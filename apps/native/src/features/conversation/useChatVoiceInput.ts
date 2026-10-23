import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { usableVoiceTranscript } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { useSpeech } from "../speech/SpeechProvider";
import { useAudioTime } from "../speech/useAudioTime";

export type ChatVoiceInputStatus =
  | "idle"
  | "starting"
  | "recording"
  | "transcribing"
  | "ready"
  | "error";
type Preview = {
  status: ChatVoiceInputStatus;
  transcript: string;
  recordingId: string;
  error: string;
};
const empty: Preview = {
  status: "idle",
  transcript: "",
  recordingId: "",
  error: "",
};
const cancelled = new Error("CHAT_VOICE_CANCELLED");

/** A foreground dictation preview. Only the caller's explicit Send sends chat. */
export function useChatVoiceInput({
  segmentId,
  enabled,
}: {
  segmentId?: string;
  enabled: boolean;
}) {
  const speech = useSpeech(),
    { accountId } = useStudy(),
    focused = useIsFocused();
  const identity = `${accountId}:${segmentId ?? ""}`;
  const [preview, setPreview] = useState<Preview>(empty);
  const [usingTranscript, setUsingTranscript] = useState(false);
  const runtime = useRef({
    epoch: 0,
    mounted: true,
    capturing: false,
    phase: "idle" as ChatVoiceInputStatus,
    id: "",
    identity,
    using: false,
    requestingRecognition: false,
    permissionInterrupted: false,
    stopOwned: null as (() => Promise<void>) | null,
    maximumDuration: 0,
    promise: Promise.resolve(),
  });
  const latest = useRef({ speech, identity, segmentId, enabled, focused });
  latest.current = { speech, identity, segmentId, enabled, focused };
  if (preview.status === "recording")
    runtime.current.maximumDuration = Math.max(
      runtime.current.maximumDuration,
      speech.durationMillis,
    );
  // Metered recording effort is separate from transcript correctness. Missing
  // microphone levels never count as evidence of speaking or pronunciation.
  useAudioTime(
    segmentId ?? "unavailable-chat",
    "speaking",
    preview.status === "recording" &&
      runtime.current.identity === identity &&
      enabled &&
      focused &&
      speech.recording &&
      Number.isFinite(speech.metering) &&
      speech.metering! >= -40,
    true,
  );
  const update = useCallback((change: Partial<Preview>) => {
    const state = runtime.current;
    if (!state.mounted) return;
    if (change.status) state.phase = change.status;
    setPreview((previous) => ({ ...previous, ...change }));
  }, []);
  const cancel = useCallback(() => {
    const state = runtime.current;
    state.epoch++;
    const wasCapturing = state.capturing;
    const stopOwned = state.stopOwned;
    state.capturing = false;
    state.stopOwned = null;
    state.id = "";
    state.maximumDuration = 0;
    state.phase = "idle";
    state.using = false;
    state.requestingRecognition = false;
    state.permissionInterrupted = false;
    // stop also invalidates a provider start waiting for Android permission.
    // Never stop a recorder belonging to another screen when we own none.
    if (wasCapturing && stopOwned) {
      const previous = state.promise;
      const stopping = stopOwned().catch(() => {});
      state.promise = Promise.allSettled([previous, stopping]).then(() => {});
    }
    if (state.mounted) {
      setPreview(empty);
      setUsingTranscript(false);
    }
  }, []);
  useEffect(() => {
    const state = runtime.current;
    state.mounted = true;
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        const interrupted =
          state.phase === "starting" || state.permissionInterrupted;
        cancel();
        if (interrupted) {
          // Android's first permission activity may background the app. Fence
          // that request, then explain the explicit tap needed after returning.
          state.permissionInterrupted = true;
          update({
            status: "error",
            error: "Microphone access changed. Tap Record again when ready.",
          });
        }
      }
    });
    return () => {
      state.mounted = false;
      listener.remove();
      cancel();
    };
  }, [cancel, update]);
  useEffect(() => {
    if (runtime.current.identity !== identity || !focused || !enabled) {
      cancel();
      runtime.current.identity = identity;
    }
  }, [identity, focused, enabled, cancel]);

  const current = useCallback((epoch: number, owner: string) => {
    const live = latest.current,
      state = runtime.current;
    return (
      state.mounted &&
      state.epoch === epoch &&
      live.identity === owner &&
      live.enabled &&
      live.focused &&
      AppState.currentState === "active"
    );
  }, []);
  const fail = useCallback(
    (message: string) => update({ status: "error", error: message }),
    [update],
  );
  const start = useCallback(async () => {
    const state = runtime.current,
      live = latest.current;
    if (["starting", "recording", "transcribing"].includes(state.phase)) return;
    if (
      !live.enabled ||
      !live.focused ||
      !live.segmentId ||
      AppState.currentState !== "active"
    )
      return;
    if (live.speech.loading || live.speech.recording) {
      fail("The microphone is busy. Try again in a moment or type instead.");
      return;
    }
    const epoch = ++state.epoch,
      owner = live.identity,
      previous = state.promise;
    state.id = "";
    state.permissionInterrupted = false;
    state.maximumDuration = 0;
    state.identity = owner;
    update({ ...empty, status: "starting" });
    state.promise = (async () => {
      await previous;
      if (!current(epoch, owner)) return;
      state.capturing = true;
      const capture = latest.current.speech;
      state.stopOwned = capture.stop;
      const id = await capture.start(
        live.segmentId!,
        "chat-answer",
        live.segmentId,
      );
      if (!current(epoch, owner)) {
        // A newer start waits for this operation before acquiring the recorder.
        if (id) await capture.stop();
        return;
      }
      if (!id) {
        state.capturing = false;
        state.stopOwned = null;
        fail(
          latest.current.speech.permissionDenied
            ? "Microphone access is off. Enable it in Settings or type instead."
            : "Recording couldn't start. Try again or type instead.",
        );
        return;
      }
      state.id = id;
      update({ status: "recording", recordingId: id });
    })().catch(() => {
      if (current(epoch, owner)) {
        state.capturing = false;
        void state.stopOwned?.().catch(() => {});
        state.stopOwned = null;
        fail("Recording couldn't start. Try again or type instead.");
      }
    });
    await state.promise;
  }, [current, fail, update]);

  const transcribe = useCallback(
    async (stopRecording: boolean) => {
      const state = runtime.current,
        owner = latest.current.identity,
        epoch = state.epoch,
        id = state.id;
      if (
        !id ||
        !current(epoch, owner) ||
        state.phase === "transcribing" ||
        (stopRecording && state.phase !== "recording")
      )
        return;
      const existing = latest.current.speech.recordings.find(
        (record) => record.id === id,
      );
      if (
        !stopRecording &&
        existing &&
        (["ready", "empty", "deleted"].includes(existing.recognitionStatus) ||
          (existing.recognitionStatus === "unavailable" &&
            (existing.attempt ?? 0) >= 3))
      )
        return;
      state.requestingRecognition = true;
      update({ status: "transcribing", error: "", transcript: "" });
      const check = () => {
        if (!current(epoch, owner)) throw cancelled;
      };
      const waitForRecording = async () => {
        for (let attempt = 0; attempt < 50; attempt++) {
          check();
          const record = latest.current.speech.recordings.find(
            (item) => item.id === id,
          );
          if (record) return record;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(
          "The recording couldn't be saved. Record again or type instead.",
        );
      };
      const previous = state.promise;
      const work = (async () => {
        await previous;
        check();
        try {
          if (stopRecording) {
            await (state.stopOwned ?? latest.current.speech.stop)();
            state.capturing = false;
            check();
            state.stopOwned = null;
          }
          await waitForRecording();
          check();
          if (!latest.current.speech.online)
            throw new Error(
              "You're offline. Reconnect to get a transcript, or type instead.",
            );
          await latest.current.speech.recognize(id);
          check();
          state.requestingRecognition = false;
          update({ status: "transcribing" });
        } catch (error) {
          if (error !== cancelled && current(epoch, owner)) {
            state.requestingRecognition = false;
            fail(
              error instanceof Error
                ? error.message
                : "Transcription is unavailable. Retry or type instead.",
            );
          }
        }
      })().catch((error) => {
        if (error !== cancelled && current(epoch, owner))
          fail("Transcription is unavailable. Retry or type instead.");
      });
      state.promise = work;
      await work;
    },
    [current, fail, update],
  );
  useEffect(() => {
    if (
      preview.status !== "transcribing" ||
      runtime.current.phase !== "transcribing" ||
      runtime.current.requestingRecognition ||
      !preview.recordingId ||
      !current(runtime.current.epoch, runtime.current.identity)
    )
      return;
    const record = speech.recordings.find(
      (item) => item.id === preview.recordingId,
    );
    if (!record) return;
    if (["ready", "empty"].includes(record.recognitionStatus)) {
      const transcript = usableVoiceTranscript(record.recognizedTranscript);
      if (transcript) update({ status: "ready", transcript, error: "" });
      else fail("We couldn't hear clear words. Record again or type instead.");
    } else if (["unavailable", "deleted"].includes(record.recognitionStatus))
      fail("Transcription is unavailable. Retry or type instead.");
    else if (!speech.online)
      fail("You're offline. Reconnect to get a transcript, or type instead.");
  }, [
    preview.status,
    preview.recordingId,
    speech.recordings,
    speech.online,
    current,
    fail,
    update,
  ]);
  useEffect(() => {
    if (
      preview.status === "recording" &&
      !speech.recording &&
      speech.recordings.some((record) => record.id === preview.recordingId) &&
      current(runtime.current.epoch, runtime.current.identity)
    ) {
      runtime.current.capturing = false;
      runtime.current.stopOwned = null;
      fail("Recording stopped. Get a transcript or record again.");
    }
  }, [
    preview.status,
    preview.recordingId,
    speech.recording,
    speech.recordings,
    current,
    fail,
  ]);
  useEffect(() => {
    if (preview.status !== "transcribing") return;
    const { epoch, identity: owner } = runtime.current;
    const timeout = setTimeout(() => {
      if (current(epoch, owner))
        fail(
          "Transcription is taking longer than expected. Retry or type instead.",
        );
    }, 100_000);
    return () => clearTimeout(timeout);
  }, [preview.status, current, fail]);

  const useTranscript = useCallback(
    async (editedText?: string) => {
      const state = runtime.current,
        epoch = state.epoch,
        owner = latest.current.identity,
        id = state.id;
      if (
        state.phase !== "ready" ||
        state.using ||
        !id ||
        !current(epoch, owner)
      )
        return;
      const text = usableVoiceTranscript(editedText ?? preview.transcript);
      if (!text) return;
      state.using = true;
      setUsingTranscript(true);
      try {
        if (text !== preview.transcript) {
          await latest.current.speech.edit(id, text);
          if (!current(epoch, owner)) return;
        }
        await latest.current.speech.confirm(id, text);
        if (!current(epoch, owner)) return;
        return text;
      } catch {
        if (current(epoch, owner))
          update({
            error:
              "The transcript couldn't be kept. Try again or type instead.",
          });
        return;
      } finally {
        if (current(epoch, owner)) {
          state.using = false;
          setUsingTranscript(false);
        }
      }
    },
    [current, preview.transcript, update],
  );
  const record = speech.recordings.find(
    (item) => item.id === preview.recordingId,
  );
  return {
    ...preview,
    usingTranscript,
    durationMillis:
      preview.status === "recording" ? runtime.current.maximumDuration : 0,
    record,
    permissionDenied: speech.permissionDenied,
    online: speech.online,
    canRetry: Boolean(
      record &&
      preview.status === "error" &&
      speech.online &&
      !["ready", "empty", "deleted"].includes(record.recognitionStatus) &&
      (record.recognitionStatus !== "unavailable" || (record.attempt ?? 0) < 3),
    ),
    start,
    stop: () => transcribe(true),
    retry: () => transcribe(false),
    cancel,
    useTranscript,
    isCurrentRecording: (id: string) =>
      Boolean(
        id &&
        runtime.current.id === id &&
        runtime.current.phase === "ready" &&
        current(runtime.current.epoch, runtime.current.identity),
      ),
  };
}
