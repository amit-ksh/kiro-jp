import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispatchVoiceTurn,
  type VoiceTurnDispatchPorts,
} from "../apps/native/src/features/conversation/voiceTurnDispatch.ts";

const turn = () => ({
  conversationId: "synthetic-conversation",
  segmentId: "synthetic-segment",
  messageId: "same-recording-id",
  text: "水をください。",
  expectedRevision: 4,
  support: ["suggestedReply"],
});
type Intent = ReturnType<typeof turn>;

function barrier() {
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>((resolve) => {
      release = resolve;
    }),
    entered = new Promise<void>((resolve) => {
      started = resolve;
    });
  return {
    release,
    entered,
    wait: async () => {
      started();
      await pending;
    },
  };
}

function fixture(
  options: {
    beforeWrite?: (step: string, count: number) => Promise<void>;
    submit?: (intent: Intent) => Promise<unknown>;
  } = {},
) {
  let active = true;
  const drafts = new Map<string, string>(),
    writes: { sessionId: string; step: string; value: string }[] = [],
    dispatched: Intent[] = [];
  const ports: VoiceTurnDispatchPorts<Intent> = {
    isCurrent: () => active,
    saveDraft: async (sessionId, step, value) => {
      writes.push({ sessionId, step, value });
      await options.beforeWrite?.(step, writes.length);
      drafts.set(step, value);
    },
    submit: async (intent) => {
      dispatched.push(intent);
      return options.submit?.(intent);
    },
  };
  return {
    ports,
    drafts,
    writes,
    dispatched,
    pause: () => {
      active = false;
    },
  };
}

test("a stopped call does no disk or network work", async () => {
  const call = fixture();
  call.pause();
  assert.equal(await dispatchVoiceTurn(turn(), call.ports), false);
  assert.equal(call.writes.length, 0);
  assert.equal(call.dispatched.length, 0);
});

test("pause during the first local write retains the transcript without dispatch", async () => {
  const disk = barrier(),
    call = fixture({
      beforeWrite: async (_step, count) => {
        if (count === 1) await disk.wait();
      },
    });
  const operation = dispatchVoiceTurn(turn(), call.ports);
  await disk.entered;
  call.pause();
  disk.release();
  assert.equal(await operation, false);
  assert.equal(call.drafts.get("chat-message"), "水をください。");
  assert.equal(call.writes.length, 1);
  assert.equal(call.dispatched.length, 0);
});

test("pause during the pending-intent write retains the exact ID without dispatch", async () => {
  const disk = barrier(),
    intent = turn(),
    call = fixture({
      beforeWrite: async (_step, count) => {
        if (count === 2) await disk.wait();
      },
    });
  const operation = dispatchVoiceTurn(intent, call.ports);
  await disk.entered;
  call.pause();
  disk.release();
  assert.equal(await operation, false);
  assert.deepEqual(JSON.parse(call.drafts.get("chat-pending")!), intent);
  assert.equal(call.dispatched.length, 0);
});

test("a lost acknowledgement preserves one idempotent pending turn and propagates the actual error", async () => {
  const failure = new Error("synthetic lost acknowledgement"),
    intent = turn(),
    call = fixture({
      submit: async () => {
        throw failure;
      },
    });
  await assert.rejects(
    dispatchVoiceTurn(intent, call.ports),
    (error) => error === failure,
  );
  assert.equal(call.dispatched.length, 1);
  assert.equal(call.dispatched[0]!.messageId, intent.messageId);
  assert.equal(call.drafts.get("chat-message"), intent.text);
  assert.deepEqual(JSON.parse(call.drafts.get("chat-pending")!), intent);
  assert.equal(call.writes.length, 2);
});

test("pause while submit is in flight never clears its recoverable pending intent", async () => {
  const network = barrier(),
    intent = turn(),
    call = fixture({ submit: async () => network.wait() });
  const operation = dispatchVoiceTurn(intent, call.ports);
  await network.entered;
  call.pause();
  network.release();
  assert.equal(await operation, false);
  assert.equal(call.dispatched.length, 1);
  assert.equal(call.drafts.get("chat-message"), intent.text);
  assert.deepEqual(JSON.parse(call.drafts.get("chat-pending")!), intent);
  assert.equal(call.writes.length, 2);
});

test("success dispatches exactly one immutable ID and assistance payload before clearing drafts", async () => {
  const disk = barrier(),
    intent = turn(),
    expected = turn(),
    call = fixture({
      beforeWrite: async (_step, count) => {
        if (count === 1) await disk.wait();
      },
    });
  const operation = dispatchVoiceTurn(intent, call.ports);
  await disk.entered;
  intent.messageId = "caller-replaced-id";
  intent.text = "caller changed text";
  intent.support.length = 0;
  disk.release();
  assert.equal(await operation, true);
  assert.deepEqual(call.dispatched, [expected]);
  assert.equal(call.writes[0]!.value, expected.text);
  assert.deepEqual(JSON.parse(call.writes[1]!.value), expected);
  assert.equal(call.drafts.get("chat-message"), "");
  assert.equal(call.drafts.get("chat-pending"), "");
  assert.equal(call.drafts.get("chat-support"), "[]");
  assert(call.writes.every((write) => write.sessionId === expected.segmentId));
});

test("pause during acknowledged cleanup prevents any subsequent local writes", async () => {
  const disk = barrier(),
    call = fixture({
      beforeWrite: async (_step, count) => {
        if (count === 3) await disk.wait();
      },
    });
  const operation = dispatchVoiceTurn(turn(), call.ports);
  await disk.entered;
  call.pause();
  disk.release();
  assert.equal(await operation, false);
  assert.equal(call.dispatched.length, 1);
  assert.equal(call.writes.length, 3);
  assert(call.drafts.get("chat-pending"));
});
