import {
  normalizeJapanese,
  normalizeRomaji,
  type SupportFlag,
} from "./lesson.ts";
export interface TutorPhrase {
  japanese: string;
  reading: string;
  romaji: string;
  english: string;
}
export interface TutorReply {
  japanese: string;
  reading: string;
  romaji: string;
  english: string;
  hints: TutorPhrase[];
  corrections: {
    original: string;
    corrected: TutorPhrase;
    explanation: string;
  }[];
  usefulPhrases: TutorPhrase[];
  usedContextIds: string[];
  assessment: {
    validity: "appropriate" | "needsCorrection" | "uncertain";
    meaningfulJapanese: boolean;
    target: "used" | "notUsed" | "uncertain";
    messageId: string;
    span: string;
    explanation: string;
  };
}
export type GoalState =
  | "notObserved"
  | "assisted"
  | "independent"
  | "awaitingAssessment";
export interface GoalEvidence {
  state: GoalState;
  meaningful: boolean;
  messageId: string;
  span?: string;
  explanation: string;
}
// Semantic appropriateness comes from the assessment rubric. This validator
// prevents it attributing assistant text, a quote, or another learner turn.
export function validateConversationEvidence(
  reply: Pick<TutorReply, "assessment">,
  message: {
    id: string;
    text: string;
    intent: "topic" | "practice";
    support: readonly SupportFlag[];
  },
  targetForms: readonly string[],
): GoalEvidence {
  const assessment = reply.assessment;
  const base = {
    state: "notObserved" as GoalState,
    meaningful: false,
    messageId: message.id,
    explanation: assessment.explanation,
  };
  if (message.intent === "topic" || assessment.messageId !== message.id)
    return base;
  const japaneseOrRomaji =
    /[ぁ-ゖァ-ヶ一-龯]/u.test(message.text) ||
    /^[a-zāīūēō\s'’-]+[.!?,]*$/iu.test(message.text.trim()) ||
    targetForms.some(
      (form) => normalizeRomaji(form) === normalizeRomaji(message.text),
    );
  const meaningful =
    assessment.meaningfulJapanese &&
    japaneseOrRomaji &&
    assessment.validity !== "uncertain";
  if (assessment.target === "uncertain" || assessment.validity === "uncertain")
    return { ...base, meaningful, state: "awaitingAssessment" };
  if (assessment.target === "notUsed") return { ...base, meaningful };
  const span = assessment.span.trim(),
    at = message.text.indexOf(span);
  const quotedRanges = [
    ...message.text.matchAll(/「[^」]*」|『[^』]*』|"[^"]*"|“[^”]*”/gu),
  ].map((match) => [match.index!, match.index! + match[0].length]);
  const discussed =
    /\b(?:means?|translate|translation|pattern|phrase|grammar|example)\b/iu.test(
      message.text,
    ) || /という(?:意味|文|表現)|と(?:言|書|聞|読)/u.test(message.text);
  const formPresent = targetForms.some(
    (form) =>
      normalizeJapanese(span).includes(normalizeJapanese(form)) ||
      normalizeRomaji(span).includes(normalizeRomaji(form)),
  );
  const quoted = quotedRanges.some(
    ([start, end]) => at >= start! && at + span.length <= end!,
  );
  if (
    !span ||
    at < 0 ||
    quoted ||
    discussed ||
    !formPresent ||
    assessment.validity !== "appropriate"
  )
    return {
      ...base,
      meaningful,
      state: "awaitingAssessment",
      explanation:
        "The target needs a checked example of your own appropriate use.",
    };
  return {
    ...base,
    meaningful,
    span,
    state: message.support.length ? "assisted" : "independent",
  };
}
export function jobResultDisposition(
  job: { claim: number; sourceRevision: number; kind: "reply" | "recap" },
  resultClaim: number,
  segment: { revision: number; state: "active" | "ended" },
) {
  if (job.claim !== resultClaim) return "superseded" as const;
  if (job.kind === "recap")
    return segment.state === "ended" && segment.revision === job.sourceRevision
      ? ("recap" as const)
      : ("stale" as const);
  return segment.state === "active" && segment.revision === job.sourceRevision
    ? ("append" as const)
    : ("stale" as const);
}
export function strongestGoal(evidence: readonly GoalEvidence[]): GoalState {
  return evidence.some((item) => item.state === "independent")
    ? "independent"
    : evidence.some((item) => item.state === "assisted")
      ? "assisted"
      : evidence.some((item) => item.state === "awaitingAssessment")
        ? "awaitingAssessment"
        : "notObserved";
}
