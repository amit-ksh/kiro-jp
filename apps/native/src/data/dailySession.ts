import {
  localDayAt,
  reviewQueue,
  type ReviewAttempt,
  type ReviewOpportunity,
  type ReviewReceipt,
  type ReviewTrack,
  type SupportFlag,
} from "@packages/learning-core";

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
  nextSessionId?: string;
  planDay?: string;
}
interface PlanStore {
  getFirstAsync<T>(sql: string, ...bindings: string[]): Promise<T | null>;
  runAsync(sql: string, ...bindings: string[]): Promise<unknown>;
}
interface ReviewSnapshot {
  tracks: ReviewTrack[];
  opportunities: ReadonlyMap<string, ReviewOpportunity>;
  attempts: ReviewAttempt[];
  receipts: ReadonlyMap<string, ReviewReceipt>;
}
/** Call on the account repository's serial queue. The saved run is authoritative. */
export async function prepareDailySession(
  db: PlanStore,
  lesson: { id: string; version: number },
  sessionId: string,
  projection: ReviewSnapshot,
  createId: () => string,
  now: number,
  offsetMinutes: number,
): Promise<{ destination: "lesson" | "review"; run?: ReviewRun }> {
  const started = await db.getFirstAsync<{ body: string }>(
    "SELECT body FROM study_events WHERE session_id=? AND json_extract(body,'$.kind')='started' LIMIT 1",
    sessionId,
  );
  if (!started)
    throw new Error("Save your lesson before preparing its reviews.");
  const source = JSON.parse(started.body) as {
    lessonId: string;
    lessonVersion: number;
  };
  if (source.lessonId !== lesson.id || source.lessonVersion !== lesson.version)
    throw new Error("This lesson version is not available.");
  const stored = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM study_metadata WHERE key='review-run'",
  );
  const current = stored
    ? (JSON.parse(stored.value) as ReviewRun | null)
    : null;
  const today = localDayAt(now, offsetMinutes);
  if (
    current?.nextSessionId === sessionId &&
    current.planDay === today &&
    current.index >= current.questions.length
  )
    return { destination: "lesson" };
  const unfinished = current && current.index < current.questions.length;
  if (
    unfinished &&
    current.nextSessionId &&
    current.nextSessionId !== sessionId
  )
    throw new Error("Resume your saved daily reviews first.");
  let next: ReviewRun;
  if (unfinished)
    next = {
      ...current,
      nextSessionId: sessionId,
      planDay: current.planDay ?? today,
    };
  else {
    const questions = reviewQueue(projection, now)
      .ready.slice(0, 8)
      .flatMap((track) => {
        const opportunity = projection.opportunities.get(track.opportunityId);
        return opportunity
          ? [
              {
                eventId: createId(),
                trackId: track.id,
                opportunity,
                mode: "due" as const,
                correction: false,
              },
            ]
          : [];
      });
    if (!questions.length) return { destination: "lesson" };
    next = {
      id: createId(),
      questions,
      index: 0,
      input: "",
      support: [],
      nextSessionId: sessionId,
      planDay: today,
    };
  }
  await db.runAsync(
    "INSERT INTO study_metadata(key,value) VALUES('review-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    JSON.stringify(next),
  );
  return { destination: "review", run: next };
}
