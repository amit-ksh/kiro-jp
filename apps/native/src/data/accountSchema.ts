export const accountSchemaVersion = 4;
export class AccountStorageError extends Error {
  readonly code: "newer-version" | "invalid-schema";
  constructor(code: "newer-version" | "invalid-schema") {
    super(
      code === "newer-version"
        ? "Your saved learning data needs a newer app version. Update the app; your files have not been changed."
        : "Your saved learning data could not be checked. Your files were kept. Retry or update the app before studying.",
    );
    this.name = "AccountStorageError";
    this.code = code;
  }
}
interface SchemaConnection {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  getAllAsync<T>(sql: string): Promise<T[]>;
}
// Versions 1–3 reproduce the schemas actually shipped by the earlier checkpoints.
const migrations: Record<number, string> = {
  1: `CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL, server_revision INTEGER NOT NULL DEFAULT 0, local_revision INTEGER NOT NULL DEFAULT 0, acknowledged_revision INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL);`,
  2: `CREATE TABLE IF NOT EXISTS study_events (event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, body TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS study_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  3: `CREATE TABLE IF NOT EXISTS review_events (event_id TEXT PRIMARY KEY, body TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS review_changes (cursor INTEGER PRIMARY KEY, body TEXT NOT NULL);`,
  4: `CREATE INDEX IF NOT EXISTS study_events_by_session ON study_events(session_id);
      CREATE INDEX IF NOT EXISTS study_events_pending ON study_events(acknowledged);
      CREATE INDEX IF NOT EXISTS review_events_pending ON review_events(acknowledged);`,
};
const tables: Record<
  string,
  { since: number; columns: Record<string, string> }
> = {
  profile: {
    since: 1,
    columns: {
      id: "INTEGER:1",
      data: "TEXT:0",
      server_revision: "INTEGER:0",
      local_revision: "INTEGER:0",
      acknowledged_revision: "INTEGER:0",
    },
  },
  drafts: {
    since: 1,
    columns: { id: "TEXT:1", body: "TEXT:0", updated_at: "INTEGER:0" },
  },
  study_events: {
    since: 2,
    columns: {
      event_id: "TEXT:1",
      session_id: "TEXT:0",
      body: "TEXT:0",
      acknowledged: "INTEGER:0",
    },
  },
  study_metadata: { since: 2, columns: { key: "TEXT:1", value: "TEXT:0" } },
  review_events: {
    since: 3,
    columns: { event_id: "TEXT:1", body: "TEXT:0", acknowledged: "INTEGER:0" },
  },
  review_changes: {
    since: 3,
    columns: { cursor: "INTEGER:1", body: "TEXT:0" },
  },
};
async function versionOf(db: SchemaConnection) {
  const version = (
    await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version")
  )?.user_version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0)
    throw new AccountStorageError("invalid-schema");
  if (version > accountSchemaVersion)
    throw new AccountStorageError("newer-version");
  return version;
}
async function checkTables(db: SchemaConnection, version: number) {
  const existing = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  if (version === 0 && existing.some((row) => !tables[row.name]))
    throw new AccountStorageError("invalid-schema");
  for (const [name, definition] of Object.entries(tables)) {
    const present = existing.some((row) => row.name === name);
    if (!present) {
      if (version >= definition.since)
        throw new AccountStorageError("invalid-schema");
      continue;
    }
    const columns = await db.getAllAsync<{
      name: string;
      type: string;
      pk: number;
    }>(`PRAGMA table_info(${name})`);
    if (
      Object.entries(definition.columns).some(
        ([column, kind]) =>
          !columns.some(
            (row) =>
              row.name === column &&
              `${row.type.toUpperCase()}:${row.pk}` === kind,
          ),
      )
    )
      throw new AccountStorageError("invalid-schema");
  }
}
export async function initializeAccountSchema(db: SchemaConnection) {
  const initial = await versionOf(db);
  // Refuse unsupported/corrupt stores before changing journal mode or any schema.
  const integrity = await db.getFirstAsync<{ quick_check: string }>(
    "PRAGMA quick_check(1)",
  );
  if (integrity?.quick_check !== "ok")
    throw new AccountStorageError("invalid-schema");
  await checkTables(db, initial);
  await db.execAsync("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  if (initial === accountSchemaVersion) return { from: initial, to: initial };
  await db.execAsync("BEGIN IMMEDIATE");
  try {
    const current = await versionOf(db);
    await checkTables(db, current);
    for (let next = current + 1; next <= accountSchemaVersion; next++) {
      await db.execAsync(migrations[next]!);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    }
    await checkTables(db, accountSchemaVersion);
    await db.execAsync("COMMIT");
    return { from: current, to: accountSchemaVersion };
  } catch (error) {
    await db.execAsync("ROLLBACK");
    throw error;
  }
}
