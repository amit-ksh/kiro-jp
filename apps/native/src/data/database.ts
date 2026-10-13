import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { LearningProfile } from "@packages/learning-core";

export interface LocalProfile { data: LearningProfile; serverRevision: number; localRevision: number; acknowledgedRevision: number; }
export const databaseSchema = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, server_revision INTEGER NOT NULL DEFAULT 0, local_revision INTEGER NOT NULL DEFAULT 0, acknowledged_revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL);
  PRAGMA user_version = 1;
`;
export async function openAccountDatabase(accountId: string) {
  if (!accountId) throw new Error("An authenticated account is required.");
  const deployment = process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured";
  const namespace = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${deployment}:${accountId}`);
  const db = await SQLite.openDatabaseAsync(`learning-${namespace}.db`);
  try { await db.execAsync(databaseSchema); return db; }
  catch (error) { await db.closeAsync(); throw error; }
}
export async function readLocalProfile(db: SQLite.SQLiteDatabase): Promise<LocalProfile | null> {
  const row = await db.getFirstAsync<{ data: string; server_revision: number; local_revision: number; acknowledged_revision: number }>("SELECT * FROM profile WHERE id = 1");
  return row ? { data: JSON.parse(row.data), serverRevision: row.server_revision, localRevision: row.local_revision, acknowledgedRevision: row.acknowledged_revision } : null;
}
export async function writeLocalProfile(db: SQLite.SQLiteDatabase, profile: LocalProfile) {
  await db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync("INSERT INTO profile (id, data, server_revision, local_revision, acknowledged_revision) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, server_revision=excluded.server_revision, local_revision=excluded.local_revision, acknowledged_revision=excluded.acknowledged_revision", JSON.stringify(profile.data), profile.serverRevision, profile.localRevision, profile.acknowledgedRevision);
  });
}
export async function preserveConflict(db: SQLite.SQLiteDatabase, profile: LearningProfile) {
  await db.runAsync("INSERT INTO drafts (id, body, updated_at) VALUES (?, ?, ?)", `profile-conflict-${Crypto.randomUUID()}`, JSON.stringify(profile), Date.now());
}
