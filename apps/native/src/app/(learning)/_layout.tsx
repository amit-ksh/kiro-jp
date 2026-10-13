import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, Stack } from "expo-router";
import { LearningAccount } from "../../features/auth/AuthProvider";
import { Loading } from "../../components/ui";
import { TextScaleProvider } from "../../components/ui";
import { useProfile } from "../../data/ProfileProvider";
function LearningScreens() { const { profile } = useProfile(); return <TextScaleProvider value={profile.textScale}><Stack screenOptions={{ headerShown: false }}/></TextScaleProvider>; }
export default function LearningLayout() { const auth = useConvexAuth(); if (auth.isLoading) return <Loading/>; if (!auth.isAuthenticated) return <Redirect href="/"/>; return <LearningAccount><LearningScreens/></LearningAccount>; }
