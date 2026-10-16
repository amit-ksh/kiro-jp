import { router } from "expo-router";
import { useProfile } from "../../../data/ProfileProvider";
import { useLearningProgress } from "../../../features/profile/useLearningProgress";
import { learningGoalLabels } from "../../../features/profile/LearningPreferences";
import { bandLabel } from "@packages/learning-core";
import { Body, Panel, Screen, Loading } from "../../../components/ui";
import {
  ActionRow,
  LearningTotals,
  SectionTitle,
} from "../../../components/dashboard";

export default function Profile() {
  const { profile } = useProfile(),
    progress = useLearningProgress();
  const topics = [...profile.interests, ...profile.favorites];
  if (progress.loading) return <Loading />;
  return (
    <Screen title="Profile" subtitle={bandLabel(profile.acceptedBand)}>
      <Panel style={{ padding: 20, gap: 14 }}>
        <SectionTitle>Your progress</SectionTitle>
        <LearningTotals inventory={progress.inventory} />
        <Body muted>
          {progress.streak}-day streak ·{" "}
          {(progress.weeklyMilliseconds / 60000).toFixed(1)} min this week
        </Body>
        <ActionRow
          label="View learning progress"
          onPress={() => router.push("/(learning)/progress")}
        />
      </Panel>
      <Panel style={{ padding: 20, gap: 4 }}>
        <ActionRow
          label="Daily goal"
          detail={`${profile.dailyMinutes} minutes · ${learningGoalLabels[profile.goal]}`}
          onPress={() => router.push("/(learning)/settings")}
        />
        <ActionRow
          label="Your interests"
          detail={
            topics.slice(0, 3).join(" · ") +
              (topics.length > 3 ? ` +${topics.length - 3} more` : "") || ""
          }
          onPress={() => router.push("/(learning)/interests")}
        />
        <ActionRow
          label="Goals & settings"
          onPress={() => router.push("/(learning)/settings")}
        />
        <ActionRow
          label="Learning data"
          onPress={() => router.push("/(learning)/account-data")}
        />
      </Panel>
    </Screen>
  );
}
