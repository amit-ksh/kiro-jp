import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import type { LearningProfile } from "@packages/learning-core";

export interface LocalProfile { data: LearningProfile; serverRevision: number; localRevision: number; acknowledgedRevision: number; }
export const databaseSchema = `
  PRAGMA busy_timeout = 5000;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, server_revision INTEGER NOT NULL DEFAULT 0, local_revision INTEGER NOT NULL DEFAULT 0, acknowledged_revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS study_events (event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, body TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS study_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  PRAGMA user_version = 2;
`;
let opening = Promise.resolve();
export async function openAccountDatabase(accountId: string) {
  if (!accountId) throw new Error("An authenticated account is required.");
  const deployment = process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured";
  const namespace = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${deployment}:${accountId}`);
  // Profile and study own separate handles. Serialize initial schema/WAL setup
  // so the first mount cannot race two journal-mode changes on a fresh file.
  const previous = opening;
  let release!: () => void;
  opening = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    const db = await SQLite.openDatabaseAsync(`learning-${namespace}.db`, { useNewConnection: true });
    try { await db.execAsync(databaseSchema); return db; }
    catch (error) { if (__DEV__) console.warn("Account storage initialization failed", error instanceof Error ? error.message : "SQLite initialization error"); await db.closeAsync(); throw error; }
  } finally { release(); }
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
