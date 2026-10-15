import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { router } from "expo-router";
import { reminderClock } from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import {
  Body,
  Button,
  Field,
  Message,
  Panel,
  Title,
} from "../../components/ui";
import { useReminders } from "./ReminderProvider";

export function ReminderOffer() {
  const reminder = useReminders();
  const { profile } = useProfile();
  if (
    !reminder.eligible ||
    profile.reminderEnabled ||
    profile.reminderOfferDismissed
  )
    return null;
  return (
    <Panel>
      <Title>Make a little time for Japanese</Title>
      <Body>
        You have finished your first learning session. Would a daily reminder
        help you return?
      </Body>
      <Button
        label="Choose a reminder time"
        secondary
        onPress={() => router.push("/(learning)/reminders")}
      />
      <Button
        label="Not now"
        secondary
        busy={reminder.busy}
        onPress={() => void reminder.skip()}
      />
      {reminder.error && <Message>{reminder.error}</Message>}
    </Panel>
  );
}
export function ReminderSettings() {
  const reminder = useReminders();
  const { profile } = useProfile();
  const [time, setTime] = useState(profile.reminderTime ?? "20:00");
  const [dirty, setDirty] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  useEffect(() => {
    if (!dirty) setTime(profile.reminderTime ?? "20:00");
  }, [dirty, profile.reminderTime]);
  const valid = reminderClock(time) !== null;
  return (
    <Panel>
      <Title>Daily study reminder</Title>
      {!reminder.eligible ? (
        <Body muted>
          After you finish a lesson and its conversation, you can choose an
          optional daily reminder here.
        </Body>
      ) : (
        <>
          <Body>
            One gentle reminder at your chosen local time. Android may deliver
            it later when battery saving is active.
          </Body>
          <Field
            label="Reminder time (24-hour HH:MM)"
            value={time}
            maxLength={5}
            editable={!reminder.busy}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="20:00"
            onChangeText={(value) => {
              setTime(value);
              setDirty(true);
            }}
          />
          {!valid && <Message>Use a time such as 08:30 or 20:00.</Message>}
          <Button
            label={
              profile.reminderEnabled
                ? "Save reminder time"
                : "Enable daily reminder"
            }
            busy={reminder.busy}
            disabled={!valid || (profile.reminderEnabled && !dirty)}
            onPress={() => {
              const action = profile.reminderEnabled
                ? reminder.saveTime(time)
                : reminder.enable(time);
              void action.then((saved) => {
                if (saved) setDirty(false);
              });
            }}
          />
          {profile.reminderEnabled && (
            <Button
              label="Turn reminders off"
              secondary
              disabled={reminder.busy}
              onPress={() => void reminder.disable()}
            />
          )}
          {reminder.status === "checking" && (
            <Body muted>Checking reminder settings on this phone…</Body>
          )}
          {reminder.status === "scheduled" && (
            <Body muted>
              Scheduled on this phone for {profile.reminderTime ?? "20:00"}{" "}
              local time. Your choice is saved locally and synchronizes with
              your profile.
            </Body>
          )}
          {reminder.status === "permission-needed" && (
            <>
              <Body muted>
                Notifications are off on this phone. You can keep studying and
                enable them in Android settings.
              </Body>
              <Button
                label="Open notification settings"
                secondary
                onPress={() =>
                  void Linking.openSettings().catch(() =>
                    setSettingsError(
                      "Open Android Settings, then this app's notification settings.",
                    ),
                  )
                }
              />
            </>
          )}
          {reminder.status === "unavailable" && (
            <Button
              label="Retry reminder scheduling"
              secondary
              onPress={reminder.retry}
            />
          )}
          {reminder.status === "off" && (
            <Body muted>
              Reminders are off. You can return to this setting whenever you
              like.
            </Body>
          )}
        </>
      )}
      {(reminder.error || settingsError) && (
        <Message>{reminder.error || settingsError}</Message>
      )}
    </Panel>
  );
}
