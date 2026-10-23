import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
function loadSource(
  path: string,
  dependencies: Record<string, unknown>,
  globals: Record<string, unknown> = {},
) {
  const code = ts.transpileModule(
    fs.readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} as any };
  vm.runInThisContext(
    `(function(require,module,exports,${Object.keys(globals).join(",")}){${code}\n})`,
  )(
    (name: string) =>
      name in dependencies ? dependencies[name] : require(name),
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}
const policy = loadSource("../packages/learning-core/src/voice-call.ts", {});

// Run the actual hook with deterministic React/native ports. These tests probe
// permission races and delayed results without opening a mic or invoking AI.
function mountInput({
  holdStart = false,
  denied = false,
  holdConfirm = false,
} = {}) {
  let cursor = 0,
    scheduled = false,
    disposed = false,
    now = 0,
    timerId = 0;
  let focused = true,
    accountId = "account-a",
    segmentId = "segment-a",
    enabled = true;
  const slots: any[] = [],
    effects: (() => void)[] = [];
  const timers = new Map<number, { at: number; run: () => void }>();
  const listeners = new Set<(state: string) => void>();
  const starts: string[][] = [],
    recognizes: string[] = [],
    edits: string[][] = [],
    confirmations: string[][] = [],
    audioTimes: any[] = [];
  let stops = 0,
    releaseStart: (() => void) | undefined,
    releaseConfirm: (() => void) | undefined;
  const AppState = {
    currentState: "active",
    addEventListener: (_event: string, listener: (state: string) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const schedule = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!disposed) render();
    });
  };
  const equal = (left?: unknown[], right?: unknown[]) =>
    Boolean(
      left &&
      right &&
      left.length === right.length &&
      left.every((item, index) => Object.is(item, right[index])),
    );
  const React = {
    useRef(initial: unknown) {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    useState(initial: unknown) {
      const index = cursor++;
      const slot = (slots[index] ??= { value: initial });
      return [
        slot.value,
        (value: unknown) => {
          const next =
            typeof value === "function"
              ? (value as (old: unknown) => unknown)(slot.value)
              : value;
          if (!Object.is(next, slot.value)) {
            slot.value = next;
            schedule();
          }
        },
      ];
    },
    useCallback(callback: unknown, deps: unknown[]) {
      const index = cursor++;
      if (!equal(slots[index]?.deps, deps)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(setup: () => unknown, deps: unknown[]) {
      const index = cursor++;
      if (equal(slots[index]?.deps, deps)) return;
      const previous = slots[index];
      const slot = (slots[index] = { deps, cleanup: undefined as unknown });
      effects.push(() => {
        previous?.cleanup?.();
        slot.cleanup = setup();
      });
    },
  };
  const speech = {
    loading: false,
    recording: false,
    durationMillis: 0,
    metering: undefined as number | undefined,
    permissionDenied: false,
    online: true,
    recordings: [] as any[],
    start: async (...args: string[]) => {
      starts.push(args);
      if (holdStart && starts.length === 1)
        await new Promise<void>((resolve) => {
          releaseStart = resolve;
        });
      if (denied) {
        speech.permissionDenied = true;
        schedule();
        return;
      }
      speech.recording = true;
      speech.durationMillis = 0;
      schedule();
      return `recording-${starts.length}`;
    },
    stop: async () => {
      stops++;
      if (speech.recording) {
        speech.recordings = [
          ...speech.recordings,
          {
            id: `recording-${starts.length}`,
            recognitionStatus: "pending",
            durationMillis: speech.durationMillis,
            attempt: 0,
          },
        ];
      }
      speech.recording = false;
      speech.durationMillis = 0;
      schedule();
    },
    recognize: async (id: string) => {
      recognizes.push(id);
      const record = speech.recordings.find((item) => item.id === id);
      speech.recordings = speech.recordings.map((item) =>
        item === record ? { ...item, recognitionStatus: "queued" } : item,
      );
      schedule();
    },
    edit: async (id: string, text: string) => {
      edits.push([id, text]);
    },
    confirm: async (id: string, text: string) => {
      confirmations.push([id, text]);
      if (holdConfirm)
        await new Promise<void>((resolve) => {
          releaseConfirm = resolve;
        });
    },
  };
  const { useChatVoiceInput } = loadSource(
    "../apps/native/src/features/conversation/useChatVoiceInput.ts",
    {
      react: React,
      "react-native": { AppState },
      "@react-navigation/native": { useIsFocused: () => focused },
      "@packages/learning-core": policy,
      "../../data/StudyProvider": { useStudy: () => ({ accountId }) },
      "../speech/SpeechProvider": { useSpeech: () => speech },
      "../speech/useAudioTime": {
        useAudioTime: (...args: any[]) => audioTimes.push(args),
      },
    },
    {
      setTimeout: (run: () => void, delay: number) => {
        const id = ++timerId;
        timers.set(id, { at: now + delay, run });
        return id;
      },
      clearTimeout: (id: number) => timers.delete(id),
    },
  );
  let voice: ReturnType<typeof useChatVoiceInput>;
  function render() {
    cursor = 0;
    voice = useChatVoiceInput({ segmentId, enabled });
    for (const effect of effects.splice(0)) effect();
  }
  render();
  const flush = async () => {
    for (let i = 0; i < 40; i++) await Promise.resolve();
  };
  const advance = async (duration: number) => {
    await flush();
    const end = now + duration;
    while (true) {
      const first = [...timers]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!first) break;
      now = first[1].at;
      timers.delete(first[0]);
      first[1].run();
      await flush();
    }
    now = end;
    await flush();
  };
  return {
    get voice() {
      return voice;
    },
    get stops() {
      return stops;
    },
    starts,
    recognizes,
    confirmations,
    edits,
    audioTimes,
    speech,
    flush,
    advance,
    rerender: schedule,
    releaseStart() {
      assert(releaseStart);
      releaseStart();
    },
    releaseConfirm() {
      assert(releaseConfirm);
      releaseConfirm();
    },
    setResult(status: string, transcript = "") {
      speech.recordings = speech.recordings.map((record) =>
        record.id === voice.recordingId
          ? {
              ...record,
              recognitionStatus: status,
              recognizedTranscript: transcript,
            }
          : record,
      );
      schedule();
    },
    setIdentity(nextAccount: string, nextSegment: string) {
      accountId = nextAccount;
      segmentId = nextSegment;
      schedule();
    },
    setEnabled(next: boolean) {
      enabled = next;
      schedule();
    },
    setFocused(next: boolean) {
      focused = next;
      schedule();
    },
    setAppState(next: string) {
      AppState.currentState = next;
      for (const listener of listeners) listener(next);
    },
    async close() {
      voice.cancel();
      await flush();
      disposed = true;
      for (const slot of slots) slot?.cleanup?.();
      await flush();
    },
  };
}

test("chat mic starts on its first action, stops explicitly and previews without confirming or sending", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    assert.equal(fixture.voice.status, "recording");
    assert.deepEqual(fixture.starts, [
      ["segment-a", "chat-answer", "segment-a"],
    ]);
    fixture.speech.durationMillis = 2000;
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.voice.durationMillis, 2000);
    await fixture.voice.stop();
    await fixture.flush();
    assert.equal(fixture.voice.status, "transcribing");
    assert.equal(fixture.speech.recording, false);
    assert.deepEqual(fixture.recognizes, ["recording-1"]);
    fixture.setResult("ready", "水をください。");
    await fixture.flush();
    assert.equal(fixture.voice.status, "ready");
    assert.equal(fixture.voice.transcript, "水をください。");
    assert.equal(fixture.voice.isCurrentRecording("recording-1"), true);
    assert.equal(fixture.confirmations.length, 0);
    assert.equal(
      await fixture.voice.useTranscript("お茶をください。"),
      "お茶をください。",
    );
    assert.deepEqual(fixture.edits, [["recording-1", "お茶をください。"]]);
    assert.deepEqual(fixture.confirmations, [
      ["recording-1", "お茶をください。"],
    ]);
  } finally {
    await fixture.close();
  }
});

