import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import {
  initialVoiceTurn,
  sampleVoiceTurn,
  usableVoiceTranscript,
  voiceRecordingDecision,
  createVoicePlaybackLatch,
  voiceTurnContextMatches,
  type SupportFlag,
} from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { dispatchVoiceTurn } from "./voiceTurnDispatch";
import { useSpeech } from "../speech/SpeechProvider";
import { useConversationAudio } from "../speech/useConversationAudio";
import { registerPlayer, stopAudioPlayers } from "../speech/audio-focus";
import { useAudioTime } from "../speech/useAudioTime";

type ChatData = NonNullable<FunctionReturnType<typeof api.conversation.get>>;
export type CallPhase =
  | "ready"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "paused";
const cancelled = new Error("CALL_PAUSED");
const callMessages = {
  offline: "Connection lost. Reconnect, then resume or return to text chat.",
  unfocused: "Return to this call screen, then resume when you're ready.",
  background: "Keep Kiro JP open for voice practice, then tap Resume.",
  loading:
    "The microphone is getting ready. Try Resume in a moment or use text chat.",
};

export function useVoiceCall(
  conversationId: string,
  data: ChatData | undefined,
  online: boolean,
) {
  const study = useStudy(),
    speech = useSpeech(),
    focused = useIsFocused();
  const submit = useMutation(api.conversation.submit);
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const playerStatus = useAudioPlayerStatus(player);
  const [phase, setPhase] = useState<CallPhase>("ready");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [voiced, setVoiced] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioMessageId, setAudioMessageId] = useState("");
  const [running, setRunning] = useState(false);
  const audio = useConversationAudio(
    /^[a-z0-9]{20,40}$/u.test(conversationId)
      ? (conversationId as Id<"conversations">)
      : undefined,
    audioMessageId,
  );
  const runtime = useRef({
    epoch: 0,
    running: false,
    mounted: true,
    promise: Promise.resolve(),
    forceFinish: false,
    captureActive: false,
  });
  const played = useRef(new Set<string>());
  const latest = useRef({
    data,
    speech,
    study,
    online,
    focused,
    muted,
    audio,
    audioMessageId,
    playerStatus,
  });
  latest.current = {
    data,
    speech,
    study,
    online,
    focused,
    muted,
    audio,
    audioMessageId,
    playerStatus,
  };
  const segment = data?.segments.find(
    (item) => item.segmentId === data.conversation.currentSegmentId,
  );
  useAudioTime(
    segment?.segmentId ?? "unavailable-call",
    "speaking",
    voiced && speech.recording && running,
    true,
  );
  useAudioTime(
    segment?.segmentId ?? "unavailable-call",
    "listening",
    playerStatus.playing && !playerStatus.isBuffering && running,
    true,
    Math.max(0, playerStatus.duration - playerStatus.currentTime) * 1000,
  );

  const pause = useCallback(
    (message = "") => {
      const state = runtime.current;
      state.epoch++;
      state.running = false;
      state.captureActive = false;
      try {
        player.pause();
      } catch {
        /* The native player may already be released. */
      }
      void latest.current.speech.stop().catch(() => {});
      if (state.mounted) {
        setRunning(false);
        setVoiced(false);
        setPhase("paused");
        setError(message);
      }
    },
    [player],
  );
  useEffect(() => registerPlayer(player), [player]);
  useEffect(() => {
    const owner = runtime.current;
    owner.mounted = true;
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") pause(callMessages.background);
    });
    return () => {
      owner.mounted = false;
      listener.remove();
      pause();
    };
  }, [pause]);
  useEffect(() => {
    if (
      (!online || !focused || segment?.state !== "active") &&
      runtime.current.running
    )
      pause(
        !online
          ? callMessages.offline
          : !focused
            ? callMessages.unfocused
            : "This conversation has ended. Return to chat to continue it.",
      );
  }, [online, focused, segment?.state, pause]);

  const resume = useCallback(() => {
    if (runtime.current.running) return;
    const availabilityMessage = () => {
      const current = latest.current;
      if (!current.online) return callMessages.offline;
      if (!current.focused) return callMessages.unfocused;
      if (AppState.currentState !== "active") return callMessages.background;
      if (current.speech.loading) return callMessages.loading;
      return "";
    };
    const unavailable = availabilityMessage();
    if (unavailable) {
      pause(unavailable);
      return;
    }
    const owner = runtime.current;
    const epoch = ++owner.epoch;
    owner.running = true;
    owner.forceFinish = false;
    setRunning(true);
    setError("");
    const check = () => {
      const l = latest.current;
      if (
        !owner.mounted ||
        !owner.running ||
        owner.epoch !== epoch ||
        !l.focused ||
        !l.online ||
        AppState.currentState !== "active"
      )
        throw cancelled;
    };
    const delay = async (milliseconds = 100) => {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
      check();
    };
    const wait = async <T>(
      read: () => T | undefined,
      timeout: number,
      failure: string,
    ): Promise<T> => {
      const end = performance.now() + timeout;
      while (true) {
        check();
        const result = read();
        if (result !== undefined) return result;
        if (performance.now() >= end) throw new Error(failure);
        await delay();
      }
    };
    const currentSegment = () => {
      const chat = latest.current.data;
      const part = chat?.segments.find(
        (item) => item.segmentId === chat.conversation.currentSegmentId,
      );
      if (!chat || !part || part.state !== "active")
        throw new Error(
          "This conversation has ended. Return to chat to continue it.",
        );
      return { chat, part };
    };
    // A resumed loop waits for the old loop/recorder cleanup. It cannot reopen
    // the microphone or submit a turn after Pause, route exit or account change.
    const previous = owner.promise;
    owner.promise = (async () => {
      await previous;
      check();
      await latest.current.speech.stop();
      check();
      const initial = currentSegment().part.segmentId;
      if (
        latest.current.study.drafts[`${initial}:chat-message`]?.trim() ||
        latest.current.study.drafts[`${initial}:chat-pending`]?.trim()
      )
        throw new Error(
          "You have an unsent message. Send or clear it in text chat before starting a call.",
        );
      while (true) {
        let { chat, part } = currentSegment();
        const lastJob = chat.jobs.find(
          (item) => item.id === part.lastReplyJobId,
        );
        if (lastJob?.status === "failed" || lastJob?.status === "stale")
          throw new Error(
            "The AI reply is unavailable. Return to chat to retry your saved message.",
          );
        if (part.pendingJobId) {
          setPhase("thinking");
          await wait(
            () => {
              const next = currentSegment();
              const job = next.chat.jobs.find(
                (item) => item.id === next.part.lastReplyJobId,
              );
              if (job?.status === "failed" || job?.status === "stale")
                throw new Error(
                  "The AI reply is unavailable. Return to chat to retry your saved message.",
                );
              return next.part.pendingJobId ? undefined : true;
            },
            100000,
            "The AI is taking longer than expected. Your message is saved in chat.",
          );
          ({ chat, part } = currentSegment());
        }
        const reply = chat.messages
          .filter(
            (item) =>
              item.segmentId === part.segmentId &&
              item.role === "assistant" &&
              item.reply &&
              !item.stale,
          )
          .at(-1);
        if (reply && !played.current.has(reply.messageId)) {
          setPhase("thinking");
          setAudioMessageId(reply.messageId);
          await wait(
            () =>
              latest.current.audioMessageId === reply.messageId
                ? true
                : undefined,
            5000,
            "Audio could not start. Return to text chat.",
          );
          await latest.current.audio.prepare();
          check();
          const source = await wait(
            () => {
              const sound = latest.current.audio;
              if (sound.status === "unavailable")
                throw new Error(
                  sound.error ||
                    "Reply audio is unavailable. You can read it in chat.",
                );
              return sound.status === "ready" && sound.source
                ? sound.source
                : undefined;
            },
            160000,
            "Reply audio is taking too long. Keep using text chat or resume later.",
          );
          check();
          stopAudioPlayers(player);
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: false,
            shouldPlayInBackground: false,
            interruptionMode: "doNotMix",
          });
          check();
          player.replace(source);
          await delay(200);
          await wait(
            () => (player.isLoaded ? true : undefined),
            15000,
            "Audio couldn't play. The reply remains in chat.",
          );
          player.setPlaybackRate(1);
          const playback = createVoicePlaybackLatch();
          const listener = player.addListener(
            "playbackStatusUpdate",
            (status) => playback.observe(status),
          );
          try {
            setPhase("speaking");
            check();
            player.play();
            await wait(
              () => (playback.started ? true : undefined),
              5000,
              "Audio couldn't play. Return to text chat.",
            );
            await wait(
              () => (playback.completed ? true : undefined),
              30000,
              "Playback paused. Resume when you are ready.",
            );
          } finally {
            listener.remove();
            try {
              player.pause();
            } catch {
              /* Released on route exit. */
            }
          }
          played.current.add(reply.messageId);
          await delay(350); // Let speaker sound decay before reopening the mic.
        }
        if (latest.current.muted) {
          setPhase("paused");
          await wait(
            () => (!latest.current.muted ? true : undefined),
            300000,
            "Call paused. Resume when you're ready.",
          );
        }
        check();
        const capturedContext = {
          segmentId: part.segmentId,
          revision: part.revision,
        };
        owner.forceFinish = false;
        owner.captureActive = true;
        const id = await latest.current.speech.start(
          part.segmentId,
          "chat-answer",
          part.segmentId,
        );
        check();
        if (!id)
          throw new Error(
            latest.current.speech.permissionDenied
              ? "Microphone access is off. Enable it in Settings or return to text chat."
              : "The microphone is unavailable. Return to text chat or try again.",
          );
        setPhase("listening");
        await wait(
          () => (latest.current.speech.recording ? true : undefined),
          3000,
          "The microphone couldn't start. Try again or use text chat.",
        );
        let detector = initialVoiceTurn(),
          shouldSend = false;
        let capturedDuration = 0;
        while (true) {
          await delay(200);
          const input = latest.current.speech;
          capturedDuration = Math.max(capturedDuration, input.durationMillis);
          const sample = sampleVoiceTurn(detector, {
            elapsedMillis: capturedDuration,
            metering: input.metering,
          });
          detector = sample.state;
          setVoiced(sample.speaking);
          const decision = voiceRecordingDecision({
            action: sample.action,
            voicedMillis: detector.voicedMillis,
            manualFinish: owner.forceFinish,
            durationMillis: capturedDuration,
            isRecording: input.recording,
          });
          if (decision !== "continue") {
            shouldSend = decision === "send";
            break;
          }
        }
        setVoiced(false);
        await latest.current.speech.stop();
        owner.captureActive = false;
        check();
        if (!shouldSend)
          throw new Error(
            "No clear speech was detected. Resume to try again, or use text chat.",
          );
        setPhase("transcribing");
        await wait(
          () => latest.current.speech.recordings.find((item) => item.id === id),
          5000,
          "The recording couldn't be saved. Try again or type instead.",
        );
        await latest.current.speech.recognize(id);
        const record = await wait(
          () => {
            const item = latest.current.speech.recordings.find(
              (row) => row.id === id,
            );
            if (
              item?.recognitionStatus === "unavailable" ||
              item?.recognitionStatus === "deleted"
            )
              throw new Error(
                "Speech recognition is unavailable. Your recording is retained; continue in text chat.",
              );
            return item && ["ready", "empty"].includes(item.recognitionStatus)
              ? item
              : undefined;
          },
          100000,
          "Transcription is taking too long. Your recording is retained.",
        );
        const recognized = usableVoiceTranscript(record.recognizedTranscript);
        if (!recognized)
          throw new Error(
            "We couldn't hear clear words. Resume to try again or type instead. No answer was marked wrong.",
          );
        setTranscript(recognized);
        check();
        const fresh = currentSegment();
        if (!voiceTurnContextMatches(capturedContext, fresh.part))
          throw new Error(
            "This chat changed on another device. Your recording is saved; return to chat before continuing.",
          );
        const intent = {
          conversationId: conversationId as Id<"conversations">,
          segmentId: part.segmentId,
          messageId: id,
          expectedRevision: capturedContext.revision,
          text: recognized,
          support: (() => {
            try {
              const value = JSON.parse(
                latest.current.study.drafts[`${part.segmentId}:chat-support`] ??
                  "[]",
              );
              return Array.isArray(value)
                ? value.filter((item): item is SupportFlag =>
                    [
                      "suggestedReply",
                      "wordBank",
                      "patternHint",
                      "transcriptEdited",
                    ].includes(item),
                  )
                : [];
            } catch {
              return [];
            }
          })(),
          practiceStamp: {
            occurredAt: record.createdAt,
            offsetMinutes: new Date(record.createdAt).getTimezoneOffset(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
        // Persist the same immutable turn ID before dispatch. A network/ack
        // failure leaves one recoverable message rather than sending it twice.
        setPhase("thinking");
        const sent = await dispatchVoiceTurn(intent, {
          saveDraft: (...args) => latest.current.study.saveDraft(...args),
          submit,
          isCurrent: () => {
            try {
              check();
              return true;
            } catch {
              return false;
            }
          },
        });
        if (!sent) throw cancelled;
        await wait(
          () =>
            latest.current.data?.messages.some((item) => item.messageId === id)
              ? true
              : undefined,
          15000,
          "Your turn was sent. Return to chat to see its reply.",
        );
      }
    })()
      .catch((failure) => {
        // A superseded run must never stop or rewrite its replacement. If this
        // run itself lost foreground/focus/connectivity, cancellation still
        // owns native resources and must release them with a useful next step.
        if (owner.epoch === epoch && owner.mounted)
          pause(
            failure === cancelled
              ? availabilityMessage() ||
                  "The call paused. Resume when you're ready."
              : failure instanceof Error
                ? failure.message
                : "The call paused. Your conversation is saved.",
          );
      })
      .finally(() => {
        if (owner.epoch === epoch) {
          owner.running = false;
          if (owner.mounted) {
            setRunning(false);
            setVoiced(false);
          }
        }
      });
  }, [conversationId, pause, player, submit]);
  const toggleMute = useCallback(() => {
    const next = !latest.current.muted;
    latest.current.muted = next;
    setMuted(next);
    if (next && (phase === "listening" || runtime.current.captureActive))
      pause();
  }, [pause, phase]);
  return {
    phase,
    error,
    running,
    muted,
    voiced,
    transcript,
    permissionDenied: speech.permissionDenied,
    ready: Boolean(segment?.state === "active" && online && !speech.loading),
    resume,
    pause,
    toggleMute,
    finishTurn: () => {
      runtime.current.forceFinish = true;
    },
  };
}
