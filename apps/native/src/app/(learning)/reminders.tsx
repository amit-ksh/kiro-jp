import { router } from "expo-router";
import { Button, Screen } from "../../components/ui";
import { ReminderSettings } from "../../features/reminders/ReminderSettings";

export default function Reminders() {
  return (
    <Screen title="A moment for Japanese" subtitle="An optional daily reminder">
      <ReminderSettings />
      <Button label="Back" secondary onPress={() => router.back()} />
    </Screen>
  );
}
