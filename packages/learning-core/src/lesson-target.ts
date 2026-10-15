import { toRomaji } from "wanakana";
import type { PreparedLesson } from "./lesson.ts";
export function lessonConversationTarget(
  lesson: PreparedLesson | null | undefined,
) {
  if (!lesson) return null;
  const forms = new Set<string>();
  for (const example of lesson.grammar.examples) {
    const marked = example.segments.filter(
      (segment) => segment.grammar === lesson.grammar.id,
    );
    const text = marked.map((segment) => segment.text).join("");
    const reading = marked.map((segment) => segment.reading).join("");
    if (text) forms.add(text);
    if (reading) forms.add(toRomaji(reading));
    if (text) forms.add(toRomaji(text));
  }
  return {
    lessonId: lesson.id,
    version: lesson.version,
    pattern: lesson.grammar.pattern,
    outcome: lesson.outcome,
    register: lesson.grammar.register,
    examples: lesson.grammar.examples.map((s) => ({
      japanese: s.text,
      reading: s.reading,
      romaji: s.romaji,
      english: s.meaning,
    })),
    forms: [...forms],
  };
}
