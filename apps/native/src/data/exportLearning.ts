import {
  exportValue,
  type ExportValue,
} from "../../../../packages/learning-core/src/data-export.ts";

interface ReadConnection {
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string) => Promise<T[]>;
}
const metadataKeys = new Set([
  "saved-phrases",
  "sentence-feedback",
  "review-run",
  "device",
  "sequence",
  "cursor",
  "review-device",
  "review-sequence",
  "review-cursor",
]);
export async function readLocalLearningExport(db: ReadConnection) {
  await db.execAsync("BEGIN");
  try {
    const profile = await db.getAllAsync<{
      data: string;
      server_revision: number;
      local_revision: number;
      acknowledged_revision: number;
    }>(
      "SELECT data,server_revision,local_revision,acknowledged_revision FROM profile WHERE id=1",
    );
    const study = await db.getAllAsync<{ body: string; acknowledged: number }>(
      "SELECT body,acknowledged FROM study_events ORDER BY rowid",
    );
    const reviews = await db.getAllAsync<{
      body: string;
      acknowledged: number;
    }>("SELECT body,acknowledged FROM review_events ORDER BY rowid");
    const changes = await db.getAllAsync<{ cursor: number; body: string }>(
      "SELECT cursor,body FROM review_changes ORDER BY cursor",
    );
    const drafts = await db.getAllAsync<{
      id: string;
      body: string;
      updated_at: number;
    }>("SELECT id,body,updated_at FROM drafts ORDER BY id");
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      "SELECT key,value FROM study_metadata ORDER BY key",
    );
    const metadata: { key: string; value: ExportValue }[] = [];
    for (const row of rows) {
      if (row.key.startsWith("recording-delete:"))
        metadata.push({ key: row.key, value: row.value });
      else if (
        metadataKeys.has(row.key) ||
        /^(chat:|recording:|phrase-audio:|content-ready:)/u.test(row.key)
      ) {
        const scalar = [
          "device",
          "sequence",
          "cursor",
          "review-device",
          "review-sequence",
          "review-cursor",
        ].includes(row.key);
        metadata.push({
          key: row.key,
          value: exportValue(scalar ? row.value : JSON.parse(row.value)),
        });
      }
    }
    const result = exportValue({
      capturedAt: Date.now(),
      profile: profile.map((row) => ({ ...row, data: JSON.parse(row.data) })),
      studyEvents: study.map((row) => ({
        event: JSON.parse(row.body),
        acknowledged: Boolean(row.acknowledged),
      })),
      reviewAttempts: reviews.map((row) => ({
        event: JSON.parse(row.body),
        acknowledged: Boolean(row.acknowledged),
      })),
      reviewChanges: changes.map((row) => ({
        cursor: row.cursor,
        change: JSON.parse(row.body),
      })),
      drafts,
      metadata,
    });
    await db.execAsync("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.execAsync("ROLLBACK");
    } catch {
      /* Keep the export error. */
    }
    throw error;
  }
}