test("double microphone taps cannot acquire two recorders", async () => {
  const fixture = mountInput({ holdStart: true });
  try {
    const pending = fixture.voice.start();
    await fixture.flush();
    assert.equal(fixture.voice.status, "starting");
    await fixture.voice.start();
    assert.equal(fixture.starts.length, 1);
    fixture.releaseStart();
    await pending;
    await fixture.flush();
    assert.equal(fixture.voice.status, "recording");
  } finally {
    await fixture.close();
  }
});

test("cancel during permission prevents a late microphone from remaining open or requesting recognition", async () => {
  const fixture = mountInput({ holdStart: true });
  try {
    const pending = fixture.voice.start();
    await fixture.flush();
    fixture.voice.cancel();
    await fixture.flush();
    assert.equal(fixture.voice.status, "idle");
    fixture.releaseStart();
    await pending;
    await fixture.flush();
    assert.equal(fixture.speech.recording, false);
    assert.equal(fixture.voice.status, "idle");
    assert.equal(fixture.recognizes.length, 0);
  } finally {
    await fixture.close();
  }
});

test("permission denial has a typed fallback and never enters recording", async () => {
  const fixture = mountInput({ denied: true });
  try {
    await fixture.voice.start();
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.equal(fixture.voice.permissionDenied, true);
    assert.match(fixture.voice.error, /Settings or type/);
    assert.equal(fixture.speech.recording, false);
    assert.equal(fixture.recognizes.length, 0);
  } finally {
    await fixture.close();
  }
});

