import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, Stack } from "expo-router";
import { LearningAccount } from "../../features/auth/AuthProvider";
import { Loading, TextScaleProvider } from "../../components/ui";
import { useProfile } from "../../data/ProfileProvider";
import { SpeechProvider } from "../../features/speech/SpeechProvider";
import { ContentProvider } from "../../data/ContentProvider";
function LearningScreens() { const { profile } = useProfile(); return <ContentProvider><SpeechProvider><TextScaleProvider value={profile.textScale}><Stack screenOptions={{ headerShown: false }}/></TextScaleProvider></SpeechProvider></ContentProvider>; }
export default function LearningLayout() { const auth = useConvexAuth(); if (auth.isLoading) return <Loading/>; if (!auth.isAuthenticated) return <Redirect href="/"/>; return <LearningAccount><LearningScreens/></LearningAccount>; }
