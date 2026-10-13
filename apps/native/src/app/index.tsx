import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { Body, Button, Loading, Panel, Screen, Title } from "../components/ui";
export default function Welcome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <Loading/>;
  if (isAuthenticated) return <Redirect href="/(learning)/(tabs)"/>;
  return <Screen title="Japanese, for your everyday." subtitle="Learn Japanese through kanji, grammar and conversations connected to your interests."><View style={{ alignItems: "flex-end", paddingVertical: 28 }}><Text style={{ color: "#FFFFFF", fontSize: 96, lineHeight: 112, fontWeight: "700" }}>学ぶ</Text><Text style={{ color: "#FFFFFF", fontSize: 20 }}>Learn · Use · Return</Text></View><Panel><Title>A little language. A useful conversation.</Title><Body>Learn a few kanji and one grammar pattern. Hear them, practise them, and make them part of a conversation about something you enjoy.</Body><Button label="Get started" onPress={() => router.push("/auth/signup")}/><Button label="Sign in" secondary onPress={() => router.push("/auth/signin")}/></Panel></Screen>;
}
