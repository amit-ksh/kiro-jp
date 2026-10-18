import { router } from "expo-router";
import { Text, View } from "react-native";
import {
  bandLabel,
  sessionProjection,
  reviewQueue,
} from "@packages/learning-core";
import {
  recommendFirstLesson,
  curriculum,
  lessonCatalog,
} from "@packages/content";
import { useStudy } from "../../../data/StudyProvider";
import { useReviews } from "../../../data/ReviewProvider";
import { useProfile } from "../../../data/ProfileProvider";
import { useContent } from "../../../data/ContentProvider";
import { useLearningProgress } from "../../../features/profile/useLearningProgress";
import { ReminderOffer } from "../../../features/reminders/ReminderSettings";
import { ActivityChart } from "../../../components/ActivityChart";
import { DailyConversation } from "../../../features/conversation/DailyConversation";
import {
  Body,
  Button,
  Panel,
  Screen,
  Loading,
  useColors,
} from "../../../components/ui";
import {
  ActionRow,
  GoalMeter,
  LearningTotals,
  PlanStep,
  SectionTitle,
} from "../../../components/dashboard";

export default function Home() {
  const { profile, syncState, error, retry, adoptCloud } = useProfile();
  const colors = useColors(),
    study = useStudy(),
    reviews = useReviews(),
    content = useContent();
  const progress = useLearningProgress();
  const sessions = study.events
    .filter((event) => event.kind === "started" && curriculum.forEvent(event))
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const projectionFor = (session: (typeof sessions)[number]) =>
    sessionProjection(
      curriculum.forEvent(session)!,
      study.events.filter((event) => event.sessionId === session.sessionId),
      study.checked,
    );
  const unfinished = sessions.find(
    (session) => !projectionFor(session).finishedText,
  );
  const recommended = recommendFirstLesson(
    profile.interests,
    profile.acceptedBand,
  );
  const todaySession = sessions.find(
    (session) => session.localDay === progress.today.day,
  );
  const plannedSession = todaySession ?? unfinished;
  const lesson =
    lessonCatalog.find((item) => item.id === plannedSession?.lessonId) ??
    recommended;
  const projection = plannedSession ? projectionFor(plannedSession) : undefined;
  const unfinishedChat = Object.values(study.chats)
    .sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt)
    .find((chat) =>
      chat.segments.some(
        (segment) =>
          segment.segmentId === chat.conversation.currentSegmentId &&
          segment.state === "active",
      ),
    );
  const queue = reviewQueue(reviews, Date.now()),
    due = queue.ready.length;
  const hasSpoken = study.events.some(
    (event) =>
      event.localDay === progress.today.day &&
      event.sessionId === plannedSession?.sessionId &&
      event.kind === "audioActivity" &&
      event.input === "speaking" &&
      event.spans.length > 0,
  );
  const hasConversed = study.events.some(
    (event) =>
      event.localDay === progress.today.day &&
      event.kind === "conversationTurn" &&
      event.input === "meaningful",
  );
  const hasListened = study.events.some(
    (event) =>
      event.localDay === progress.today.day &&
      event.sessionId === plannedSession?.sessionId &&
      event.kind === "audioActivity" &&
      event.input === "listening" &&
      event.spans.length > 0,
  );
  const start = () =>
    router.push({
      pathname: "/(learning)/session-preview",
      params: { lessonId: lesson.id },
    });
  if (study.loading || reviews.loading)
    return <Loading label="Opening your daily plan…" />;
  return (
    <Screen
      title="Today"
      subtitle={`${bandLabel(profile.acceptedBand)} · ${profile.targetJlpt}`}
    >
      <Panel style={{ padding: 20, gap: 14 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Body style={{ fontWeight: "700" }}>Daily goal</Body>
          <Body muted>
            {progress.streak} day{progress.streak === 1 ? "" : "s"} streak
          </Body>
        </View>
        <Body>
          <Body style={{ fontWeight: "800" }}>
            {(progress.today.milliseconds / 60_000).toFixed(1)}
          </Body>{" "}
          / {profile.dailyMinutes} min
          {progress.today.goalMet ? " · goal reached" : ""}
          {progress.today.meaningful ? " · streak earned" : ""}
        </Body>
        <GoalMeter
          milliseconds={progress.today.milliseconds}
          minutes={profile.dailyMinutes}
        />
        <LearningTotals
          inventory={progress.inventory}
          onPress={() => router.push("/(learning)/progress")}
        />
      </Panel>

      {!content.online && (
        <Panel style={{ padding: 20, gap: 10 }}>
          <SectionTitle>You’re offline</SectionTitle>
          <Button
            label="Continue offline study"
            secondary
            onPress={() =>
              unfinished
                ? router.push({
                    pathname: "/(learning)/lesson",
                    params: { sessionId: unfinished.sessionId },
                  })
                : due
                  ? router.push("/(learning)/(tabs)/review")
                  : start()
            }
          />
        </Panel>
      )}

      <Panel style={{ padding: 20, gap: 12 }}>
        <ActionRow
          label={reviews.run ? "Continue reviews" : "Due reviews"}
          detail={due ? `${due} reviews ready` : "0 due"}
          onPress={() => router.push("/(learning)/(tabs)/review")}
        />
        {queue.awaitingFeedback.length > 0 && (
          <Body muted>{queue.awaitingFeedback.length} awaiting feedback</Body>
        )}
        <View style={{ height: 1, backgroundColor: colors.outline }} />
        <SectionTitle>{lesson.title}</SectionTitle>
        <Button label="Start today's session" onPress={start} />
        <Text
          style={{
            color: colors.onSurface,
            fontSize: 36,
            lineHeight: 48,
            fontWeight: "700",
          }}
        >
          {lesson.kanji.join("  ")}
        </Text>
        <PlanStep
          label={`${lesson.kanji.length} kanji`}
          done={Boolean(
            projection &&
            projection.initiallyLearned.length >=
              curriculum.get(lesson.id)!.words.length,
          )}
        />
        <PlanStep
          label={lesson.pattern}
          done={Boolean(
            projection &&
            ["independent", "assisted"].includes(projection.grammarState),
          )}
        />
        <PlanStep
          label="Speaking & chat"
          done={hasListened && hasSpoken && hasConversed}
        />
        <ActionRow
          label="Choose another session"
          onPress={() => router.push("/(learning)/(tabs)/lessons")}
        />
      </Panel>

      <DailyConversation />

      {(unfinished || unfinishedChat) && (
        <Panel style={{ padding: 20, gap: 4 }}>
          <SectionTitle>Continue</SectionTitle>
          {unfinished && (
            <ActionRow
              label="Resume lesson"
              detail={curriculum.forEvent(unfinished)!.title}
              onPress={() =>
                router.push({
                  pathname: "/(learning)/lesson",
                  params: { sessionId: unfinished.sessionId },
                })
              }
            />
          )}
          {unfinishedChat && (
            <ActionRow
              label="Resume conversation"
              detail={unfinishedChat.conversation.title}
              onPress={() =>
                router.push({
                  pathname: "/(learning)/chat",
                  params: { conversationId: unfinishedChat.conversation._id },
                })
              }
            />
          )}
        </Panel>
      )}

      <Panel style={{padding:20,gap:12}}><ActivityChart days={progress.days} compact/></Panel>

      <Panel style={{ padding: 20, gap: 4 }}>
        {sessions.length > 0 && (
          <ActionRow
            label="Last session reference"
            onPress={() =>
              router.push({
                pathname: "/(learning)/reference",
                params: { sessionId: sessions[0]!.sessionId },
              })
            }
          />
        )}
        <ActionRow
          label="Your progress"
          detail={progress.suggestions[0]?.label}
          onPress={() => router.push("/(learning)/progress")}
        />
        <ActionRow
          label="Grammar reference"
          onPress={() => router.push("/(learning)/grammar")}
        />
      </Panel>
      <ReminderOffer />
      {syncState === "conflict" ? (
        <Panel>
          <Body>
            Your profile changed on another device. Local answers are saved.
          </Body>
          <Button
            label="Use cloud profile and keep local draft"
            secondary
            onPress={() => void adoptCloud()}
          />
        </Panel>
      ) : (
        (syncState === "pending" || error) && (
          <Panel>
            <Body>{error || "Saved on this phone. Sync pending."}</Body>
            <Button label="Retry synchronization" secondary onPress={retry} />
          </Panel>
        )
      )}
    </Screen>
  );
}
