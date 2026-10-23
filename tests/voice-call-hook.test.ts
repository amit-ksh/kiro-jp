import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function sourceModule(
  path: string,
  dependencies: Record<string, unknown> = {},
  globals: Record<string, unknown> = {},
) {
  const code = ts.transpileModule(
    fs.readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} as any };
  const names = Object.keys(globals);
  vm.runInThisContext(
    `(function(require,module,exports,${names.join(",")}){"use strict";${code}\n})`,
  )(
    (name: string) =>
      name in dependencies ? dependencies[name] : require(name),
    module,
    module.exports,
    ...Object.values(globals),
  );
  return module.exports;
}

const policy = sourceModule("../packages/learning-core/src/voice-call.ts");
const dispatch = sourceModule(
  "../apps/native/src/features/conversation/voiceTurnDispatch.ts",
);

// The real controller is evaluated unchanged. Only React's hook host and native
// ports are replaced, allowing deterministic lifecycle and permission races
// without a renderer dependency, a device, inference, or real elapsed timers.
function mountCall(
  options: { permissionPrompt?: boolean; reply?: boolean } = {},
) {
  let now = 0,
    nextTimer = 0,
    cursor = 0,
    scheduled = false,
    disposed = false;
  let focused = true,
    online = true,
    startCount = 0,
    stopCount = 0;
  const slots: any[] = [],
    effects: (() => void)[] = [];
  const timers = new Map<number, { at: number; callback: () => void }>();
  const stateListeners = new Set<(state: string) => void>();
  const playbackListeners = new Set<(state: unknown) => void>();
  const submissions: any[] = [],
    writes: any[] = [];
  let releasePermission: (() => void) | undefined;
  const AppState = {
    currentState: "active",
    addEventListener: (_name: string, listener: (state: string) => void) => {
      stateListeners.add(listener);
      return { remove: () => stateListeners.delete(listener) };
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
  const equal = (a?: unknown[], b?: unknown[]) =>
    Boolean(
      a &&
      b &&
      a.length === b.length &&
      a.every((value, index) => Object.is(value, b[index])),
    );
  const React = {
    useRef: (initial: unknown) => {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    useState: (initial: unknown) => {
      const index = cursor++;
      const slot = (slots[index] ??= { value: initial });
      return [
        slot.value,
        (value: unknown) => {
          const next =
            typeof value === "function"
              ? (value as (previous: unknown) => unknown)(slot.value)
              : value;
          if (!Object.is(next, slot.value)) {
            slot.value = next;
            schedule();
          }
        },
      ];
    },
    useCallback: (callback: unknown, dependencies: unknown[]) => {
      const index = cursor++;
      if (!equal(slots[index]?.dependencies, dependencies))
        slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useEffect: (setup: () => unknown, dependencies?: unknown[]) => {
      const index = cursor++;
      if (equal(slots[index]?.dependencies, dependencies)) return;
      const previous = slots[index];
      const slot = (slots[index] = {
        dependencies,
        cleanup: undefined as unknown,
      });
      effects.push(() => {
        if (typeof previous?.cleanup === "function") previous.cleanup();
        slot.cleanup = setup();
      });
    },
  };
  const timer = (callback: () => void, duration: number) => {
    const id = ++nextTimer;
    timers.set(id, { at: now + duration, callback });
    return id;
  };
  const playerStatus = {
    playing: false,
    isBuffering: false,
    duration: 0.5,
    currentTime: 0,
  };
  const player = {
    isLoaded: true,
    replace: () => {},
    setPlaybackRate: () => {},
    pause: () => {
      playerStatus.playing = false;
    },
    play: () => {
      playerStatus.playing = true;
      for (const listener of playbackListeners)
        listener({ playing: true, didJustFinish: false });
      timer(() => {
        playerStatus.playing = false;
        for (const listener of playbackListeners)
          listener({ playing: false, didJustFinish: true });
      }, 500);
    },
    addListener: (_name: string, listener: (state: unknown) => void) => {
      playbackListeners.add(listener);
      return { remove: () => playbackListeners.delete(listener) };
    },
  };
  const chat = {
    conversation: { currentSegmentId: "synthetic-segment" },
    segments: [
      { segmentId: "synthetic-segment", state: "active", revision: 4 },
    ],
    jobs: [],
    messages: options.reply
      ? [
          {
            segmentId: "synthetic-segment",
            role: "assistant",
            reply: { japanese: "こんにちは。" },
            messageId: "opening-reply",
            stale: false,
          },
        ]
      : ([] as any[]),
  };
  const speech = {
    loading: false,
    recording: false,
    durationMillis: 0,
    metering: undefined as number | undefined,
    permissionDenied: false,
    recordings: [] as any[],
    start: async () => {
      startCount++;
      if (options.permissionPrompt && startCount === 1) {
        await new Promise<void>((resolve) => {
          releasePermission = resolve;
        });
        // The provider invalidates its pending start when permission UI causes
        // AppState/background. Granting permission must not reopen the mic.
        return undefined;
      }
      const id = `recording-${startCount}`;
      speech.recording = true;
      speech.durationMillis = 0;
      schedule();
      return id;
    },
    stop: async () => {
      stopCount++;
      if (speech.recording) {
        speech.recordings.push({
          id: `recording-${startCount}`,
          createdAt: 1000,
          recognitionStatus: "pending",
        });
      }
      speech.recording = false;
      schedule();
    },
    recognize: async (id: string) => {
      const record = speech.recordings.find((item) => item.id === id);
      record.recognitionStatus = "ready";
      record.recognizedTranscript = "水をください。";
      schedule();
    },
  };
  const study = {
    drafts: {} as Record<string, string>,
    saveDraft: async (session: string, step: string, value: string) => {
      writes.push({ session, step, value });
      study.drafts[`${session}:${step}`] = value;
    },
  };
  const submit = async (intent: any) => {
    submissions.push(intent);
    chat.messages.push({
      segmentId: intent.segmentId,
      messageId: intent.messageId,
      role: "user",
    });
    schedule();
  };
  const audio = {
    status: "ready",
    source: "file:///synthetic.wav",
    error: "",
    prepare: async () => {},
  };
  const { useVoiceCall } = sourceModule(
    "../apps/native/src/features/conversation/useVoiceCall.ts",
    {
      react: React,
      "react-native": { AppState },
      "@react-navigation/native": { useIsFocused: () => focused },
      "convex/react": { useMutation: () => submit },
      "expo-audio": {
        useAudioPlayer: () => player,
        useAudioPlayerStatus: () => playerStatus,
        setAudioModeAsync: async () => {},
      },
      "@packages/backend/convex/_generated/api": {
        api: { conversation: { submit: "synthetic-submit" } },
      },
      "@packages/learning-core": policy,
      "../../data/StudyProvider": { useStudy: () => study },
      "./voiceTurnDispatch": dispatch,
      "../speech/SpeechProvider": { useSpeech: () => speech },
      "../speech/useConversationAudio": { useConversationAudio: () => audio },
      "../speech/audio-focus": {
        registerPlayer: () => () => {},
        stopAudioPlayers: () => {},
      },
      "../speech/useAudioTime": { useAudioTime: () => {} },
    },
    { setTimeout: timer, performance: { now: () => now } },
  );
  let call: ReturnType<typeof useVoiceCall>;
  function render() {
    cursor = 0;
    call = useVoiceCall("syntheticconversation123456", chat, online);
    for (const effect of effects.splice(0)) effect();
  }
  render();
  const flush = async () => {
    for (let index = 0; index < 40; index++) await Promise.resolve();
  };
  const advance = async (milliseconds: number) => {
    await flush();
    const end = now + milliseconds;
    while (true) {
      const next = [...timers]
        .filter(([, item]) => item.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    now = end;
    await flush();
  };
  return {
    get call() {
      return call;
    },
    get startCount() {
      return startCount;
    },
    get stopCount() {
      return stopCount;
    },
    speech,
    AppState,
    submissions,
    writes,
    flush,
    advance,
    async until(predicate: () => boolean, timeout = 5000) {
      for (let elapsed = 0; elapsed <= timeout; elapsed += 100) {
        await flush();
        if (predicate()) return;
        await advance(100);
      }
      assert.fail(
        `Controller did not reach expected state; phase=${call.phase}, running=${call.running}, error=${call.error}, starts=${startCount}`,
      );
    },
    setAppState(state: string) {
      AppState.currentState = state;
      for (const listener of stateListeners) listener(state);
    },
    grantPermission: () => {
      assert(releasePermission);
      releasePermission();
    },
    setFocused(value: boolean) {
      focused = value;
      schedule();
    },
    setOnline(value: boolean) {
      online = value;
      schedule();
    },
    rerender: schedule,
    async close() {
      call.pause();
      await advance(200);
      disposed = true;
      for (const slot of slots)
        if (typeof slot?.cleanup === "function") slot.cleanup();
      await flush();
    },
  };
}

test("real call hook reaches the metered microphone and sends one turn after voiced speech and silence", async () => {
  const fixture = mountCall();
  try {
    fixture.call.resume();
    await fixture.until(() => fixture.call.phase === "listening");
    assert.equal(fixture.startCount, 1);
    for (const duration of [200, 400, 600, 800, 1000]) {
      fixture.speech.durationMillis = duration;
      fixture.speech.metering = -20;
      fixture.rerender();
      await fixture.advance(200);
    }
    assert.equal(fixture.call.voiced, true);
    for (const duration of [1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600]) {
      fixture.speech.durationMillis = duration;
      fixture.speech.metering = -80;
      fixture.rerender();
      await fixture.advance(200);
    }
    await fixture.until(() => fixture.submissions.length === 1);
    fixture.call.pause();
    await fixture.advance(500);
    assert.equal(fixture.submissions.length, 1);
    assert.equal(fixture.submissions[0].text, "水をください。");
    assert.equal(fixture.submissions[0].expectedRevision, 4);
    assert.equal(fixture.call.transcript, "水をください。");
    assert.equal(fixture.speech.recording, false);
  } finally {
    await fixture.close();
  }
});

test("real call hook resumes after permission interrupts the first microphone request", async () => {
  const fixture = mountCall({ permissionPrompt: true, reply: true });
  try {
    fixture.call.resume();
    await fixture.until(() => fixture.startCount === 1);
    fixture.setAppState("background");
    await fixture.flush();
    assert.equal(fixture.call.running, false);
    assert.equal(fixture.call.phase, "paused");
    fixture.grantPermission();
    fixture.setAppState("active");
    await fixture.flush();
    fixture.call.resume();
    await fixture.until(() => fixture.call.phase === "listening");
    assert.equal(fixture.startCount, 2);
    assert.equal(fixture.speech.recording, true);
    assert.equal(fixture.call.running, true);
    assert.equal(fixture.submissions.length, 0);
    fixture.call.pause();
    await fixture.advance(300);
    assert.equal(fixture.speech.recording, false);
  } finally {
    await fixture.close();
  }
});

test("real call hook does not silently reopen the mic when permission returns after pause", async () => {
  const fixture = mountCall({ permissionPrompt: true });
  try {
    fixture.call.resume();
    await fixture.until(() => fixture.startCount === 1);
    fixture.call.pause();
    fixture.grantPermission();
    await fixture.advance(1000);
    assert.equal(fixture.call.running, false);
    assert.equal(fixture.startCount, 1);
    assert.equal(fixture.speech.recording, false);
    assert.equal(fixture.submissions.length, 0);
  } finally {
    await fixture.close();
  }
});

test("real call hook explains why Resume is blocked until the app is active", async () => {
  const fixture = mountCall();
  try {
    fixture.call.pause();
    fixture.AppState.currentState = "background";
    await fixture.flush();
    fixture.call.resume();
    await fixture.flush();
    assert.equal(fixture.call.phase, "paused");
    assert.equal(fixture.call.running, false);
    assert.match(fixture.call.error, /Keep Kiro JP open/);
    assert.equal(fixture.startCount, 0);
    fixture.AppState.currentState = "active";
    fixture.call.resume();
    await fixture.until(() => fixture.call.phase === "listening");
    assert.equal(fixture.startCount, 1);
    assert.equal(fixture.call.error, "");
  } finally {
    await fixture.close();
  }
});

test("real call hook releases an active microphone when polling detects lifecycle loss", async () => {
  const fixture = mountCall();
  try {
    fixture.call.resume();
    await fixture.until(() => fixture.call.phase === "listening");
    assert.equal(fixture.speech.recording, true);
    // Polling is a second lifecycle guard. Even if a native event was missed,
    // cancellation of the current run must release native audio resources.
    fixture.AppState.currentState = "background";
    await fixture.advance(300);
    assert.equal(fixture.call.running, false);
    assert.equal(fixture.speech.recording, false);
    assert.match(fixture.call.error, /Keep Kiro JP open/);
  } finally {
    await fixture.close();
  }
});

test("real call hook explains offline, unfocused, and loading Resume guards without opening the mic", async () => {
  const cases = [
    {
      block: (fixture: ReturnType<typeof mountCall>) =>
        fixture.setOnline(false),
      expected: /Reconnect/,
    },
    {
      block: (fixture: ReturnType<typeof mountCall>) =>
        fixture.setFocused(false),
      expected: /Return to this call screen/,
    },
    {
      block: (fixture: ReturnType<typeof mountCall>) => {
        fixture.speech.loading = true;
        fixture.rerender();
      },
      expected: /microphone is getting ready/,
    },
  ];
  for (const { block, expected } of cases) {
    const fixture = mountCall();
    try {
      block(fixture);
      await fixture.flush();
      fixture.call.resume();
      await fixture.flush();
      assert.equal(fixture.call.running, false);
      assert.equal(fixture.call.phase, "paused");
      assert.match(fixture.call.error, expected);
      assert.equal(fixture.startCount, 0);
    } finally {
      await fixture.close();
    }
  }
});

test("a superseded permission request cannot pause a newer Resume", async () => {
  const fixture = mountCall({ permissionPrompt: true });
  try {
    fixture.call.resume();
    await fixture.until(() => fixture.startCount === 1);
    fixture.setAppState("background");
    fixture.setAppState("active");
    await fixture.flush();
    // The replacement is queued while the first permission request still owns
    // its promise. Its stale cancellation must not stop this newer run.
    fixture.call.resume();
    await fixture.flush();
    assert.equal(fixture.call.running, true);
    fixture.grantPermission();
    await fixture.until(() => fixture.call.phase === "listening");
    assert.equal(fixture.startCount, 2);
    assert.equal(fixture.call.running, true);
    assert.equal(fixture.call.error, "");
    assert.equal(fixture.speech.recording, true);
    assert.equal(fixture.submissions.length, 0);
  } finally {
    await fixture.close();
  }
});
