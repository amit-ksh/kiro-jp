import { Tabs } from "expo-router";
import { useProfile } from "../../../data/ProfileProvider";
import {
  TextScaleProvider,
  Screen,
  Panel,
  Body,
  Button,
} from "../../../components/ui";
import { useSignOut } from "../../../features/auth/AuthProvider";
import { Onboarding } from "../../../features/onboarding/Onboarding";
import { learningTabOptions } from "../../../navigation/policy";
import { FloatingTabBar } from "../../../navigation/FloatingTabBar";
export default function TabsLayout() {
  const { profile, loading, error, retry } = useProfile();
  const signOut = useSignOut();
  if (loading)
    return (
      <Screen title="Opening your saved setup">
        <Panel>
          <Body>
            {error ||
              "Connect once to load your learning setup on this phone. Previously saved study stays available on phones you've already prepared."}
          </Body>
          <Button label="Retry loading setup" onPress={retry} />
          <Button
            label="Return to sign in"
            secondary
            onPress={() => void signOut()}
          />
        </Panel>
      </Screen>
    );
  if (profile.onboardingStep !== "complete") return <Onboarding />;
  return (
    <TextScaleProvider value={profile.textScale}>
      <Tabs
        {...learningTabOptions}
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
          }}
        />
        <Tabs.Screen
          name="lessons"
          options={{
            title: "Lessons",
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: "Review",
          }}
        />
        <Tabs.Screen
          name="conversation"
          options={{
            title: "Conversation",
            tabBarLabel: "Chat",
            tabBarAccessibilityLabel: "Conversation",
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
          }}
        />
      </Tabs>
    </TextScaleProvider>
  );
}
