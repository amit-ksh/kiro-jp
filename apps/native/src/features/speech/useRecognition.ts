import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { fetch as nativeFetch } from "expo/fetch";
import { File } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { api } from "@packages/backend/convex/_generated/api";
import { inspectRecording } from "@packages/learning-core";
import type { LocalRecording } from "./SpeechProvider";

type Options = {
  dbRef: RefObject<SQLiteDatabase | null>;
  recordings: LocalRecording[];
  refresh: (db: SQLiteDatabase) => Promise<void>;
  loading: boolean;
};
export function useRecognition({
  dbRef,
  recordings,
  refresh,
  loading,
}: Options) {
  const token = useAuthToken(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const online =
    auth.isAuthenticated && connection.isWebSocketConnected && Boolean(token);
  const remote = useQuery(api.speech.list, online && !loading ? {} : "skip");
  const prepare = useMutation(api.speech.prepare),
    confirmRemote = useMutation(api.speech.confirm),
    removeRemote = useMutation(api.speech.remove);
  const serial = useRef(Promise.resolve()),
    busy = useRef(new Set<string>()),
    housekeeping = useRef(false);
  const enqueue = useCallback((work: () => Promise<void>) => {
    const next = serial.current.then(work);
    serial.current = next.catch(() => {});
    return next;
  }, []);
  const drain = useCallback(() => serial.current, []);
  const update = useCallback(
    async (id: string, change: (record: LocalRecording) => LocalRecording) => {
      const db = dbRef.current;
      if (!db) throw new Error("Recording storage unavailable.");
      await enqueue(async () => {
        if (dbRef.current !== db) return;
        const row = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM study_metadata WHERE key=?",
          `recording:${id}`,
        );
        if (!row) return;
        await db.runAsync(
          "UPDATE study_metadata SET value=? WHERE key=?",
          JSON.stringify(change(JSON.parse(row.value) as LocalRecording)),
          `recording:${id}`,
        );
        await refresh(db);
      });
    },
    [dbRef, enqueue, refresh],
  );
  useEffect(() => {
    if (!remote) return;
    for (const row of remote)
      void update(row.recordingId, (local) => {
        if ((local.remoteUpdatedAt ?? 0) >= row.updatedAt) return local;
        return {
          ...local,
          recognitionStatus:
            row.status === "awaitingUpload" ? "pending" : row.status,
          recognitionRequested:
            ["awaitingUpload", "uploading", "queued", "running"].includes(
              row.status,
            ) && local.recognitionRequested,
          attempt: row.attempt,
          remoteUpdatedAt: row.updatedAt,
          recognizedTranscript: row.recognizedTranscript,
          ...(local.confirmationPending
            ? {}
            : {
                learnerConfirmedText: row.learnerConfirmedText,
                wasEdited: row.wasEdited,
              }),
        };
      }).catch(() => {});
  }, [remote, update]);
  const recognize = useCallback(
    (id: string) =>
      update(id, (record) => ({
        ...record,
        recognitionRequested: true,
        recognitionStatus: "pending",
      })),
    [update],
  );
  const edit = useCallback(
    (id: string, text: string) =>
      update(id, (record) => ({
        ...record,
        transcriptDraft: text.slice(0, 1000),
      })),
    [update],
  );
  const confirm = useCallback(
    (id: string, text: string) => {
      const clean = text.trim();
      if (!clean || clean.length > 1000)
        return Promise.reject(new Error("Check the text before confirming."));
      return update(id, (record) => ({
        ...record,
        learnerConfirmedText: clean,
        wasEdited: clean !== (record.recognizedTranscript ?? "").trim(),
        confirmationPending: true,
      }));
    },
    [update],
  );
  useEffect(() => {
    if (!online || loading) return;
    for (const record of recordings) {
      if (busy.current.has(record.id)) continue;
      if (
        record.confirmationPending &&
        record.learnerConfirmedText &&
        ["ready", "empty"].includes(record.recognitionStatus)
      ) {
        busy.current.add(record.id);
        void confirmRemote({
          recordingId: record.id,
          text: record.learnerConfirmedText,
        })
          .then(() =>
            update(record.id, (current) =>
              current.learnerConfirmedText === record.learnerConfirmedText
                ? { ...current, confirmationPending: false }
                : current,
            ),
          )
          .catch(() => {})
          .finally(() => busy.current.delete(record.id));
        continue;
      }
      if (
        !record.recognitionRequested ||
        record.recognitionStatus !== "pending"
      )
        continue;
      busy.current.add(record.id);
      const db = dbRef.current;
      void (async () => {
        const file = new File(record.uri),
          bytes = await file.bytes(),
          media = inspectRecording(bytes);
        const hash = new Uint8Array(
          await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes),
        );
        const sha256 = Array.from(hash)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        if (dbRef.current !== db) return;
        const source = {
          ...(record.conversationSegmentId
            ? { conversationSegmentId: record.conversationSegmentId }
            : { lessonSessionId: record.sessionId }),
          cueId: record.cueId,
        };
        const job = await prepare({
          recordingId: record.id,
          source,
          sha256,
          bytes: bytes.length,
        });
        if (dbRef.current !== db) return;
        if (job.status === "awaitingUpload") {
          const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
          if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/u.test(site))
            throw new Error("Upload configuration unavailable.");
          await update(record.id, (current) => ({
            ...current,
            recognitionStatus: "uploading",
            durationMillis: media.durationMillis,
            bytes: bytes.length,
            attempt: job.attempt,
          }));
          const controller = new AbortController(),
            timeout = setTimeout(() => controller.abort(), 40_000);
          try {
            const response = await nativeFetch(
              `${site}/speech/upload?id=${job.id}&attempt=${job.attempt}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "audio/mp4",
                },
                // Expo's Blob path overrides Content-Type with Android's file
                // extension guess. These already-validated bounded bytes keep
                // the explicit audio/mp4 contract and exact hash unchanged.
                body: bytes,
                signal: controller.signal,
              },
            );
            if (!response.ok && response.status !== 409)
              throw new Error("Upload unavailable.");
          } finally {
            clearTimeout(timeout);
          }
          await update(record.id, (current) =>
            ["pending", "uploading"].includes(current.recognitionStatus)
              ? { ...current, recognitionStatus: "queued" }
              : current,
          );
        } else {
          const status = job.status;
          await update(record.id, (current) => ({
            ...current,
            recognitionStatus: status,
            attempt: job.attempt,
            recognizedTranscript: job.recognizedTranscript,
            recognitionRequested: false,
          }));
        }
      })()
        .catch(() =>
          update(record.id, (current) =>
            ["ready", "empty", "deleted"].includes(current.recognitionStatus)
              ? current
              : {
                  ...current,
                  recognitionStatus: "unavailable",
                  recognitionRequested: false,
                },
          ).catch(() => {}),
        )
        .finally(() => busy.current.delete(record.id));
    }
    if (!housekeeping.current) {
      housekeeping.current = true;
      const db = dbRef.current;
      void (async () => {
        const deletions = await db?.getAllAsync<{ key: string }>(
          "SELECT key FROM study_metadata WHERE key LIKE 'recording-delete:%'",
        );
        for (const row of deletions ?? []) {
          if (dbRef.current !== db) return;
          await removeRemote({
            recordingId: row.key.slice("recording-delete:".length),
          });
          if (dbRef.current === db)
            await db!.runAsync(
              "DELETE FROM study_metadata WHERE key=?",
              row.key,
            );
        }
      })()
        .catch(() => {})
        .finally(() => {
          housekeeping.current = false;
        });
    }
  }, [
    online,
    recordings,
    prepare,
    token,
    update,
    confirmRemote,
    removeRemote,
    dbRef,
    loading,
  ]);
  return { recognize, edit, confirm, drain, online };
}
