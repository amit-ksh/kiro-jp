import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useProfile } from "../../../data/ProfileProvider";
import {
  TextScaleProvider,
  useColors,
  Screen,
  Panel,
  Body,
  Button,
} from "../../../components/ui";
import { useSignOut } from "../../../features/auth/AuthProvider";
import { Onboarding } from "../../../features/onboarding/Onboarding";
export default function TabsLayout() {
  const { profile, loading, error, retry } = useProfile();
  const colors = useColors();
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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            minHeight: 76,
            paddingTop: 8,
            borderTopWidth: 0,
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarItemStyle: { minHeight: 48 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="lessons"
          options={{
            title: "Lessons",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="review"
          options={{
            title: "Review",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="layers-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="conversation"
          options={{
            title: "Conversation",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </TextScaleProvider>
  );
}
