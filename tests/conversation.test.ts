import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateConversationEvidence,
  jobResultDisposition,
  strongestGoal,
  type TutorReply,
} from "../packages/learning-core/src/conversation.ts";
const reply: TutorReply = {
  japanese: "はい、どうぞ。",
  reading: "はいどうぞ",
  romaji: "hai, douzo",
  english: "Here you go.",
  hints: [],
  corrections: [],
  usefulPhrases: [],
  usedContextIds: [],
  assessment: {
    validity: "appropriate",
    meaningfulJapanese: true,
    target: "used",
    messageId: "learner-1",
    span: "水をください",
    explanation: "Appropriate request in the current context.",
  },
};
const message = {
  id: "learner-1",
  text: "水をください",
  intent: "practice" as const,
  support: [],
};
test("late replies cannot append, while an ended source recap can assess its own immutable snapshot", () => {
  assert.equal(
    jobResultDisposition({ claim: 1, sourceRevision: 3, kind: "reply" }, 1, {
      revision: 4,
      state: "ended",
    }),
    "stale",
  );
  assert.equal(
    jobResultDisposition({ claim: 1, sourceRevision: 4, kind: "recap" }, 1, {
      revision: 4,
      state: "ended",
    }),
    "recap",
  );
  assert.equal(
    jobResultDisposition({ claim: 1, sourceRevision: 4, kind: "recap" }, 1, {
      revision: 5,
      state: "active",
    }),
    "stale",
  );
  assert.equal(
    jobResultDisposition({ claim: 2, sourceRevision: 3, kind: "reply" }, 1, {
      revision: 3,
      state: "active",
    }),
    "superseded",
  );
});
test("uncertain classification stays pending even when the model says notUsed", () => {
  const result = validateConversationEvidence(
    {
      assessment: {
        ...reply.assessment,
        validity: "uncertain",
        target: "notUsed",
      },
    },
    message,
    ["をください"],
  );
  assert.equal(result.state, "awaitingAssessment");
  assert.equal(result.meaningful, false);
});
test("appropriate target use can count in a changed topic with separate assistance", () => {
  assert.equal(
    validateConversationEvidence(reply, message, ["をください"]).state,
    "independent",
  );
  assert.equal(
    validateConversationEvidence(
      reply,
      { ...message, support: ["suggestedReply"] },
      ["をください"],
    ).state,
    "assisted",
  );
  const roman = {
    ...reply,
    assessment: { ...reply.assessment, span: "mizu o kudasai" },
  };
  assert.equal(
    validateConversationEvidence(
      roman,
      { ...message, text: "mizu o kudasai" },
      ["o kudasai"],
    ).meaningful,
    true,
  );
});
test("assistant attribution, topic selection, quotes and explanations are not own target use", () => {
  assert.equal(
    validateConversationEvidence(
      {
        ...reply,
        assessment: { ...reply.assessment, messageId: "assistant-1" },
      },
      message,
      ["をください"],
    ).state,
    "notObserved",
  );
  assert.equal(
    validateConversationEvidence(reply, { ...message, intent: "topic" }, [
      "をください",
    ]).state,
    "notObserved",
  );
  for (const text of [
    '"水をください" means water please',
    "「水をください」と言いました",
    "The example is 水をください",
  ])
    assert.notEqual(
      validateConversationEvidence(reply, { ...message, text }, ["をください"])
        .state,
      "independent",
    );
});
test("a valid different pattern and unrelated Japanese retain practice without claiming the target", () => {
  const result = validateConversationEvidence(
    {
      ...reply,
      assessment: { ...reply.assessment, target: "notUsed", span: "" },
    },
    { ...message, text: "アニメが好きです" },
    ["をください"],
  );
  assert.equal(result.state, "notObserved");
  assert.equal(result.meaningful, true);
  assert.equal(strongestGoal([result]), "notObserved");
  assert.equal(
    validateConversationEvidence(
      { ...reply, assessment: { ...reply.assessment, target: "notUsed" } },
      { ...message, text: "ohayou gozaimasu" },
      [],
    ).meaningful,
    true,
  );
  assert.equal(
    validateConversationEvidence(
      {
        ...reply,
        assessment: {
          ...reply.assessment,
          meaningfulJapanese: false,
          target: "notUsed",
        },
      },
      { ...message, text: "What do you recommend?" },
      [],
    ).meaningful,
    false,
  );
});
