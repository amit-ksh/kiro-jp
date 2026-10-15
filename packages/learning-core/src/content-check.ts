import { assessFixed, normalizeJapanese, type PreparedLesson } from "./lesson.ts";
function arrangements(parts: readonly string[]): string[] { return parts.length ? parts.flatMap((part, index) => arrangements(parts.filter((_, other) => other !== index)).map(rest => part + rest)) : [""]; }
export function checkPreparedLesson(lesson: PreparedLesson) {
  const errors: string[] = [];
  if (lesson.words.length < 3 || lesson.words.length > 5 || !Number.isInteger(lesson.version) || lesson.version < 1) errors.push("Invalid lesson size/version.");
  if (lesson.check.status !== "sourceChecked" || !lesson.check.method || lesson.check.references.length < 2 || lesson.check.references.some(reference => !reference.url.startsWith("https://") || !reference.locator || !reference.checked)) errors.push("Missing source-check record.");
  if ((lesson.level === "N4" && !lesson.entry) || (lesson.entry && lesson.level !== "N4")) errors.push("Missing checked prerequisite support.");
  if (lesson.entry && (lesson.entry.minimumBand !== "early-n4" || !lesson.entry.prerequisite.lessonId || !Number.isSafeInteger(lesson.entry.prerequisite.version) || lesson.entry.prerequisite.version < 1 || !lesson.entry.support.explanation.trim() || !lesson.entry.support.examples.length)) errors.push("Missing checked prerequisite support.");
  const ids = lesson.exercises.map(exercise => exercise.id);
  if (new Set(ids).size !== ids.length) errors.push("Duplicate exercise IDs.");
  for (const word of lesson.words) {
    if (!word.meaningAliases.length || !word.readingAliases.includes(word.reading) || !word.romaji.length || !word.mnemonic) errors.push(`Missing checked word data: ${word.id}.`);
    for (const facet of ["meaning", "reading"] as const) if (!lesson.exercises.some(exercise => exercise.targetId === word.id && exercise.facet === facet)) errors.push(`Missing ${facet} exercise: ${word.id}.`);
    if (word.vocabulary && (!word.vocabulary.meaning || !word.vocabulary.meaningAliases.includes(word.vocabulary.meaning) || !lesson.exercises.some(exercise => exercise.id === `vocabulary-${word.id}` && exercise.facet === "meaning" && exercise.targetId === word.id && exercise.japanese === word.word && exercise.expected === word.vocabulary!.meaning && word.vocabulary!.meaningAliases.every(alias => exercise.accepted.includes(alias))))) errors.push(`Missing separate vocabulary meaning: ${word.id}.`);
  }
  for (const exercise of lesson.exercises) {
    if (!exercise.accepted.length || !exercise.explanation || !exercise.hints.length || exercise.accepted.some(answer => !["independent", "assisted"].includes(assessFixed(exercise, answer, []).outcome))) errors.push(`Invalid approved answers: ${exercise.id}.`);
    if (exercise.options && exercise.options.filter(option => exercise.accepted.includes(option)).length !== 1) errors.push(`Ambiguous choice: ${exercise.id}.`);
    if (exercise.kind === "tiles" && (!exercise.tiles?.length || exercise.tiles.length > 6 || !arrangements(exercise.tiles).some(answer => exercise.accepted.some(approved => normalizeJapanese(answer) === normalizeJapanese(approved))))) errors.push(`Invalid tiles: ${exercise.id}.`);
  }
  for (const sentence of [...lesson.words.map(word => word.example), ...lesson.grammar.examples, ...(lesson.entry?.support.examples ?? [])]) {
    if (sentence.segments.map(segment => segment.text).join("") !== sentence.text || !sentence.reading || !sentence.meaning || !sentence.romaji) errors.push(`Invalid sentence breakdown: ${sentence.id}.`);
  }
  return errors;
}
