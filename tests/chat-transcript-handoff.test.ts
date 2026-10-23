import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyChatVoiceTranscript,
  type ChatTranscriptHandoffPorts,
} from "../apps/native/src/features/conversation/applyChatVoiceTranscript.ts";

function barrier() {
  let release!: () => void, started!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  return {
    entered,
    release,
    wait: async () => {
      started();
      await pending;
    },
  };
}

function fixture(
  options: {
    beforeConfirm?: () => Promise<void>;
    beforeWrite?: (step: string) => Promise<void>;
    confirmed?: string;
  } = {},
) {
  let current = true,
    draft = "Already typed.",
    support: ReturnType<ChatTranscriptHandoffPorts["readSupport"]> = [
      "suggestedReply",
    ];
  const confirmations: string[] = [],
    writes: { step: string; input: string }[] = [];
  const ports: ChatTranscriptHandoffPorts = {
    isCurrent: () => current,
    readDraft: () => draft,
    readSupport: () => support,
    confirm: async (text) => {
      confirmations.push(text);
      await options.beforeConfirm?.();
      return options.confirmed ?? text;
    },
    saveDraft: async (step, input) => {
      writes.push({ step, input });
      await options.beforeWrite?.(step);
      if (step === "chat-message") draft = input;
      else support = JSON.parse(input);
    },
  };
  return {
    ports,
    confirmations,
    writes,
    get draft() {
      return draft;
    },
    get support() {
      return support;
    },
    setDraft: (value: string) => {
      draft = value;
    },
    setSupport: (value: typeof support) => {
      support = value;
    },
    cancel: () => {
      current = false;
    },
  };
}
const input = { text: "水をください。", edited: false };

test("cancel before confirmation does no recording or draft work", async () => {
  const chat = fixture();
  chat.cancel();
  assert.equal(await applyChatVoiceTranscript(input, chat.ports), undefined);
  assert.deepEqual(chat.confirmations, []);
  assert.deepEqual(chat.writes, []);
  assert.equal(chat.draft, "Already typed.");
});

test("cancel while confirming cannot append a late transcript", async () => {
  const confirmation = barrier(),
    chat = fixture({ beforeConfirm: confirmation.wait });
  const operation = applyChatVoiceTranscript(input, chat.ports);
  await confirmation.entered;
  chat.cancel();
  confirmation.release();
  assert.equal(await operation, undefined);
  assert.deepEqual(chat.writes, []);
  assert.equal(chat.draft, "Already typed.");
});

test("cancel during support persistence cannot append text to the same chat", async () => {
  const disk = barrier(),
    chat = fixture({
      beforeWrite: async (step) => {
        if (step === "chat-support") await disk.wait();
      },
    });
  const operation = applyChatVoiceTranscript(input, chat.ports);
  await disk.entered;
  chat.cancel();
  disk.release();
  assert.equal(await operation, undefined);
  assert.deepEqual(
    chat.writes.map((write) => write.step),
    ["chat-support"],
  );
  assert.equal(chat.draft, "Already typed.");
});

test("a newer hint or draft written while support saves is preserved before appending", async () => {
  const disk = barrier(),
    chat = fixture({
      beforeWrite: async (step) => {
        if (step === "chat-support") await disk.wait();
      },
    });
  const operation = applyChatVoiceTranscript(input, chat.ports);
  await disk.entered;
  chat.setDraft("A newer suggested topic.");
  disk.release();
  assert.deepEqual(await operation, { support: ["suggestedReply"] });
  assert.equal(chat.draft, "A newer suggested topic.\n水をください。");
  assert.deepEqual(
    chat.writes.map((write) => write.step),
    ["chat-support", "chat-message"],
  );
});

test("assistance is read after confirmation and saved before text with edited flag", async () => {
  const confirmation = barrier(),
    chat = fixture({ beforeConfirm: confirmation.wait });
  const operation = applyChatVoiceTranscript(
    { ...input, edited: true },
    chat.ports,
  );
  await confirmation.entered;
  chat.setSupport(["wordBank", "suggestedReply", "wordBank"]);
  confirmation.release();
  assert.deepEqual(await operation, {
    support: ["wordBank", "suggestedReply", "transcriptEdited"],
  });
  assert.deepEqual(JSON.parse(chat.writes[0]!.input), [
    "wordBank",
    "suggestedReply",
    "transcriptEdited",
  ]);
  assert.equal(chat.writes[0]!.step, "chat-support");
  assert.equal(chat.writes[1]!.step, "chat-message");
});

test("oversized combined input is not truncated or confirmed", async () => {
  const chat = fixture();
  chat.setDraft("x".repeat(999));
  await assert.rejects(
    applyChatVoiceTranscript(input, chat.ports),
    /Shorten the transcript/,
  );
  assert.equal(chat.draft, "x".repeat(999));
  assert.deepEqual(chat.confirmations, []);
  assert.deepEqual(chat.writes, []);
});

test("a longer confirmed result is rechecked without changing the original draft", async () => {
  const chat = fixture({ confirmed: "y".repeat(1000) });
  await assert.rejects(
    applyChatVoiceTranscript(input, chat.ports),
    /Shorten the transcript/,
  );
  assert.equal(chat.draft, "Already typed.");
  assert.deepEqual(chat.writes, []);
});

test("a draft that grows during support persistence is not overwritten or truncated", async () => {
  const disk = barrier(),
    chat = fixture({
      beforeWrite: async (step) => {
        if (step === "chat-support") await disk.wait();
      },
    });
  const operation = applyChatVoiceTranscript(input, chat.ports);
  await disk.entered;
  chat.setDraft("x".repeat(999));
  disk.release();
  await assert.rejects(operation, /Shorten the transcript/);
  assert.equal(chat.draft, "x".repeat(999));
  assert.deepEqual(
    chat.writes.map((write) => write.step),
    ["chat-support"],
  );
});

test("cancel during message persistence does not report success or clear anything", async () => {
  const disk = barrier(),
    chat = fixture({
      beforeWrite: async (step) => {
        if (step === "chat-message") await disk.wait();
      },
    });
  const operation = applyChatVoiceTranscript(input, chat.ports);
  await disk.entered;
  chat.cancel();
  disk.release();
  assert.equal(await operation, undefined);
  assert.equal(chat.draft, "Already typed.\n水をください。");
  assert.equal(chat.writes.length, 2);
});

test("a blank transcript leaves typed text and assistance untouched", async () => {
  const chat = fixture();
  assert.equal(
    await applyChatVoiceTranscript({ text: "  ", edited: false }, chat.ports),
    undefined,
  );
  assert.equal(chat.draft, "Already typed.");
  assert.deepEqual(chat.support, ["suggestedReply"]);
  assert.deepEqual(chat.confirmations, []);
  assert.deepEqual(chat.writes, []);
});
