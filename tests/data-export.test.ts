import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  collectCloudExport,
  exportCollections,
  exportValue,
} from "../packages/learning-core/src/data-export.ts";
import { initializeAccountSchema } from "../apps/native/src/data/accountSchema.ts";
import { readLocalLearningExport } from "../apps/native/src/data/exportLearning.ts";

test("learning export omits private handles and diagnostics while preserving learner text", () => {
  const source = {
    input: "mizu o kudasai",
    reading: "みず",
    trace: "private provider response",
    storageId: "private-blob",
    nested: {
      uri: "file:///private/recording.m4a",
      refresh_token: "private refresh",
      expected: "water",
      passwordHash: "hash",
      accessToken: "jwt",
    },
    answers: [
      {
        text: "The word token appears in this learner answer.",
        apiKey: "private-key",
      },
    ],
    optional: undefined,
  };
  const before = structuredClone(source);
  assert.deepEqual(exportValue(source), {
    input: "mizu o kudasai",
    reading: "みず",
    nested: { expected: "water" },
    answers: [{ text: "The word token appears in this learner answer." }],
  });
  assert.deepEqual(source, before);
  assert.throws(() => exportValue({ value: Infinity }));
});
test("cloud export reads every page including empty scan pages and every learning collection", async () => {
  const seen: string[] = [];
  const data = await collectCloudExport(
    "owner",
    async (collection, cursor) => {
      seen.push(`${collection}:${cursor}`);
      if (collection === "studyEvents") {
        if (cursor === null)
          return {
            accountId: "owner",
            records: [{ eventId: "first" }],
            done: false,
            cursor: "one",
          };
        if (cursor === "one")
          return {
            accountId: "owner",
            records: [],
            done: false,
            cursor: "two",
          };
        return {
          accountId: "owner",
          records: [{ eventId: "last" }],
          done: true,
          cursor: "end",
        };
      }
      return { accountId: "owner", records: [], done: true, cursor: "end" };
    },
    () => {},
  );
  assert.deepEqual(Object.keys(data), [...exportCollections]);
  assert.deepEqual(data.studyEvents, [
    { eventId: "first" },
    { eventId: "last" },
  ]);
  assert.equal(seen.length, exportCollections.length + 2);
});
test("cloud pagination or identity failures never resolve a partial export", async () => {
  await assert.rejects(
    collectCloudExport(
      "owner",
      async () => ({
        accountId: "other-owner",
        records: [{ text: "other" }],
        done: true,
        cursor: "end",
      }),
      () => {},
    ),
    /account changed/u,
  );
  let calls = 0;
  await assert.rejects(
    collectCloudExport(
      "owner",
      async () => {
        if (++calls === 2) throw Error("offline");
        return {
          accountId: "owner",
          records: [{ saved: true }],
          done: true,
          cursor: "end",
        };
      },
      () => {},
    ),
    /offline/u,
  );
  await assert.rejects(
    collectCloudExport(
      "owner",
      async () => ({
        accountId: "owner",
        records: [],
        done: false,
        cursor: "stuck",
      }),
      () => {},
    ),
    /could not finish/u,
  );
});
test("an incomplete cloud page is replaced by its complete split ranges", async () => {
  const data = await collectCloudExport(
    "owner",
    async (collection, cursor, endCursor?: string) => {
      if (collection !== "profile")
        return { accountId: "owner", records: [], done: true, cursor: "end" };
      if (!endCursor)
        return {
          accountId: "owner",
          records: [{ partial: true }],
          done: true,
          cursor: "end",
          pageStatus: "SplitRequired" as const,
          splitCursor: "middle",
        };
      if (cursor === null && endCursor === "middle")
        return {
          accountId: "owner",
          records: [{ first: true }],
          done: false,
          cursor: "middle",
        };
      assert.equal(cursor, "middle");
      assert.equal(endCursor, "end");
      return {
        accountId: "owner",
        records: [{ second: true }],
        done: true,
        cursor: "end",
      };
    },
    () => {},
  );
  assert.deepEqual(data.profile, [{ first: true }, { second: true }]);
});
test("nested incomplete ranges finish before continuing to the next original page", async () => {
  const data = await collectCloudExport(
    "owner",
    async (collection, cursor, endCursor?: string) => {
      if (collection !== "profile")
        return { accountId: "owner", records: [], done: true, cursor: "end" };
      if (cursor === "end" && !endCursor)
        return {
          accountId: "owner",
          records: [{ n: 4 }],
          done: true,
          cursor: "tail",
        };
      if (!endCursor)
        return {
          accountId: "owner",
          records: [{ partial: true }],
          done: false,
          cursor: "end",
          pageStatus: "SplitRequired" as const,
          splitCursor: "middle",
        };
      if (cursor === null && endCursor === "middle")
        return {
          accountId: "owner",
          records: [{ n: 1 }],
          done: false,
          cursor: "middle",
        };
      if (cursor === "middle" && endCursor === "end")
        return {
          accountId: "owner",
          records: [{ partial: true }],
          done: false,
          cursor: "end",
          pageStatus: "SplitRequired" as const,
          splitCursor: "inner",
        };
      return {
        accountId: "owner",
        records: [{ n: cursor === "middle" ? 2 : 3 }],
        done: false,
        cursor: endCursor,
      };
    },
    () => {},
  );
  assert.deepEqual(data.profile, [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }]);
});
test("an incomplete page without a usable split fails rather than saving partial data", async () => {
  for (const splitCursor of [null, "end"]) {
    await assert.rejects(
      collectCloudExport(
        "owner",
        async () => ({
          accountId: "owner",
          records: [{ partial: true }],
          done: true,
          cursor: "end",
          pageStatus: "SplitRequired",
          splitCursor,
        }),
        () => {},
      ),
      /large page/u,
    );
  }
});
test("cancelling during a pending cloud page prevents its data from being returned", async () => {
  let cancelled = false;
  await assert.rejects(
    collectCloudExport(
      "owner",
      async () => {
        cancelled = true;
        return {
          accountId: "owner",
          records: [{ text: "saved" }],
          done: true,
          cursor: "end",
        };
      },
      () => {
        if (cancelled) throw Error("cancelled");
      },
    ),
    /cancelled/u,
  );
});
async function fixture(file = ":memory:") {
  const db = new DatabaseSync(file);
  let fail = false;
  const connection = {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (db.prepare(sql).get() as T) ?? null;
    },
    async getAllAsync<T>(sql: string) {
      if (fail && sql.includes("review_events"))
        throw Error("read interrupted");
      return db.prepare(sql).all() as T[];
    },
  };
  await initializeAccountSchema(connection);
  db.prepare(
    "INSERT INTO profile(id,data,server_revision,local_revision,acknowledged_revision) VALUES(1,?,3,5,3)",
  ).run(JSON.stringify({ goal: "conversation", reminderTime: "20:00" }));
  db.prepare("INSERT INTO study_events VALUES(?,?,?,?)").run(
    "event-first",
    "saved-session",
    JSON.stringify({ input: "みず", localDay: "2026-10-15" }),
    0,
  );
  db.prepare("INSERT INTO review_events VALUES(?,?,?)").run(
    "review-first",
    JSON.stringify({ input: "water", mode: "due" }),
    0,
  );
  db.prepare("INSERT INTO review_changes VALUES(?,?)").run(
    1,
    JSON.stringify({ kind: "attempt", receipt: { status: "committed" } }),
  );
  db.prepare("INSERT INTO drafts VALUES(?,?,?)").run(
    "answer:saved-session:own-sentence",
    "hon o kudasai",
    123,
  );
  const insert = db.prepare("INSERT INTO study_metadata VALUES(?,?)");
  insert.run(
    "recording:one",
    JSON.stringify({
      id: "one",
      uri: "file:///private/one.m4a",
      recognizedTranscript: "水をください",
      learnerConfirmedText: "みずをください",
      recognitionStatus: "ready",
    }),
  );
  insert.run(
    "chat:one",
    JSON.stringify({
      messages: [{ text: "水をください" }],
      jobs: [{ recap: "You practised requests", trace: "private" }],
    }),
  );
  insert.run("review-run", JSON.stringify({ index: 1, input: "tea" }));
  insert.run(
    "unknown-private-metadata",
    JSON.stringify({ token: "never export" }),
  );
  return {
    db,
    connection,
    fail: () => {
      fail = true;
    },
  };
}
test("device export retains unsynchronized attempts drafts transcripts and review position without changing SQLite", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  const before = f.db.prepare("SELECT total_changes() AS count").get();
  const snapshot = await readLocalLearningExport(f.connection);
  const text = JSON.stringify(snapshot);
  assert.match(text, /hon o kudasai/u);
  assert.match(text, /みずをください/u);
  assert.match(text, /"acknowledged":false/u);
  assert.match(text, /"local_revision":5/u);
  assert.match(text, /"key":"review-run"/u);
  assert.match(text, /"input":"tea"/u);
  assert.doesNotMatch(
    text,
    /private\/one|unknown-private|never export|"trace"/u,
  );
  assert.deepEqual(
    f.db.prepare("SELECT total_changes() AS count").get(),
    before,
  );
  assert.equal(
    f.db.prepare("SELECT count(*) AS count FROM study_events").get()?.count,
    1,
  );
});
test("a device snapshot read failure rolls back and retains all saved work", async (t) => {
  const f = await fixture();
  t.after(() => f.db.close());
  f.fail();
  await assert.rejects(
    readLocalLearningExport(f.connection),
    /read interrupted/u,
  );
  f.db.exec("BEGIN;ROLLBACK");
  assert.equal(
    f.db.prepare("SELECT count(*) AS count FROM study_events").get()?.count,
    1,
  );
  assert.equal(
    f.db.prepare("SELECT body FROM drafts").get()?.body,
    "hon o kudasai",
  );
});
test("a concurrent WAL writer cannot mix two device states into one export", async (t) => {
  const parent = resolve(tmpdir()),
    directory = mkdtempSync(join(parent, "kiro-export-"));
  const file = join(directory, "account.db");
  const f = await fixture(file),
    writer = new DatabaseSync(file);
  t.after(() => {
    writer.close();
    f.db.close();
    assert(resolve(directory).startsWith(parent + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  let changed = false;
  const reader = {
    execAsync: f.connection.execAsync,
    async getAllAsync<T>(sql: string) {
      const rows = await f.connection.getAllAsync<T>(sql);
      if (!changed && sql.includes("FROM profile")) {
        changed = true;
        writer.exec("BEGIN IMMEDIATE");
        writer
          .prepare("UPDATE profile SET data=?")
          .run(JSON.stringify({ goal: "travel" }));
        writer
          .prepare("INSERT INTO drafts VALUES(?,?,?)")
          .run("later-draft", "new concurrent answer", 999);
        writer.exec("COMMIT");
      }
      return rows;
    },
  };
  const snapshot = await readLocalLearningExport(reader);
  const text = JSON.stringify(snapshot);
  assert.equal(changed, true);
  assert.match(text, /conversation/u);
  assert.doesNotMatch(text, /later-draft|new concurrent answer/u);
  assert.match(
    String(writer.prepare("SELECT data FROM profile").get()?.data),
    /travel/u,
  );
  assert.equal(
    writer.prepare("SELECT count(*) AS count FROM drafts").get()?.count,
    2,
  );
});
