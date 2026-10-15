export type LearningFacet = "meaning" | "reading" | "kana" | "grammar" | "sentence";
export type SupportFlag = "wordBank" | "patternHint" | "example" | "testedAnswer" | "suggestedReply" | "transcriptEdited" | "correctionRetry";
export type AssessmentOutcome = "independent" | "assisted" | "incorrect" | "dontKnow" | "validAlternative" | "pending" | "unassessed";
export interface SentenceSegment { text: string; reading: string; meaning: string; grammar?: string; }
export interface CheckedSentence { id: string; text: string; reading: string; romaji: string; meaning: string; segments: readonly SentenceSegment[]; }
export interface LessonWord { id: string; kanji: string; meaning: string; meaningAliases: readonly string[]; word: string; vocabulary?: { meaning: string; meaningAliases: readonly string[] }; reading: string; readingAliases: readonly string[]; romaji: readonly string[]; mnemonic: string; readingNote: string; example: CheckedSentence; }
export interface LessonExercise { id: string; facet: LearningFacet; kind: "recall" | "choice" | "tiles" | "gap" | "sentence"; prompt: string; japanese?: string; targetId: string; expected: string; accepted: readonly string[]; romaji?: readonly string[]; alternatives?: readonly string[]; options?: readonly string[]; tiles?: readonly string[]; explanation: string; hints: readonly string[]; }
export interface PreparedLesson { id: string; version: number; title: string; outcome: string; words: readonly LessonWord[]; kana: readonly { character: string; sound: string; note: string }[]; grammar: { id: string; pattern: string; explanation: string; register: string; mistake: string; examples: readonly CheckedSentence[] }; exercises: readonly LessonExercise[]; check: { status: "sourceChecked"; checkedAt: string; method: string; references: readonly { url: string; locator: string; checked: string }[] }; }
export interface Assessment { outcome: AssessmentOutcome; normalized: string; expected: string; explanation: string; inputScript: "english" | "kana" | "romaji" | "japanese" | "tiles" | "none"; kanaEvidence: boolean; targetObserved: boolean; }
export function normalizeEnglish(input: string) { return input.normalize("NFKC").trim().toLowerCase().replace(/[.!?]+$/u, "").trim(); }
export function normalizeJapanese(input: string) { return input.normalize("NFKC").trim().replace(/[\s。！？.!?,、]+/gu, "").replace(/[ァ-ヶ]/gu, char => String.fromCharCode(char.charCodeAt(0) - 0x60)); }
export function normalizeRomaji(input: string) { return normalizeEnglish(input).replace(/[\s'-]+/gu, ""); }
export function assessFixed(exercise: LessonExercise, input: string, support: readonly SupportFlag[], dontKnow = false): Assessment {
  const base = { normalized: "", expected: exercise.expected, explanation: exercise.explanation, inputScript: "none" as Assessment["inputScript"], kanaEvidence: false, targetObserved: false };
  if (dontKnow) return { ...base, outcome: "dontKnow" };
  const isMeaning = exercise.facet === "meaning";
  const normalized = isMeaning ? normalizeEnglish(input) : normalizeJapanese(input);
  const roman = /^[a-z\s'’-]+[.!?]*$/iu.test(input.trim());
  const inputScript: Assessment["inputScript"] = isMeaning ? "english" : exercise.kind === "tiles" ? "tiles" : roman ? "romaji" : /^[ぁ-ゖァ-ヶー\s。.!?]+$/u.test(input.trim()) ? "kana" : "japanese";
  const accepted = exercise.accepted.some(answer => (isMeaning ? normalizeEnglish(answer) : normalizeJapanese(answer)) === normalized) || (roman && (exercise.romaji ?? []).some(answer => normalizeRomaji(answer) === normalizeRomaji(input)));
  const assisted = support.length > 0 || exercise.kind === "tiles";
  const detail = { ...base, normalized, inputScript, kanaEvidence: exercise.facet === "kana" && accepted && !assisted, targetObserved: (exercise.facet === "grammar" || exercise.facet === "sentence") && accepted };
  if (accepted) return { ...detail, outcome: assisted ? "assisted" : "independent" };
  if (exercise.alternatives?.some(answer => normalizeJapanese(answer) === normalized || (roman && normalizeRomaji(answer) === normalizeRomaji(input)))) return { ...detail, outcome: "validAlternative", explanation: "That is a useful sentence too. Try today's target pattern next; it has not been demonstrated yet." };
  if (exercise.kind === "sentence" && input.trim()) return { ...detail, outcome: "pending", explanation: "Your sentence is saved and awaiting feedback. A new sentence needs assessment before it can demonstrate this pattern." };
  return { ...detail, outcome: "incorrect" };
}
export const recallIntervals = [4, 8, 24, 72, 168, 336, 720, 2160].map(hours => hours * 3_600_000);
export const grammarIntervals = [24, 72, 168, 336, 720, 2160].map(hours => hours * 3_600_000);
export function scheduleTransition(stage: number, outcome: AssessmentOutcome, occurredAt: number, grammar = false) {
  if (!Number.isInteger(stage) || stage < 0 || !Number.isFinite(occurredAt)) throw new Error("Invalid review state.");
  if (!["independent", "assisted", "incorrect", "dontKnow"].includes(outcome)) return null;
  const intervals = grammar ? grammarIntervals : recallIntervals;
  const nextStage = outcome === "independent" ? Math.min(stage + 1, intervals.length - 1) : outcome === "assisted" ? Math.min(stage, intervals.length - 1) : Math.max(0, stage - 1);
  return { stage: nextStage, dueAt: occurredAt + (outcome === "independent" ? intervals[nextStage]! : Math.min(intervals[nextStage]!, 4 * 3_600_000)) };
}
