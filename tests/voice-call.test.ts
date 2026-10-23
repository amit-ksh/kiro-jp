import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialVoiceTurn,
  createVoicePlaybackLatch,
  sampleVoiceTurn,
  usableVoiceTranscript,
  voiceRecordingDecision,
  voiceTurnContextMatches,
  voiceTurnLimits,
  type VoiceTurnState,
} from "../packages/learning-core/src/voice-call.ts";

test("a turn needs observed voice and a beginner-friendly trailing pause", () => {
  let state = initialVoiceTurn();
  for (const elapsed of [0, 200, 400, 600]) {
    const result = sampleVoiceTurn(state, {
      elapsedMillis: elapsed,
      metering: -24,
    });
    assert.equal(result.action, "continue");
    assert.equal(result.speaking, true);
    state = result.state;
  }
  assert.equal(state.voicedMillis, 600);
  const shortPause = sampleVoiceTurn(state, {
    elapsedMillis: 2_000,
    metering: -75,
  });
  assert.equal(shortPause.action, "continue");
  const end = sampleVoiceTurn(shortPause.state, {
    elapsedMillis: 2_100,
    metering: -75,
  });
  assert.equal(end.action, "finish");
  assert.equal(end.reason, "silence");
});

test("initial sampling, duplicate time, reverse time, and stalled polling cannot invent voice duration", () => {
  const first = sampleVoiceTurn(initialVoiceTurn(), {
    elapsedMillis: 2_000,
    metering: -18,
  });
  assert.equal(first.state.voicedMillis, 0);
  for (const elapsed of [2_000, 1_000, -1, Number.NaN, Infinity]) {
    const ignored = sampleVoiceTurn(first.state, {
      elapsedMillis: elapsed,
      metering: -18,
    });
    assert.equal(ignored.state, first.state);
    assert.equal(ignored.speaking, false);
  }
  const stalled = sampleVoiceTurn(first.state, {
    elapsedMillis: 11_000,
    metering: -18,
  });
  assert.equal(
    stalled.state.voicedMillis,
    voiceTurnLimits.maximumSampleGapMillis,
  );
  assert.equal(stalled.action, "continue");
  const idle = sampleVoiceTurn(stalled.state, {
    elapsedMillis: 12_000,
    metering: -80,
  });
  assert.equal(idle.action, "pause");
  assert.equal(idle.reason, "idle");
});

test("background noise adapts within bounds and silent, missing, or invalid meters never send a turn", () => {
  for (const metering of [-56, -160, undefined, Number.NaN, -Infinity]) {
    let state = initialVoiceTurn();
    for (let elapsed = 0; elapsed < 12_000; elapsed += 200) {
      const result = sampleVoiceTurn(state, {
        elapsedMillis: elapsed,
        metering,
      });
      assert.equal(result.action, "continue");
      assert.equal(result.speaking, false);
      state = result.state;
    }
    assert.equal(state.voicedMillis, 0);
    assert(state.noiseFloorDb >= -65 && state.noiseFloorDb <= -42);
    assert.equal(
      sampleVoiceTurn(state, { elapsedMillis: 12_000, metering }).action,
      "pause",
    );
    if (metering === -56) assert(state.noiseFloorDb > -58);
    if (metering === -160) assert.equal(state.noiseFloorDb, -65);
    if (metering === undefined) assert.equal(state.meteringAvailable, false);
  }
});

test("a click or a long recording without meaningful speech cannot auto-submit", () => {
  let state = sampleVoiceTurn(initialVoiceTurn(), {
    elapsedMillis: 0,
    metering: -80,
  }).state;
  state = sampleVoiceTurn(state, { elapsedMillis: 200, metering: 100 }).state;
  assert.equal(state.voicedMillis, 200);
  const limited = sampleVoiceTurn(state, {
    elapsedMillis: 29_000,
    metering: -80,
  });
  assert.equal(limited.action, "pause");
  assert.equal(limited.reason, "limit");
  assert.equal(
    sampleVoiceTurn(initialVoiceTurn(), { elapsedMillis: 29_000 }).action,
    "pause",
  );
});

test("the hard limit ends meaningful speech and an unavailable meter cannot manufacture a silence boundary", () => {
  const state: VoiceTurnState = {
    ...initialVoiceTurn(),
    lastSampleMillis: 1_000,
    lastVoiceMillis: 1_000,
    voicedMillis: 600,
    meteringAvailable: true,
  };
  assert.equal(
    sampleVoiceTurn(state, { elapsedMillis: 3_000 }).action,
    "continue",
  );
  const limited = sampleVoiceTurn(state, { elapsedMillis: 29_000 });
  assert.equal(limited.action, "finish");
  assert.equal(limited.reason, "limit");
});

