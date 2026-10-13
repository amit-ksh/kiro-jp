import type { LearningBand, PlacementDomain, PlacementResponse } from "./profile.ts";
export interface PlacementQuestion {
  id: string; bankVersion: number; domain: PlacementDomain; phase: "starter" | "followup";
  prompt: string; japanese?: string; options: readonly string[]; correctIndex: number; explanation: string; audioId?: string;
}
export interface PlacementRecommendation { band: LearningBand; correct: number; assessed: number; followupCorrect: number; explanation: string; kanaSupport: boolean; }
export function recommendLevel(questions: readonly PlacementQuestion[], responses: readonly PlacementResponse[]): PlacementRecommendation {
  const latest = new Map(responses.map(answer => [answer.questionId, answer]));
  const answered = questions.filter(q => latest.get(q.id)?.bankVersion === q.bankVersion);
  const starter = answered.filter(q => q.phase === "starter");
  const assessed = starter.filter(q => latest.get(q.id)?.outcome !== "unavailable");
  const correct = starter.filter(q => latest.get(q.id)?.outcome === "correct");
  const followup = answered.filter(q => q.phase === "followup" && latest.get(q.id)?.outcome === "correct");
  const has = (items: PlacementQuestion[], domain: PlacementDomain) => items.some(q => q.domain === domain);
  let band: LearningBand = "early-n5";
  if (assessed.length < 6 || correct.length <= 3 || (!has(correct, "grammar") && !has(correct, "listening"))) band = "foundations";
  else if (correct.length >= 6 && followup.length >= 3 && has(followup, "grammar") && has(followup, "listening")) band = "early-n4";
  const kanaSupport = correct.filter(q => q.domain === "kana").length < 2;
  const missingListening = !has(assessed, "listening");
  const explanation = `${correct.length} of ${assessed.length} available starter answers were correct.${band === "early-n4" ? ` You also answered ${followup.length} follow-up questions correctly, including grammar and listening.` : " We'll begin with short, supported language and adjust as you practise."}${missingListening ? " Listening is not assessed yet; it has not been replaced with a reading score." : ""}${kanaSupport ? " Kana and romaji support will remain available." : ""} This is a starting recommendation, not a JLPT result.`;
  return { band, correct: correct.length, assessed: assessed.length, followupCorrect: followup.length, explanation, kanaSupport };
}
export function shouldOfferFollowups(questions: readonly PlacementQuestion[], responses: readonly PlacementResponse[]): boolean {
  return recommendLevel(questions, responses).correct >= 6;
}
