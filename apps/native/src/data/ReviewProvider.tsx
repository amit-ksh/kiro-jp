import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useConvexConnectionState } from "convex/react";
import * as Crypto from "expo-crypto";
import type { SQLiteDatabase } from "expo-sqlite";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { requestsLesson } from "@packages/content";
import {
  lessonReviewIntroductions,
  phraseReviewIntroductions,
  projectReviews,
  localDayAt,
  validateReviewAttempt,
  type ReviewAttempt,
  type ReviewChange,
  type ReviewOpportunity,
  type SupportFlag,
} from "@packages/learning-core";
import { openAccountDatabase, accountTransaction } from "./database";
import { useStudy } from "./StudyProvider";

export interface ReviewQuestion {
  eventId: string;
  trackId: string;
  opportunity: ReviewOpportunity;
  mode: "due" | "extra";
  correction: boolean;
}
export interface ReviewRun {
  id: string;
  questions: ReviewQuestion[];
  index: number;
  input: string;
  support: SupportFlag[];
}
type Projection = Awaited<ReturnType<typeof projectReviews>>;
type State = Projection & {
  loading: boolean;
  pending: number;
  error: string;
  run: ReviewRun | null;
  saveRun: (run: ReviewRun | null) => Promise<void>;
  submit: (
    question: ReviewQuestion,
    input: string,
    support: SupportFlag[],
    dontKnow: boolean,
    sessionId: string,
  ) => Promise<void>;
  retry: () => void;
};
const Context = createContext<State | null>(null);
const digest = (text: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const empty: Projection = {
  tracks: [],
  opportunities: new Map(),
  receipts: new Map(),
  attempts: [],
  provisional: new Set(),
};
export function ReviewProvider({
  cloudReady,
  children,
}: {
  cloudReady: boolean;
  children: ReactNode;
}) {
  const study = useStudy(),
    accountId = study.accountId,
    connection = useConvexConnectionState();
  const online = cloudReady && connection.isWebSocketConnected;
  const [projection, setProjection] = useState<Projection>(empty),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(0),
    [cursor, setCursor] = useState(0),
    [error, setError] = useState(""),
    [run, setRun] = useState<ReviewRun | null>(null),
    [retry, setRetry] = useState(0);
  const dbRef = useRef<SQLiteDatabase | null>(null),
    epoch = useRef(0),
    serial = useRef(Promise.resolve()),
    syncing = useRef(false),
    device = useRef(""),
    sequence = useRef(0);
  const latest = useRef({ study, projection });
  latest.current = { study, projection };
  const push = useMutation(api.reviews.push),
    ensureLesson = useMutation(api.reviews.ensureLesson),
    ensurePhrase = useMutation(api.reviews.ensurePhrase);
  const remote = useQuery(
    api.reviews.pull,
    online && !loading ? { afterCursor: cursor } : "skip",
  );
  const enqueue = useCallback((work: () => Promise<void>) => {
    const next = serial.current.then(work);
    serial.current = next.catch(() => {});
    return next;
  }, []);
  const refresh = useCallback(
    async (db: SQLiteDatabase, generation: number) => {
      const saved = await db.getAllAsync<{
        body: string;
        acknowledged: number;
      }>("SELECT body,acknowledged FROM review_events ORDER BY rowid");
      const changes = await db.getAllAsync<{ body: string }>(
        "SELECT body FROM review_changes ORDER BY cursor",
      );
      const source = latest.current.study;
      const introductions = [
        ...new Set(
          source.events
            .filter((e) => e.kind === "started")
            .map((e) => e.sessionId),
        ),
      ].flatMap((session) =>
        lessonReviewIntroductions(
          requestsLesson,
          source.events.filter((e) => e.sessionId === session),
          source.checked,
        ),
      );
      for (const phrase of source.phrases)
        if (phrase.status === "approved")
          introductions.push(
            ...phraseReviewIntroductions(
              phrase._id,
              phrase.phrase,
              phrase.updatedAt,
            ),
          );
      const next = await projectReviews(
        changes.map((row) => JSON.parse(row.body) as ReviewChange),
        saved.map((row) => ({
          event: JSON.parse(row.body) as ReviewAttempt,
          acknowledged: row.acknowledged === 1,
        })),
        introductions,
        digest,
      );
      if (generation !== epoch.current) return;
      setProjection(next);
      setPending(saved.filter((row) => row.acknowledged !== 1).length);
    },
    [],
  );
  useEffect(() => {
    const generation = ++epoch.current;
    let owned: SQLiteDatabase | null = null;
    setLoading(true);
    void (async () => {
      const db = await openAccountDatabase(accountId);
      owned = db;
      if (generation !== epoch.current) {
        await db.closeAsync();
        owned = null;
        return;
      }
      let saved = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM study_metadata WHERE key='review-device'",
      );
      if (!saved) {
        saved = { value: Crypto.randomUUID() };
        await db.runAsync(
          "INSERT INTO study_metadata(key,value) VALUES('review-device',?)",
          saved.value,
        );
      }
      const count = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM study_metadata WHERE key='review-sequence'",
        ),
        position = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM study_metadata WHERE key='review-cursor'",
        ),
        draft = await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM study_metadata WHERE key='review-run'",
        );
      if (generation !== epoch.current) return;
      dbRef.current = db;
      device.current = saved.value;
      sequence.current = Number(count?.value ?? 0);
      setRun(draft ? (JSON.parse(draft.value) as ReviewRun) : null);
      await refresh(db, generation);
      if (generation === epoch.current) {
        setCursor(Number(position?.value ?? 0));
        setLoading(false);
      }
    })().catch(() => {
      if (generation === epoch.current) {
        setLoading(false);
        setError(
          "Review storage couldn't open. Restart to try again; your account is retained.",
        );
      }
    });
    return () => {
      epoch.current = generation + 1;
      syncing.current = false;
      const db = owned;
      if (db)
        void serial.current.then(async () => {
          if (dbRef.current === db) dbRef.current = null;
          await db.closeAsync();
        });
    };
  }, [accountId, refresh]);
  const introductionKey = useMemo(
    () =>
      JSON.stringify([
        study.events.filter((e) => e.kind === "advanced").map((e) => e.eventId),
        Object.keys(study.checked),
        study.phrases
          .filter((p) => p.status === "approved")
          .map((p) => [p._id, p.updatedAt]),
      ]),
    [study.events, study.checked, study.phrases],
  );
  const prepared = useRef(new Set<string>());
  useEffect(() => {
    if (loading || study.loading) return;
    const generation = epoch.current;
    void enqueue(async () => {
      const db = dbRef.current;
      if (db && generation === epoch.current) await refresh(db, generation);
    }).catch(() => {
      if (generation === epoch.current)
        setError("Local reviews are retained. Retry to rebuild the queue.");
    });
  }, [introductionKey, loading, study.loading, enqueue, refresh]);
  useEffect(() => {
    if (!online || loading || study.loading) return;
    let active = true;
    const generation = epoch.current;
    void (async () => {
      const source = latest.current.study;
      const sessions = [
        ...new Set(
          source.events
            .filter((e) => e.kind === "advanced")
            .map((e) => e.sessionId),
        ),
      ];
      for (const sessionId of sessions) {
        const key = `${sessionId}:${introductionKey}`;
        if (prepared.current.has(key)) continue;
        if (!active || generation !== epoch.current) return;
        await ensureLesson({ sessionId });
        prepared.current.add(key);
      }
      for (const phrase of source.phrases) {
        if (phrase.status !== "approved") continue;
        const key = `${phrase._id}:${phrase.updatedAt}`;
        if (prepared.current.has(key)) continue;
        if (!active || generation !== epoch.current) return;
        await ensurePhrase({ phraseId: phrase._id as Id<"savedPhrases"> });
        prepared.current.add(key);
      }
    })().catch(() => {
      if (active && generation === epoch.current)
        setError(
          "Preparing reviews after your lesson synchronizes. Offline study remains saved.",
        );
    });
    return () => {
      active = false;
    };
  }, [
    online,
    loading,
    study.loading,
    introductionKey,
    retry,
    ensureLesson,
    ensurePhrase,
  ]);
  useEffect(() => {
    if (loading || !remote?.changes.length) return;
    const generation = epoch.current;
    void enqueue(async () => {
      const db = dbRef.current;
      if (!db || generation !== epoch.current) return;
      await accountTransaction(db, async (tx) => {
        for (const row of remote.changes) {
          await tx.runAsync(
            "INSERT OR IGNORE INTO review_changes(cursor,body) VALUES(?,?)",
            row.cursor,
            JSON.stringify(row.change),
          );
          if (row.change.kind === "attempt")
            await tx.runAsync(
              "INSERT INTO review_events(event_id,body,acknowledged) VALUES(?,?,1) ON CONFLICT(event_id) DO UPDATE SET acknowledged=1",
              row.change.event.eventId,
              JSON.stringify(row.change.event),
            );
          if (row.change.track)
            await tx.runAsync(
              "INSERT OR IGNORE INTO study_metadata(key,value) VALUES(?, '1')",
              `review-ready:${row.change.track.id}`,
            );
        }
        await tx.runAsync(
          "INSERT INTO study_metadata(key,value) VALUES('review-cursor',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          String(remote.nextCursor),
        );
      });
      if (generation !== epoch.current) return;
      await refresh(db, generation);
      setCursor(remote.nextCursor);
      setError("");
    }).catch((cause) => {
      if (__DEV__)
        console.warn(
          "Review cache failure",
          cause instanceof Error
            ? cause.message
            : "Unknown local storage error",
        );
      if (generation === epoch.current)
        setError(
          "Cloud reviews couldn't be cached. Your local attempts remain saved.",
        );
    });
  }, [remote, loading, retry, enqueue, refresh]);
  const saveRun = useCallback(
    async (next: ReviewRun | null) => {
      const generation = epoch.current,
        body = JSON.stringify(next);
      if (body.length > 100000) throw new Error("Review session is too large.");
      await enqueue(async () => {
        const db = dbRef.current;
        if (!db || generation !== epoch.current)
          throw new Error("Review storage is not ready.");
        await db.runAsync(
          "INSERT INTO study_metadata(key,value) VALUES('review-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          body,
        );
        if (generation === epoch.current) setRun(next);
      });
    },
    [enqueue],
  );
  const submit = useCallback(
    async (
      question: ReviewQuestion,
      input: string,
      support: SupportFlag[],
      dontKnow: boolean,
      sessionId: string,
    ) => {
      const generation = epoch.current;
      await enqueue(async () => {
        const db = dbRef.current;
        if (!db || generation !== epoch.current)
          throw new Error("Review storage is not ready.");
        if (await db.getFirstAsync("SELECT event_id FROM review_events WHERE event_id=?",question.eventId)) { await refresh(db,generation); return; }
        const occurredAt = Date.now(),
          offsetMinutes = new Date(occurredAt).getTimezoneOffset(),
          opportunity = question.opportunity;
        const event: ReviewAttempt = {
          algorithm: 1,
          eventId: question.eventId,
          sessionId,
          deviceId: device.current,
          sequence: sequence.current + 1,
          occurredAt,
          offsetMinutes,
          localDay: localDayAt(occurredAt, offsetMinutes),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          input,
          dontKnow,
          support: [
            ...new Set([
              ...support,
              ...(question.correction ? ["correctionRetry" as const] : []),
            ]),
          ],
          spans: [],
          trackId: question.trackId,
          opportunityId: opportunity.id,
          parentResolutionId: opportunity.parentResolutionId,
          ...(opportunity.parentEventId
            ? { parentEventId: opportunity.parentEventId }
            : {}),
          baseRevision: opportunity.revision,
          mode: question.mode,
        };
        validateReviewAttempt(event, occurredAt);
        await accountTransaction(db, async (tx) => {
          await tx.runAsync(
            "INSERT INTO review_events(event_id,body) VALUES(?,?)",
            event.eventId,
            JSON.stringify(event),
          );
          await tx.runAsync(
            "INSERT INTO study_metadata(key,value) VALUES('review-sequence',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            String(event.sequence),
          );
        });
        sequence.current = event.sequence;
        await refresh(db, generation);
      });
    },
    [enqueue, refresh],
  );
  useEffect(() => {
    if (!online || loading || !pending || syncing.current) return;
    const generation = epoch.current;
    syncing.current = true;
    void (async () => {
      let batch: ReviewAttempt[] = [];
      await enqueue(async () => {
        const db = dbRef.current;
        if (!db || generation !== epoch.current) return;
        const rows = await db.getAllAsync<{ body: string }>(
          "SELECT body FROM review_events WHERE acknowledged=0 ORDER BY rowid LIMIT 50",
        );
        batch = rows.map((row) => JSON.parse(row.body));
      });
      if (!batch.length || generation !== epoch.current) return;
      const receipts = await push({ events: batch });
      // Retain the provisional overlay until pull commits the canonical snapshot.
      await enqueue(async () => {
        const db = dbRef.current;
        if (!db || generation !== epoch.current) return;
        await accountTransaction(db, async (tx) => {
          for (const ack of receipts.acks)
            await tx.runAsync(
              "UPDATE review_events SET acknowledged=2 WHERE event_id=? AND acknowledged=0",
              ack.eventId,
            );
        });
        await refresh(db, generation);
        setError("");
      });
    })()
      .catch(() => {
        if (generation === epoch.current)
          setError(
            "Reviews are saved on this phone. Reconnect or retry to synchronize.",
          );
      })
      .finally(() => {
        if (generation === epoch.current) syncing.current = false;
      });
  }, [online, loading, pending, retry, cursor, enqueue, refresh, push]);
  useEffect(() => {
    const timer = setInterval(() => setRetry((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Context.Provider
      value={{
        ...projection,
        loading: loading || study.loading,
        pending,
        error,
        run,
        saveRun,
        submit,
        retry: () => {
          study.retry();
          setRetry((value) => value + 1);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useReviews() {
  const value = useContext(Context);
  if (!value) throw new Error("ReviewProvider is required.");
  return value;
}
