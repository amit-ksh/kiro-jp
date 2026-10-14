import type { StudyEvent, ReviewChange } from "@packages/learning-core";

interface CacheTransaction {
  runAsync(sql: string, ...values: (string | number)[]): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...values: (string | number)[]
  ): Promise<T | null>;
}
type Transact = (
  work: (tx: CacheTransaction) => Promise<void>,
) => Promise<void>;
type StudyPage = readonly { cursor: number; event: StudyEvent }[];
type ReviewPage = {
  changes: readonly { cursor: number; change: ReviewChange }[];
  nextCursor: number;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function checkPage(rows: readonly { cursor: number }[]) {
  if (!rows.length || rows.length > 50)
    throw new Error("Invalid sync page size.");
  let previous = 0;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.cursor) || row.cursor <= previous)
      throw new Error("Invalid sync page order.");
    previous = row.cursor;
  }
  return previous;
}
async function advanceCursor(tx: CacheTransaction, key: string, next: number) {
  const stored = await tx.getFirstAsync<{ value: string }>(
    "SELECT value FROM study_metadata WHERE key=?",
    key,
  );
  const previous = Number(stored?.value ?? 0);
  if (!Number.isSafeInteger(previous) || previous < 0)
    throw new Error("Invalid saved sync cursor. Your data was retained.");
  const cursor = Math.max(previous, next);
  await tx.runAsync(
    "INSERT INTO study_metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    key,
    String(cursor),
  );
  return cursor;
}
function checkImmutable(stored: { body: string } | null, incoming: unknown) {
  if (stored && canonical(JSON.parse(stored.body)) !== canonical(incoming))
    throw new Error("A saved sync identity changed. Your data was retained.");
}

// Rows, acknowledgements and cursor commit together. A failed write leaves the
// same page replayable; replaying an old page must never move a cursor backward.
export async function cacheStudyPage(page: StudyPage, transact: Transact) {
  const next = checkPage(page);
  let cursor = 0;
  await transact(async (tx) => {
    for (const row of page) {
      checkImmutable(
        await tx.getFirstAsync<{ body: string }>(
          "SELECT body FROM study_events WHERE event_id=?",
          row.event.eventId,
        ),
        row.event,
      );
      await tx.runAsync(
        "INSERT INTO study_events(event_id,session_id,body,acknowledged) VALUES(?,?,?,1) ON CONFLICT(event_id) DO UPDATE SET acknowledged=1",
        row.event.eventId,
        row.event.sessionId,
        JSON.stringify(row.event),
      );
    }
    cursor = await advanceCursor(tx, "cursor", next);
  });
  return cursor;
}
export async function cacheReviewPage(page: ReviewPage, transact: Transact) {
  const next = checkPage(page.changes);
  if (page.nextCursor !== next) throw new Error("Invalid review page cursor.");
  let cursor = 0;
  await transact(async (tx) => {
    for (const row of page.changes) {
      checkImmutable(
        await tx.getFirstAsync<{ body: string }>(
          "SELECT body FROM review_changes WHERE cursor=?",
          row.cursor,
        ),
        row.change,
      );
      await tx.runAsync(
        "INSERT OR IGNORE INTO review_changes(cursor,body) VALUES(?,?)",
        row.cursor,
        JSON.stringify(row.change),
      );
      if (row.change.kind === "attempt") {
        checkImmutable(
          await tx.getFirstAsync<{ body: string }>(
            "SELECT body FROM review_events WHERE event_id=?",
            row.change.event.eventId,
          ),
          row.change.event,
        );
        await tx.runAsync(
          "INSERT INTO review_events(event_id,body,acknowledged) VALUES(?,?,1) ON CONFLICT(event_id) DO UPDATE SET acknowledged=1",
          row.change.event.eventId,
          JSON.stringify(row.change.event),
        );
      }
      if (row.change.track)
        await tx.runAsync(
          "INSERT OR IGNORE INTO study_metadata(key,value) VALUES(?, '1')",
          `review-ready:${row.change.track.id}`,
        );
    }
    cursor = await advanceCursor(tx, "review-cursor", next);
  });
  return cursor;
}
