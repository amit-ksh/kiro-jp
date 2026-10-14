import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useConvex,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { fetch as nativeFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { api } from "@packages/backend/convex/_generated/api";
import { checkedContentManifests } from "@packages/content";
import {
  verifyContentManifest,
  type ContentManifest,
  type ContentAsset,
} from "@packages/learning-core";
import { openAccountDatabase } from "./database";
import { useStudy } from "./StudyProvider";
import { installContent } from "./installContent";
import { cachePreparedModelAudio } from "../features/speech/lesson-audio";

interface ReadyPackage {
  manifest: ContentManifest;
  directory: string;
  preparedAt: number;
}
interface State {
  loading: boolean;
  ready: ReadyPackage | null;
  busy: boolean;
  online: boolean;
  error: string;
  progress: number;
  total: number;
  prepare: () => Promise<void>;
  cancel: () => void;
}
const Context = createContext<State | null>(null);
const digest = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const bytesHash = async (file: File) =>
  Array.from(
    new Uint8Array(
      await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        await file.bytes(),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const fileName = (asset: ContentAsset) =>
  `${asset.id}.${asset.kind === "lesson" ? "json" : "wav"}`;
export function ContentProvider({ children }: { children: ReactNode }) {
  const { accountId } = useStudy(),
    convex = useConvex(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const online = auth.isAuthenticated && connection.isWebSocketConnected;
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState<ReadyPackage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0);
  const epoch = useRef(0),
    dbRef = useRef<SQLiteDatabase | null>(null),
    rootRef = useRef<Directory | null>(null),
    job = useRef<Promise<void> | null>(null),
    abort = useRef<AbortController | null>(null);
  const expected = checkedContentManifests[0]!,
    key = `content-ready:${expected.lessonId}:${expected.version}`;
  useEffect(() => {
    const generation = ++epoch.current;
    let owned: SQLiteDatabase | null = null,
      closed = false;
    setLoading(true);
    setReady(null);
    setError("");
    const closeOwned = async () => {
      if (owned && !closed) {
        closed = true;
        await owned.closeAsync();
      }
    };
    const current = () => epoch.current === generation;
    void (async () => {
      const namespace = await digest(
          `${process.env.EXPO_PUBLIC_CONVEX_URL}:${accountId}`,
        ),
        root = new Directory(Paths.document, "content-packages", namespace);
      root.create({ intermediates: true, idempotent: true });
      const db = await openAccountDatabase(accountId);
      owned = db;
      if (!current()) return;
      dbRef.current = db;
      rootRef.current = root;
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM study_metadata WHERE key=?",
        key,
      );
      if (row) {
        const saved = JSON.parse(row.value) as ReadyPackage;
        await verifyContentManifest(saved.manifest, digest);
        if (
          saved.manifest.sha256 !== expected.sha256 ||
          !saved.directory.startsWith(root.uri.replace(/\/$/, "") + "/") ||
          !/^ready-[a-f0-9-]+\/?$/.test(
            saved.directory.slice(root.uri.replace(/\/$/, "").length + 1),
          )
        )
          throw new Error("Prepared package version is unavailable.");
        const directory = new Directory(saved.directory);
        for (const asset of saved.manifest.assets) {
          const file = new File(directory, fileName(asset));
          if (
            !file.exists ||
            file.size !== asset.bytes ||
            (await bytesHash(file)) !== asset.sha256
          )
            throw new Error("A saved content file needs repair.");
          if (asset.kind === "audio")
            await cachePreparedModelAudio(asset.id, file.uri);
          if (!current()) return;
        }
        if (current()) setReady(saved);
      }
      // Interrupted staging folders never become ready. Account folders are independent.
      for (const item of root.list())
        if (
          item instanceof Directory &&
          /\/stage-[a-f0-9-]+\/?$/.test(item.uri)
        )
          item.delete();
    })()
      .catch(() => {
        if (current())
          setError(
            "The offline package could not be verified. Prepared text and saved answers remain available; connect and prepare the audio again.",
          );
      })
      .finally(() => {
        if (current()) setLoading(false);
        else void closeOwned().catch(() => {});
      });
    return () => {
      epoch.current = generation + 1;
      abort.current?.abort();
      const db = owned;
      if (db)
        void (job.current ?? Promise.resolve())
          .finally(async () => {
            if (dbRef.current === db) dbRef.current = null;
            await closeOwned();
          })
          .catch(() => {});
    };
  }, [accountId, expected.sha256, key]);
  const prepare = async () => {
    if (job.current || loading || !online) return;
    const db = dbRef.current,
      root = rootRef.current,
      generation = epoch.current;
    if (!db || !root) {
      setError("Offline storage is not ready. Reopen the app and try again.");
      return;
    }
    const controller = new AbortController();
    abort.current = controller;
    const current = () =>
      generation === epoch.current && !controller.signal.aborted;
    const stage = new Directory(root, `stage-${Crypto.randomUUID()}`),
      destination = new Directory(root, `ready-${Crypto.randomUUID()}`);
    let activated = false;
    setBusy(true);
    setError("");
    setProgress(0);
    const work = (async () => {
      const queryDeadline = setTimeout(() => controller.abort(), 30000);
      let rejectQuery: () => void = () => {};
      const cancelled = new Promise<never>((_resolve, reject) => {
        rejectQuery = () => reject(new Error("Preparation cancelled."));
        controller.signal.addEventListener("abort", rejectQuery, {
          once: true,
        });
      });
      const remote = await Promise.race([
        convex.query(api.content.getPackage, {
          lessonId: expected.lessonId,
          version: expected.version,
        }),
        cancelled,
      ]).finally(() => {
        clearTimeout(queryDeadline);
        controller.signal.removeEventListener("abort", rejectQuery);
      });
      if (!remote || remote.manifest.sha256 !== expected.sha256)
        throw new Error(
          "This checked package is not available yet. Keep studying the prepared text and try again later.",
        );
      await installContent(
        remote.manifest,
        {
          digest,
          freeBytes: () => Paths.availableDiskSpace,
          current,
          createStage: async () => stage.create(),
          fetchAsset: async (asset) => {
            const source = remote.files.find(
              (f) => f.assetId === asset.id,
            )?.url;
            const parsed = source ? new URL(source) : null,
              origin = new URL(process.env.EXPO_PUBLIC_CONVEX_URL!).origin;
            if (
              !parsed ||
              parsed.origin !== origin ||
              !parsed.pathname.startsWith("/api/storage/")
            )
              throw new Error("Checked content download is unavailable.");
            const timeout = setTimeout(() => controller.abort(), 30000);
            try {
              const response = await nativeFetch(parsed.href, {
                signal: controller.signal,
                redirect: "error",
              });
              if (
                !response.ok ||
                !response.body ||
                response.headers.get("content-type")?.split(";")[0] !==
                  asset.mime ||
                Number(response.headers.get("content-length") ?? 0) >
                  asset.bytes
              )
                throw new Error("Content download could not finish.");
              const reader = response.body.getReader(),
                chunks: Uint8Array[] = [];
              let bytes = 0;
              try {
                while (true) {
                  const part = await reader.read();
                  if (part.done) break;
                  bytes += part.value.length;
                  if (bytes > asset.bytes || !current())
                    throw new Error("Content download was interrupted.");
                  chunks.push(part.value);
                }
              } finally {
                await reader.cancel().catch(() => {});
              }
              if (bytes !== asset.bytes)
                throw new Error("Content download is incomplete.");
              const data = new Uint8Array(bytes);
              let offset = 0;
              for (const chunk of chunks) {
                data.set(chunk, offset);
                offset += chunk.length;
              }
              new File(stage, fileName(asset)).write(data);
            } finally {
              clearTimeout(timeout);
            }
          },
          verifyAsset: async (asset) => {
            const file = new File(stage, fileName(asset));
            if (
              file.size !== asset.bytes ||
              (await bytesHash(file)) !== asset.sha256
            )
              throw new Error("Content checksum changed. Retry the download.");
          },
          activate: async (manifest) => {
            for (const asset of manifest.assets) {
              if (!current()) throw new Error("Preparation cancelled.");
              if (asset.kind === "audio")
                await cachePreparedModelAudio(
                  asset.id,
                  new File(stage, fileName(asset)).uri,
                );
            }
            if (!current()) throw new Error("Preparation cancelled.");
            stage.move(destination);
            const saved = {
              manifest,
              directory: destination.uri,
              preparedAt: Date.now(),
            };
            if (!current()) throw new Error("Preparation cancelled.");
            await db.runAsync(
              "INSERT INTO study_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
              key,
              JSON.stringify(saved),
            );
            activated = true;
            if (current()) setReady(saved);
          },
          discardStage: async () => {
            if (stage.exists && !activated) stage.delete();
            if (destination.exists && !activated) destination.delete();
          },
        },
        (done) => {
          if (current()) setProgress(done);
        },
      );
    })()
      .catch((cause) => {
        if (generation === epoch.current) {
          const message = cause instanceof Error ? cause.message : "";
          setError(
            controller.signal.aborted
              ? "Preparation stopped. Your previously saved content and study progress are retained."
              : /^(Not enough storage\.|This checked package |Content checksum changed\.)/.test(
                    message,
                  )
                ? message
                : "The download could not finish. Your previous package and study progress stay saved. Reconnect and try again.",
          );
        }
      })
      .finally(() => {
        job.current = null;
        if (abort.current === controller) abort.current = null;
        if (generation === epoch.current) setBusy(false);
      });
    job.current = work;
    await work;
  };
  return (
    <Context.Provider
      value={{
        loading,
        ready,
        busy,
        online,
        error,
        progress,
        total: expected.assets.length,
        prepare,
        cancel: () => abort.current?.abort(),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useContent() {
  const value = useContext(Context);
  if (!value) throw new Error("Content storage is not available.");
  return value;
}
