import { router } from "expo-router";
import { Button, Screen } from "../../components/ui";
import { SavedPhrases } from "../../features/conversation/SavedPhrases";
export default function Phrases() {
  return (
    <Screen title="Words to keep." subtitle="Your conversation references">
      <SavedPhrases />
      <Button label="Return" secondary onPress={() => router.back()} />
    </Screen>
  );
}
