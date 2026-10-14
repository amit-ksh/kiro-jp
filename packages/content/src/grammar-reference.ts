import type { GrammarReference } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
// Only checked, implemented lessons appear; planned catalog entries are not reference content.
export const grammarReferences: readonly GrammarReference[] = [
  { id: "requests-v1-request-kudasai", level: "N5", lesson: requestsLesson },
];