test("first permission prompt leaves a visible retry after backgrounding and never reopens the mic on return", async () => {
  const fixture = mountInput({ holdStart: true });
  try {
    const pending = fixture.voice.start();
    await fixture.flush();
    fixture.setAppState("inactive");
    fixture.setAppState("background");
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.match(fixture.voice.error, /Tap Record again/);
    fixture.releaseStart();
    fixture.setAppState("active");
    await pending;
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.equal(fixture.speech.recording, false);
    assert.equal(fixture.starts.length, 1);
    assert.equal(fixture.recognizes.length, 0);
    await fixture.voice.start();
    await fixture.flush();
    assert.equal(fixture.voice.status, "recording");
    assert.equal(fixture.starts.length, 2);
    assert.equal(fixture.voice.error, "");
  } finally {
    await fixture.close();
  }
});

test("background, blur, changed segment and pending jobs stop capture while retaining its recording", async () => {
  const changes = [
    (fixture: ReturnType<typeof mountInput>) =>
      fixture.setAppState("background"),
    (fixture: ReturnType<typeof mountInput>) => fixture.setFocused(false),
    (fixture: ReturnType<typeof mountInput>) =>
      fixture.setIdentity("account-a", "segment-b"),
    (fixture: ReturnType<typeof mountInput>) =>
      fixture.setIdentity("account-b", "segment-a"),
    (fixture: ReturnType<typeof mountInput>) => fixture.setEnabled(false),
  ];
  for (const change of changes) {
    const fixture = mountInput();
    try {
      await fixture.voice.start();
      await fixture.flush();
      change(fixture);
      await fixture.flush();
      assert.equal(fixture.voice.status, "idle");
      assert.equal(fixture.speech.recording, false);
      assert.equal(fixture.speech.recordings.length, 1);
      assert.equal(fixture.recognizes.length, 0);
    } finally {
      await fixture.close();
    }
  }
});

test("a cancelled transcription cannot write its late result into the next account or segment", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    await fixture.voice.stop();
    await fixture.flush();
    fixture.setIdentity("account-b", "segment-b");
    // The recognition result and identity change arrive in the same render.
    fixture.speech.recordings = fixture.speech.recordings.map((record) => ({
      ...record,
      recognitionStatus: "ready",
      recognizedTranscript: "水をください。",
    }));
    await fixture.flush();
    assert.equal(fixture.voice.status, "idle");
    assert.equal(fixture.voice.transcript, "");
    assert.equal(await fixture.voice.useTranscript(), undefined);
    assert.equal(fixture.confirmations.length, 0);
    await fixture.advance(100_001);
    assert.equal(fixture.voice.status, "idle");
  } finally {
    await fixture.close();
  }
});

