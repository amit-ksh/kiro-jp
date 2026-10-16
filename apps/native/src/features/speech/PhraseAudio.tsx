import { useEffect, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { fetch as nativeFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { inspectModelWave } from "@packages/learning-core";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { useStudy } from "../../data/StudyProvider";
import { openAccountDatabase } from "../../data/database";
import { AudioPlay } from "./AudioPlay";
import { Body, Button } from "../../components/ui";
type Cache = { uri: string; sha256: string; bytes: number };
export function PhraseAudio({
  phraseId,
  practiceId,
  conversation = false,
}: {
  phraseId: Id<"savedPhrases">;
  practiceId: string;
  conversation?: boolean;
}) {
  const { accountId } = useStudy(),
    token = useAuthToken(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const online =
    auth.isAuthenticated && connection.isWebSocketConnected && Boolean(token);
  const rows = useQuery(api.readback.list, online ? {} : "skip"),
    request = useMutation(api.readback.request);
  const row = rows?.find(
    (item) => item.phraseId === phraseId && item.voiceVersion === "kore-v1",
  );
  const [cache, setCache] = useState<Cache | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0),
    [now, setNow] = useState(Date.now());
  const ready = row?.status === "ready" ? row : undefined;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setCache(null);
    setError("");
    void (async () => {
      const namespace = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${process.env.EXPO_PUBLIC_CONVEX_URL}:${accountId}`,
      );
      const directory = new Directory(
        Paths.document,
        "phrase-audio",
        namespace,
      );
      const db = await openAccountDatabase(accountId);
      const key = `phrase-audio:${phraseId}:kore-v1`;
      try {
        if (!active) return;
        directory.create({ intermediates: true, idempotent: true });
        const saved = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM study_metadata WHERE key=?",
          key,
        );
        const metadata: Cache | null = saved ? JSON.parse(saved.value) : null;
        const verify = async (file: File, expected: string) => {
          const bytes = await file.bytes();
          inspectModelWave(bytes);
          const digest = Array.from(
            new Uint8Array(
              await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes),
            ),
          )
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          if (digest !== expected) throw new Error("Audio hash changed.");
          return bytes;
        };
        if (
          metadata &&
          /^[a-f0-9]{64}$/.test(metadata.sha256) &&
          (!ready || ready.sha256 === metadata.sha256)
        ) {
          const file = new File(directory, `${metadata.sha256}.wav`);
          if (file.exists) {
            try {
              await verify(file, metadata.sha256);
              if (active) setCache({ ...metadata, uri: file.uri });
              return;
            } catch {
              // This path is derived from the owned partition and a SHA-256,
              // never a path supplied by a remote reference.
              file.delete();
              await db.runAsync("DELETE FROM study_metadata WHERE key=?", key);
            }
          }
        }
        if (!ready?.sha256 || !online) return;
        const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
        if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/u.test(site))
          throw new Error("Audio unavailable.");
        const timeout = setTimeout(() => controller.abort(), 30000);
        let bytes: Uint8Array;
        try {
          const response = await nativeFetch(
            `${site}/speech/model?id=${ready.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            },
          );
          if (
            !response.ok ||
            Number(response.headers.get("content-length")) !== ready.bytes ||
            !ready.bytes ||
            ready.bytes > 2 * 1024 * 1024
          )
            throw new Error("Audio unavailable.");
          bytes = new Uint8Array(await response.arrayBuffer());
        } finally {
          clearTimeout(timeout);
        }
        if (
          !active ||
          readyRef.current?.sha256 !== ready.sha256 ||
          bytes.length !== ready.bytes
        )
          return;
        const file = new File(directory, `${ready.sha256}.wav`),
          staging = new File(directory, `${ready.id}.part`);
        try {
          staging.write(bytes);
          await verify(staging, ready.sha256);
          if (!active) return;
          staging.copy(file);
          const next: Cache = {
            uri: file.uri,
            sha256: ready.sha256,
            bytes: bytes.length,
          };
          await db.runAsync(
            "INSERT INTO study_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            key,
            JSON.stringify(next),
          );
          if (active) setCache(next);
        } finally {
          if (staging.exists) staging.delete();
        }
      } finally {
        await db.closeAsync();
      }
    })().catch(() => {
      if (active)
        setError(
          "Audio couldn't be prepared on this phone. Keep the text reference or try again.",
        );
    });
    return () => {
      active = false;
      controller.abort();
    };
    // All metadata belongs to a fixed account/phrase/ready hash. Status-only
    // subscription updates must not interrupt a verified download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, phraseId, ready?.sha256, online, retry]);
  useEffect(() => {
    if (row?.status !== "queued" && row?.status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [row?.status]);
  if (cache)
    return (
      <>
        <AudioPlay
          source={{ uri: cache.uri }}
          sessionId={practiceId}
          conversation={conversation}
          reference={!conversation}
          label="saved phrase"
        />
        <Body muted>Checked model audio saved for offline practice.</Body>
      </>
    );
  const pending = row?.status === "queued" || row?.status === "running";
  const expired =
    row?.status === "queued"
      ? now - row.updatedAt > 180000
      : row?.status === "running" && (row.leaseUntil ?? 0) < now;
  return (
    <>
      <Body muted>
        {error ||
          (pending
            ? "Model audio is being prepared and checked. You can keep studying."
            : "Prepare checked model audio for this saved phrase.")}
      </Body>
      {(!pending || expired) && (
        <Button
          label={
            ready || error
              ? "Retry audio download"
              : row?.status === "unavailable"
                ? "Retry model audio"
                : "Prepare model audio"
          }
          secondary
          busy={busy}
          disabled={!online || (!ready && (row?.attempt ?? 0) >= 2)}
          onPress={() => {
            setBusy(true);
            setError("");
            void (ready ? Promise.resolve() : request({ phraseId }))
              .then(() => setRetry((value) => value + 1))
              .catch(() =>
                setError(
                  "Model audio is unavailable. Your text reference is still saved.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      )}
      {!online && (
        <Body muted>
          Connect to prepare new audio; previously saved audio stays available.
        </Body>
      )}
    </>
  );
}
