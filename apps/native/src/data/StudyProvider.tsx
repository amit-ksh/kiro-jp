import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { api } from "@packages/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { localDayAt, validateStudyEvent, type StudyEvent, type Assessment } from "@packages/learning-core";
import { curriculum } from "@packages/content";
import { openAccountDatabase, accountTransaction } from "./database";
import { pendingStudyBatchSql } from "./studyOutbox";
import { cacheStudyPage } from "./syncCache";

type EventInput = Pick<StudyEvent, "sessionId" | "kind" | "stepId"> & Partial<Pick<StudyEvent, "input" | "support" | "dontKnow" | "context" | "spans" | "lessonId" | "lessonVersion">>;
export type CachedChat = NonNullable<FunctionReturnType<typeof api.conversation.get>>;
type SavedPhrases = FunctionReturnType<typeof api.references.list>;
type SentenceFeedback = Record<string, FunctionReturnType<typeof api.assessment.list>[number]>;
type State = { accountId:string; events: StudyEvent[]; sentenceFeedback:SentenceFeedback; checked:Record<string,Assessment>; phrases: SavedPhrases; chats: Record<string, CachedChat>; cacheChat: (chat: CachedChat) => Promise<void>; drafts: Record<string, string>; saveDraft: (sessionId: string, stepId: string, input: string) => Promise<void>; loading: boolean; pending: number; error: string; append: (input: EventInput) => Promise<StudyEvent>; retry: () => void };
const Context = createContext<State | null>(null);
export function StudyProvider({ accountId, cloudReady, children }: { accountId: string; cloudReady: boolean; children: ReactNode }) {
  const [events, setEvents] = useState<StudyEvent[]>([]), [loading, setLoading] = useState(true), [cursor, setCursor] = useState(0), [pending, setPending] = useState(0), [error, setError] = useState(""), [retryCount, setRetryCount] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [chats, setChats] = useState<Record<string, CachedChat>>({});
  const [phrases, setPhrases] = useState<SavedPhrases>([]);
  const [sentenceFeedback,setSentenceFeedback]=useState<SentenceFeedback>({});
  const checked=useMemo(()=>Object.fromEntries(Object.entries(sentenceFeedback).flatMap(([id,row])=>row.status==="ready"&&row.assessment?[[id,row.assessment as Assessment]]:[])),[sentenceFeedback]);
  const dbRef = useRef<SQLiteDatabase | null>(null), epochRef = useRef(0), serial = useRef(Promise.resolve()), deviceId = useRef(""), sequence = useRef(0), syncing = useRef(false);
  const remote = useQuery(api.study.changes, cloudReady && !loading ? { afterCursor: cursor } : "skip");
  const push = useMutation(api.study.push);
  const remotePhrases = useQuery(api.references.list, cloudReady && !loading ? {} : "skip");
  const remoteSentences = useQuery(api.assessment.list,cloudReady&&!loading?{}:"skip");
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
      const savedChats = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM study_metadata WHERE key LIKE 'chat:%'");
      const savedPhrases = await db.getFirstAsync<{ value: string }>("SELECT value FROM study_metadata WHERE key='saved-phrases'");
      const savedSentences=await db.getFirstAsync<{value:string}>("SELECT value FROM study_metadata WHERE key='sentence-feedback'");
      if (epoch !== epochRef.current) return;
      deviceId.current = device.value; sequence.current = Number(lastSequence?.value ?? 0); dbRef.current = db;
      setDrafts(Object.fromEntries(savedDrafts.map(draft => [draft.id.slice(7), draft.body])));
      setChats(Object.fromEntries(savedChats.map(chat => [chat.key.slice(5), JSON.parse(chat.value) as CachedChat])));
      setPhrases(savedPhrases ? JSON.parse(savedPhrases.value) as SavedPhrases : []);
      setSentenceFeedback(savedSentences?JSON.parse(savedSentences.value) as SentenceFeedback:{});
      await refresh(db, epoch); if (epoch === epochRef.current) { setCursor(Number(savedCursor?.value ?? 0)); setLoading(false); }
    })().catch(() => { if (epoch === epochRef.current) { setLoading(false); setError("Study storage couldn't open. Your account remains saved; restart to try again."); } });
    return () => { epochRef.current = epoch + 1; syncing.current = false; const db = owned; if (db) void serial.current.then(async () => { if (dbRef.current === db) dbRef.current = null; await db.closeAsync(); }); };
  }, [accountId, refresh]);
  useEffect(()=>{if(!remoteSentences||loading)return;const epoch=epochRef.current;void enqueue(async()=>{const db=dbRef.current;if(!db||epoch!==epochRef.current)return;const stored=await db.getFirstAsync<{value:string}>("SELECT value FROM study_metadata WHERE key='sentence-feedback'");const merged={...(stored?JSON.parse(stored.value) as SentenceFeedback:{}),...Object.fromEntries(remoteSentences.map(row=>[row.eventId,row]))};await db.runAsync("INSERT INTO study_metadata (key,value) VALUES ('sentence-feedback',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(merged));if(epoch===epochRef.current)setSentenceFeedback(merged);}).catch(()=>{if(epoch===epochRef.current)setError("Sentence feedback is saved online. Reconnect to cache it here.");});},[remoteSentences,loading,retryCount,enqueue]);
  useEffect(() => {
    if (!remotePhrases || loading) return;
    const epoch = epochRef.current;
    void enqueue(async () => { const db = dbRef.current; if (!db || epoch !== epochRef.current) return; await db.runAsync("INSERT INTO study_metadata (key,value) VALUES ('saved-phrases',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(remotePhrases)); if (epoch === epochRef.current) setPhrases(remotePhrases); }).catch(() => { if (epoch === epochRef.current) setError("Your references are saved online. Reconnect to cache them on this phone."); });
  }, [remotePhrases, loading, retryCount, enqueue]);
  const cacheChat = useCallback(async (chat: CachedChat) => {
    const epoch = epochRef.current;
    await enqueue(async () => {
      const db = dbRef.current; if (!db || epoch !== epochRef.current) return;
      const key = `chat:${chat.conversation._id}`, stored = await db.getFirstAsync<{value:string}>("SELECT value FROM study_metadata WHERE key=?",key);
      const previous = stored ? JSON.parse(stored.value) as CachedChat : undefined;
      const messages = [...new Map([...(previous?.messages ?? []),...chat.messages].map(message=>[message.messageId,message])).values()].sort((a,b)=>a.order-b.order || a._creationTime-b._creationTime);
      const merged = {...chat,messages}; let body=JSON.stringify(merged);
      while(body.length>600_000 && messages.length>1){messages.shift();body=JSON.stringify(merged);}
      if(body.length>600_000)return;
      await db.runAsync("INSERT INTO study_metadata (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",key,body);
      if(epoch===epochRef.current)setChats(current=>({...current,[chat.conversation._id]:merged}));
    });
  }, [enqueue]);
  const saveDraft = useCallback(async (sessionId: string, stepId: string, input: string) => {
    const epoch = epochRef.current, key = `${sessionId}:${stepId}`;
    if (input.length > (stepId === "chat-pending" ? 4096 : 1000)) throw new Error("Answer is too long.");
    setDrafts(current => ({ ...current, [key]: input }));
    await enqueue(async () => { const db = dbRef.current; if (!db || epoch !== epochRef.current) return; await db.runAsync("INSERT INTO drafts (id,body,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at", `answer:${key}`, input, Date.now()); });
  }, [enqueue]);
  const append = useCallback(async (input: EventInput) => {
    const epoch = epochRef.current; let created: StudyEvent | null = null;
    await enqueue(async () => {
      const db = dbRef.current; if (!db || epoch !== epochRef.current) throw new Error("Study storage is not ready.");
      const now = Date.now(), offsetMinutes = new Date(now).getTimezoneOffset();
      const conversation = input.kind === "conversationActivity" || (input.kind === "audioActivity" && input.stepId === "chat");
      const reference = input.kind === "audioActivity" && input.stepId === "reference";
      const review = input.kind === "reviewActivity" || (input.kind === "audioActivity" && input.stepId.startsWith("review:"));
      const library = input.kind === "audioActivity" && input.stepId.startsWith("library:");
      let lesson = input.kind === "started" ? curriculum.get(input.lessonId ?? "", input.lessonVersion ?? 0) : undefined;
      if (!conversation && !reference && !review && !library && input.kind !== "started") {
        const start = await db.getFirstAsync<{ body: string }>("SELECT body FROM study_events WHERE session_id=? AND json_extract(body,'$.kind')='started' ORDER BY rowid LIMIT 1", input.sessionId);
        if (start) lesson = curriculum.forEvent(JSON.parse(start.body) as StudyEvent);
      }
      const event: StudyEvent = { ...input, eventId: Crypto.randomUUID(), deviceId: deviceId.current, sequence: sequence.current + 1, lessonId: review ? "review" : library ? "library" : reference ? "reference" : conversation ? "conversation" : lesson?.id ?? "", lessonVersion: conversation || reference || review || library ? 1 : lesson?.version ?? 0, occurredAt: now, localDay: localDayAt(now, offsetMinutes), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes, support: input.support ?? [], spans: input.spans ?? [] };
      validateStudyEvent(event, curriculum.forEvent(event), now);
      await accountTransaction(db, async tx => { await tx.runAsync("INSERT INTO study_events (event_id,session_id,body) VALUES (?,?,?)", event.eventId, event.sessionId, JSON.stringify(event)); await tx.runAsync("INSERT INTO study_metadata (key,value) VALUES ('sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", String(event.sequence)); });
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
      const nextCursor = await cacheStudyPage(remote, work => accountTransaction(db, work));
      if (epoch !== epochRef.current) return;
      await refresh(db, epoch); setCursor(nextCursor); setError("");
    }).catch(() => { if (epoch === epochRef.current) setError("Cloud activity couldn't be saved on this phone. Your local study is retained."); });
  }, [remote, loading, retryCount, enqueue, refresh]);
  useEffect(() => {
    if (loading || !cloudReady || !pending || syncing.current) return;
    const epoch = epochRef.current; syncing.current = true;
    void (async () => {
      let batch: StudyEvent[] = [];
      await enqueue(async () => { if (epoch === epochRef.current && dbRef.current) { const rows = await dbRef.current.getAllAsync<{ body: string }>(pendingStudyBatchSql); batch = rows.map(row => JSON.parse(row.body)); } });
      if (!batch.length || epoch !== epochRef.current) return;
      const receipts = await push({ events: batch });
      await enqueue(async () => {
        const db = dbRef.current; if (!db || epoch !== epochRef.current) return;
        await accountTransaction(db, async tx => { for (const receipt of receipts) await tx.runAsync("UPDATE study_events SET acknowledged=1 WHERE event_id=?", receipt.eventId); });
        await refresh(db, epoch); setError("");
      });
    })().catch(() => { if (epoch === epochRef.current) setError("Progress is safe. Synchronization will retry automatically."); }).finally(() => { if (epoch === epochRef.current) { syncing.current = false; } });
  }, [cloudReady, loading, pending, retryCount, events, enqueue, refresh, push]);
  useEffect(() => { const timer = setInterval(() => setRetryCount(count => count + 1), 30_000); return () => clearInterval(timer); }, []);
  return <Context.Provider value={{ accountId,events, sentenceFeedback, checked, phrases, chats, cacheChat, drafts, saveDraft, loading, pending, error, append, retry: () => setRetryCount(count => count + 1) }}>{children}</Context.Provider>;
}
export function useStudy() { const state = useContext(Context); if (!state) throw new Error("StudyProvider is required."); return state; }
