import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import type { AudioSource } from "expo-audio";
import { fetch as nativeFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import { inspectModelWave } from "@packages/learning-core";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { useStudy } from "../../data/StudyProvider";
import { readContentBytes } from "../../data/contentBytes";

type Status = "idle" | "preparing" | "ready" | "unavailable";
type AudioState = {
  key: string;
  sha256?: string;
  source: AudioSource | null;
  error: string;
};
const unavailable =
  "This voice reply is unavailable. You can keep reading or continue by typing.";

/** Requests only on prepare(); a subscription never starts model inference. */
export function useConversationAudio(
  conversationId: Id<"conversations"> | undefined,
  messageId?: string,
): {
  source: AudioSource | null;
  status: Status;
  error: string;
  prepare: () => Promise<void>;
} {
  const { accountId } = useStudy(),
    token = useAuthToken(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const online =
    auth.isAuthenticated && connection.isWebSocketConnected && Boolean(token);
  const key =
    conversationId && messageId && auth.isAuthenticated
      ? JSON.stringify([
          process.env.EXPO_PUBLIC_CONVEX_URL,
          accountId,
          conversationId,
          messageId,
        ])
      : "";
  const currentKey = useRef(key),
    mounted = useRef(false),
    inFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  // Invalidate old work during render, before its effect cleanup can run.
  currentKey.current = key;
  const row = useQuery(
    api.readback.conversation,
    online && conversationId && messageId
      ? { conversationId, messageId }
      : "skip",
  );
  const request = useMutation(api.readback.requestConversation);
  const [audio, setAudio] = useState<AudioState>({
      key: "",
      source: null,
      error: "",
    }),
    [requested, setRequested] = useState({ key: "", at: 0, busy: false }),
    [requestError, setRequestError] = useState({ key: "", text: "" }),
    [retry, setRetry] = useState(0),
    [now, setNow] = useState(Date.now());
  // The server includes the source identity; never attach another reply's
  // metadata while switching a chat, message, or signed-in account.
  const ownedRow =
    row && row.conversationId === conversationId && row.messageId === messageId
      ? row
      : undefined;
  const ready = ownedRow?.status === "ready" ? ownedRow : undefined;
  const hash = ready?.sha256,
    bytes = ready?.bytes,
    durationMillis = ready?.durationMillis,
    assetId = ready?.id;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!key || !online || !ready) return;
    let active = true;
    const controller = new AbortController(),
      current = () =>
        active && !controller.signal.aborted && currentKey.current === key;
    setAudio({ key, sha256: hash, source: null, error: "" });
    void (async () => {
      if (
        !hash ||
        !/^[a-f0-9]{64}$/u.test(hash) ||
        !assetId ||
        !Number.isSafeInteger(bytes) ||
        !bytes ||
        bytes < 44 ||
        bytes > 2_000_000 ||
        !Number.isSafeInteger(durationMillis) ||
        !durationMillis ||
        durationMillis < 100 ||
        durationMillis > 20_000
      )
        throw new Error("Invalid voice metadata.");
      const namespace = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${process.env.EXPO_PUBLIC_CONVEX_URL}:${accountId}`,
      );
      if (!current()) return;
      const directory = new Directory(
        Paths.cache,
        "conversation-audio",
        namespace,
      );
      directory.create({ intermediates: true, idempotent: true });
      const destination = new File(directory, `${hash}.wav`);
      const verify = async (data: Uint8Array) => {
        if (data.length !== bytes) throw new Error("Voice size changed.");
        const media = inspectModelWave(data);
        if (media.durationMillis !== durationMillis)
          throw new Error("Voice duration changed.");
        const digest = Array.from(
          new Uint8Array(
            await Crypto.digest(
              Crypto.CryptoDigestAlgorithm.SHA256,
              new Uint8Array(data),
            ),
          ),
        )
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        if (digest !== hash) throw new Error("Voice hash changed.");
      };
      if (destination.exists) {
        try {
          if (destination.size !== bytes)
            throw new Error("Voice size changed.");
          await verify(await destination.bytes());
          if (current())
            setAudio({
              key,
              sha256: hash,
              source: { uri: destination.uri },
              error: "",
            });
          return;
        } catch {
          if (!current()) return;
          // Both directory and filename derive from this account and a SHA-256.
          if (destination.exists) destination.delete();
        }
      }
      if (!current()) return;
      const site = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? "";
      if (!/^https:\/\/[a-z0-9-]+\.convex\.site$/u.test(site))
        throw new Error("Voice download configuration unavailable.");
      const deadline = setTimeout(() => controller.abort(), 30_000);
      let data: Uint8Array;
      try {
        const response = await nativeFetch(
          `${site}/speech/model?id=${encodeURIComponent(assetId)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
            redirect: "error",
          },
        );
        if (
          !response.ok ||
          !response.body ||
          response.headers.get("content-type")?.split(";")[0] !== "audio/wav" ||
          Number(response.headers.get("content-length")) !== bytes
        ) {
          await response.body?.cancel().catch(() => {});
          throw new Error("Voice download unavailable.");
        }
        data = await readContentBytes(
          response.body.getReader(),
          bytes,
          current,
        );
        await verify(data);
      } finally {
        clearTimeout(deadline);
      }
      if (!current()) return;
      const staging = new File(directory, `${Crypto.randomUUID()}.part`);
      try {
        staging.write(data);
        if (!current()) return;
        // A second consumer may have filled the same checked content cache.
        if (destination.exists) await verify(await destination.bytes());
        else staging.copy(destination);
        if (destination.size !== bytes)
          throw new Error("Voice cache incomplete.");
        if (current())
          setAudio({
            key,
            sha256: hash,
            source: { uri: destination.uri },
            error: "",
          });
      } finally {
        if (staging.exists) staging.delete();
      }
    })().catch(() => {
      if (active && currentKey.current === key)
        setAudio({ key, sha256: hash, source: null, error: unavailable });
    });
    return () => {
      active = false;
      controller.abort();
    };
    // Status-only subscription updates must not restart a checked download.
    // Token refresh is read by the next request; account/auth changes reset key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, accountId, online, hash, bytes, durationMillis, assetId, retry]);

  const ticking = Boolean(
    key &&
    (ownedRow?.status === "queued" ||
      ownedRow?.status === "running" ||
      (requested.key === key && !ownedRow)),
  );
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [ticking]);

  const prepare = useCallback(async () => {
    if (!mounted.current || currentKey.current !== key) return;
    if (!key || !conversationId || !messageId || !online) {
      if (key)
        setRequestError({
          key,
          text: "Connect to hear the tutor's voice reply.",
        });
      return;
    }
    if (inFlight.current?.key === key) return inFlight.current.promise;
    setRequestError({ key, text: "" });
    setAudio((previous) =>
      previous.key === key ? { ...previous, error: "" } : previous,
    );
    if (ready) {
      setRetry((value) => value + 1);
      return;
    }
    const current = () => mounted.current && currentKey.current === key;
    setRequested({ key, at: Date.now(), busy: true });
    const promise = Promise.resolve().then(async () => {
      try {
        if (!current()) return;
        const result = await request({ conversationId, messageId });
        if (
          current() &&
          (result.status === "unavailable" || result.status === "deleted")
        )
          setRequestError({ key, text: unavailable });
      } catch {
        if (current()) setRequestError({ key, text: unavailable });
      } finally {
        if (current()) setRequested((value) => ({ ...value, busy: false }));
        if (inFlight.current?.promise === promise) inFlight.current = null;
      }
    });
    inFlight.current = { key, promise };
    return promise;
  }, [key, conversationId, messageId, online, ready, request]);

  const source =
    key && audio.key === key && hash === audio.sha256 && ready
      ? audio.source
      : null;
  const pending =
    ownedRow?.status === "queued" || ownedRow?.status === "running";
  const expired =
    ownedRow?.status === "queued"
      ? now - ownedRow.updatedAt > 180_000
      : ownedRow?.status === "running"
        ? (ownedRow.leaseUntil ?? 0) < now
        : requested.key === key &&
          !requested.busy &&
          now - requested.at > 180_000;
  const error = source
    ? ""
    : (key && requestError.key === key ? requestError.text : "") ||
      (key && audio.key === key && audio.sha256 === hash ? audio.error : "") ||
      (key && !online ? "Connect to hear the tutor's voice reply." : "") ||
      (key &&
      (expired ||
        ownedRow?.status === "unavailable" ||
        ownedRow?.status === "deleted")
        ? unavailable
        : "");
  const status: Status = !key
    ? "idle"
    : source
      ? "ready"
      : error
        ? "unavailable"
        : ready || pending || requested.key === key
          ? "preparing"
          : "idle";
  return { source, status, error, prepare };
}
