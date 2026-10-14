import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  prepareDailySession,
  type ReviewRun,
} from "../apps/native/src/data/dailySession.ts";
import {
  introduceReview,
  type ReviewCard,
} from "../packages/learning-core/src/reviews.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";

const now = Date.UTC(2026, 9, 14, 8),
  sessionId = "daily-lesson-session-0000";
const digest = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function fixture(t: TestContext, count = 9) {
  const directory = mkdtempSync(join(tmpdir(), "kiro-daily-test-")),
    file = join(directory, "plan.db");
  let db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE study_events(session_id TEXT,body TEXT); CREATE TABLE study_metadata(key TEXT PRIMARY KEY,value TEXT);",
  );
  const store = {
    async getFirstAsync<T>(sql: string, ...bindings: string[]) {
      return (db.prepare(sql).get(...bindings) as T) ?? null;
    },
    async runAsync(sql: string, ...bindings: string[]) {
      return db.prepare(sql).run(...bindings);
    },
  };
  t.after(() => {
    db.close();
    for (const name of readdirSync(directory)) {
      unlinkSync(join(directory, name));
    }
    rmdirSync(directory);
  });
  const card: ReviewCard = {
    id: "daily-card",
    facet: "reading",
    source: "lesson",
    sourceId: "requests",
    sourceVersion: 1,
    label: "水",
    exercise: requestsLesson.exercises.find((e) => e.id === "reading-water")!,
  };
  const roots = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      introduceReview(
        { ...card, id: `daily-${i}` },
        now - 7 * 86400000 + i,
        digest,
      ),
    ),
  );
  const snapshot = {
    tracks: roots.map((r) => r.track),
    opportunities: new Map(roots.map((r) => [r.opportunity.id, r.opportunity])),
    attempts: [],
    receipts: new Map(),
  };
  db.prepare("INSERT INTO study_events VALUES(?,?)").run(
    sessionId,
    JSON.stringify({ kind: "started", lessonId: "requests", lessonVersion: 1 }),
  );
  let ids = 0;
  const prepare = (id = sessionId, time = now) =>
    prepareDailySession(
      store,
      requestsLesson,
      id,
      snapshot,
      () => `daily-id-${++ids}`,
      time,
      -330,
    );
  const read = () =>
    JSON.parse(
      (
        db
          .prepare("SELECT value FROM study_metadata WHERE key='review-run'")
          .get() as { value: string }
      ).value,
    ) as ReviewRun;
  const save = (run: ReviewRun) =>
    db
      .prepare(
        "INSERT INTO study_metadata VALUES('review-run',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(run));
  return {
    prepare,
    read,
    save,
    snapshot,
    reopen: () => {
      db.close();
      db = new DatabaseSync(file);
    },
    sql: (statement: string) => db.exec(statement),
    countIds: () => ids,
  };
}

test("daily review plan survives SQLite reopen with its exact drafts, question IDs and lesson handoff", async (t) => {
  const f = await fixture(t),
    original = JSON.stringify(f.snapshot.tracks);
  const first = await f.prepare();
  assert.equal(first.destination, "review");
  assert(first.run);
  assert.equal(first.run.questions.length, 8);
  assert.equal(first.run.nextSessionId, sessionId);
  assert.equal(first.run.planDay, "2026-10-14");
  assert.equal(new Set(first.run.questions.map((q) => q.eventId)).size, 8);
  const partial = {
    ...first.run,
    index: 2,
    input: "mizu",
    support: ["patternHint" as const],
  };
  f.save(partial);
  f.reopen();
  const resumed = await f.prepare();
  assert.deepEqual(resumed.run, partial);
  assert.equal(f.countIds(), 9);
  assert.equal(JSON.stringify(f.snapshot.tracks), original);
  assert.equal(f.snapshot.tracks.length, 9);
});

test("completed daily set hands off once that day, while tomorrow's due reviews still come first", async (t) => {
  const f = await fixture(t),
    first = await f.prepare();
  assert(first.run);
  f.save({ ...first.run, index: first.run.questions.length });
  const done = await f.prepare();
  assert.deepEqual(done, { destination: "lesson" });
  assert.equal(f.countIds(), 9);
  const tomorrow = await f.prepare(sessionId, now + 86400000);
  assert.equal(tomorrow.destination, "review");
  assert(tomorrow.run);
  assert.equal(tomorrow.run.planDay, "2026-10-15");
  assert.notEqual(tomorrow.run.id, first.run.id);
});

test("daily plan adopts unlinked partial practice without replacing it and rejects a different owned handoff", async (t) => {
  const f = await fixture(t),
    first = await f.prepare();
  assert(first.run);
  const unlinked = {
    ...first.run,
    nextSessionId: undefined,
    planDay: undefined,
    index: 1,
    input: "kept draft",
  };
  f.save(unlinked);
  const adopted = await f.prepare();
  assert(adopted.run);
  assert.deepEqual(adopted.run.questions, first.run.questions);
  assert.equal(adopted.run.input, "kept draft");
  assert.equal(adopted.run.index, 1);
  const otherId = "other-owned-session";
  f.sql(
    `INSERT INTO study_events VALUES('${otherId}','{"kind":"started","lessonId":"requests","lessonVersion":1}');`,
  );
  await assert.rejects(f.prepare(otherId), /saved daily reviews/);
  assert.deepEqual(f.read(), adopted.run);
  await assert.rejects(f.prepare("missing-session"), /Save your lesson/);
});

test("a failed SQLite plan write leaves the lesson intact and retry creates one reusable review set", async (t) => {
  const f = await fixture(t);
  f.sql(
    "CREATE TRIGGER fail_plan BEFORE INSERT ON study_metadata WHEN NEW.key='review-run' BEGIN SELECT RAISE(ABORT,'synthetic storage failure'); END;",
  );
  await assert.rejects(f.prepare(), /synthetic storage failure/);
  f.sql("DROP TRIGGER fail_plan");
  const ready = await f.prepare();
  assert.equal(ready.destination, "review");
  assert(ready.run);
  f.reopen();
  assert.deepEqual((await f.prepare()).run, ready.run);
});

test("no due reviews opens the saved lesson without creating study or a fake completed review", async (t) => {
  const f = await fixture(t, 0);
  assert.deepEqual(await f.prepare(), { destination: "lesson" });
  assert.equal(f.countIds(), 0);
});
