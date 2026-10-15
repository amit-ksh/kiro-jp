import type { Assessment, PreparedLesson } from "./lesson.ts";
import { sessionProjection, type StudyEvent } from "./study.ts";

export function hasCompletedReminderSession(
  events: readonly StudyEvent[],
  endedLessonSessionIds: ReadonlySet<string>,
  lessonForEvent: (event: StudyEvent) => PreparedLesson | undefined,
  checked: Readonly<Record<string, Assessment>> = {},
) {
  return events.some((event) => {
    if (event.kind !== "started" || !endedLessonSessionIds.has(event.sessionId))
      return false;
    const lesson = lessonForEvent(event);
    return (
      !!lesson &&
      sessionProjection(
        lesson,
        events.filter((row) => row.sessionId === event.sessionId),
        checked,
      ).finishedText
    );
  });
}

/** Local wall-clock time; no date, offset or server timestamp is stored. */
export function reminderClock(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/u.test(value)) return null;
  return { hour: Number(value.slice(0, 2)), minute: Number(value.slice(3)) };
}

export interface ReminderDriver {
  cancel: () => Promise<void>;
  permission: () => Promise<boolean>;
  schedule: (clock: { hour: number; minute: number }) => Promise<void>;
}
export type ReminderStatus =
  | "off"
  | "permission-needed"
  | "scheduled"
  | "retired";

/** Serialize OS writes, including cancellation after an in-flight schedule.
 * Retiring an account invalidates queued work before awaiting the OS bridge.
 */
export function createReminderCoordinator(driver: ReminderDriver) {
  let generation = 0;
  let queue = Promise.resolve();
  function enqueue<T>(work: () => Promise<T>) {
    const result = queue.then(work);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }
  function retire() {
    generation++;
    return enqueue(() => driver.cancel());
  }
  function acquire() {
    const lease = ++generation;
    return {
      async reconcile(enabled: boolean, time: string): Promise<ReminderStatus> {
        const clock = reminderClock(time);
        if (enabled && !clock)
          throw new Error("Choose a time in HH:MM format.");
        return enqueue(async () => {
          if (lease !== generation) return "retired";
          await driver.cancel();
          if (lease !== generation) return "retired";
          if (!enabled) return "off";
          const granted = await driver.permission();
          if (lease !== generation) return "retired";
          if (!granted) return "permission-needed";
          try {
            await driver.schedule(clock!);
          } catch (error) {
            // A rejected bridge call can still have reached the native side.
            await driver.cancel();
            throw error;
          }
          // retire() already queued cancellation behind this operation.
          return lease === generation ? "scheduled" : "retired";
        });
      },
      dispose() {
        if (lease !== generation) return queue;
        return retire();
      },
    };
  }
  return { acquire, retire };
}
