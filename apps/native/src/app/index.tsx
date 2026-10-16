import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";
import { Body, Button, Loading, Panel, Screen, Title } from "../components/ui";
export default function Welcome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <Loading/>;
  if (isAuthenticated) return <Redirect href="/(learning)/(tabs)"/>;
  return <Screen title="Kiro JP" subtitle="Japanese, for your everyday."><View style={{ alignItems: "flex-end", paddingVertical: 28 }}><Text style={{ color: "#FFFFFF", fontSize: 96, lineHeight: 112, fontWeight: "700" }}>学ぶ</Text><Text style={{ color: "#FFFFFF", fontSize: 20 }}>Learn · Use · Return</Text></View><Panel><Title>A little language. A useful conversation.</Title><Body>Kanji, grammar and conversations connected to your interests.</Body><Button label="Get started" onPress={() => router.push("/auth/signup")}/><Button label="Sign in" secondary onPress={() => router.push("/auth/signin")}/></Panel></Screen>;
}
