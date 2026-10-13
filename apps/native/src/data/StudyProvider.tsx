import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { api } from "@packages/backend/convex/_generated/api";
import { localDayAt, validateStudyEvent, type StudyEvent } from "@packages/learning-core";
import { requestsLesson } from "@packages/content";
import { openAccountDatabase } from "./database";

type EventInput = Pick<StudyEvent, "sessionId" | "kind" | "stepId"> & Partial<Pick<StudyEvent, "input" | "support" | "dontKnow" | "context" | "spans">>;
type State = { events: StudyEvent[]; drafts: Record<string, string>; saveDraft: (sessionId: string, stepId: string, input: string) => Promise<void>; loading: boolean; pending: number; error: string; append: (input: EventInput) => Promise<StudyEvent>; retry: () => void };
const Context = createContext<State | null>(null);
export function StudyProvider({ accountId, cloudReady, children }: { accountId: string; cloudReady: boolean; children: ReactNode }) {
  const [events, setEvents] = useState<StudyEvent[]>([]), [loading, setLoading] = useState(true), [cursor, setCursor] = useState(0), [pending, setPending] = useState(0), [error, setError] = useState(""), [retryCount, setRetryCount] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dbRef = useRef<SQLiteDatabase | null>(null), epochRef = useRef(0), serial = useRef(Promise.resolve()), deviceId = useRef(""), sequence = useRef(0), syncing = useRef(false);
  const remote = useQuery(api.study.changes, cloudReady && !loading ? { afterCursor: cursor } : "skip");
  const push = useMutation(api.study.push);
  const enqueue = useCallback((work: () => Promise<void>) => { const next = serial.current.then(work); serial.current = next.catch(() => {}); return next; }, []);
  const refresh = useCallback(async (db: SQLiteDatabase, epoch: number) => {
    const rows = await db.getAllAsync<{ body: string; acknowledged: number }>("SELECT body, acknowledged FROM study_events ORDER BY rowid");
    if (epoch !== epochRef.current) return;
    setEvents(rows.map(row => JSON.parse(row.body) as StudyEvent)); setPending(rows.filter(row => !row.acknowledged).length);
  }, []);
  useEffect(() => {
    const epoch = ++epochRef.current; let owned: SQLiteDatabase | null = null; setLoading(true);
    void (async () => {
      const db = await openAccountDatabase(accountId); owned = db;
      if (epoch !== epochRef.current) { await db.closeAsync(); owned = null; return; }
      let device = await db.getFirstAsync<{ value: string }>("SELECT value FROM study_metadata WHERE key='device'");
      if (!device) { device = { value: Crypto.randomUUID() }; await db.runAsync("INSERT INTO study_metadata (key,value) VALUES ('device',?)", device.value); }
      const savedCursor = await db.getFirstAsync<{ value: string }>("SELECT value FROM study_metadata WHERE key='cursor'");
      const lastSequence = await db.getFirstAsync<{ value: string }>("SELECT value FROM study_metadata WHERE key='sequence'");
      const savedDrafts = await db.getAllAsync<{ id: string; body: string }>("SELECT id, body FROM drafts WHERE id LIKE 'answer:%'");
      if (epoch !== epochRef.current) return;
      deviceId.current = device.value; sequence.current = Number(lastSequence?.value ?? 0); dbRef.current = db;
      setDrafts(Object.fromEntries(savedDrafts.map(draft => [draft.id.slice(7), draft.body])));
      await refresh(db, epoch); if (epoch === epochRef.current) { setCursor(Number(savedCursor?.value ?? 0)); setLoading(false); }
    })().catch(() => { if (epoch === epochRef.current) { setLoading(false); setError("Study storage couldn't open. Your account remains saved; restart to try again."); } });
    return () => { epochRef.current = epoch + 1; syncing.current = false; const db = owned; if (db) void serial.current.then(async () => { if (dbRef.current === db) dbRef.current = null; await db.closeAsync(); }); };
  }, [accountId, refresh]);
  const saveDraft = useCallback(async (sessionId: string, stepId: string, input: string) => {
    const epoch = epochRef.current, key = `${sessionId}:${stepId}`;
    if (input.length > 1000) throw new Error("Answer is too long.");
    setDrafts(current => ({ ...current, [key]: input }));
    await enqueue(async () => { const db = dbRef.current; if (!db || epoch !== epochRef.current) return; await db.runAsync("INSERT INTO drafts (id,body,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at", `answer:${key}`, input, Date.now()); });
  }, [enqueue]);
  const append = useCallback(async (input: EventInput) => {
    const epoch = epochRef.current; let created: StudyEvent | null = null;
    await enqueue(async () => {
      const db = dbRef.current; if (!db || epoch !== epochRef.current) throw new Error("Study storage is not ready.");
      const now = Date.now(), offsetMinutes = new Date(now).getTimezoneOffset();
      const event: StudyEvent = { ...input, eventId: Crypto.randomUUID(), deviceId: deviceId.current, sequence: sequence.current + 1, lessonId: requestsLesson.id, lessonVersion: requestsLesson.version, occurredAt: now, localDay: localDayAt(now, offsetMinutes), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes, support: input.support ?? [], spans: input.spans ?? [] };
      validateStudyEvent(event, requestsLesson, now);
      await db.withExclusiveTransactionAsync(async tx => { await tx.runAsync("INSERT INTO study_events (event_id,session_id,body) VALUES (?,?,?)", event.eventId, event.sessionId, JSON.stringify(event)); await tx.runAsync("INSERT INTO study_metadata (key,value) VALUES ('sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(event.sequence)); });
      if (epoch !== epochRef.current) return;
      sequence.current = event.sequence; created = event; await refresh(db, epoch);
    });
    if (!created) throw new Error("Your account changed before the activity was saved.");
    return created as StudyEvent;
  }, [enqueue, refresh]);
  useEffect(() => {
    if (loading || !remote?.length) return;
    const epoch = epochRef.current;
    void enqueue(async () => {
      const db = dbRef.current; if (!db || epoch !== epochRef.current) return;
      const nextCursor = remote[remote.length - 1]!.cursor;
      await db.withExclusiveTransactionAsync(async tx => {
        for (const row of remote) { await tx.runAsync("INSERT INTO study_events (event_id,session_id,body,acknowledged) VALUES (?,?,?,1) ON CONFLICT(event_id) DO UPDATE SET acknowledged=1", row.event.eventId, row.event.sessionId, JSON.stringify(row.event)); }
        await tx.runAsync("INSERT INTO study_metadata (key,value) VALUES ('cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(nextCursor));
      });
      if (epoch !== epochRef.current) return;
      await refresh(db, epoch); setCursor(nextCursor);
    }).catch(() => { if (epoch === epochRef.current) setError("Cloud activity couldn't be saved on this phone. Your local study is retained."); });
  }, [remote, loading, enqueue, refresh]);
  useEffect(() => {
    if (loading || !cloudReady || !pending || syncing.current) return;
    const epoch = epochRef.current; syncing.current = true;
    void (async () => {
      let batch: StudyEvent[] = [];
      await enqueue(async () => { if (epoch === epochRef.current && dbRef.current) { const rows = await dbRef.current.getAllAsync<{ body: string }>("SELECT body FROM study_events WHERE acknowledged=0 ORDER BY rowid LIMIT 50"); batch = rows.map(row => JSON.parse(row.body)); } });
      if (!batch.length || epoch !== epochRef.current) return;
      const receipts = await push({ events: batch });
      await enqueue(async () => {
        const db = dbRef.current; if (!db || epoch !== epochRef.current) return;
        await db.withExclusiveTransactionAsync(async tx => { for (const receipt of receipts) await tx.runAsync("UPDATE study_events SET acknowledged=1 WHERE event_id=?", receipt.eventId); });
        await refresh(db, epoch); setError("");
      });
    })().catch(() => { if (epoch === epochRef.current) setError("Saved on this phone. Study synchronization will retry when you reconnect."); }).finally(() => { if (epoch === epochRef.current) { syncing.current = false; } });
  }, [cloudReady, loading, pending, retryCount, events, enqueue, refresh, push]);
  useEffect(() => { const timer = setInterval(() => setRetryCount(count => count + 1), 30_000); return () => clearInterval(timer); }, []);
  return <Context.Provider value={{ events, drafts, saveDraft, loading, pending, error, append, retry: () => setRetryCount(count => count + 1) }}>{children}</Context.Provider>;
}
export function useStudy() { const state = useContext(Context); if (!state) throw new Error("StudyProvider is required."); return state; }
