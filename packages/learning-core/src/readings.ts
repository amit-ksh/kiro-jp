import { toRomaji } from "wanakana";
import type { TutorPhrase, TutorReply } from "./conversation.ts";
// Transliteration checks spelling against the supplied reading. It cannot prove
// that a generated reading matches its kanji or assess pronunciation.
export function canonicalTutorPhrase<T extends TutorPhrase>(phrase: T): T {
  if (!/[ぁ-ゖァ-ヶ]/u.test(phrase.reading) || /[一-龯]/u.test(phrase.reading))
    throw new Error("A kana reading is required.");
  return { ...phrase, romaji: toRomaji(phrase.reading) };
}
export function canonicalTutorReply(reply: TutorReply): TutorReply {
  return {
    ...canonicalTutorPhrase(reply),
    hints: reply.hints.map(canonicalTutorPhrase),
    usefulPhrases: reply.usefulPhrases.map(canonicalTutorPhrase),
    corrections: reply.corrections.map((correction) => ({
      ...correction,
      corrected: canonicalTutorPhrase(correction.corrected),
    })),
  };
}
