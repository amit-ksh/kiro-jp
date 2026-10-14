import type { PreparedLesson } from "./lesson.ts";
export interface GrammarReference {
  id: string;
  level: "N5" | "N4";
  lesson: PreparedLesson;
}
export function searchGrammarReferences(
  entries: readonly GrammarReference[],
  query: string,
) {
  const normalize = (text: string) =>
    text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
  const parts = normalize(query.slice(0, 120)).split(" ").filter(Boolean);
  return entries.filter((entry) => {
    const lesson = entry.lesson;
    if (lesson.check.status !== "sourceChecked") return false;
    const grammar = lesson.grammar;
    const haystack = normalize(
      [
        entry.level,
        lesson.title,
        lesson.outcome,
        grammar.pattern,
        grammar.explanation,
        grammar.register,
        grammar.mistake,
        ...grammar.examples.flatMap((s) => [
          s.text,
          s.reading,
          s.romaji,
          s.meaning,
        ]),
        ...lesson.exercises
          .filter((e) => e.targetId === grammar.id)
          .flatMap((e) => [e.prompt, e.explanation, ...(e.romaji ?? [])]),
      ].join(" "),
    );
    return parts.every((part) => haystack.includes(part));
  });
}
