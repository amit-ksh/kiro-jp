// Local reminders do not use push tokens. Importing the SDK's aggregate index
// initializes remote push and throws in Android Expo Go (SDK 53 and later).
// Keep this pinned SDK-55 facade lazy so older binaries can still sign out.
import { cancelScheduledNotificationAsync } from "expo-notifications/build/cancelScheduledNotificationAsync";
import { dismissNotificationAsync } from "expo-notifications/build/dismissNotificationAsync";
import { setNotificationChannelAsync } from "expo-notifications/build/setNotificationChannelAsync";
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-notifications/build/NotificationPermissions";
import { scheduleNotificationAsync } from "expo-notifications/build/scheduleNotificationAsync";
import {
  getLastNotificationResponse,
  clearLastNotificationResponse,
  addNotificationResponseReceivedListener,
} from "expo-notifications/build/NotificationsEmitter";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { SchedulableTriggerInputTypes } from "expo-notifications/build/Notifications.types";
export const localNotifications = {
  cancelScheduledNotificationAsync,
  dismissNotificationAsync,
  setNotificationChannelAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  getLastNotificationResponse,
  clearLastNotificationResponse,
  addNotificationResponseReceivedListener,
  AndroidImportance,
  SchedulableTriggerInputTypes,
};
