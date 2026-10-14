import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, Stack } from "expo-router";
import { LearningAccount } from "../../features/auth/AuthProvider";
import { Loading, TextScaleProvider } from "../../components/ui";
import { useProfile } from "../../data/ProfileProvider";
import { SpeechProvider } from "../../features/speech/SpeechProvider";
function LearningScreens() { const { profile } = useProfile(); return <SpeechProvider><TextScaleProvider value={profile.textScale}><Stack screenOptions={{ headerShown: false }}/></TextScaleProvider></SpeechProvider>; }
export default function LearningLayout() { const auth = useConvexAuth(); if (auth.isLoading) return <Loading/>; if (!auth.isAuthenticated) return <Redirect href="/"/>; return <LearningAccount><LearningScreens/></LearningAccount>; }
