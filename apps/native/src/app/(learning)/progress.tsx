import { router } from "expo-router";
import { View } from "react-native";
import type { PracticeCounts, ProgressFacet } from "@packages/learning-core";
import { useLearningProgress } from "../../features/profile/useLearningProgress";
import { LearningTotals, SectionTitle } from "../../components/dashboard";
import {
  Body,
  Button,
  Loading,
  Panel,
  Screen,
  Title,
} from "../../components/ui";

const labels: Record<ProgressFacet, string> = {
  meaning: "Kanji and word meanings",
  reading: "Word reading recall",
  kana: "Kana recognition",
  grammar: "Grammar exercises",
};
const minutes = (ms: number) => (ms / 60_000).toFixed(1);
function countsText(counts: PracticeCounts) {
  const parts = [];
  if (counts.independent) parts.push(`${counts.independent} independent`);
  if (counts.assisted) parts.push(`${counts.assisted} with help`);
  if (counts.incorrect + counts.dontKnow)
    parts.push(`${counts.incorrect + counts.dontKnow} to practise`);
  if (counts.validAlternative)
    parts.push(`${counts.validAlternative} other valid answers`);
  if (counts.pending) parts.push(`${counts.pending} awaiting feedback`);
  if (counts.unassessed) parts.push(`${counts.unassessed} not assessed`);
  return parts.join(" · ") || "No answers recorded this week.";
}
export default function Progress() {
  const progress = useLearningProgress();
  if (progress.loading) return <Loading label="Opening your saved practice…" />;
  return (
    <Screen title="Your progress">
      <Panel>
        <SectionTitle>Introduced</SectionTitle>
        <LearningTotals inventory={progress.inventory} />
        {progress.inventory.kanji.length > 0 && (
          <Body>{progress.inventory.kanji.join("  ")}</Body>
        )}
        <Body>
          {progress.inventory.kana.length} kana introduced ·{" "}
          {progress.inventory.savedPhrases} phrases saved for review
        </Body>
      </Panel>
      <Panel>
        <Title>{minutes(progress.weeklyMilliseconds)} minutes this week</Title>
        <Body>
          {progress.meaningfulDaysThisWeek} active study days ·{" "}
          {progress.streak}-day current streak
        </Body>
        <Body>
          Today: {minutes(progress.today.milliseconds)} /{" "}
          {progress.dailyMinutes} minutes
          {progress.today.goalMet ? " · daily goal reached" : ""}
          {progress.today.meaningful ? " · streak day earned" : ""}
        </Body>
        {progress.days.map((day) => (
          <View key={day.day} style={{ gap: 4 }}>
            <Body>
              {new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}{" "}
              · {minutes(day.milliseconds)} min
            </Body>
            <Body muted>
              {day.meaningful ? "Study day earned" : "No study step yet"}
              {day.goalMet ? " · time goal reached" : ""}
            </Body>
          </View>
        ))}
      </Panel>
      <Panel>
        <Title>Answers and support</Title>
        {(Object.entries(labels) as [ProgressFacet, string][]).map(
          ([key, label]) => (
            <View key={key} style={{ gap: 6 }}>
              <Body>{label}</Body>
              <Body muted>{countsText(progress.skills[key])}</Body>
            </View>
          ),
        )}
        {progress.skills.reading.romaji > 0 && (
          <Body muted>
            {progress.skills.reading.romaji} correct reading answers used
            romaji. Kana recognition is tracked separately.
          </Body>
        )}
      </Panel>
      <Panel>
        <Title>Listening and speaking</Title>
        <Body>
          Listening: {minutes(progress.listeningMilliseconds)} minutes
        </Body>
        <Body>Speaking: {minutes(progress.speakingMilliseconds)} minutes</Body>
        <Body>
          {progress.conversationTurns} Japanese conversation turns ·{" "}
          {progress.assistedConversationTurns} with support
        </Body>
      </Panel>
      <Panel>
        <Title>Useful next practice</Title>
        {progress.suggestions.length ? (
          progress.suggestions.map((item) => (
            <View key={item.key} style={{ gap: 12 }}>
              <Body>
                {item.label} · {labels[item.facet]}
              </Body>
              <Body muted>
                Missed in {item.sessions} separate sessions this week.
              </Body>
              <Button
                label={`Practise ${item.label}`}
                secondary
                onPress={() =>
                  item.trackId
                    ? router.push({
                        pathname: "/(learning)/(tabs)/review",
                        params: { practiceTrackId: item.trackId },
                      })
                    : item.lessonId
                      ? router.push({
                          pathname: "/(learning)/session-preview",
                          params: { lessonId: item.lessonId },
                        })
                      : router.push("/(learning)/(tabs)/review")
                }
              />
            </View>
          ))
        ) : (
          <>
            <Button
              label="Open my reviews"
              secondary
              onPress={() => router.push("/(learning)/(tabs)/review")}
            />
          </>
        )}
        {progress.provisionalReviewTracks > 0 && (
          <Body muted>
            Offline review changes are provisional until synchronization. Your
            recorded effort stays on its original day.
          </Body>
        )}
      </Panel>
      <Button label="Back to Profile" secondary onPress={() => router.back()} />
    </Screen>
  );
}
