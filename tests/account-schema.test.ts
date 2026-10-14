import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  accountSchemaVersion,
  initializeAccountSchema,
  AccountStorageError,
} from "../apps/native/src/data/accountSchema.ts";

// Independent snapshots of the DDL in bd24578 (v1), ff56dec (v2), fc0c8b0 (v3).
const legacy = [
  "CREATE TABLE profile(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL,server_revision INTEGER NOT NULL DEFAULT 0,local_revision INTEGER NOT NULL DEFAULT 0,acknowledged_revision INTEGER NOT NULL DEFAULT 0);CREATE TABLE drafts(id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at INTEGER NOT NULL);",
  "CREATE TABLE study_events(event_id TEXT PRIMARY KEY,session_id TEXT NOT NULL,body TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0);CREATE TABLE study_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
  "CREATE TABLE review_events(event_id TEXT PRIMARY KEY,body TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0);CREATE TABLE review_changes(cursor INTEGER PRIMARY KEY,body TEXT NOT NULL);",
];
function fixture(t: TestContext, version = 0) {
  const directory = mkdtempSync(join(tmpdir(), "kiro-schema-")),
    file = join(directory, "account.db");
  let db = new DatabaseSync(file),
    failAt = "";
  for (const ddl of legacy.slice(0, version)) db.exec(ddl);
  db.exec(`PRAGMA user_version=${version}`);
  if (version >= 1)
    db.exec(
      `INSERT INTO profile VALUES(1,'{"interests":["Manga"],"onboardingStep":"complete"}',2,3,2);INSERT INTO drafts VALUES('answer:saved:step','mizu o kudasai',1234);`,
    );
  if (version >= 2)
    db.exec(
      `INSERT INTO study_events VALUES('offline-study','saved-session','{"kind":"attempted","localDay":"2026-10-13"}',0);INSERT INTO study_metadata VALUES('cursor','93');INSERT INTO study_metadata VALUES('content-ready:requests:1','{"kept":"package"}');`,
    );
  if (version >= 3)
    db.exec(
      `INSERT INTO review_events VALUES('offline-review','{"opportunityId":"original","input":"mizu"}',0);INSERT INTO review_changes VALUES(54,'{"closed":{"resolution":"permanent"}}');`,
    );
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const executed: string[] = [];
  const connection = {
    async execAsync(sql: string) {
      executed.push(sql);
      if (failAt && sql.includes(failAt))
        throw Error("synthetic migration interruption");
      db.exec(sql);
    },
    async getFirstAsync<T>(sql: string) {
      return (db.prepare(sql).get() as T) ?? null;
    },
    async getAllAsync<T>(sql: string) {
      return db.prepare(sql).all() as T[];
    },
  };
  const snapshot = () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return Object.fromEntries(
      tables.map((t) => [
        t.name,
        db.prepare(`SELECT * FROM ${t.name} ORDER BY rowid`).all(),
      ]),
    );
  };
  return {
    connection,
    executed,
    file,
    snapshot,
    sql: (sql: string) => db.exec(sql),
    get: (sql: string) => db.prepare(sql).get(),
    all: (sql: string) => db.prepare(sql).all(),
    reopen: () => {
      db.close();
      db = new DatabaseSync(file);
    },
    fail: (needle: string) => (failAt = needle),
  };
}
for (const version of [0, 1, 2, 3])
  test(`account schema ${version} upgrades atomically and retains drafts, outbox, package and permanent review bytes`, async (t) => {
    const f = fixture(t, version),
      before = f.snapshot();
    assert.deepEqual(await initializeAccountSchema(f.connection), {
      from: version,
      to: accountSchemaVersion,
    });
    f.reopen();
    assert.equal(
      (f.get("PRAGMA user_version") as { user_version: number }).user_version,
      4,
    );
    const after = f.snapshot();
    for (const table of Object.keys(before))
      assert.deepEqual(after[table], before[table]);
    assert.equal(
      f.all(
        "SELECT name FROM sqlite_master WHERE type='index' AND name IN('study_events_by_session','study_events_pending','review_events_pending')",
      ).length,
      3,
    );
    assert.deepEqual(await initializeAccountSchema(f.connection), {
      from: 4,
      to: 4,
    });
    assert.deepEqual(f.snapshot(), after);
  });
