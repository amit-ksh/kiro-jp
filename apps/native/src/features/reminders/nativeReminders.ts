import { createReminderCoordinator } from "@packages/learning-core";
import { requireOptionalNativeModule } from "expo";

export const studyReminderId = "japanese-study-daily-v1";
const channelId = "study-reminders";
let modulePromise: Promise<typeof import("expo-notifications")> | undefined;
export function notificationModule() {
  return (modulePromise ??= import("expo-notifications"));
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
  const notifications = await notificationModule();
  await notifications.cancelScheduledNotificationAsync(studyReminderId);
  await notifications.dismissNotificationAsync(studyReminderId);
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
