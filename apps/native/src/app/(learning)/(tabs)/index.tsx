import { router } from "expo-router";
import { Text } from "react-native";
import { bandLabel } from "@packages/learning-core";
import { recommendFirstLesson } from "@packages/content";
import { useProfile } from "../../../data/ProfileProvider";
import { Body, Button, Panel, Screen, Title, styles, useColors } from "../../../components/ui";
export default function Home() {
  const { profile, syncState, error, retry, adoptCloud } = useProfile(); const colors = useColors();
  const lesson = recommendFirstLesson(profile.interests);
  return <Screen title="A little Japanese, today." subtitle={`${bandLabel(profile.acceptedBand)} · ${profile.dailyMinutes}-minute daily goal`}>
    <Panel><Body muted>Today&apos;s study</Body><Title>0 / {profile.dailyMinutes} minutes</Title><Body>Study effort and streaks begin with your first meaningful exercise. Your account setup is saved.</Body></Panel>
    <Panel><Title>{lesson.title}</Title><Body>{profile.interests.length ? profile.interests.join(" · ") : "Everyday Japanese"}</Body><Text style={[styles.kanji, { color: colors.onSurface, fontSize: 46 }]}>{lesson.kanji.join(" ")}</Text><Body>{lesson.pattern}</Body><Body>By the end, you&apos;ll be able to {lesson.outcome.toLowerCase()}.</Body><Button label="Start today's session" onPress={() => router.push("/(learning)/session-preview")}/><Button label="Choose another session" secondary onPress={() => router.push("/(learning)/(tabs)/lessons")}/></Panel>
    <Panel><Title>Your review queue</Title><Body>Reviews will appear after you begin learning. Meanings and word readings will return separately.</Body></Panel>
    <Panel><Title>Your starting point</Title><Body>{bandLabel(profile.acceptedBand)} · Target {profile.targetJlpt}</Body><Body muted>Your skill progress will reflect actual practice. No speaking or grammar mastery is inferred from your selected level.</Body><Button label="Goals and interests" secondary onPress={() => router.push("/(learning)/(tabs)/profile")}/></Panel>
    {syncState === "conflict" ? <Panel><Body>Your profile changed on another device; local answers remain saved.</Body><Button label="Use cloud profile and keep local draft" secondary onPress={() => void adoptCloud()}/></Panel> : (syncState === "pending" || error) && <Panel><Body>{error || "Saved on this phone. Cloud synchronization is pending."}</Body><Button label="Retry synchronization" secondary onPress={retry}/></Panel>}
  </Screen>;
}
