import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { lessonCatalog, requestsLesson } from "@packages/content";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Message, Panel, Screen, Title } from "../../components/ui";
export default function SessionPreview() {
  const { lessonId = "requests" } = useLocalSearchParams<{ lessonId?: string }>(); const { profile } = useProfile(); const study = useStudy();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lesson = lessonCatalog.find(item => item.id === lessonId) ?? lessonCatalog[0];
  const theme = profile.interests[0] ?? "Everyday Japanese";
  const start = async () => {
    setBusy(true); setError("");
    try { const sessionId = Crypto.randomUUID(); await study.append({ sessionId, kind: "started", stepId: "goal", context: { theme, band: profile.acceptedBand, romaji: profile.romaji, furigana: profile.furigana, translations: profile.translations } }); router.replace({ pathname: "/(learning)/lesson", params: { sessionId } }); }
    catch { setError("Your session couldn't be saved. Try again before beginning."); } finally { setBusy(false); }
  };
  return <Screen title={lesson.title}><Panel><Title>{lesson.id === "requests" ? requestsLesson.outcome : lesson.outcome}</Title><Body>{lesson.kanji.join(" · ")}</Body><Body>{lesson.pattern}</Body>{lesson.id === "requests" ? <><Body>{theme} · four kanji, three kana and a useful request.</Body><Body>The text lesson and reference are ready, including offline study. Conversation and spoken practice are being connected; they stay unpractised until you actually use them.</Body><Button label="Start my session" disabled={study.loading} busy={busy} onPress={() => void start()}/></> : <Body>This lesson is in the approved starter inventory. Its checked exercises will become available after the first lesson loop is verified.</Body>}{error && <Message>{error}</Message>}<Button label="Return to my daily plan" secondary onPress={() => router.back()}/></Panel></Screen>;
}
