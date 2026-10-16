import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { Worker } from "node:worker_threads";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { initializeAccountSchema } from "../apps/native/src/data/accountSchema.ts";
import { cacheReviewPage } from "../apps/native/src/data/syncCache.ts";
import type { ReviewChange } from "../packages/learning-core/src/reviews.ts";

// Exercise the app wrapper itself. Only native module loading is substituted;
// connections, WAL locking, statements and independent workers use real SQLite.
const factoryKey = Symbol.for("kiro.test.sqliteFactory");
const globals = globalThis as typeof globalThis & {
  [factoryKey]?: (...args: unknown[]) => Promise<Connection>;
};
const sqliteStub = `data:text/javascript,${encodeURIComponent(
  'export const openDatabaseAsync = (...args) => globalThis[Symbol.for("kiro.test.sqliteFactory")](...args);',
)}`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-sqlite")
      return { url: sqliteStub, shortCircuit: true };
    if (specifier === "expo-crypto")
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier === "expo-secure-store")
      return { url: "data:text/javascript,export const getItemAsync=async()=>null;", shortCircuit: true };
    if (
      specifier === "./accountSchema" &&
      context.parentURL?.endsWith("/database.ts")
    )
      return next("./accountSchema.ts", context);
    return next(specifier, context);
  },
});
const { accountTransaction } =
  await import("../apps/native/src/data/database.ts");
hooks.deregister();

