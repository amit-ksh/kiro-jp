import {
  assessFixed,
  type Assessment,
  type LessonExercise,
  type SupportFlag,
} from "./lesson.ts";
import {
  validateConversationEvidence,
  type TutorReply,
} from "./conversation.ts";
export function assessNovelSentence(
  exercise: LessonExercise,
  source: { id: string; input: string; support: readonly SupportFlag[] },
  semantic: TutorReply["assessment"],
): Assessment {
  const fixed = assessFixed(exercise, source.input, source.support);
  if (fixed.outcome !== "pending" || semantic.messageId !== source.id)
    return fixed;
  const evidence = validateConversationEvidence(
    { assessment: semantic },
    {
      id: source.id,
      text: source.input,
      intent: "practice",
      support: source.support,
    },
    ["をください", "o kudasai", "wo kudasai"],
  );
  const outcome =
    semantic.validity === "uncertain"
      ? "pending"
      : semantic.validity === "needsCorrection"
        ? "incorrect"
        : !semantic.meaningfulJapanese
          ? "pending"
          : semantic.target === "notUsed"
            ? "validAlternative"
            : evidence.state === "independent"
              ? "independent"
              : evidence.state === "assisted"
                ? "assisted"
                : "pending";
  return {
    ...fixed,
    outcome,
    explanation: semantic.explanation,
    targetObserved: outcome === "independent" || outcome === "assisted",
    kanaEvidence: false,
  };
}
