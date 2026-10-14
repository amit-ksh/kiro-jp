import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { LearningProfile } from "@packages/learning-core";
import { initializeAccountSchema } from "./accountSchema";

export interface LocalProfile {
  data: LearningProfile;
  serverRevision: number;
  localRevision: number;
  acknowledgedRevision: number;
}
let opening = Promise.resolve();
export async function openAccountDatabase(accountId: string) {
  if (!accountId) throw new Error("An authenticated account is required.");
  const deployment = process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured";
  const namespace = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${deployment}:${accountId}`,
  );
  // Profile and study own separate handles. Serialize initial schema/WAL setup
  // so the first mount cannot race two journal-mode changes on a fresh file.
  const previous = opening;
  let release!: () => void;
  opening = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const db = await SQLite.openDatabaseAsync(`learning-${namespace}.db`, {
      useNewConnection: true,
    });
    try {
      const migration = await initializeAccountSchema(db);
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
  // Expo opens a fresh connection for every exclusive transaction. The timeout
  // set on the parent handle is not inherited by that connection.
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.execAsync("PRAGMA busy_timeout = 5000");
    await task(tx);
  });
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
