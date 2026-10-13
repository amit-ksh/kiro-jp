import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useProfile } from "../../../data/ProfileProvider";
import { TextScaleProvider, useColors } from "../../../components/ui";
import { Onboarding } from "../../../features/onboarding/Onboarding";
export default function TabsLayout() {
  const { profile } = useProfile(); const colors = useColors();
  if (profile.onboardingStep !== "complete") return <Onboarding/>;
  return <TextScaleProvider value={profile.textScale}><Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, minHeight: 76, paddingTop: 8, borderTopWidth: 0 }, tabBarLabelStyle: { fontSize: 12, fontWeight: "600" }, tabBarItemStyle: { minHeight: 48 } }}>
    <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size}/> }}/>
    <Tabs.Screen name="lessons" options={{ title: "Lessons", tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size}/> }}/>
    <Tabs.Screen name="review" options={{ title: "Review", tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" color={color} size={size}/> }}/>
    <Tabs.Screen name="conversation" options={{ title: "Conversation", tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size}/> }}/>
    <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size}/> }}/>
  </Tabs></TextScaleProvider>;
}
