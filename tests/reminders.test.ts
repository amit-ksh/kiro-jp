import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createReminderCoordinator,
  hasCompletedReminderSession,
  reminderClock,
  type ReminderDriver,
} from "../packages/learning-core/src/reminders.ts";
import { requestsLesson } from "../packages/content/src/requests.ts";
import {
  lessonSteps,
  type StudyEvent,
} from "../packages/learning-core/src/study.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(overrides: Partial<ReminderDriver> = {}) {
  const calls: string[] = [];
  let scheduled: string | null = null;
  const coordinator = createReminderCoordinator({
    async cancel() {
      calls.push("cancel");
      scheduled = null;
    },
    async permission() {
      calls.push("permission");
      return true;
    },
    async schedule(clock) {
      scheduled = `${clock.hour}:${clock.minute}`;
      calls.push(`schedule:${scheduled}`);
    },
    ...overrides,
  });
  return {
    coordinator,
    calls,
    get scheduled() {
      return scheduled;
    },
  };
}
test("reminder offers require the completed lesson and its ended linked conversation", () => {
  const start: StudyEvent = {
    eventId: "reminder-start",
    sessionId: "reminder-session",
    deviceId: "reminder-device",
    sequence: 1,
    lessonId: "requests",
    lessonVersion: 1,
    occurredAt: Date.UTC(2026, 9, 15),
    localDay: "2026-10-15",
    timezone: "UTC",
    offsetMinutes: 0,
    kind: "started",
    stepId: "goal",
    support: [],
    spans: [],
  };
  const completed: StudyEvent[] = [
    start,
    ...lessonSteps(requestsLesson)
      .filter((step) => step.kind !== "recap")
      .map((step, i) => ({
        ...start,
        kind: "advanced" as const,
        eventId: `reminder-step-${i}`,
        sequence: i + 2,
        stepId: step.id,
      })),
  ];
  const resolve = () => requestsLesson;
  const ended = new Set([start.sessionId]);
  assert.equal(hasCompletedReminderSession([], ended, resolve), false);
  assert.equal(hasCompletedReminderSession([start], ended, resolve), false);
  assert.equal(
    hasCompletedReminderSession(completed, new Set(), resolve),
    false,
  );
  assert.equal(
    hasCompletedReminderSession(
      completed,
      new Set(["another-session"]),
      resolve,
    ),
    false,
  );
  assert.equal(hasCompletedReminderSession(completed, ended, resolve), true);
  assert.equal(
    hasCompletedReminderSession(completed, ended, () => undefined),
    false,
  );
});
test("reminder time is a bounded canonical wall clock without a timezone", () => {
  assert.deepEqual(reminderClock("00:00"), { hour: 0, minute: 0 });
  assert.deepEqual(reminderClock("23:59"), { hour: 23, minute: 59 });
  for (const value of [
    "24:00",
    "20:60",
    "8:30",
    " 08:30",
    "08:30Z",
    "08:30:00",
    "",
    "2026-10-15",
  ])
    assert.equal(reminderClock(value), null);
});
test("disabled reminders cancel without asking permission; denied permission never schedules", async () => {
  const fixture = setup();
  const lease = fixture.coordinator.acquire();
  assert.equal(await lease.reconcile(false, "20:00"), "off");
  assert.deepEqual(fixture.calls, ["cancel"]);
  const denied = setup({ permission: async () => false });
  assert.equal(
    await denied.coordinator.acquire().reconcile(true, "20:00"),
    "permission-needed",
  );
  assert.equal(denied.scheduled, null);
});
test("changing the preferred time replaces a single reminder rather than adding another", async () => {
  const fixture = setup();
  const lease = fixture.coordinator.acquire();
  assert.equal(await lease.reconcile(true, "20:00"), "scheduled");
  assert.equal(await lease.reconcile(true, "08:30"), "scheduled");
  assert.equal(fixture.scheduled, "8:30");
  assert.deepEqual(fixture.calls, [
    "cancel",
    "permission",
    "schedule:20:0",
    "cancel",
    "permission",
    "schedule:8:30",
  ]);
});
test("sign-out while permission is being checked prevents a later schedule", async () => {
  const started = deferred<void>(),
    permission = deferred<boolean>();
  const fixture = setup({
    async permission() {
      started.resolve();
      return permission.promise;
    },
  });
  const lease = fixture.coordinator.acquire();
  const pending = lease.reconcile(true, "20:00");
  await started.promise;
  const signingOut = fixture.coordinator.retire();
  permission.resolve(true);
  assert.equal(await pending, "retired");
  await signingOut;
  assert.equal(fixture.scheduled, null);
  assert.equal(await lease.reconcile(true, "20:00"), "retired");
  assert.ok(!fixture.calls.some((call) => call.startsWith("schedule:")));
});
test("sign-out waits for an already dispatched OS schedule and then cancels it", async () => {
  const started = deferred<void>(),
    finish = deferred<void>();
  let nativeReminder = false;
  const fixture = setup({
    async cancel() {
      nativeReminder = false;
    },
    async schedule() {
      started.resolve();
      await finish.promise;
      nativeReminder = true;
    },
  });
  const pending = fixture.coordinator.acquire().reconcile(true, "20:00");
  await started.promise;
  const signingOut = fixture.coordinator.retire();
  finish.resolve();
  assert.equal(await pending, "retired");
  await signingOut;
  assert.equal(nativeReminder, false);
});
test("a retired account and its delayed cleanup cannot overwrite the next account's reminder", async () => {
  const fixture = setup();
  const old = fixture.coordinator.acquire();
  const stale = old.reconcile(true, "20:00");
  const next = fixture.coordinator.acquire();
  assert.equal(await stale, "retired");
  assert.equal(await next.reconcile(true, "09:15"), "scheduled");
  await old.dispose();
  assert.equal(fixture.scheduled, "9:15");
  await next.dispose();
  assert.equal(fixture.scheduled, null);
});
test("ambiguous native scheduling failure is cancelled and the queue can retry", async () => {
  let attempts = 0,
    nativeReminder = false;
  const fixture = setup({
    async cancel() {
      nativeReminder = false;
    },
    async schedule() {
      nativeReminder = true;
      if (++attempts === 1) throw new Error("lost native acknowledgement");
    },
  });
  const lease = fixture.coordinator.acquire();
  await assert.rejects(
    lease.reconcile(true, "20:00"),
    /lost native acknowledgement/u,
  );
  assert.equal(nativeReminder, false);
  assert.equal(await lease.reconcile(true, "20:00"), "scheduled");
  assert.equal(nativeReminder, true);
});
test("failed cancellation does not silently succeed and does not poison retries", async () => {
  let shouldFail = true;
  const fixture = setup({
    async cancel() {
      if (shouldFail) throw new Error("OS cancellation failed");
    },
  });
  const lease = fixture.coordinator.acquire();
  await assert.rejects(lease.dispose(), /OS cancellation failed/u);
  shouldFail = false;
  await fixture.coordinator.retire();
  assert.equal(await lease.reconcile(true, "20:00"), "retired");
});
