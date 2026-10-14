import { router } from "expo-router";
import { Text } from "react-native";
import {
  activeMilliseconds,
  bandLabel,
  localDayAt,
  sessionProjection,
  reviewEarnsStreak,
  reviewQueue,
} from "@packages/learning-core";
import { lessonCatalog, requestsLesson } from "@packages/content";
import { useStudy } from "../../../data/StudyProvider";
import { useReviews } from "../../../data/ReviewProvider";
import { useProfile } from "../../../data/ProfileProvider";
import {
  Body,
  Button,
  Panel,
  Screen,
  Title,
  Loading,
  styles,
  useColors,
} from "../../../components/ui";
export default function Home() {
  const { profile, syncState, error, retry, adoptCloud } = useProfile();
  const colors = useColors();
  const study = useStudy();
  const reviews = useReviews();
  const lesson = lessonCatalog[0];
  const sessions = study.events
    .filter((event) => event.kind === "started")
    .sort((a, b) => b.occurredAt - a.occurredAt);
  const unfinished = sessions.find(
    (session) =>
      !sessionProjection(
        requestsLesson,
        study.events.filter((event) => event.sessionId === session.sessionId),
      ).finishedText,
  );
  const unfinishedChat = Object.values(study.chats)
    .sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt)
    .find((chat) =>
      chat.segments.some(
        (segment) =>
          segment.segmentId === chat.conversation.currentSegmentId &&
          segment.state === "active",
      ),
    );
  const today = localDayAt(Date.now(), new Date().getTimezoneOffset());
  const milliseconds = activeMilliseconds(
    study.events.flatMap((event) => event.spans),
    today,
  );
  const meaningful =
    study.events.some(
      (event) =>
        event.kind === "conversationTurn" &&
        event.localDay === today &&
        event.input === "meaningful",
    ) ||
    sessions.some((session) =>
      sessionProjection(
        requestsLesson,
        study.events.filter((event) => event.sessionId === session.sessionId),
        study.checked,
      ).meaningfulDays.includes(today),
    ) ||
    reviews.attempts.some(
      (event) =>
        event.localDay === today &&
        reviewEarnsStreak(event, reviews.receipts.get(event.eventId)),
    );
  const queue = reviewQueue(reviews, Date.now()),
    due = queue.ready.length;
  if (study.loading || reviews.loading)
    return <Loading label="Opening your saved daily plan…" />;
  return (
    <Screen
      title="A little Japanese, today."
      subtitle={`${bandLabel(profile.acceptedBand)} · ${profile.dailyMinutes}-minute daily goal`}
    >
      <Panel>
        <Body muted>Today&apos;s study</Body>
        <Title>
          {(milliseconds / 60_000).toFixed(1)} / {profile.dailyMinutes} minutes
        </Title>
        <Body>
          {meaningful
            ? "Today's streak day earned through meaningful practice."
            : "Complete a review, lesson exercise or Japanese conversation turn to earn today's streak day."}
        </Body>
        <Body muted>
          Active time after study interactions; idle and network waiting are
          excluded.
        </Body>
      </Panel>
      <Panel>
        <Title>{lesson.title}</Title>
        <Body>
          {profile.interests.length
            ? profile.interests.join(" · ")
            : "Everyday Japanese"}
        </Body>
        <Text style={[styles.kanji, { color: colors.onSurface, fontSize: 46 }]}>
          {lesson.kanji.join(" ")}
        </Text>
        <Body>{lesson.pattern}</Body>
        <Body>
          By the end, you&apos;ll be able to {lesson.outcome.toLowerCase()}.
        </Body>
        <Body muted>
          {due
            ? "Begin with your saved or due review set, then continue the lesson, pronunciation and conversation."
            : "Continue your lesson, pronunciation and conversation. Reviews return as you learn."}
        </Body>
        <Button
          label="Start today's session"
          onPress={() => router.push("/(learning)/session-preview")}
        />
        <Button
          label="Choose another session"
          secondary
          onPress={() => router.push("/(learning)/(tabs)/lessons")}
        />
      </Panel>
      {unfinished && (
        <Panel>
          <Title>Continue learning</Title>
          <Body>{requestsLesson.title} · saved where you stopped</Body>
          <Button
            label="Resume my lesson"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(learning)/lesson",
                params: { sessionId: unfinished.sessionId },
              })
            }
          />
        </Panel>
      )}
      {unfinishedChat && (
        <Panel>
          <Title>Continue your conversation</Title>
          <Body>{unfinishedChat.conversation.title}</Body>
          <Button
            label="Resume my conversation"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(learning)/chat",
                params: { conversationId: unfinishedChat.conversation._id },
              })
            }
          />
        </Panel>
      )}
      <Panel>
        <Title>Your review queue</Title>
        <Body>
          {reviews.tracks.length
            ? `${reviews.tracks.length} separate tracks introduced · ${due} ready. Word and kana reviews return after four hours; grammar follows after a day.`
            : "Reviews will appear after you begin learning. Meanings and word readings return separately."}
        </Body>
        {queue.awaitingFeedback.length > 0 && (
          <Body>
            {queue.awaitingFeedback.length} due sentence{" "}
            {queue.awaitingFeedback.length === 1 ? "answer is" : "answers are"}{" "}
            awaiting feedback, with the previous schedule retained.
          </Body>
        )}
        {(due > 0 || reviews.run) && (
          <Button
            label={reviews.run ? "Continue my reviews" : "Start review"}
            secondary
            onPress={() => router.push("/(learning)/(tabs)/review")}
          />
        )}
        <Body muted>
          Repeating a lesson does not reset an existing schedule.{" "}
          {reviews.provisional.size > 0
            ? "Offline advances are provisional until synchronized."
            : ""}
        </Body>
      </Panel>
      {sessions.length > 0 && (
        <Panel>
          <Title>Saved reference</Title>
          <Body>Your words, request pattern and example sentences.</Body>
          <Button
            label="Open session reference"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(learning)/reference",
                params: { sessionId: sessions[0]!.sessionId },
              })
            }
          />
        </Panel>
      )}
      <Panel>
        <Title>Your starting point</Title>
        <Body>
          {bandLabel(profile.acceptedBand)} · Target {profile.targetJlpt}
        </Body>
        <Body muted>
          Your skill progress will reflect actual practice. No speaking or
          grammar mastery is inferred from your selected level.
        </Body>
        <Button
          label="Goals and interests"
          secondary
          onPress={() => router.push("/(learning)/(tabs)/profile")}
        />
      </Panel>
      {syncState === "conflict" ? (
        <Panel>
          <Body>
            Your profile changed on another device; local answers remain saved.
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
            <Body>
              {error ||
                "Saved on this phone. Cloud synchronization is pending."}
            </Body>
            <Button label="Retry synchronization" secondary onPress={retry} />
          </Panel>
        )
      )}
    </Screen>
  );
}
