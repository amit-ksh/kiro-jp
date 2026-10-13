import { router, useLocalSearchParams } from "expo-router";
import { lessonCatalog, recommendFirstLesson } from "@packages/content";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button, Panel, Screen, Title } from "../../components/ui";
export default function SessionPreview() {
  const { lessonId } = useLocalSearchParams<{ lessonId?: string }>(); const { profile } = useProfile();
  const lesson = lessonCatalog.find(item => item.id === lessonId) ?? recommendFirstLesson(profile.interests);
  return <Screen title={lesson.title}><Panel><Title>{lesson.outcome}</Title><Body>{lesson.kanji.join(" · ")}</Body><Body>{lesson.pattern}</Body><Body>This first build establishes your account, learning setup and session preview. The learning exercises and Qloo conversation are the next build step; they are not complete yet.</Body><Button label="Return to my daily plan" onPress={() => router.back()}/></Panel></Screen>;
}
