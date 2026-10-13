import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { initialProfile, type LearningProfile } from "@packages/learning-core";
import type { SQLiteDatabase } from "expo-sqlite";
import { openAccountDatabase, preserveConflict, readLocalProfile, writeLocalProfile, type LocalProfile } from "./database";

type ProfilePatch = Partial<LearningProfile> | ((current: LearningProfile) => Partial<LearningProfile>);
type ProfileState = { profile: LearningProfile; loading: boolean; syncState: "saved" | "pending" | "conflict" | "error"; error: string; update: (patch: ProfilePatch) => Promise<void>; retry: () => void; adoptCloud: () => Promise<void> };
const Context = createContext<ProfileState | null>(null);
export function ProfileProvider({ accountId, cloudReady, children }: { accountId: string; cloudReady: boolean; children: ReactNode }) {
  const remote = useQuery(api.profile.get, cloudReady ? {} : "skip");
  const push = useMutation(api.profile.update);
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<ProfileState["syncState"]>("saved");
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const dbRef = useRef<SQLiteDatabase | null>(null);
  const localRef = useRef<LocalProfile>({ data: initialProfile(), serverRevision: 0, localRevision: 0, acknowledgedRevision: 0 });
  const serial = useRef(Promise.resolve());
  const active = useRef(true);
  const lifecycle = useRef(0);
  const pushing = useRef(false);
  const conflict = useRef(false);
  const enqueue = useCallback((fn: () => Promise<void>) => {
    const next = serial.current.then(fn); serial.current = next.catch(() => {}); return next;
  }, []);
  useEffect(() => {
    const epoch = ++lifecycle.current;
    let cancelled = false;
    let ownedDb: SQLiteDatabase | null = null;
    active.current = true;
    setLoading(true);
    void (async () => {
      const db = await openAccountDatabase(accountId);
      if (cancelled || epoch !== lifecycle.current) { await db.closeAsync(); return; }
      ownedDb = db;
      const cached = await readLocalProfile(db);
      if (cancelled || epoch !== lifecycle.current) return;
      dbRef.current = db;
      if (cached) localRef.current = cached;
      setProfile(localRef.current.data); setLoading(false); setSyncState(localRef.current.localRevision > localRef.current.acknowledgedRevision ? "pending" : "saved");
    })().catch(() => { if (!cancelled && epoch === lifecycle.current) { setLoading(false); setError("Local storage couldn't open. Restart the app to try again."); setSyncState("error"); } });
    return () => {
      cancelled = true;
      active.current = false; pushing.current = false;
      const db = ownedDb;
      if (db) void serial.current.then(async () => { if (dbRef.current === db) dbRef.current = null; await db.closeAsync(); });
    };
  }, [accountId]);
  const update = useCallback((patch: ProfilePatch) => {
    const epoch = lifecycle.current;
    return enqueue(async () => {
    if (!active.current || epoch !== lifecycle.current || !dbRef.current) throw new Error("Your learning storage is not ready.");
    const resolved = typeof patch === "function" ? patch(localRef.current.data) : patch;
    const next = { ...localRef.current, data: { ...localRef.current.data, ...resolved }, localRevision: localRef.current.localRevision + 1 };
    await writeLocalProfile(dbRef.current, next);
    if (!active.current || epoch !== lifecycle.current) return;
    localRef.current = next;
    if (active.current) { setProfile(next.data); setSyncState(conflict.current ? "conflict" : "pending"); setError(""); }
    });
  }, [enqueue]);
  useEffect(() => {
    if (!cloudReady || loading || remote === undefined || !dbRef.current || pushing.current) return;
    const epoch = lifecycle.current;
    const isCurrent = () => active.current && epoch === lifecycle.current;
    void (async () => {
      let snapshot: LocalProfile | null = null;
      await enqueue(async () => {
      if (!isCurrent() || !dbRef.current) return;
      const local = localRef.current;
      if (remote && remote.revision > local.serverRevision) {
        if (local.localRevision > local.acknowledgedRevision) { conflict.current = true; setSyncState("conflict"); return; }
        const next = { ...local, data: remote.data, serverRevision: remote.revision };
        await writeLocalProfile(dbRef.current, next);
        if (!isCurrent()) return;
        localRef.current = next; setProfile(next.data);
      }
      if (conflict.current || pushing.current || localRef.current.localRevision === localRef.current.acknowledgedRevision) return;
      pushing.current = true;
      snapshot = localRef.current;
      });
      if (!snapshot) return;
      if (!isCurrent()) return;
      const sent = snapshot as LocalProfile;
      try {
        const result = await push({ data: sent.data, expectedRevision: sent.serverRevision });
        await enqueue(async () => {
        if (!isCurrent() || !dbRef.current) return;
        const ack = { ...localRef.current, serverRevision: result.revision, acknowledgedRevision: sent.localRevision };
        await writeLocalProfile(dbRef.current, ack);
        if (!isCurrent()) return;
        localRef.current = ack;
        setSyncState(ack.localRevision === ack.acknowledgedRevision ? "saved" : "pending");
        });
        if (isCurrent()) { pushing.current = false; setRetryCount(count => count + 1); }
      } catch (failure) {
        if (!isCurrent()) return;
        if (String(failure).includes("STALE_REVISION")) { conflict.current = true; setSyncState("conflict"); }
        else { setSyncState("pending"); setError("Saved on this phone. Cloud sync will retry when you reconnect."); }
      } finally { if (isCurrent()) pushing.current = false; }
    })().catch(() => { if (isCurrent()) { setSyncState("error"); setError("Your local progress couldn't be updated. Try again."); } });
  }, [cloudReady, remote, loading, profile, push, retryCount, enqueue]);
  const adoptCloud = useCallback(() => enqueue(async () => {
    if (!remote || !dbRef.current) return;
    await preserveConflict(dbRef.current, localRef.current.data);
    const next = { data: remote.data, serverRevision: remote.revision, localRevision: localRef.current.localRevision + 1, acknowledgedRevision: localRef.current.localRevision + 1 };
    await writeLocalProfile(dbRef.current, next); localRef.current = next; conflict.current = false;
    setProfile(next.data); setSyncState("saved"); setError("");
  }), [enqueue, remote]);
  return <Context.Provider value={{ profile, loading, syncState, error, update, retry: () => setRetryCount(count => count + 1), adoptCloud }}>{children}</Context.Provider>;
}
export function useProfile() { const value = useContext(Context); if (!value) throw new Error("ProfileProvider is required."); return value; }
