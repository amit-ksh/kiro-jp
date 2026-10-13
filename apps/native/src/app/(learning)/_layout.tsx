import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, Stack } from "expo-router";
import { LearningAccount } from "../../features/auth/AuthProvider";
import { Loading } from "../../components/ui";
export default function LearningLayout() { const auth = useConvexAuth(); if (auth.isLoading) return <Loading/>; if (!auth.isAuthenticated) return <Redirect href="/"/>; return <LearningAccount><Stack screenOptions={{ headerShown: false }}/></LearningAccount>; }
