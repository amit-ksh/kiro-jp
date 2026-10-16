import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { registerHooks } from "node:module";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const key = Symbol.for("kiro.test.retirement");
type Connection = {
  databasePath: string;
  options: object;
  execAsync(sql: string): Promise<void>;
  closeAsync(): Promise<void>;
  closed: boolean;
};
type Ports = {
  digest: (s: string) => string;
  get: (s: string) => Promise<string | null>;
  set: (s: string, v: string) => Promise<void>;
  open: (name: string, options: object) => Promise<Connection>;
};
const globals = globalThis as typeof globalThis & {
  [key]: Ports;
  __DEV__: boolean;
};
const moduleUrl = (source: string) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "expo-sqlite")
      return {
        shortCircuit: true,
        url: moduleUrl(
          'export const openDatabaseAsync=(...args)=>globalThis[Symbol.for("kiro.test.retirement")].open(...args);',
        ),
      };
    if (specifier === "expo-crypto")
      return {
        shortCircuit: true,
        url: moduleUrl(
          'export const CryptoDigestAlgorithm={SHA256:"SHA256"};export const digestStringAsync=async(_,value)=>globalThis[Symbol.for("kiro.test.retirement")].digest(value);',
        ),
      };
    if (specifier === "expo-secure-store")
      return {
        shortCircuit: true,
        url: moduleUrl(
          'export const getItemAsync=(key)=>globalThis[Symbol.for("kiro.test.retirement")].get(key);export const setItemAsync=(key,value)=>globalThis[Symbol.for("kiro.test.retirement")].set(key,value);',
        ),
      };
    if (
      specifier === "./accountSchema" &&
      context.parentURL?.includes("/database.ts")
    )
      return next("./accountSchema.ts", context);
    return next(specifier, context);
  },
});
const storage = await import("../apps/native/src/data/database.ts");

function fixture(t: TestContext) {
  const root = resolve(tmpdir()),
    directory = mkdtempSync(join(root, "kiro-retire-"));
  const secrets = new Map<string, string>(),
    connections: Connection[] = [];
  let opened = 0,
    beforeReturn = async (_name: string) => {};
  globals.__DEV__ = false;
  globals[key] = {
    digest: (value) => createHash("sha256").update(value).digest("hex"),
    get: async (key) => secrets.get(key) ?? null,
    set: async (key, value) => {
      secrets.set(key, value);
    },
    open: async (name, options) => {
      opened++;
      const databasePath = join(directory, name),
        db = new DatabaseSync(databasePath);
      const connection = {
        databasePath,
        options,
        closed: false,
        execAsync: async (sql: string) => {
          db.exec(sql);
        },
        getFirstAsync: async (sql: string) => db.prepare(sql).get() ?? null,
        getAllAsync: async (sql: string) => db.prepare(sql).all(),
        closeAsync: async () => {
          db.close();
          connection.closed = true;
        },
      };
      connections.push(connection);
      await beforeReturn(name);
      return connection;
    },
  };
  t.after(async () => {
    for (const connection of connections)
      if (!connection.closed) await connection.closeAsync();
    assert(directory.startsWith(root + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    secrets,
    connections,
    opened: () => opened,
    pause: (fn: typeof beforeReturn) => {
      beforeReturn = fn;
    },
  };
}

test("retirement blocks new opens and transactions, waits for old handles, and leaves another account usable", async (t) => {
  const f = fixture(t),
    a = await storage.openAccountDatabase("retirementA"),
    b = await storage.openAccountDatabase("retirementB");
  const namespace = await storage.quarantineAccountDatabase("retirementA");
  assert.equal(f.secrets.get(`retired-learning-${namespace}`), "1");
  await assert.rejects(storage.openAccountDatabase("retirementA"), /retired/u);
  await assert.rejects(
    storage.accountTransaction(a, async (tx) => {
      await tx.execAsync("SELECT 1");
    }),
    /retired/u,
  );
  await storage.accountTransaction(b, async (tx) => {
    await tx.execAsync("CREATE TABLE still_owned(value TEXT)");
  });
  let retired = false;
  const wait = storage.retireAccountDatabase("retirementA").then(() => {
    retired = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(retired, false);
  await a.closeAsync();
  await wait;
  assert.equal(retired, true);
  assert.equal(f.opened(), 3);
  await b.closeAsync();
});
test("an open that finishes after retirement closes itself before cleanup can finish", async (t) => {
  const f = fixture(t);
  let release!: () => void, started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.pause(async () => {
    started();
    await barrier;
  });
  const late = storage.openAccountDatabase("lateRetirement");
  await entered;
  await storage.quarantineAccountDatabase("lateRetirement");
  let finished = false;
  const retirement = storage
    .retireAccountDatabase("lateRetirement")
    .then(() => {
      finished = true;
    });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(finished, false);
  release();
  await assert.rejects(late, /retired/u);
  await retirement;
  assert(f.connections.every((db) => db.closed));
});
test("a fresh JS runtime honors the persistent retirement before opening SQLite", async (t) => {
  const f = fixture(t),
    namespace = await storage.accountStorageNamespace("persistentRetirement");
  f.secrets.set(`retired-learning-${namespace}`, "1");
  const restarted = await import(
    `../apps/native/src/data/database.ts?retirement-restart`
  );
  await assert.rejects(
    restarted.openAccountDatabase("persistentRetirement"),
    /retired/u,
  );
  assert.equal(f.opened(), 0);
});

test.after(() => {
  hooks.deregister();
});
