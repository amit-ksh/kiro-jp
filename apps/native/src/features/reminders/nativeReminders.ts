import { createReminderCoordinator } from "@packages/learning-core";
import { requireOptionalNativeModule } from "expo";

export const studyReminderId = "japanese-study-daily-v1";
const channelId = "study-reminders";
let modulePromise:
  | Promise<(typeof import("./localNotifications"))["localNotifications"]>
  | undefined;
export function notificationModule() {
  return (modulePromise ??= import("./localNotifications")
    .then((loaded) => {
      const notifications = loaded.localNotifications;
      if (
        !notifications ||
        typeof notifications.cancelScheduledNotificationAsync !== "function" ||
        typeof notifications.dismissNotificationAsync !== "function"
      ) {
        throw new Error("Native notification controls are unavailable.");
      }
      return notifications;
    })
    .catch((error) => {
      modulePromise = undefined;
      throw error;
    }));
}
export async function prepareReminderPermission(request = false) {
  const notifications = await notificationModule();
  // Android 13 needs a channel before the explicit permission request.
  await notifications.setNotificationChannelAsync(channelId, {
    name: "Study reminders",
    importance: notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
  });
  const current = await notifications.getPermissionsAsync();
  if (current.granted || !request || !current.canAskAgain)
    return current.granted;
  return (await notifications.requestPermissionsAsync()).granted;
}
async function cancel() {
  if (!requireOptionalNativeModule("ExpoNotificationScheduler")) {
    // An older development binary without this native module cannot have
    // scheduled this feature. Other import/OS errors must remain failures.
    return;
  }
  let stage = "load";
  try {
    const notifications = await notificationModule();
    stage = "cancel";
    await notifications.cancelScheduledNotificationAsync(studyReminderId);
    stage = "dismiss";
    await notifications.dismissNotificationAsync(studyReminderId);
  } catch (error) {
    if (__DEV__)
      console.warn(
        "Reminder retirement failed",
        stage,
        error instanceof Error ? error.message : "Native notification error",
      );
    throw error;
  }
}
export const studyReminders = createReminderCoordinator({
  cancel,
  permission: () => prepareReminderPermission(),
  async schedule(clock) {
    const notifications = await notificationModule();
    await notifications.scheduleNotificationAsync({
      identifier: studyReminderId,
      content: {
        title: "A little Japanese, every day",
        body: "Your next lesson or review is ready when you are.",
        sound: false,
        data: { kind: "study-reminder" },
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DAILY,
        ...clock,
        channelId,
      },
    });
  },
});
