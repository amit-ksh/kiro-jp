import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { initializeAccountSchema } from "../apps/native/src/data/accountSchema.ts";
import {
  cacheStudyPage,
  cacheReviewPage,
} from "../apps/native/src/data/syncCache.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import {
  introduceReview,
  decideReview,
  projectReviews,
  type ReviewAttempt,
  type ReviewCard,
  type ReviewChange,
} from "../packages/learning-core/src/reviews.ts";
import type { StudyEvent } from "../packages/learning-core/src/study.ts";

async function fixture(t: TestContext) {
  const root = resolve(tmpdir()),
    directory = mkdtempSync(join(root, "kiro-sync-"));
  const file = join(directory, "account.db");
  let db = new DatabaseSync(file);
  let fail: (sql: string, values: (string | number)[]) => boolean = () => false;
  const connection = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, ...values: (string | number)[]) {
      if (fail(sql, values)) throw Error("synthetic cache interruption");
      return db.prepare(sql).run(...values);
    },
    async getFirstAsync<T>(sql: string, ...values: (string | number)[]) {
      return (db.prepare(sql).get(...values) as T) ?? null;
    },
    async getAllAsync<T>(sql: string) {
      return db.prepare(sql).all() as T[];
    },
  };
  await initializeAccountSchema(connection);
  db.exec(
    "PRAGMA journal_mode=WAL;INSERT INTO drafts VALUES('answer:kept:step','mizu o kudasai',1234);INSERT INTO study_metadata VALUES('content-ready:requests:1','kept');",
  );
  t.after(() => {
    db.close();
    assert(directory.startsWith(root + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  const transact = async (work: (tx: typeof connection) => Promise<void>) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      await work(connection);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  return {
    connection,
    transact,
    fail: (predicate: typeof fail) => {
      fail = predicate;
    },
    reopen: () => {
      db.close();
      db = new DatabaseSync(file);
    },
    rows: (sql: string) => db.prepare(sql).all(),
    run: (sql: string, ...values: (string | number)[]) =>
      db.prepare(sql).run(...values),
    cursor: (key: string) =>
      Number(
        (
          db
            .prepare("SELECT value FROM study_metadata WHERE key=?")
            .get(key) as { value: string } | undefined
        )?.value ?? 0,
      ),
  };
}
const studyPage = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    cursor: index + 1,
    event: {
      eventId: `study-${index}`,
      sessionId: "retained-lesson",
      deviceId: "offline-device-01",
      sequence: index + 1,
      lessonId: "requests",
      lessonVersion: 1,
      kind: "activity",
      stepId: "teach-water",
      occurredAt: 1791918000000 + index,
      localDay: "2026-10-13",
      timezone: "Asia/Calcutta",
      offsetMinutes: -330,
      support: [],
      spans: [],
    } as StudyEvent,
  }));
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function reviewFixture() {
  const card: ReviewCard = {
    id: "requests:1:water:meaning",
    facet: "meaning",
    source: "lesson",
    sourceId: "requests",
    sourceVersion: 1,
    label: "水",
    exercise: requestsLesson.exercises.find((e) => e.id === "meaning-water")!,
  };
  const intro = await introduceReview(card, Date.UTC(2026, 8, 1), digest);
  const event: ReviewAttempt = {
    eventId: "offline-review",
    sessionId: "offline-review-session",
    deviceId: "offline-device-01",
    sequence: 1,
    algorithm: 1,
    trackId: card.id,
    opportunityId: intro.opportunity.id,
    parentResolutionId: intro.track.parentResolutionId,
    baseRevision: intro.track.revision,
    mode: "due",
    input: "water",
    support: [],
    spans: [],
    occurredAt: intro.track.dueAt,
    localDay: "2026-09-01",
    offsetMinutes: 0,
    timezone: "UTC",
  };
  const decision = await decideReview(
    intro.track,
    intro.opportunity,
    undefined,
    event,
    digest,
  );
  assert.equal(decision.receipt.status, "applied-to-schedule");
  return {
    card,
    intro,
    event,
    decision,
    first: {
      cursor: 1,
      change: { kind: "introduced", ...intro } as ReviewChange,
    },
    second: {
      cursor: 2,
      change: { kind: "attempt", event, ...decision } as ReviewChange,
    },
  };
}

