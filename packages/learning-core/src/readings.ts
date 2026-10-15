import { toRomaji, toHiragana } from "wanakana";
import type { TutorPhrase, TutorReply } from "./conversation.ts";
// Transliteration checks spelling against the supplied reading. It cannot prove
// that a generated reading matches its kanji or assess pronunciation.
function supportedRomaji(phrase: TutorPhrase) {
  const roman = phrase.romaji.trim().replace(/\s+/gu, " ");
  if (!/^[a-z\s'’.,!?-]{1,400}$/iu.test(roman)) return null;
  const clean = (text: string) =>
    toHiragana(text)
      .normalize("NFKC")
      .replace(/[\s。！？，、.!?,]/gu, "");
  const reading = clean(phrase.reading);
  let positions = new Set([0]);
  for (const token of roman
    .toLowerCase()
    .split(/[\s.,!?]+/u)
    .filter(Boolean)) {
    const options = new Set([clean(token)]);
    // Irodori Starter word list L1-1: these greetings retain written は.
    for(const [spoken,written] of [["konnichiwa","こんにちは"],["konbanwa","こんばんは"]])
      if(token===spoken && phrase.japanese.includes(written))options.add(written);
    // Preserve a supplied spoken particle only where its written counterpart
    // exists in the Japanese. Never change a syllable inside another word.
    for (const [spoken, written] of [
      ["wa", "は"],
      ["o", "を"],
      ["e", "へ"],
    ])
      if (token === spoken && phrase.japanese.includes(written))
        options.add(written);
    const next = new Set<number>();
    for (const position of positions)
      for (const option of options)
        if (option && reading.startsWith(option, position))
          next.add(position + option.length);
    positions = next;
    if (!positions.size) return null;
  }
  return positions.has(reading.length) ? roman : null;
}
export function canonicalTutorPhrase<T extends TutorPhrase>(phrase: T): T {
  if (!/[ぁ-ゖァ-ヶ]/u.test(phrase.reading) || /[一-龯]/u.test(phrase.reading))
    throw new Error("A kana reading is required.");
  let canonical=toRomaji(phrase.reading);
  if(phrase.japanese.includes("こんにちは"))canonical=canonical.replaceAll("konnichiha","konnichiwa");
  if(phrase.japanese.includes("こんばんは"))canonical=canonical.replaceAll("konbanha","konbanwa");
  return {
    ...phrase,
    romaji: supportedRomaji(phrase) ?? canonical,
  };
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
