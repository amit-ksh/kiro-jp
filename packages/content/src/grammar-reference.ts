import type { GrammarReference } from "@packages/learning-core";
import { preparedLessons } from "./curriculum.ts";
// Only checked, implemented lessons appear; planned catalog entries are not reference content.
export const grammarReferences: readonly GrammarReference[] = preparedLessons.map(lesson=>({id:`${lesson.id}-v${lesson.version}-${lesson.grammar.id}`,level:"N5",lesson}));
