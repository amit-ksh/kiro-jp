import type { PreparedLesson } from "./lesson.ts";
import type { StudyEvent } from "./study.ts";

// Latest is for a new session only. Saved work always resolves an exact version.
export function createCurriculum(lessons: readonly PreparedLesson[]) {
  const versions = new Map<string, Map<number, PreparedLesson>>();
  for (const lesson of lessons) {
    if (
      lesson.check.status !== "sourceChecked" ||
      ["review", "reference", "conversation", "library"].includes(lesson.id) ||
      !/^[a-z][a-z0-9-]{0,79}$/u.test(lesson.id) ||
      !Number.isSafeInteger(lesson.version) ||
      lesson.version < 1
    )
      throw new Error(
        "Only checked, versioned lessons can enter the curriculum.",
      );
    const entries =
      versions.get(lesson.id) ?? new Map<number, PreparedLesson>();
    if (entries.has(lesson.version))
      throw new Error("A lesson version cannot be registered twice.");
    entries.set(lesson.version, lesson);
    versions.set(lesson.id, entries);
  }
  const get = (id: string, version?: number) => {
    const entries = versions.get(id);
    return entries?.get(version ?? Math.max(...entries.keys()));
  };
  const forEvent = (
    event: Pick<StudyEvent, "lessonId" | "lessonVersion" | "stepId">,
  ) => {
    if (event.lessonId === "library") {
      const match =
        /^library:([a-z][a-z0-9-]{0,79}):([1-9][0-9]*):[^:]+$/u.exec(
          event.stepId,
        );
      return match ? get(match[1]!, Number(match[2])) : undefined;
    }
    return get(event.lessonId, event.lessonVersion);
  };
  const forSession = (events: readonly StudyEvent[], sessionId: string) => {
    const start = events.find(
      (event) => event.sessionId === sessionId && event.kind === "started",
    );
    return start ? get(start.lessonId, start.lessonVersion) : undefined;
  };
  return { get, forEvent, forSession };
}