test("a newer database is refused before any write, keeps its version/data and can be opened by a newer app", async (t) => {
  const f = fixture(t, 3);
  f.sql("PRAGMA user_version=9");
  const before = f.snapshot(),
    journal = f.get("PRAGMA journal_mode");
  await assert.rejects(
    initializeAccountSchema(f.connection),
    (error: unknown) =>
      error instanceof AccountStorageError &&
      error.code === "newer-version" &&
      error.message.includes("Update the app"),
  );
  assert.deepEqual(f.executed, []);
  assert.deepEqual(f.get("PRAGMA journal_mode"), journal);
  f.reopen();
  assert.deepEqual(f.snapshot(), before);
  assert.equal(
    (f.get("PRAGMA user_version") as { user_version: number }).user_version,
    9,
  );
});
test("a migration failure rolls all new tables/version changes back, then retries without replacing earlier data", async (t) => {
  const f = fixture(t, 1),
    before = f.snapshot();
  f.fail("review_changes");
  await assert.rejects(
    initializeAccountSchema(f.connection),
    /synthetic migration/,
  );
  f.reopen();
  assert.equal(
    (f.get("PRAGMA user_version") as { user_version: number }).user_version,
    1,
  );
  assert.deepEqual(f.snapshot(), before);
  f.fail("");
  await initializeAccountSchema(f.connection);
  f.reopen();
  for (const table of Object.keys(before))
    assert.deepEqual(f.snapshot()[table], before[table]);
});
test("incompatible or incomplete known schemas are retained and rejected instead of silently recreating progress tables", async (t) => {
  const f = fixture(t, 3);
  f.sql(
    "ALTER TABLE review_events RENAME TO retained_review_events;CREATE TABLE review_events(event_id INTEGER PRIMARY KEY,body TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0)",
  );
  const before = f.snapshot();
  await assert.rejects(
    initializeAccountSchema(f.connection),
    AccountStorageError,
  );
  assert.deepEqual(f.executed, []);
  assert.deepEqual(f.snapshot(), before);
  const missing = fixture(t, 3);
  missing.sql("DROP TABLE review_changes");
  await assert.rejects(
    initializeAccountSchema(missing.connection),
    AccountStorageError,
  );
  assert.deepEqual(missing.executed, []);
  assert(!missing.snapshot().review_changes);
  const unknown = fixture(t);
  unknown.sql(
    "CREATE TABLE unrelated(body TEXT);INSERT INTO unrelated VALUES('retained')",
  );
  await assert.rejects(
    initializeAccountSchema(unknown.connection),
    AccountStorageError,
  );
  assert.deepEqual(unknown.executed, []);
  assert.equal(
    (unknown.get("SELECT body FROM unrelated") as { body: string }).body,
    "retained",
  );
});
test("separate account files keep unsent answers and schema upgrades isolated", async (t) => {
  const a = fixture(t, 3),
    b = fixture(t),
    before = a.snapshot();
  await initializeAccountSchema(b.connection);
  assert.deepEqual(a.snapshot(), before);
  assert.equal(b.all("SELECT * FROM study_events").length, 0);
  assert.equal(b.all("SELECT * FROM review_events").length, 0);
  await initializeAccountSchema(a.connection);
  assert.deepEqual(a.snapshot(), before);
});

test("a partially applied v4 index upgrade rolls back without changing acknowledged review records", async (t) => {
  const f = fixture(t, 3),
    before = f.snapshot(),
    original = f.connection.execAsync;
  f.connection.execAsync = async (sql) => {
    if (sql.includes("review_events_pending")) {
      f.sql("CREATE INDEX study_events_by_session ON study_events(session_id)");
      throw new Error("interrupted after first index");
    }
    await original(sql);
  };
  await assert.rejects(
    initializeAccountSchema(f.connection),
    /interrupted after first index/,
  );
  f.reopen();
  assert.equal(
    (f.get("PRAGMA user_version") as { user_version: number }).user_version,
    3,
  );
  assert.equal(
    f.all(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='study_events_by_session'",
    ).length,
    0,
  );
  assert.deepEqual(f.snapshot(), before);
  f.connection.execAsync = original;
  await initializeAccountSchema(f.connection);
  assert.deepEqual(f.snapshot(), before);
});
test("an unreadable database is never replaced with an empty store", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "kiro-invalid-")),
    file = join(directory, "broken.db");
  writeFileSync(file, "saved bytes that are not a sqlite database");
  const before = readFileSync(file);
  const db = new DatabaseSync(file);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await assert.rejects(
    initializeAccountSchema({
      async execAsync(sql) {
        db.exec(sql);
      },
      async getFirstAsync<T>(sql) {
        return db.prepare(sql).get() as T;
      },
      async getAllAsync<T>(sql) {
        return db.prepare(sql).all() as T[];
      },
    }),
  );
  assert.deepEqual(readFileSync(file), before);
});
