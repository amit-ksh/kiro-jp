import type { LearningBand } from "./profile.ts";
import type { PreparedLesson } from "./lesson.ts";

// The checked N4 starters explicitly teach their prerequisite forms. External
// vocabulary familiarity and finishing a conversation never substitute for the
// accepted language level or this prepared support.
export function lessonEntry(lesson: PreparedLesson, band: LearningBand) {
  if (lesson.level !== "N4" && !lesson.entry)
    return { allowed: true, reason: "ready" as const };
  if (!lesson.entry || lesson.level !== "N4")
    return { allowed: false, reason: "prerequisite" as const };
  if (band !== lesson.entry.minimumBand)
    return { allowed: false, reason: "level" as const };
  const { prerequisite, support } = lesson.entry;
  if (
    !prerequisite.lessonId ||
    !Number.isSafeInteger(prerequisite.version) ||
    prerequisite.version < 1 ||
    !support.explanation.trim() ||
    !support.examples.length
  )
    return { allowed: false, reason: "prerequisite" as const };
  return { allowed: true, reason: "supported" as const };
}
