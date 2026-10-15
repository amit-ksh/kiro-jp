import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteAuthBatch, deleteLearningBatch, deletionCollections } from "../packages/backend/convex/lib/accountCleanup.ts";
import type { MutationCtx } from "../packages/backend/convex/_generated/server";
import type { Id } from "../packages/backend/convex/_generated/dataModel";

const owner = "owner" as Id<"users">;
function fixture() {
  const rows = new Map<string, Record<string, unknown>>(), deletedBlobs: string[] = [];
  let serial = 0, maxBatch = 0;
  const add = (table: string, values: Record<string, unknown>) => {
    const id = `${table}:${++serial}`;
    rows.set(id, { ...values, _id: id, _table: table });
    return id;
  };
  const ctx = {
    db: {
      query(table: string) {
        const equals: [string, unknown][] = [];
        const builder = { eq(key: string, value: unknown) { equals.push([key, value]); return builder; } };
        const all = () => [...rows.values()].filter(row => row._table === table && equals.every(([key, value]) => key.split(".").reduce<unknown>((v, part) => (v as Record<string, unknown>)?.[part], row) === value));
        const result = {
          withIndex(_index: string, fn: (q: typeof builder) => unknown) { fn(builder); return result; },
          async first() { return all()[0] ?? null; },
          async take(n: number) { assert(n <= 25); maxBatch = Math.max(maxBatch, Math.min(all().length, n)); return all().slice(0, n); },
        };
        return result;
      },
      async delete(id: string) { rows.delete(id); },
      async patch(id: string, data: Record<string, unknown>) { assert(rows.has(id)); Object.assign(rows.get(id)!, data); },
    },
    storage: { async delete(id: string) { deletedBlobs.push(id); } },
  } as unknown as MutationCtx;
  return { ctx, rows, add, deletedBlobs, maxBatch: () => maxBatch };
}

test("bounded learning cleanup removes only the owner and private blobs, preserving shared data and quota ledgers", async () => {
  const f = fixture();
  for (const table of deletionCollections) {
    for (let n = 0; n < 61; n++) f.add(table, { userId: owner, ...(table === "speechAttempts" || table === "readbackAssets" ? { storageId: `${table}-blob-${n}` } : {}) });
    f.add(table, { userId: "other" });
  }
  const preserved = ["contentPackages", "aiBudgets", "aiCostReservations", "aiServiceReservations", "speechReservations", "accountEmailLimits"].map(table => f.add(table, { userId: owner, storageId: "public-lesson-audio" }));
  let deleted = 0;
  for (let phase = 0; phase < deletionCollections.length; phase++) {
    for (let n = 0; n < 10; n++) {
      const count = await deleteLearningBatch(f.ctx, owner, phase);
      deleted += count;
      if (!count) break;
    }
    assert.equal(await deleteLearningBatch(f.ctx, owner, phase), 0);
  }
  assert.equal(deleted, 61 * deletionCollections.length);
  assert.equal(f.maxBatch(), 25);
  assert.equal(f.deletedBlobs.length, 122);
  assert(!f.deletedBlobs.includes("public-lesson-audio"));
  assert(preserved.every(id => f.rows.has(id)));
  assert.equal([...f.rows.values()].filter(row => row.userId === "other").length, deletionCollections.length);
});

test("auth cleanup expires a session before deleting tokens and retains the parent across interrupted batches", async () => {
  const f = fixture(), session = f.add("authSessions", { userId: owner, expirationTime: Date.now() + 99_999 });
  for (let n = 0; n < 61; n++) f.add("authRefreshTokens", { sessionId: session });
  const verifier = f.add("authVerifiers", { sessionId: session, signature: "private" });
  assert.equal(await deleteAuthBatch(f.ctx, owner), 25);
  assert.equal(f.rows.get(session)?.expirationTime, 0);
  assert(f.rows.has(session) && f.rows.has(verifier));
  // Resuming after a crash always finds the expired session and remaining children.
  assert.equal(await deleteAuthBatch(f.ctx, owner), 25);
  assert.equal(await deleteAuthBatch(f.ctx, owner), 11);
  assert.equal(await deleteAuthBatch(f.ctx, owner), 1);
  assert(!f.rows.has(verifier) && f.rows.has(session));
  assert.equal(await deleteAuthBatch(f.ctx, owner), 1);
  assert.equal(await deleteAuthBatch(f.ctx, owner), 0);
  assert.equal(f.rows.size, 0);
});

test("auth cleanup retains credential pointers until codes and owned rate limits are removed", async () => {
  const f = fixture(), account = f.add("authAccounts", { userId: owner, provider: "password", providerAccountId: "synthetic@example.invalid", secret: "private" });
  for (let n = 0; n < 26; n++) f.add("authVerificationCodes", { accountId: account });
  f.add("authRateLimits", { identifier: account });
  f.add("authRateLimits", { identifier: "synthetic@example.invalid" });
  const other = f.add("authAccounts", { userId: "other", provider: "password", providerAccountId: "other@example.invalid" });
  const otherCode = f.add("authVerificationCodes", { accountId: other });
  assert.equal(await deleteAuthBatch(f.ctx, owner), 25);
  assert(f.rows.has(account));
  for (let n = 0; n < 10; n++) if (!(await deleteAuthBatch(f.ctx, owner))) break;
  assert.deepEqual([...f.rows.keys()], [other, otherCode]);
});

test("a storage failure leaves its owner row available for retry", async () => {
  const f = fixture(), row = f.add("speechAttempts", { userId: owner, storageId: "private" });
  const phase = deletionCollections.indexOf("speechAttempts");
  const failing = { ...f.ctx, storage: { delete: async () => { throw new Error("unavailable"); } } } as unknown as MutationCtx;
  await assert.rejects(deleteLearningBatch(failing, owner, phase), /unavailable/u);
  assert(f.rows.has(row));
  assert.equal(await deleteLearningBatch(f.ctx, owner, phase), 1);
  assert.equal(await deleteLearningBatch(f.ctx, owner, phase), 0);
});
