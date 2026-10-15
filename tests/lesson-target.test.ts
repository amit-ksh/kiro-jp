import { test } from "node:test";
import assert from "node:assert/strict";
import { lessonConversationTarget } from "../packages/learning-core/src/lesson-target.ts";
import { validateConversationEvidence } from "../packages/learning-core/src/conversation.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import { directionsLesson } from "../packages/content/src/directions.ts";
function observe(text: string, forms: readonly string[], span = text) {
  return validateConversationEvidence(
    {
      assessment: {
        messageId: "learner-0001",
        meaningfulJapanese: true,
        validity: "appropriate",
        target: "used",
        span,
        explanation: "Synthetic semantic result for the evidence guard.",
      },
    },
    { id: "learner-0001", text, intent: "practice", support: [] },
    forms,
  );
}
test("lesson targets preserve checked version, grammar and Japanese/romaji evidence forms", () => {
  const request = lessonConversationTarget(requestsLesson)!,
    direction = lessonConversationTarget(directionsLesson)!;
  assert.equal(request.pattern, "[item] + をください");
  assert(request.forms.includes("をください"));
  assert(request.forms.includes("okudasai"));
  assert.equal(direction.lessonId, "directions");
  assert.equal(direction.version, 1);
  assert(direction.forms.includes("はどこですか"));
  assert(direction.forms.includes("wadokodesuka"));
  assert.equal(direction.forms.includes("をください"), false);
  assert.equal(lessonConversationTarget(undefined), null);
  const before = JSON.stringify(directionsLesson);
  lessonConversationTarget(directionsLesson);
  assert.equal(JSON.stringify(directionsLesson), before);
});
test("appropriate location questions in Japanese or romaji count under the location lesson, including another subject", () => {
  const forms = lessonConversationTarget(directionsLesson)!.forms;
  for (const text of [
    "入口はどこですか。",
    "iriguchi wa doko desu ka",
    "アニメの店の入口はどこですか。",
  ]) {
    const e = observe(text, forms);
    assert.equal(e.state, "independent");
    assert.equal(e.meaningful, true);
  }
});
test("a request or a quoted grammar example cannot accidentally satisfy the location target", () => {
  const forms = lessonConversationTarget(directionsLesson)!.forms;
  assert.equal(observe("水をください", forms).state, "awaitingAssessment");
  assert.equal(
    observe('Translate "入口はどこですか"', forms, "入口はどこですか").state,
    "awaitingAssessment",
  );
  assert.equal(
    observe(
      "iriguchi wa doko desu ka",
      lessonConversationTarget(requestsLesson)!.forms,
    ).state,
    "awaitingAssessment",
  );
});
