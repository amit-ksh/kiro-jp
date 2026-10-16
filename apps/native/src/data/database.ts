import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import type { LearningProfile } from "@packages/learning-core";
import { initializeAccountSchema } from "./accountSchema";

export interface LocalProfile {
  data: LearningProfile;
  serverRevision: number;
  localRevision: number;
  acknowledgedRevision: number;
}
let opening = Promise.resolve();
const retired = new Set<string>(),
  checked = new Set<string>();
const handles = new Map<SQLite.SQLiteDatabase, string>();
const pendingOpens = new Map<Promise<SQLite.SQLiteDatabase>, string>();
export async function accountStorageNamespace(accountId: string) {
  if (!accountId) throw new Error("An authenticated account is required.");
  const deployment = process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured";
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${deployment}:${accountId}`,
  );
}
async function assertActive(namespace: string) {
  if (
    !checked.has(namespace) &&
    (await SecureStore.getItemAsync(`retired-learning-${namespace}`))
  )
    retired.add(namespace);
  checked.add(namespace);
  if (retired.has(namespace))
    throw new Error("This account's local storage is retired.");
}
async function trackedOpen(
  namespace: string,
  name: string,
  options: SQLite.SQLiteOpenOptions,
  directory?: string,
) {
  const task = (async () => {
    await assertActive(namespace);
    const db = await SQLite.openDatabaseAsync(name, options, directory);
    const close = db.closeAsync.bind(db);
    let closing: Promise<void> | undefined;
    handles.set(db, namespace);
    db.closeAsync = () =>
      (closing ??= close().then(
        () => {
          handles.delete(db);
        },
        (error) => {
          closing = undefined;
          throw error;
        },
      ));
    try {
      await assertActive(namespace);
      return db;
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
  })();
  pendingOpens.set(task, namespace);
  try {
    return await task;
  } finally {
    pendingOpens.delete(task);
  }
}
export async function quarantineAccountDatabase(accountId: string) {
  const namespace = await accountStorageNamespace(accountId);
  retired.add(namespace);
  await SecureStore.setItemAsync(`retired-learning-${namespace}`, "1");
  return namespace;
}
export async function retireAccountDatabase(accountId: string) {
  const namespace = await quarantineAccountDatabase(accountId);
  // Providers unmount before cleanup. Let their queues/aborted downloads finish
  // and close naturally; closing underneath a transaction can lose its rollback.
  for (let n = 0; n < 80; n++) {
    if (![...handles.values(), ...pendingOpens.values()].includes(namespace))
      return namespace;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    "Local study is quarantined while its last operation stops. Retry cleanup.",
  );
}
export async function openAccountDatabase(accountId: string) {
  const namespace = await accountStorageNamespace(accountId);
  await assertActive(namespace);
  // Profile and study own separate handles. Serialize initial schema/WAL setup
  // so the first mount cannot race two journal-mode changes on a fresh file.
  const previous = opening;
  let release!: () => void;
  opening = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const db = await trackedOpen(namespace, `learning-${namespace}.db`, {
      useNewConnection: true,
    });
    try {
      const migration = await initializeAccountSchema(db);
      await assertActive(namespace);
      if (__DEV__ && migration.from < migration.to)
        console.info("Account storage upgraded safely", migration);
      return db;
    } catch (error) {
      if (__DEV__)
        console.warn(
          "Account storage initialization failed",
          error instanceof Error
            ? error.message
            : "SQLite initialization error",
        );
      await db.closeAsync();
      throw error;
    }
  } finally {
    release();
  }
}
export async function readLocalProfile(
  db: SQLite.SQLiteDatabase,
): Promise<LocalProfile | null> {
  const row = await db.getFirstAsync<{
    data: string;
    server_revision: number;
    local_revision: number;
    acknowledged_revision: number;
  }>("SELECT * FROM profile WHERE id = 1");
  return row
    ? {
        data: JSON.parse(row.data),
        serverRevision: row.server_revision,
        localRevision: row.local_revision,
        acknowledgedRevision: row.acknowledged_revision,
      }
    : null;
}
export async function accountTransaction(
  db: SQLite.SQLiteDatabase,
  task: Parameters<SQLite.SQLiteDatabase["withExclusiveTransactionAsync"]>[0],
) {
  // Reserve the write before reading. Expo's exclusive helper starts with a
  // deferred BEGIN: a concurrent commit can make a later read-to-write upgrade
  // fail with SQLITE_BUSY_SNAPSHOT even when a busy timeout is configured.
  // A fresh connection also keeps unrelated parent-handle writes outside this
  // transaction. Preserve the account/deployment path and connection options.
  const path = db.databasePath.replace(/\\/g, "/");
  const separator = path.lastIndexOf("/");
  const namespace = /(?:^|\/)learning-([a-f0-9]{64})\.db$/.exec(path)?.[1];
  const open = namespace
    ? (name: string, options: SQLite.SQLiteOpenOptions, directory?: string) =>
        trackedOpen(namespace, name, options, directory)
    : SQLite.openDatabaseAsync;
  const tx = await open(
    path.slice(separator + 1),
    { ...db.options, useNewConnection: true },
    separator < 0 ? undefined : path.slice(0, separator) || "/",
  );
  let started = false;
  let failed = false;
  try {
    await tx.execAsync("PRAGMA busy_timeout = 5000");
    await tx.execAsync("BEGIN IMMEDIATE");
    started = true;
    await task(tx);
    await tx.execAsync("COMMIT");
    started = false;
  } catch (error) {
    failed = true;
    if (started) {
      try {
        await tx.execAsync("ROLLBACK");
      } catch {
        // Preserve the original failure; closing releases this connection.
      }
    }
    throw error;
  } finally {
    try {
      await tx.closeAsync();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
export async function writeLocalProfile(
  db: SQLite.SQLiteDatabase,
  profile: LocalProfile,
) {
  await accountTransaction(db, async (tx) => {
    await tx.runAsync(
      "INSERT INTO profile (id, data, server_revision, local_revision, acknowledged_revision) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, server_revision=excluded.server_revision, local_revision=excluded.local_revision, acknowledged_revision=excluded.acknowledged_revision",
      JSON.stringify(profile.data),
      profile.serverRevision,
      profile.localRevision,
      profile.acknowledgedRevision,
    );
  });
}
export async function preserveConflict(
  db: SQLite.SQLiteDatabase,
  profile: LearningProfile,
) {
  await db.runAsync(
    "INSERT INTO drafts (id, body, updated_at) VALUES (?, ?, ?)",
    `profile-conflict-${Crypto.randomUUID()}`,
    JSON.stringify(profile),
    Date.now(),
  );
}
