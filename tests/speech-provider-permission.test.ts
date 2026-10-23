import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Execute SpeechProvider itself so permission checks cannot be tested only in a
// substitute helper. React's hook host, native resources and local storage are
// deterministic ports; no device, microphone, network or wall-clock timer runs.
function mountSpeech(
  options: {
    granted?: boolean;
    promptGrant?: boolean;
    promptBackground?: boolean;
    deferCheck?: boolean;
  } = {},
) {
  let cursor = 0,
    queued = false,
    disposed = false;
  let permissionGranted = options.granted ?? true;
  let checks = 0,
    requests = 0,
    nativeStarts = 0,
    nativeReleases = 0;
  let releaseCheck: (() => void) | undefined;
  const slots: any[] = [],
    effects: (() => void)[] = [];
  const listeners = new Set<(value: string) => void>();
  const AppState = {
    currentState: "active",
    addEventListener: (_event: string, listener: (value: string) => void) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
  const setAppState = (value: string) => {
    AppState.currentState = value;
    for (const listener of listeners) listener(value);
  };
  const schedule = () => {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
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
    createContext: () => ({ Provider: "SyntheticProvider" }),
    useContext: () => {
      throw new Error(
        "The provider test does not consume its context through React.",
      );
    },
    useRef: (initial: unknown) => {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    useState: (initial: unknown) => {
      const index = cursor++,
        slot = (slots[index] ??= { value: initial });
      return [
        slot.value,
        (value: unknown) => {
          const next =
            typeof value === "function"
              ? (value as (prior: unknown) => unknown)(slot.value)
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
      const prior = slots[index],
        slot = (slots[index] = { dependencies, cleanup: undefined as unknown });
      effects.push(() => {
        if (typeof prior?.cleanup === "function") prior.cleanup();
        slot.cleanup = setup();
      });
    },
  };
  const nativeRecorders: NativeRecorder[] = [];
  class NativeRecorder {
    recording = false;
    uri = "file:///synthetic-recording.m4a";
    constructor() {
      nativeRecorders.push(this);
    }
    async prepareToRecordAsync() {}
    record() {
      this.recording = true;
      nativeStarts++;
    }
    getStatus() {
      return { isRecording: this.recording, durationMillis: 0, metering: -80 };
    }
    async stop() {
      this.recording = false;
    }
    release() {
      this.recording = false;
      nativeReleases++;
    }
  }
  const AudioModule = {
    getRecordingPermissionsAsync: async () => {
      checks++;
      if (options.deferCheck)
        await new Promise<void>((resolve) => {
          releaseCheck = resolve;
        });
      return { granted: permissionGranted };
    },
    requestRecordingPermissionsAsync: async () => {
      requests++;
      if (options.promptBackground ?? true) setAppState("background");
      permissionGranted = options.promptGrant ?? true;
      return { granted: permissionGranted };
    },
    AudioRecorder: NativeRecorder,
  };
  class Directory {
    create() {}
  }
  class File {}
  const db = {
    getAllAsync: async () => [],
    closeAsync: async () => {},
    runAsync: async () => {},
  };
  const recognition = {
    drain: async () => {},
    recognize: async () => {},
    edit: async () => {},
    confirm: async () => {},
    online: true,
  };
  const dependencies: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": {
      jsx: (_type: unknown, props: unknown) => ({ props }),
    },
    "react-native": { AppState },
    "expo-audio": {
      AudioModule,
      RecordingPresets: { HIGH_QUALITY: { android: {} } },
      setAudioModeAsync: async () => {},
    },
    "expo-file-system": {
      Directory,
      File,
      Paths: { document: "file:///synthetic-documents" },
    },
    "expo-crypto": {
      digestStringAsync: async () => "synthetic-namespace",
      CryptoDigestAlgorithm: { SHA256: "sha256" },
      randomUUID: () => "synthetic-recording-id",
    },
    "../../data/database": { openAccountDatabase: async () => db },
    "../../data/StudyProvider": {
      useStudy: () => ({ accountId: "synthetic-account" }),
    },
    "./audio-focus": { stopAudioPlayers: () => {} },
    "@packages/learning-core": {
      inspectRecording: () => {
        throw new Error("No completed recording is used in this test.");
      },
    },
    "./useRecognition": { useRecognition: () => recognition },
  };
  const source = fs.readFileSync(
    new URL(
      "../apps/native/src/features/speech/SpeechProvider.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as any };
  vm.runInThisContext(
    `(function(require,module,exports,setInterval,clearInterval){"use strict";${code}\n})`,
  )(
    (name: string) =>
      name in dependencies ? dependencies[name] : require(name),
    module,
    module.exports,
    () => 1,
    () => {},
  );
  let state: any;
  function render() {
    cursor = 0;
    state = module.exports.SpeechProvider({ children: null }).props.value;
    for (const effect of effects.splice(0)) effect();
  }
  const flush = async () => {
    for (let index = 0; index < 40; index++) await Promise.resolve();
  };
  render();
  return {
    get state() {
      return state;
    },
    get checks() {
      return checks;
    },
    get requests() {
      return requests;
    },
    get nativeStarts() {
      return nativeStarts;
    },
    get nativeReleases() {
      return nativeReleases;
    },
    get liveRecorders() {
      return nativeRecorders.filter((recorder) => recorder.recording).length;
    },
    setAppState,
    flush,
    releaseCheck: () => {
      assert(releaseCheck);
      releaseCheck();
    },
    async close() {
      await state.stop();
      await flush();
      disposed = true;
      for (const slot of slots)
        if (typeof slot?.cleanup === "function") slot.cleanup();
      await flush();
    },
  };
}

test("SpeechProvider starts an already-authorized microphone without requesting permission again", async () => {
  const fixture = mountSpeech({ granted: true });
  try {
    await fixture.flush();
    assert.equal(fixture.state.loading, false);
    const id = await fixture.state.start(
      "synthetic-chat",
      "chat-answer",
      "synthetic-chat",
    );
    await fixture.flush();
    assert.equal(
      fixture.requests,
      0,
      "An already-granted Android permission must not open a permission activity.",
    );
    assert.equal(fixture.checks, 1);
    assert.equal(id, "synthetic-recording-id");
    assert.equal(fixture.state.recording, true);
    assert.equal(fixture.nativeStarts, 1);
    assert.equal(fixture.liveRecorders, 1);
  } finally {
    await fixture.close();
  }
});

test("SpeechProvider retains permission and lifecycle gates when a first prompt interrupts the activity", async () => {
  const fixture = mountSpeech({ granted: false, promptGrant: true });
  try {
    await fixture.flush();
    assert.equal(
      await fixture.state.start(
        "synthetic-chat",
        "chat-answer",
        "synthetic-chat",
      ),
      undefined,
    );
    await fixture.flush();
    assert.equal(fixture.requests, 1);
    assert.equal(fixture.nativeStarts, 0);
    assert.equal(fixture.state.recording, false);
    fixture.setAppState("active");
    const id = await fixture.state.start(
      "synthetic-chat",
      "chat-answer",
      "synthetic-chat",
    );
    await fixture.flush();
    assert.equal(
      fixture.requests,
      1,
      "Resume must check the newly granted permission, without reopening its activity.",
    );
    assert.equal(id, "synthetic-recording-id");
    assert.equal(fixture.state.recording, true);
    assert.equal(fixture.nativeStarts, 1);
  } finally {
    await fixture.close();
  }
});

test("SpeechProvider does not record after permission is denied", async () => {
  const fixture = mountSpeech({
    granted: false,
    promptGrant: false,
    promptBackground: false,
  });
  try {
    await fixture.flush();
    assert.equal(
      await fixture.state.start(
        "synthetic-chat",
        "chat-answer",
        "synthetic-chat",
      ),
      undefined,
    );
    await fixture.flush();
    assert.equal(fixture.checks, 1);
    assert.equal(fixture.requests, 1);
    assert.equal(fixture.state.permissionDenied, true);
    assert.equal(fixture.nativeStarts, 0);
  } finally {
    await fixture.close();
  }
});

test("SpeechProvider does not open a prompt or recorder after a pending permission check is cancelled", async () => {
  const fixture = mountSpeech({ granted: false, deferCheck: true });
  try {
    await fixture.flush();
    const operation = fixture.state.start(
      "synthetic-chat",
      "chat-answer",
      "synthetic-chat",
    );
    await fixture.flush();
    await fixture.state.stop();
    fixture.releaseCheck();
    assert.equal(await operation, undefined);
    await fixture.flush();
    assert.equal(fixture.requests, 0);
    assert.equal(fixture.nativeStarts, 0);
    assert.equal(fixture.state.recording, false);
  } finally {
    await fixture.close();
  }
});