class Connection {
  readonly db: DatabaseSync;
  readonly databasePath: string;
  readonly options: { useNewConnection?: boolean };
  closed = false;
  afterRead?: () => Promise<void>;
  fail?: (sql: string) => void;
  constructor(
    databasePath: string,
    options: { useNewConnection?: boolean } = {},
  ) {
    this.databasePath = databasePath;
    this.options = options;
    this.db = new DatabaseSync(databasePath);
  }
  async execAsync(sql: string) {
    this.fail?.(sql);
    this.db.exec(sql);
  }
  async runAsync(sql: string, ...values: (string | number)[]) {
    return this.db.prepare(sql).run(...values);
  }
  async getFirstAsync<T>(sql: string, ...values: (string | number)[]) {
    const row = (this.db.prepare(sql).get(...values) as T) ?? null;
    if (this.afterRead && sql.includes("FROM review_changes")) {
      const hook = this.afterRead;
      this.afterRead = undefined;
      await hook();
    }
    return row;
  }
  async getAllAsync<T>(sql: string) {
    return this.db.prepare(sql).all() as T[];
  }
  async closeAsync() {
    this.db.close();
    this.closed = true;
    this.fail?.("CLOSE");
  }
  // Installed Expo SDK 55 starts a deferred transaction on a fresh connection.
  // Retain that behavior so this regression goes red with the former wrapper.
  async withExclusiveTransactionAsync(work: (tx: Connection) => Promise<void>) {
    const tx = await globals[factoryKey]!(
      this.databasePath.split(/[\\/]/).pop()!,
      { ...this.options, useNewConnection: true },
      dirname(this.databasePath),
    );
    try {
      await tx.execAsync("BEGIN");
      await work(tx);
      await tx.execAsync("COMMIT");
    } catch (error) {
      await tx.execAsync("ROLLBACK");
      throw error;
    } finally {
      await tx.closeAsync();
    }
  }
}
async function fixture(t: TestContext) {
  const root = resolve(tmpdir()),
    directory = mkdtempSync(join(root, "kiro-account-write-")),
    file = join(directory, "learning-synthetic-account.db");
  const parent = new Connection(file, { useNewConnection: true });
  const connections: Connection[] = [];
  const opens: unknown[][] = [];
  let configure = (_tx: Connection) => {};
  globals[factoryKey] = async (...args) => {
    opens.push(args);
    const [name, options, targetDirectory] = args as [
      string,
      { useNewConnection?: boolean },
      string,
    ];
    const tx = new Connection(join(targetDirectory, name), options);
    connections.push(tx);
    configure(tx);
    return tx;
  };
  await initializeAccountSchema(parent);
  t.after(async () => {
    delete globals[factoryKey];
    for (const connection of [...connections, parent])
      if (!connection.closed) await connection.closeAsync();
    assert(directory.startsWith(root + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    file,
    parent,
    opens,
    connections,
    configure: (callback: typeof configure) => {
      configure = callback;
    },
    transact: (work: (tx: Connection) => Promise<void>) =>
      accountTransaction(
        parent as unknown as Parameters<typeof accountTransaction>[0],
        work as Parameters<typeof accountTransaction>[1],
      ),
  };
}
async function waitFor(predicate: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline)
      throw Error("SQLite worker rendezvous timed out");
    await new Promise((done) => setTimeout(done, 2));
  }
}
const page = {
  changes: [
    {
      cursor: 1,
      change: {
        kind: "introduced",
        track: { id: "synthetic-review-track" },
      } as ReviewChange,
    },
  ],
  nextCursor: 1,
};

test("review cache and an independent draft writer both survive the read/write overlap", async (t) => {
  const f = await fixture(t);
  const state = new Int32Array(new SharedArrayBuffer(8));
  const worker = new Worker(
    `const { workerData } = require("node:worker_threads");
     const { DatabaseSync } = require("node:sqlite");
     const s = new Int32Array(workerData.state), db = new DatabaseSync(workerData.file);
     db.exec("PRAGMA busy_timeout = 50");
     Atomics.store(s, 0, 1); Atomics.notify(s, 0); Atomics.wait(s, 0, 1);
     function write() { db.exec("BEGIN IMMEDIATE; INSERT INTO drafts VALUES('concurrent-draft','retained',1); COMMIT;"); }
     try { write(); Atomics.store(s, 0, 3); }
     catch (error) {
       if (![5, 517].includes(error.errcode)) throw error;
       Atomics.store(s, 0, 4); Atomics.notify(s, 0); Atomics.wait(s, 1, 0); write();
     }
     db.close(); Atomics.store(s, 0, 5); Atomics.notify(s, 0);`,
    { eval: true, workerData: { file: f.file, state: state.buffer } },
  );
  t.after(() => worker.terminate());
  await waitFor(() => Atomics.load(state, 0) === 1);
  f.configure((tx) => {
    tx.afterRead = async () => {
      Atomics.store(state, 0, 2);
      Atomics.notify(state, 0);
      await waitFor(() => Atomics.load(state, 0) >= 3);
    };
  });
  try {
    assert.equal(await cacheReviewPage(page, f.transact), 1);
  } finally {
    Atomics.store(state, 1, 1);
    Atomics.notify(state, 1);
  }
  await waitFor(() => Atomics.load(state, 0) === 5);
  assert.equal(
    f.parent.db.prepare("SELECT count(*) AS n FROM drafts").get()!.n,
    1,
  );
  assert.equal(
    f.parent.db.prepare("SELECT count(*) AS n FROM review_changes").get()!.n,
    1,
  );
  assert.equal(
    f.parent.db
      .prepare("SELECT value FROM study_metadata WHERE key='review-cursor'")
      .get()!.value,
    "1",
  );
  assert(f.connections.every((tx) => tx.closed));
  f.configure(() => {});
  assert.equal(await cacheReviewPage(page, f.transact), 1);
  assert.equal(
    f.parent.db.prepare("SELECT count(*) AS n FROM review_changes").get()!.n,
    1,
  );
});

test("a short independent write lock is waited out before the cache reads", async (t) => {
  const f = await fixture(t);
  const state = new Int32Array(new SharedArrayBuffer(4));
  const worker = new Worker(
    `const {workerData}=require("node:worker_threads"), {DatabaseSync}=require("node:sqlite");
     const db=new DatabaseSync(workerData.file), s=new Int32Array(workerData.state);
     db.exec("BEGIN IMMEDIATE; INSERT INTO drafts VALUES('earlier-write','retained',1)");
     Atomics.store(s,0,1); Atomics.notify(s,0); Atomics.wait(s,0,1,100);
     db.exec("COMMIT"); db.close(); Atomics.store(s,0,2); Atomics.notify(s,0);`,
    { eval: true, workerData: { file: f.file, state: state.buffer } },
  );
  t.after(() => worker.terminate());
  await waitFor(() => Atomics.load(state, 0) === 1);
  assert.equal(await cacheReviewPage(page, f.transact), 1);
  await waitFor(() => Atomics.load(state, 0) === 2);
  assert.equal(
    f.parent.db.prepare("SELECT count(*) AS n FROM drafts").get()!.n,
    1,
  );
  assert(f.connections.every((tx) => tx.closed));
});

test("failed cache commits roll back atomically and preserve the original error through cleanup", async (t) => {
  const f = await fixture(t),
    original = Error("synthetic commit failure");
  f.configure((tx) => {
    tx.fail = (sql) => {
      if (sql === "COMMIT") throw original;
      if (sql === "CLOSE") throw Error("synthetic close failure");
    };
  });
  await assert.rejects(
    cacheReviewPage(page, f.transact),
    (error) => error === original,
  );
  assert.equal(
    f.parent.db.prepare("SELECT count(*) AS n FROM review_changes").get()!.n,
    0,
  );
  assert.equal(
    f.parent.db
      .prepare(
        "SELECT count(*) AS n FROM study_metadata WHERE key='review-cursor'",
      )
      .get()!.n,
    0,
  );
  assert(f.connections.every((tx) => tx.closed));
  assert.equal(f.parent.closed, false);
  f.configure(() => {});
  assert.equal(await cacheReviewPage(page, f.transact), 1);
  const [name, options, directory] = f.opens[0]!;
  assert.equal(
    resolve(join(directory as string, name as string)),
    resolve(f.file),
  );
  assert.deepEqual(options, { useNewConnection: true });
});

test("an unavailable write reservation does not run the task or roll back an unstarted transaction", async (t) => {
  const f = await fixture(t),
    original = Error("synthetic begin failure");
  let taskRan = false,
    rolledBack = false;
  f.configure((tx) => {
    tx.fail = (sql) => {
      if (sql === "BEGIN IMMEDIATE") throw original;
      if (sql === "ROLLBACK") rolledBack = true;
    };
  });
  await assert.rejects(
    f.transact(async () => {
      taskRan = true;
    }),
    (error) => error === original,
  );
  assert.equal(taskRan, false);
  assert.equal(rolledBack, false);
  assert(f.connections.every((tx) => tx.closed));
  f.configure(() => {});
  assert.equal(await cacheReviewPage(page, f.transact), 1);
});

test("a task failure survives rollback failure and closes only its account connection", async (t) => {
  const f = await fixture(t),
    original = Error("synthetic task failure");
  const other = new Connection(
    join(dirname(f.file), "learning-other-account.db"),
  );
  try {
    await initializeAccountSchema(other);
    f.configure((tx) => {
      tx.fail = (sql) => {
        if (sql === "ROLLBACK") throw Error("synthetic rollback failure");
      };
    });
    await assert.rejects(
      f.transact(async (tx) => {
        await tx.runAsync(
          "INSERT INTO drafts VALUES('failed-write','discarded',1)",
        );
        throw original;
      }),
      (error) => error === original,
    );
    assert(f.connections.every((tx) => tx.closed));
    assert.equal(
      f.parent.db.prepare("SELECT count(*) AS n FROM drafts").get()!.n,
      0,
    );
    f.configure(() => {});
    await f.transact(async (tx) => {
      await tx.runAsync(
        "INSERT INTO drafts VALUES('committed-write','retained',2)",
      );
    });
    assert.equal(
      f.parent.db.prepare("SELECT count(*) AS n FROM drafts").get()!.n,
      1,
    );
    assert.equal(
      other.db.prepare("SELECT count(*) AS n FROM drafts").get()!.n,
      0,
    );
    assert.equal(f.parent.closed, false);
    assert.equal(other.closed, false);
  } finally {
    await other.closeAsync();
  }
});
