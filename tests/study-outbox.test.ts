import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pendingStudyBatchSql } from "../apps/native/src/data/studyOutbox.ts";
function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "kiro-outbox-")),
    file = join(directory, "account.db");
  let db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL;CREATE TABLE study_events(event_id TEXT PRIMARY KEY,body TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0);CREATE TABLE study_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
  );
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    insert: (
      event: {
        eventId: string;
        kind: string;
        stepId: string;
        lessonId?: string;
        [key: string]: unknown;
      },
      ack = 0,
    ) =>
      db
        .prepare("INSERT INTO study_events VALUES(?,?,?)")
        .run(event.eventId, JSON.stringify(event), ack),
    ready: (trackId: string) =>
      db
        .prepare("INSERT INTO study_metadata VALUES(?,?)")
        .run(`review-ready:${trackId}`, "1"),
    batch: () =>
      db
        .prepare(pendingStudyBatchSql)
        .all()
        .map(
          (row) =>
            JSON.parse(row.body as string) as {
              eventId: string;
              stepId: string;
            },
        ),
    acknowledge: (ids: string[]) => {
      db.exec("BEGIN");
      for (const id of ids)
        db.prepare(
          "UPDATE study_events SET acknowledged=1 WHERE event_id=?",
        ).run(id);
      db.exec("COMMIT");
    },
    reopen: () => {
      db.close();
      db = new DatabaseSync(file);
    },
    all: () =>
      db
        .prepare(
          "SELECT event_id,body,acknowledged FROM study_events ORDER BY rowid",
        )
        .all(),
  };
}
test("review listening waits for the exact acknowledged track without blocking other study or changing stored evidence", (t) => {
  const f = fixture(t),
    track = "requests:1:water:reading";
  f.insert({
    eventId: "review-time",
    kind: "reviewActivity",
    stepId: track,
    lessonId: "review",
  });
  f.insert({
    eventId: "review-listen",
    kind: "audioActivity",
    stepId: `review:${track}`,
    lessonId: "review",
    occurredAt: 1791957600000,
    localDay: "2026-10-14",
    offsetMinutes: -330,
    input: "listening",
    spans: [
      {
        start: 1791957599000,
        end: 1791957600000,
        localDay: "2026-10-14",
        offsetMinutes: -330,
      },
    ],
  });
  f.insert({
    eventId: "lesson-listen",
    kind: "audioActivity",
    stepId: "recap",
    lessonId: "requests",
  });
  f.insert({
    eventId: "phrase-listen",
    kind: "audioActivity",
    stepId: "reference",
    lessonId: "reference",
  });
  f.insert({
    eventId: "lesson-answer",
    kind: "attempted",
    stepId: "meaning-water",
    lessonId: "requests",
  });
  const before = f.all();
  assert.deepEqual(
    f.batch().map((e) => e.eventId),
    ["lesson-listen", "phrase-listen", "lesson-answer"],
  );
  assert.deepEqual(f.all(), before);
  f.ready("requests:1:water:meaning");
  assert.equal(f.batch().length, 3);
  f.reopen();
  assert.equal(f.batch().length, 3);
  f.ready(track);
  assert.deepEqual(
    f.batch().map((e) => e.eventId),
    before.map((row) => row.event_id),
  );
  assert.deepEqual(f.all(), before);
  f.acknowledge(f.batch().map((e) => e.eventId));
  assert.deepEqual(f.batch(), []);
});
test("bounded outbox pages retain original order and lost acknowledgements replay identical event IDs", (t) => {
  const f = fixture(t),
    track = "requests:1:water:meaning",
    pending: string[] = [],
    blocked: string[] = [];
  f.insert(
    { eventId: "already-synced", kind: "activity", stepId: "teach-water" },
    1,
  );
  for (let n = 0; n < 123; n++) {
    if (n % 5 === 0) {
      const id = `blocked-${n}`;
      blocked.push(id);
      f.insert({
        eventId: id,
        kind: "audioActivity",
        lessonId: "review",
        stepId: `review:${track}`,
      });
    }
    const id = `study-${n}`;
    pending.push(id);
    f.insert({
      eventId: id,
      kind: "activity",
      stepId: "teach-water",
      lessonId: "requests",
    });
  }
  const first = f.batch();
  assert.equal(first.length, 50);
  f.reopen();
  assert.deepEqual(f.batch(), first);
  const uploaded: string[] = [];
  while (f.batch().length) {
    const batch = f.batch();
    assert(batch.length <= 50);
    uploaded.push(...batch.map((e) => e.eventId));
    f.acknowledge(batch.map((e) => e.eventId));
  }
  assert.deepEqual(uploaded, pending);
  assert.equal(new Set(uploaded).size, 123);
  assert.deepEqual(
    f
      .all()
      .filter((row) => row.acknowledged === 0)
      .map((row) => row.event_id),
    blocked,
  );
  f.ready(track);
  assert.deepEqual(
    f.batch().map((e) => e.eventId),
    blocked,
  );
  f.acknowledge(blocked);
  assert.deepEqual(f.batch(), []);
});
test("another account's ready marker and malformed review-audio identity cannot release blocked activity", (t) => {
  const a = fixture(t),
    b = fixture(t),
    track = "requests:1:water:reading";
  for (const f of [a, b]) {
    f.insert({
      eventId: "same-local-id",
      kind: "audioActivity",
      lessonId: "review",
      stepId: `review:${track}`,
    });
    f.insert({
      eventId: "malformed",
      kind: "audioActivity",
      lessonId: "review",
      stepId: "recap",
    });
  }
  a.ready(track);
  assert.deepEqual(
    a.batch().map((e) => e.eventId),
    ["same-local-id"],
  );
  assert.deepEqual(b.batch(), []);
  b.reopen();
  assert.deepEqual(b.batch(), []);
});
