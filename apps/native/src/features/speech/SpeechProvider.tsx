import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  type AudioRecorder,
} from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { openAccountDatabase } from "../../data/database";
import { useStudy } from "../../data/StudyProvider";
import { stopAudioPlayers } from "./audio-focus";
import { inspectRecording } from "@packages/learning-core";
export interface LocalRecording {
  id: string;
  sessionId: string;
  cueId: string;
  uri: string;
  durationMillis: number;
  bytes: number;
  createdAt: number;
  recognitionStatus: "pending" | "unavailable" | "ready";
  recognizedTranscript?: string;
  learnerConfirmedText?: string;
  wasEdited?: boolean;
}
type Current = {
  recorder: AudioRecorder;
  id: string;
  sessionId: string;
  cueId: string;
  db: SQLiteDatabase;
  directory: Directory;
  durationMillis: number;
};
type State = {
  recordings: LocalRecording[];
  recording: boolean;
  durationMillis: number;
  loading: boolean;
  error: string;
  permissionDenied: boolean;
  start: (sessionId: string, cueId: string) => Promise<void>;
  stop: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};
const Context = createContext<State | null>(null);
export function SpeechProvider({ children }: { children: ReactNode }) {
  const { accountId } = useStudy();
  const [recordings, setRecordings] = useState<LocalRecording[]>([]),
    [recording, setRecording] = useState(false),
    [durationMillis, setDuration] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [permissionDenied, setDenied] = useState(false);
  const requestVersion = useRef(0);
  const dbRef = useRef<SQLiteDatabase | null>(null),
    directoryRef = useRef<Directory | null>(null),
    current = useRef<Current | null>(null),
    ending = useRef<Promise<void> | null>(null),
    mounted = useRef(false),
    starting = useRef(false),
    epoch = useRef(0);
  const refresh = useCallback(async (db: SQLiteDatabase) => {
    const rows = await db.getAllAsync<{ value: string }>(
      "SELECT value FROM study_metadata WHERE key LIKE 'recording:%' ORDER BY key",
    );
    const records = rows
      .map((row) => JSON.parse(row.value) as LocalRecording)
      .sort((a, b) => b.createdAt - a.createdAt);
    if (mounted.current && dbRef.current === db) setRecordings(records);
  }, []);
  const stop = useCallback(async () => {
    requestVersion.current += 1;
    if (ending.current) return ending.current;
    const owned = current.current;
    if (!owned) return;
    current.current = null;
    const work = (async () => {
      try {
        const before = owned.recorder.getStatus();
        owned.durationMillis = Math.max(
          owned.durationMillis,
          before.durationMillis,
        );
        if (before.isRecording) await owned.recorder.stop();
        const uri = owned.recorder.uri ?? before.url;
        if (!uri || owned.durationMillis < 150)
          throw new Error("No recording captured.");
        const source = new File(uri);
        if (
          !source.exists ||
          source.size <= 0 ||
          source.size > 2 * 1024 * 1024 ||
          owned.durationMillis > 31000
        )
          throw new Error("Recording exceeds practice limits.");
        const destination = new File(owned.directory, `${owned.id}.m4a`);
        const media = inspectRecording(await source.bytes());
        source.copy(destination);
        const record: LocalRecording = {
          id: owned.id,
          sessionId: owned.sessionId,
          cueId: owned.cueId,
          uri: destination.uri,
          durationMillis: media.durationMillis,
          bytes: destination.size,
          createdAt: Date.now(),
          recognitionStatus: "pending",
        };
        await owned.db.runAsync(
          "INSERT INTO study_metadata(key,value) VALUES(?,?)",
          `recording:${owned.id}`,
          JSON.stringify(record),
        );
        if (source.exists) source.delete();
        await refresh(owned.db);
      } catch {
        if (mounted.current)
          setError(
            "The recording couldn't be saved. Keep practising with model audio or type instead; no answer was marked wrong.",
          );
      } finally {
        owned.recorder.release();
        if (mounted.current) {
          setRecording(false);
          setDuration(0);
        }
        await setAudioModeAsync({
          allowsRecording: false,
          shouldPlayInBackground: false,
        }).catch(() => {});
      }
    })();
    ending.current = work;
    try {
      await work;
    } finally {
      ending.current = null;
    }
  }, [refresh]);
  useEffect(() => {
    const turn = ++epoch.current;
    mounted.current = true;
    setLoading(true);
    let ownedDb: SQLiteDatabase | null = null;
    void (async () => {
      const db = await openAccountDatabase(accountId);
      ownedDb = db;
      if (!mounted.current || epoch.current !== turn) {
        await db.closeAsync();
        ownedDb = null;
        return;
      }
      const namespace = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${process.env.EXPO_PUBLIC_CONVEX_URL}:${accountId}`,
      );
      const directory = new Directory(Paths.document, "recordings", namespace);
      directory.create({ intermediates: true, idempotent: true });
      if (!mounted.current || epoch.current !== turn) {
        await db.closeAsync();
        ownedDb = null;
        return;
      }
      dbRef.current = db;
      directoryRef.current = directory;
      await refresh(db);
      setLoading(false);
    })().catch(() => {
      if (mounted.current && epoch.current === turn) {
        setError(
          "Recording storage is unavailable. You can continue with listening or typing.",
        );
        setLoading(false);
      }
    });
    return () => {
      mounted.current = false;
      directoryRef.current = null;
      dbRef.current = null;
      void stop().finally(() => ownedDb?.closeAsync());
    };
  }, [accountId, refresh, stop]);
  useEffect(() => {
    const timer = setInterval(() => {
      const owned = current.current;
      if (!owned) return;
      try {
        const status = owned.recorder.getStatus();
        owned.durationMillis = Math.max(
          owned.durationMillis,
          status.durationMillis,
        );
        if (mounted.current) setDuration(owned.durationMillis);
        if (!status.isRecording || owned.durationMillis >= 29000) void stop();
      } catch {
        void stop();
      }
    }, 200);
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") void stop();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [stop]);
  const start = useCallback(async (sessionId: string, cueId: string) => {
    if (starting.current || current.current || ending.current) return;
    const turn = epoch.current;
    const request = ++requestVersion.current;
    starting.current = true;
    setError("");
    try {
      const db = dbRef.current,
        directory = directoryRef.current;
      if (!db || !directory) throw new Error("Storage unavailable.");
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setDenied(true);
        return;
      }
      setDenied(false);
      if (
        !mounted.current ||
        epoch.current !== turn ||
        requestVersion.current !== request ||
        AppState.currentState !== "active"
      )
        return;
      stopAudioPlayers();
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        shouldPlayInBackground: false,
        interruptionMode: "doNotMix",
      });
      const options = {
        ...RecordingPresets.HIGH_QUALITY,
        numberOfChannels: 1,
        android: {
          ...RecordingPresets.HIGH_QUALITY.android,
          maxFileSize: 2 * 1024 * 1024,
        },
      };
      // Own this native resource until stop/copy finishes, including route exit.
      // Installed Expo AudioModule.types declares this native constructor;
      // eslint's namespace resolver does not follow NativeAudioModule members.
      // eslint-disable-next-line import/namespace
      const { AudioRecorder: NativeRecorder } = AudioModule;
      const recorder = new NativeRecorder({
        ...options,
        ...options.android,
      });
      try {
        await recorder.prepareToRecordAsync(options);
        if (
          !mounted.current ||
          epoch.current !== turn ||
          requestVersion.current !== request ||
          AppState.currentState !== "active"
        ) {
          recorder.release();
          return;
        }
        current.current = {
          recorder,
          id: Crypto.randomUUID(),
          sessionId,
          cueId,
          db,
          directory,
          durationMillis: 0,
        };
        recorder.record({ forDuration: 29 });
        setRecording(true);
        setDuration(0);
      } catch {
        current.current = null;
        recorder.release();
        throw new Error("Microphone unavailable.");
      }
    } catch {
      if (mounted.current)
        setError(
          "Recording is unavailable. Continue with model audio or type instead; speaking wasn't assessed.",
        );
    } finally {
      starting.current = false;
      if (!current.current)
        await setAudioModeAsync({
          allowsRecording: false,
          shouldPlayInBackground: false,
        }).catch(() => {});
    }
  }, []);
  const remove = useCallback(
    async (id: string) => {
      const db = dbRef.current,
        directory = directoryRef.current;
      if (!db || !directory || !/^[-a-z0-9]{36}$/u.test(id)) return;
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM study_metadata WHERE key=?",
        `recording:${id}`,
      );
      if (!row) return;
      stopAudioPlayers();
      const file = new File(directory, `${id}.m4a`);
      if (file.exists) file.delete();
      await db.runAsync(
        "DELETE FROM study_metadata WHERE key=?",
        `recording:${id}`,
      );
      await refresh(db);
    },
    [refresh],
  );
  return (
    <Context.Provider
      value={{
        recordings,
        recording,
        durationMillis,
        loading,
        error,
        permissionDenied,
        start,
        stop,
        remove,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSpeech() {
  const state = useContext(Context);
  if (!state) throw new Error("SpeechProvider required.");
  return state;
}
