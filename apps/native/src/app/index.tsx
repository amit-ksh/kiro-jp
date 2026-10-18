import { useConvexAuth } from "@convex-dev/auth/react";
import { Redirect, router } from "expo-router";
import { View } from "react-native";
import { KiroMark } from "../components/KiroMark";
import { Body, Button, Loading, Panel, Screen, Title } from "../components/ui";
export default function Welcome() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <Loading />;
  if (isAuthenticated) return <Redirect href="/(learning)/(tabs)" />;
  return (
    <Screen title="Kiro JP" subtitle="Japanese, for your everyday.">
      <View style={{ alignItems: "center", paddingVertical: 8 }}>
        <KiroMark size={250} />
      </View>
      <Panel>
        <Title>A little language. A useful conversation.</Title>
        <Body>
          Kanji, grammar and conversations connected to your interests.
        </Body>
        <Button
          label="Get started"
          onPress={() => router.push("/auth/signup")}
        />
        <Button
          label="Sign in"
          secondary
          onPress={() => router.push("/auth/signin")}
        />
      </Panel>
    </Screen>
  );
}