test("offline recording is retained and transcription is explicitly retryable after reconnection", async () => {
  const fixture = mountInput();
  try {
    fixture.speech.online = false;
    fixture.rerender();
    await fixture.flush();
    await fixture.voice.start();
    await fixture.flush();
    await fixture.voice.stop();
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.match(fixture.voice.error, /Reconnect/);
    assert.equal(fixture.speech.recordings.length, 1);
    assert.equal(fixture.recognizes.length, 0);
    fixture.speech.online = true;
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.voice.canRetry, true);
    await fixture.voice.retry();
    await fixture.flush();
    assert.deepEqual(fixture.recognizes, ["recording-1"]);
    fixture.setResult("empty");
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.match(fixture.voice.error, /clear words/);
    assert.equal(fixture.voice.canRetry, false);
    assert.equal(fixture.confirmations.length, 0);
  } finally {
    await fixture.close();
  }
});

test("native interruption retains audio for explicit retry and never auto-transcribes", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    await fixture.speech.stop();
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.match(fixture.voice.error, /Recording stopped/);
    assert.equal(fixture.recognizes.length, 0);
    assert.equal(fixture.voice.record.id, "recording-1");
  } finally {
    await fixture.close();
  }
});

test("explicit recognition retry ignores the previous failure and respects the three-attempt cap", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    await fixture.voice.stop();
    await fixture.flush();
    fixture.setResult("unavailable");
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.equal(fixture.voice.canRetry, true);
    await fixture.voice.retry();
    await fixture.flush();
    assert.equal(fixture.voice.status, "transcribing");
    assert.equal(fixture.recognizes.length, 2);
    fixture.speech.recordings = fixture.speech.recordings.map((record) => ({
      ...record,
      attempt: 3,
      recognitionStatus: "unavailable",
    }));
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.voice.status, "error");
    assert.equal(fixture.voice.canRetry, false);
    await fixture.voice.retry();
    assert.equal(fixture.recognizes.length, 2);
  } finally {
    await fixture.close();
  }
});

test("a slow recognition times out without automatic retries and cannot resurface after Cancel", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    await fixture.voice.stop();
    await fixture.flush();
    await fixture.advance(100_001);
    assert.equal(fixture.voice.status, "error");
    assert.match(fixture.voice.error, /longer than expected/);
    assert.equal(fixture.recognizes.length, 1);
    fixture.voice.cancel();
    fixture.speech.recordings = fixture.speech.recordings.map((record) => ({
      ...record,
      recognitionStatus: "ready",
      recognizedTranscript: "こんにちは。",
    }));
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.voice.status, "idle");
    assert.equal(fixture.voice.isCurrentRecording("recording-1"), false);
    assert.equal(fixture.confirmations.length, 0);
  } finally {
    await fixture.close();
  }
});

test("cancelling transcript confirmation prevents the resolved text from entering the composer", async () => {
  const fixture = mountInput({ holdConfirm: true });
  try {
    await fixture.voice.start();
    await fixture.flush();
    await fixture.voice.stop();
    await fixture.flush();
    fixture.setResult("ready", "こんにちは。");
    await fixture.flush();
    const text = fixture.voice.useTranscript();
    await fixture.flush();
    assert.equal(fixture.voice.usingTranscript, true);
    fixture.voice.cancel();
    fixture.releaseConfirm();
    assert.equal(await text, undefined);
    await fixture.flush();
    assert.equal(fixture.voice.status, "idle");
  } finally {
    await fixture.close();
  }
});

test("silent recording and unknown metering do not count as speaking effort", async () => {
  const fixture = mountInput();
  try {
    await fixture.voice.start();
    await fixture.flush();
    assert.equal(fixture.audioTimes.at(-1)[2], false);
    fixture.speech.metering = -80;
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.audioTimes.at(-1)[2], false);
    fixture.speech.metering = -20;
    fixture.rerender();
    await fixture.flush();
    assert.equal(fixture.audioTimes.at(-1)[2], true);
    fixture.voice.cancel();
    await fixture.flush();
    assert.equal(fixture.audioTimes.at(-1)[2], false);
  } finally {
    await fixture.close();
  }
});
