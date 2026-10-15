import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { lessonCatalog, curriculum } from "@packages/content";
import {
  localDayAt,
  reviewQueue,
  sessionProjection,
  lessonEntry,
} from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import { useReviews } from "../../data/ReviewProvider";
import {
  Body,
  Button,
  Message,
  Panel,
  Screen,
  Title,
} from "../../components/ui";
export default function SessionPreview() {
  const { lessonId = "requests" } = useLocalSearchParams<{
    lessonId?: string;
  }>();
  const { profile } = useProfile();
  const study = useStudy(),
    reviews = useReviews();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const starting = useRef(false),
    selectedSessionId = useRef<string | null>(null);
  const lesson = lessonCatalog.find((item) => item.id === lessonId);
  if (!lesson) return <Screen title="Lesson unavailable"><Panel><Body>This lesson is not in the current library. Choose an available lesson; your saved progress is retained.</Body><Button label="Show lessons" onPress={() => router.replace("/(learning)/(tabs)/lessons")} /></Panel></Screen>;
  const preparedLesson = curriculum.get(lesson.id);
  const prerequisite = lesson.prerequisite
    ? lessonCatalog.find(item => item.id === lesson.prerequisite)
    : undefined;
  const unfinished = study.events
    .filter(
      (event) =>
        event.kind === "started" &&
        event.lessonId === preparedLesson?.id &&
        event.lessonVersion === preparedLesson?.version,
    )
    .filter(
      (event) =>
        preparedLesson && !sessionProjection(
          preparedLesson,
          study.events.filter((item) => item.sessionId === event.sessionId),
          study.checked,
        ).finishedText,
    )
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const resume =
    unfinished.find(
      (event) => event.sessionId === reviews.run?.nextSessionId,
    ) ?? unfinished[0];
  const entry = preparedLesson ? lessonEntry(preparedLesson, profile.acceptedBand) : null;
  const canStart = Boolean(resume || entry?.allowed);
  const theme =
    resume?.context?.theme ?? profile.interests[0] ?? "Everyday Japanese";
  const queue = reviewQueue(reviews, Date.now());
  const savedReview =
    reviews.run && reviews.run.index < reviews.run.questions.length
      ? reviews.run
      : null;
  const completedReview = Boolean(
    resume &&
    reviews.run?.nextSessionId === resume.sessionId &&
    reviews.run.planDay ===
      localDayAt(Date.now(), new Date().getTimezoneOffset()) &&
    !savedReview,
  );
  const firstReviews = savedReview
    ? savedReview.questions.length - savedReview.index
    : completedReview
      ? 0
      : Math.min(8, queue.ready.length);
  const start = async () => {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!preparedLesson) throw new Error("Checked lesson not available.");
      if (!canStart) throw new Error("Lesson starting point unavailable.");
      const sessionId =
        selectedSessionId.current ?? resume?.sessionId ?? Crypto.randomUUID();
      selectedSessionId.current = sessionId;
      if (
        !study.events.some(
          (event) => event.sessionId === sessionId && event.kind === "started",
        )
      )
        await study.append({
          sessionId,
          kind: "started",
          lessonId: preparedLesson.id,
          lessonVersion: preparedLesson.version,
          stepId: "goal",
          context: {
            theme,
            band: profile.acceptedBand,
            romaji: profile.romaji,
            furigana: profile.furigana,
            translations: profile.translations,
          },
        });
      const next = await reviews.prepareSessionReviews(sessionId);
      if (next === "review") router.replace("/(learning)/(tabs)/review");
      else
        router.replace({
          pathname: "/(learning)/lesson",
          params: { sessionId },
        });
    } catch {
      setError(
        "Your place is retained. Try again to prepare your reviews and lesson.",
      );
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen title={lesson.title}>
      <Panel>
        <Title>
          {preparedLesson?.outcome ?? lesson.outcome}
        </Title>
        <Body>{lesson.kanji.join(" · ")}</Body>
        <Body>{lesson.pattern}</Body>
        {preparedLesson ? (
          <>
            <Body>{theme} · {preparedLesson.words.length} kanji, {preparedLesson.kana.length} kana and a useful pattern.</Body>
            {prerequisite && !preparedLesson.entry && (
              <>
                <Body>
                  Builds on {prerequisite.title}. You can revisit that lesson
                  first. This N5 session teaches its words and readings with
                  support, including any familiar kanji it reinforces.
                </Body>
                <Button
                  label={`Revisit ${prerequisite.title}`}
                  secondary
                  onPress={() => router.push({pathname: "/(learning)/session-preview", params: {lessonId: prerequisite.id}})}
                />
              </>
            )}
            {preparedLesson.entry && <>
              <Body>Early N4 · Builds on {prerequisite?.title ?? preparedLesson.entry.prerequisite.lessonId}. This lesson includes a supported refresher on the required verb forms.</Body>
              {prerequisite && <Button label={`Review ${prerequisite.title}`} secondary onPress={() => router.push({pathname:"/(learning)/session-preview",params:{lessonId:prerequisite.id}})}/>}
              {!canStart && <><Body>This lesson is above your saved starting level. Try a foundation lesson, or review your level if your experience has changed.</Body><Button label="Review my level" secondary onPress={() => router.push("/(learning)/(tabs)/profile")}/></>}
              {resume && !entry?.allowed && <Body muted>Your saved session keeps its original starting point. You can continue it or choose another lesson.</Body>}
            </>}
            <Body>
              {firstReviews
                ? `First, ${firstReviews} ${savedReview ? "remaining questions in your saved review set" : "due reviews"}. Then ${resume ? "resume your saved lesson" : "learn the kanji, kana and grammar"}, practise pronunciation and open your interest-led conversation.`
                : completedReview
                  ? "Your review set is saved. Continue your lesson from where you stopped."
                  : "No new reviews are ready. Begin with the lesson, then pronunciation and your interest-led conversation."}
            </Body>
            {queue.ready.length > 8 && !savedReview && !completedReview && (
              <Body muted>
                The session begins with up to eight due questions. Remaining
                reviews stay ready in Review.
              </Body>
            )}
            {queue.awaitingFeedback.length > 0 && (
              <Body muted>
                {queue.awaitingFeedback.length} sentence{" "}
                {queue.awaitingFeedback.length === 1
                  ? "answer is"
                  : "answers are"}{" "}
                saved for feedback. You can continue without repeating{" "}
                {queue.awaitingFeedback.length === 1 ? "it" : "them"}.
              </Body>
            )}
            <Body muted>
              Prepared lessons and reviews work offline. New conversation
              replies and automatic speech feedback need internet. Activity
              counts only when you actually practise.
            </Body>
            <Button
              label={resume ? "Continue my session" : "Start my session"}
              disabled={study.loading || reviews.loading || !canStart}
              busy={busy}
              onPress={() => void start()}
            />
          </>
        ) : (
          <Body>
            This lesson is in the approved starter inventory. Its checked
            exercises will become available after the first lesson loop is
            verified.
          </Body>
        )}
        {error && <Message>{error}</Message>}
        <Button
          label="Return to my daily plan"
          secondary
          onPress={() => router.back()}
        />
      </Panel>
    </Screen>
  );
}
