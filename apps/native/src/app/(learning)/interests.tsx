import { router } from "expo-router";
import { useRef } from "react";
import type { ScrollView } from "react-native";
import { Button, Panel, Screen } from "../../components/ui";
import { InterestPicker } from "../../features/profile/InterestPicker";
import { CulturalPreferences } from "../../features/conversation/CulturalPreferences";

export default function Interests() {
  const scroll = useRef<ScrollView>(null);
  return (
    <Screen title="Your interests" keyboardAware scrollRef={scroll}>
      <Panel>
        <InterestPicker scrollRef={scroll} />
      </Panel>
      <CulturalPreferences />
      <Button label="Done" onPress={() => router.back()} />
    </Screen>
  );
}
