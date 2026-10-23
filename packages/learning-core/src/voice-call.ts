export const voiceTurnLimits = {
  minimumVoicedMillis: 600,
  trailingSilenceMillis: 1_500,
  idlePauseMillis: 12_000,
  maximumRecordingMillis: 29_000,
  maximumSampleGapMillis: 400,
} as const;

export interface VoiceTurnState {
  lastSampleMillis: number | null;
  voicedMillis: number;
  lastVoiceMillis: number | null;
  noiseFloorDb: number;
  meteringAvailable: boolean;
}

export interface VoiceTurnSample {
  /** Monotonic time since this recording began, never a wall-clock timestamp. */
  elapsedMillis: number;
  /** Expo Audio recorder level in dBFS. Missing levels are not speech evidence. */
  metering?: number;
}

export interface VoiceTurnObservation {
  state: VoiceTurnState;
  action: "continue" | "finish" | "pause";
  reason?: "silence" | "limit" | "idle";
  speaking: boolean;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function initialVoiceTurn(): VoiceTurnState {
  return {
    lastSampleMillis: null,
    voicedMillis: 0,
    lastVoiceMillis: null,
    noiseFloorDb: -58,
    meteringAvailable: false,
  };
}

/**
 * A conservative turn boundary, not a speech recognizer or pronunciation score.
 * The controller still offers a manual Send turn for quiet or noisy microphones.
 */
export function sampleVoiceTurn(
  previous: VoiceTurnState,
  sample: VoiceTurnSample,
): VoiceTurnObservation {
  const elapsed = sample.elapsedMillis;
  if (
    !Number.isFinite(elapsed) ||
    elapsed < 0 ||
    (previous.lastSampleMillis !== null && elapsed <= previous.lastSampleMillis)
  )
    return { state: previous, action: "continue", speaking: false };

  // The first observation establishes a baseline. A stalled JS timer can only
  // account for a bounded observed interval, not all the time since it last ran.
  const delta =
    previous.lastSampleMillis === null
      ? 0
      : Math.min(
          voiceTurnLimits.maximumSampleGapMillis,
          elapsed - previous.lastSampleMillis,
        );
  const hasMeter = Number.isFinite(sample.metering);
  const level = hasMeter ? clamp(sample.metering!, -160, 0) : -160;
  const threshold = clamp(previous.noiseFloorDb + 12, -45, -32);
  const speaking = hasMeter && level >= threshold;
  const state: VoiceTurnState = {
    ...previous,
    lastSampleMillis: elapsed,
    meteringAvailable: previous.meteringAvailable || hasMeter,
    voicedMillis: previous.voicedMillis + (speaking ? delta : 0),
    lastVoiceMillis: speaking ? elapsed : previous.lastVoiceMillis,
    // Learn background levels only below the speech threshold. An absolute
    // bound keeps a quiet room from treating every microphone hiss as speech.
    noiseFloorDb:
      hasMeter && !speaking
        ? clamp(
            previous.noiseFloorDb +
              (level - previous.noiseFloorDb) * (1 - Math.exp(-delta / 1_200)),
            -65,
            -42,
          )
        : previous.noiseFloorDb,
  };
  const meaningful = state.voicedMillis >= voiceTurnLimits.minimumVoicedMillis;
  if (elapsed >= voiceTurnLimits.maximumRecordingMillis)
    return {
      state,
      action: meaningful ? "finish" : "pause",
      reason: "limit",
      speaking,
    };
  if (
    meaningful &&
    state.lastVoiceMillis !== null &&
    hasMeter &&
    !speaking &&
    elapsed - state.lastVoiceMillis >= voiceTurnLimits.trailingSilenceMillis
  )
    return { state, action: "finish", reason: "silence", speaking };
  if (!meaningful && elapsed >= voiceTurnLimits.idlePauseMillis)
    return { state, action: "pause", reason: "idle", speaking };
  return { state, action: "continue", speaking };
}

/** A recognition aid can be uncertain; never manufacture a turn from silence. */
export function usableVoiceTranscript(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (
    !text ||
    text.length > 1_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)
  )
    return null;
  const marker = text.normalize("NFKC").toLocaleLowerCase();
  if (
    /^(?:\[|\()(?:blank_audio|silence|no speech|inaudible)(?:\]|\))$/u.test(
      marker,
    )
  )
    return null;
  // These exact video-outro strings are common Whisper silence hallucinations.
  // Do not reject ordinary thanks, English, romaji, or mixed-language answers.
  const boilerplate = marker.replace(/[\s.!?。！？]/gu, "");
  if (
    boilerplate === "thankyouforwatching" ||
    boilerplate === "thanksforwatching" ||
    boilerplate === "ご視聴ありがとうございました"
  )
    return null;
  return text;
}

export interface VoiceRecordingDecisionInput {
  action: VoiceTurnObservation["action"];
  voicedMillis: number;
  manualFinish: boolean;
  /** Maximum observed duration; recorder teardown may reset its live status. */
  durationMillis: number;
  isRecording: boolean;
}

/** Only an explicit send can bypass unreliable microphone metering. */
export function voiceRecordingDecision({
  action,
  voicedMillis,
  manualFinish,
  durationMillis,
  isRecording,
}: VoiceRecordingDecisionInput): "continue" | "send" | "pause" {
  const validDuration = Number.isFinite(durationMillis) && durationMillis >= 0;
  const meaningful =
    Number.isFinite(voicedMillis) &&
    voicedMillis >= voiceTurnLimits.minimumVoicedMillis;
  if (manualFinish)
    return validDuration && durationMillis >= 600 ? "send" : "pause";
  // Native stop can mean microphone revocation or an interruption, not that
  // the learner finished. Only the known bounded recording cap may auto-send.
  if (!isRecording)
    return validDuration && durationMillis >= 28_500 && meaningful
      ? "send"
      : "pause";
  if (action === "continue") return "continue";
  return action === "finish" && meaningful ? "send" : "pause";
}

/** Create one latch per playback and feed it the actual native status events. */
export function createVoicePlaybackLatch() {
  let started = false,
    completed = false;
  return {
    get started() {
      return started;
    },
    get completed() {
      return completed;
    },
    observe(status: { playing: boolean; didJustFinish: boolean }) {
      // A finish event from a preceding source cannot complete this play.
      // Ordinary paused/focus-loss events never masquerade as completion.
      if (status.playing && !status.didJustFinish) started = true;
      if (started && status.didJustFinish) completed = true;
    },
  };
}

export interface VoiceTurnContext {
  segmentId: string;
  revision: number;
}

/** Do not silently rebase an utterance onto a changed conversation. */
export function voiceTurnContextMatches(
  captured: VoiceTurnContext,
  live:
    | (VoiceTurnContext & { state: string; pendingJobId?: string | null })
    | null
    | undefined,
): boolean {
  return Boolean(
    captured.segmentId &&
    Number.isSafeInteger(captured.revision) &&
    captured.revision >= 0 &&
    live?.state === "active" &&
    !live.pendingJobId &&
    live.segmentId === captured.segmentId &&
    live.revision === captured.revision,
  );
}