test("recognized input preserves Japanese, romaji, English, and mixed-language practice", () => {
  for (const text of [
    "水をください。",
    "mizu o kudasai",
    "I like anime",
    "今日は anime が好きです",
    "ありがとう",
    "Thank you.",
  ])
    assert.equal(usableVoiceTranscript(`  ${text}  `), text);
  for (const value of [
    null,
    undefined,
    17,
    "",
    " \n\t ",
    "x".repeat(1_001),
    "a\u0000b",
    "[BLANK_AUDIO]",
    "[silence]",
    "(no speech)",
    "[inaudible]",
    "Thank you for watching!",
    "ご視聴ありがとうございました。",
  ])
    assert.equal(usableVoiceTranscript(value), null);
});

test("manual send works without a meter while automatic sends require voice evidence", () => {
  const input = {
    action: "continue" as const,
    voicedMillis: 0,
    manualFinish: false,
    durationMillis: 3_000,
    isRecording: true,
  };
  assert.equal(voiceRecordingDecision(input), "continue");
  assert.equal(
    voiceRecordingDecision({ ...input, manualFinish: true }),
    "send",
  );
  for (const durationMillis of [0, 599, Number.NaN, Infinity])
    assert.equal(
      voiceRecordingDecision({ ...input, manualFinish: true, durationMillis }),
      "pause",
    );
  assert.equal(voiceRecordingDecision({ ...input, action: "finish" }), "pause");
  assert.equal(
    voiceRecordingDecision({ ...input, action: "finish", voicedMillis: 600 }),
    "send",
  );
  assert.equal(
    voiceRecordingDecision({ ...input, action: "pause", voicedMillis: 600 }),
    "pause",
  );
});

test("an interrupted recording is retained without auto-sending an unfinished phrase", () => {
  const input = {
    action: "continue" as const,
    voicedMillis: 2_000,
    manualFinish: false,
    durationMillis: 3_000,
    isRecording: false,
  };
  assert.equal(voiceRecordingDecision(input), "pause");
  assert.equal(voiceRecordingDecision({ ...input, action: "finish" }), "pause");
  assert.equal(
    voiceRecordingDecision({ ...input, durationMillis: 28_500 }),
    "send",
  );
  assert.equal(
    voiceRecordingDecision({
      ...input,
      durationMillis: 29_000,
      voicedMillis: 200,
    }),
    "pause",
  );
  assert.equal(
    voiceRecordingDecision({ ...input, durationMillis: Number.NaN }),
    "pause",
  );
  assert.equal(
    voiceRecordingDecision({ ...input, manualFinish: true }),
    "send",
  );
});

test("a per-play native completion latch survives transient finish events and ignores pauses", () => {
  const playback = createVoicePlaybackLatch();
  playback.observe({ playing: false, didJustFinish: true });
  assert.equal(playback.started, false);
  assert.equal(playback.completed, false);
  playback.observe({ playing: true, didJustFinish: false });
  assert.equal(playback.started, true);
  playback.observe({ playing: false, didJustFinish: false });
  assert.equal(playback.completed, false);
  playback.observe({ playing: false, didJustFinish: true });
  playback.observe({ playing: false, didJustFinish: false });
  assert.equal(playback.completed, true);
  const next = createVoicePlaybackLatch();
  assert.equal(next.completed, false);
});

test("a voice turn remains bound to the conversation revision heard before recording", () => {
  const captured = { segmentId: "practice-original", revision: 4 };
  const live = { ...captured, state: "active" };
  assert.equal(voiceTurnContextMatches(captured, live), true);
  assert.equal(
    voiceTurnContextMatches(captured, {
      ...live,
      pendingJobId: "other-device-reply",
    }),
    false,
  );
  // Another phone can finish its AI reply before this recording is recognized.
  // An empty queue alone must not allow the old utterance to be rebased.
  assert.equal(
    voiceTurnContextMatches(captured, { ...live, revision: 6 }),
    false,
  );
  assert.equal(
    voiceTurnContextMatches(captured, { ...live, segmentId: "practice-new" }),
    false,
  );
  assert.equal(
    voiceTurnContextMatches(captured, { ...live, state: "ended" }),
    false,
  );
  assert.equal(voiceTurnContextMatches(captured, undefined), false);
  assert.equal(
    voiceTurnContextMatches(
      { ...captured, revision: Infinity },
      { ...live, revision: Infinity },
    ),
    false,
  );
});