test("study pages survive restart and duplicate delivery without losing original dates, drafts or another account's pending work", async (t) => {
  const a = await fixture(t),
    b = await fixture(t),
    page = studyPage(123);
  const pending = { ...page[0]!.event, eventId: "own-pending" };
  for (const f of [a, b])
    f.run(
      "INSERT INTO study_events(event_id,session_id,body) VALUES(?,?,?)",
      pending.eventId,
      pending.sessionId,
      JSON.stringify(pending),
    );
  for (let n = 0; n < page.length; n += 50) {
    await cacheStudyPage(page.slice(n, n + 50), a.transact);
    a.reopen();
  }
  assert.equal(a.cursor("cursor"), 123);
  assert.equal(a.rows("SELECT * FROM study_events").length, 124);
  const snapshot = a.rows("SELECT * FROM study_events ORDER BY rowid");
  assert.equal(await cacheStudyPage(page.slice(0, 50), a.transact), 123);
  assert.deepEqual(
    a.rows("SELECT * FROM study_events ORDER BY rowid"),
    snapshot,
  );
  assert.equal(
    a.rows("SELECT * FROM study_events WHERE acknowledged=0").length,
    1,
  );
  assert.equal(b.cursor("cursor"), 0);
  assert.equal(
    b.rows("SELECT * FROM study_events WHERE acknowledged=0").length,
    1,
  );
  assert.deepEqual(
    a.rows("SELECT * FROM drafts"),
    b.rows("SELECT * FROM drafts"),
  );
  assert.equal(
    a.rows("SELECT * FROM study_metadata WHERE key LIKE 'content-ready:%'")
      .length,
    1,
  );
  assert(
    a
      .rows("SELECT body FROM study_events WHERE acknowledged=1")
      .every((row) => JSON.parse(row.body as string).localDay === "2026-10-13"),
  );
});
test("a study cache interruption rolls back rows and acknowledgements and retries the unchanged page after reopening", async (t) => {
  const f = await fixture(t),
    page = studyPage(2);
  f.run(
    "INSERT INTO study_events(event_id,session_id,body) VALUES(?,?,?)",
    page[0]!.event.eventId,
    page[0]!.event.sessionId,
    JSON.stringify(page[0]!.event),
  );
  f.fail((_sql, values) => values[0] === "cursor");
  await assert.rejects(cacheStudyPage(page, f.transact), /interruption/);
  f.reopen();
  assert.equal(f.cursor("cursor"), 0);
  assert.equal(f.rows("SELECT * FROM study_events").length, 1);
  assert.equal(
    f.rows("SELECT * FROM study_events WHERE acknowledged=0").length,
    1,
  );
  f.fail(() => false);
  assert.equal(await cacheStudyPage(page, f.transact), 2);
  assert.equal(
    f.rows("SELECT * FROM study_events WHERE acknowledged=1").length,
    2,
  );
  const before = f.rows("SELECT * FROM study_events ORDER BY rowid");
  await assert.rejects(
    cacheStudyPage(
      [{ cursor: 3, event: { ...page[0]!.event, localDay: "2026-10-14" } }],
      f.transact,
    ),
    /identity changed/,
  );
  assert.equal(f.cursor("cursor"), 2);
  assert.deepEqual(f.rows("SELECT * FROM study_events ORDER BY rowid"), before);
});
test("review cache interruption retains its provisional closure until the complete canonical page is committed", async (t) => {
  const f = await fixture(t),
    { first, second, event, decision } = await reviewFixture();
  await cacheReviewPage({ changes: [first], nextCursor: 1 }, f.transact);
  f.run(
    "INSERT INTO review_events(event_id,body,acknowledged) VALUES(?,?,2)",
    event.eventId,
    JSON.stringify(event),
  );
  const projection = () =>
    projectReviews(
      f
        .rows("SELECT body FROM review_changes ORDER BY cursor")
        .map((r) => JSON.parse(r.body as string) as ReviewChange),
      f
        .rows("SELECT body,acknowledged FROM review_events ORDER BY rowid")
        .map((r) => ({
          event: JSON.parse(r.body as string) as ReviewAttempt,
          acknowledged: r.acknowledged === 1,
        })),
      [],
      digest,
    );
  const provisional = await projection();
  assert.equal(provisional.tracks[0]!.stage, decision.track!.stage);
  assert.equal(provisional.provisional.size, 1);
  f.fail((_sql, values) => values[0] === "review-cursor");
  await assert.rejects(
    cacheReviewPage({ changes: [second], nextCursor: 2 }, f.transact),
    /interruption/,
  );
  f.reopen();
  assert.equal(f.cursor("review-cursor"), 1);
  assert.equal(f.rows("SELECT * FROM review_changes").length, 1);
  assert.equal(
    f.rows("SELECT acknowledged FROM review_events")[0]!.acknowledged,
    2,
  );
  assert.equal((await projection()).provisional.size, 1);
  f.fail(() => false);
  await cacheReviewPage({ changes: [second], nextCursor: 2 }, f.transact);
  const canonical = await projection();
  assert.equal(canonical.provisional.size, 0);
  assert.deepEqual(canonical.tracks, provisional.tracks);
  assert.equal(
    canonical.opportunities.get(event.opportunityId)!.resolution!.id,
    decision.closed!.resolution!.id,
  );
  assert.equal(
    await cacheReviewPage({ changes: [first], nextCursor: 1 }, f.transact),
    2,
  );
  await cacheReviewPage({ changes: [second], nextCursor: 2 }, f.transact);
  assert.deepEqual((await projection()).tracks, canonical.tracks);
});
test("multiple review pages, updated receipts and replays preserve one permanent closure without cross-account acknowledgement", async (t) => {
  const a = await fixture(t),
    b = await fixture(t),
    f = await reviewFixture();
  const changes = [f.first, f.second];
  for (let n = 0; n < 120; n++) {
    const intro = await introduceReview(
      { ...f.card, id: `other-${n}` },
      f.intro.track.introducedAt,
      digest,
    );
    changes.push({
      cursor: changes.length + 1,
      change: { kind: "introduced", ...intro },
    });
  }
  changes.push({
    cursor: changes.length + 1,
    change: {
      kind: "attempt",
      event: f.event,
      receipt: {
        ...f.decision.receipt,
        revision: 2,
        feedback: {
          status: "ready",
          attempt: 1,
          updatedAt: f.event.occurredAt + 1,
        },
      },
    },
  });
  b.run(
    "INSERT INTO review_events(event_id,body,acknowledged) VALUES(?,?,2)",
    f.event.eventId,
    JSON.stringify(f.event),
  );
  for (let n = 0; n < changes.length; n += 50) {
    const page = changes.slice(n, n + 50);
    await cacheReviewPage(
      { changes: page, nextCursor: page.at(-1)!.cursor },
      a.transact,
    );
    a.reopen();
  }
  assert.equal(a.cursor("review-cursor"), 123);
  assert.equal(a.rows("SELECT * FROM review_changes").length, 123);
  assert.equal(a.rows("SELECT * FROM review_events").length, 1);
  assert.equal(b.cursor("review-cursor"), 0);
  assert.equal(
    b.rows("SELECT acknowledged FROM review_events")[0]!.acknowledged,
    2,
  );
  const projection = await projectReviews(
    a
      .rows("SELECT body FROM review_changes ORDER BY cursor")
      .map((r) => JSON.parse(r.body as string) as ReviewChange),
    [],
    [],
    digest,
  );
  assert.equal(
    projection.tracks.find((t) => t.id === f.card.id)!.stage,
    f.decision.track!.stage,
  );
  assert.equal(projection.receipts.get(f.event.eventId)!.revision, 2);
  assert.equal(
    projection.opportunities.get(f.event.opportunityId)!.resolution!.id,
    f.decision.closed!.resolution!.id,
  );
  await assert.rejects(
    cacheReviewPage(
      {
        changes: [
          {
            ...f.second,
            change: {
              ...f.second.change,
              kind: "introduced",
              track: f.intro.track,
              opportunity: f.intro.opportunity,
            } as ReviewChange,
          },
        ],
        nextCursor: 2,
      },
      a.transact,
    ),
    /identity changed/,
  );
  assert.equal(a.cursor("review-cursor"), 123);
});
test("invalid or unordered cache pages never advance a cursor", async (t) => {
  const f = await fixture(t),
    page = studyPage(2),
    review = await reviewFixture();
  for (const invalid of [
    [],
    page.toReversed(),
    [page[0]!, page[0]!],
    [{ ...page[0]!, cursor: -1 }],
    studyPage(51),
  ])
    await assert.rejects(cacheStudyPage(invalid, f.transact), /Invalid sync/);
  await assert.rejects(
    cacheReviewPage({ changes: [review.first], nextCursor: 2 }, f.transact),
    /page cursor/,
  );
  assert.equal(f.cursor("cursor"), 0);
  assert.equal(f.cursor("review-cursor"), 0);
});
