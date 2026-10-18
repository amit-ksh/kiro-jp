import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, Stack } from "expo-router";
import { LearningAccount } from "../../features/auth/AuthProvider";
import { Loading, TextScaleProvider } from "../../components/ui";
import { useProfile } from "../../data/ProfileProvider";
import { SpeechProvider } from "../../features/speech/SpeechProvider";
import { ContentProvider } from "../../data/ContentProvider";
import { ReminderProvider } from "../../features/reminders/ReminderProvider";
import { LearningBackGuard } from "../../navigation/useAppBack";
import { learningStackOptions } from "../../navigation/policy";
export const unstable_settings = { anchor: "(tabs)" };
function LearningScreens() { const { profile } = useProfile(); return <ContentProvider><SpeechProvider><ReminderProvider><TextScaleProvider value={profile.textScale}><Stack {...learningStackOptions} screenOptions={{ headerShown: false }}/><LearningBackGuard /></TextScaleProvider></ReminderProvider></SpeechProvider></ContentProvider>; }
export default function LearningLayout() { const auth = useConvexAuth(); if (auth.isLoading) return <Loading/>; if (!auth.isAuthenticated) return <Redirect href="/"/>; return <LearningAccount><LearningScreens/></LearningAccount>; }
