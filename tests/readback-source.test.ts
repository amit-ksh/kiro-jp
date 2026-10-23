import { test } from "node:test";
import assert from "node:assert/strict";
import type { Doc } from "../packages/backend/convex/_generated/dataModel";
import type { QueryCtx } from "../packages/backend/convex/_generated/server";
import { readbackSourceAvailable } from "../packages/backend/convex/lib/readbackSource.ts";

const source = {
  japanese: "水をください。",
  reading: "みずをください。",
  romaji: "Mizu o kudasai.",
  english: "Water, please.",
};
const userId = "owner" as Doc<"users">["_id"];
const conversationId = "conversation" as Doc<"conversations">["_id"];
const phraseId = "phrase" as Doc<"savedPhrases">["_id"];
const reference = {
  userId,
  conversationId,
  messageId: "turn-assistant",
  segmentId: "current-segment",
  source,
};
function fixture() {
  const rows = new Map<string, Record<string, unknown>>([
    [userId, { _id: userId }],
    [
      conversationId,
      { _id: conversationId, userId, currentSegmentId: reference.segmentId },
    ],
    [
      "segment",
      {
        _id: "segment",
        _table: "conversationSegments",
        userId,
        conversationId,
        segmentId: reference.segmentId,
        state: "active",
      },
    ],
    [
      "message",
      {
        _id: "message",
        _table: "conversationMessages",
        userId,
        conversationId,
        segmentId: reference.segmentId,
        messageId: reference.messageId,
        role: "assistant",
        stale: false,
        reply: { ...source },
      },
    ],
    [
      phraseId,
      { _id: phraseId, userId, status: "approved", phrase: { ...source } },
    ],
  ]);
  const ctx = {
    db: {
      async get(id: string) {
        return rows.get(id) ?? null;
      },
      query(table: string) {
        const equals: [string, unknown][] = [];
        const index = {
          eq(key: string, value: unknown) {
            equals.push([key, value]);
            return index;
          },
        };
        const query = {
          withIndex(_name: string, build: (q: typeof index) => unknown) {
            build(index);
            return query;
          },
          async unique() {
            return (
              [...rows.values()].find(
                (row) =>
                  row._table === table &&
                  equals.every(([key, value]) => row[key] === value),
              ) ?? null
            );
          },
        };
        return query;
      },
    },
  } as unknown as QueryCtx;
  return { ctx, rows };
}
test("conversation audio accepts an exact owned tutor reply without a saved phrase", async () => {
  const f = fixture();
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), true);
  assert.equal(
    await readbackSourceAvailable(f.ctx, { userId, phraseId, source }, true),
    true,
  );
});
test("audio cannot combine phrase and conversation references or omit a source identifier", async () => {
  const f = fixture();
  assert.equal(
    await readbackSourceAvailable(f.ctx, { ...reference, phraseId }),
    false,
  );
  assert.equal(
    await readbackSourceAvailable(f.ctx, {
      ...reference,
      messageId: undefined,
    }),
    false,
  );
  assert.equal(await readbackSourceAvailable(f.ctx, { userId, source }), false);
});
test("conversation audio refuses another account, another conversation, and another segment", async () => {
  const f = fixture();
  f.rows.get(conversationId)!.userId = "other";
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
  f.rows.get(conversationId)!.userId = userId;
  f.rows.get("message")!.userId = "other";
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
  f.rows.get("message")!.userId = userId;
  f.rows.get("message")!.segmentId = "different-segment";
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
  f.rows.get("message")!.segmentId = reference.segmentId;
  f.rows.get("segment")!.conversationId = "different-conversation";
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
});
test("learner messages, missing replies, and stale model callbacks never become tutor audio", async () => {
  const f = fixture(),
    message = f.rows.get("message")!;
  message.role = "user";
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), false);
  message.role = "assistant";
  message.stale = true;
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), false);
  message.stale = false;
  message.reply = undefined;
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), false);
});
test("an ended or replaced segment can play owned historical audio but cannot generate another voice", async () => {
  const f = fixture();
  f.rows.get("segment")!.state = "ended";
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), false);
  assert.equal(await readbackSourceAvailable(f.ctx, reference), true);
  f.rows.get("segment")!.state = "active";
  f.rows.get(conversationId)!.currentSegmentId = "next-segment";
  assert.equal(await readbackSourceAvailable(f.ctx, reference, true), false);
  assert.equal(await readbackSourceAvailable(f.ctx, reference), true);
});
test("changes to authoritative Japanese, readings, or support invalidate the old audio source", async () => {
  const f = fixture();
  for (const key of ["japanese", "reading", "romaji", "english"] as const) {
    const changed = { ...source, [key]: `${source[key]} changed` };
    f.rows.get("message")!.reply = changed;
    assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
    f.rows.get(phraseId)!.phrase = changed;
    assert.equal(
      await readbackSourceAvailable(f.ctx, { userId, phraseId, source }),
      false,
    );
  }
});
test("account or conversation deletion blocks in-flight generation and historical download", async () => {
  const f = fixture();
  f.rows.delete(userId);
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
  assert.equal(
    await readbackSourceAvailable(f.ctx, { userId, phraseId, source }),
    false,
  );
  f.rows.set(userId, { _id: userId });
  f.rows.delete(conversationId);
  assert.equal(await readbackSourceAvailable(f.ctx, reference), false);
});
test("saved phrase approval and ownership remain mandatory", async () => {
  const f = fixture();
  f.rows.get(phraseId)!.status = "queued";
  assert.equal(
    await readbackSourceAvailable(f.ctx, { userId, phraseId, source }),
    false,
  );
  f.rows.get(phraseId)!.status = "approved";
  f.rows.get(phraseId)!.userId = "other";
  assert.equal(
    await readbackSourceAvailable(f.ctx, { userId, phraseId, source }),
    false,
  );
});
