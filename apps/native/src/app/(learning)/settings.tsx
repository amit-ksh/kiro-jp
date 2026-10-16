import { router } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useState } from "react";
import { Switch, View } from "react-native";
import { bandLabel, type LearningBand } from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import { useSignOut } from "../../features/auth/AuthProvider";
import { WaniKaniImport } from "../../features/imports/WaniKaniImport";
import { LearningPreferences } from "../../features/profile/LearningPreferences";
import { ReminderSettings } from "../../features/reminders/ReminderSettings";
import {
  Body,
  Button,
  Choice,
  Message,
  Panel,
  Screen,
  Title,
  useColors,
} from "../../components/ui";
export default function Settings() {
  const { profile, update } = useProfile();
  const colors = useColors();
  const signOut = useSignOut();
  const { isAuthenticated } = useConvexAuth();
  const email = useQuery(
    api.account.passwordResetEmail,
    isAuthenticated ? {} : "skip",
  );
  const capabilities = useQuery(
    api.account.capabilities,
    isAuthenticated ? {} : "skip",
  );
  const [error, setError] = useState("");
  const save = (patch: Parameters<typeof update>[0]) =>
    void update(patch).catch(() =>
      setError("Your setting couldn't be saved. Please try again."),
    );
  return (
    <Screen title="Goals & settings">
      <Panel>
        <Title>Level and daily goal</Title>
        {(["foundations", "early-n5", "early-n4"] as LearningBand[]).map(
          (band) => (
            <Choice
              key={band}
              label={bandLabel(band)}
              selected={profile.acceptedBand === band}
              onPress={() => save({ acceptedBand: band })}
            />
          ),
        )}
        {[5, 10, 15, 20, 30].map((minutes) => (
          <Choice
            key={minutes}
            label={`${minutes} minutes a day`}
            selected={profile.dailyMinutes === minutes}
            onPress={() => save({ dailyMinutes: minutes })}
          />
        ))}
      </Panel>
      <Panel>
        <Title>Your progress</Title>
        <Body>
          See your week, separate skill practice and useful follow-up reviews.
        </Body>
        <Button
          label="View my progress"
          secondary
          onPress={() => router.push("/(learning)/progress")}
        />
      </Panel>
      <LearningPreferences />
      <ReminderSettings />
      <Panel>
        <Title>Your learning data</Title>
        <Body>
          Export saved practice, conversations and device drafts, or delete your
          account.
        </Body>
        <Button
          label="Manage my learning data"
          secondary
          onPress={() => router.push("/(learning)/account-data")}
        />
      </Panel>
      <Panel>
        <Title>Your interests</Title>
        <Button
          label="Edit interests"
          secondary
          onPress={() => router.push("/(learning)/interests")}
        />
      </Panel>
      <Panel>
        <WaniKaniImport />
      </Panel>
      <Panel>
        <Title>Reading support</Title>
        {(
          [
            ["furigana", "Kana readings"],
            ["romaji", "Romaji support"],
            ["translations", "English translations"],
          ] as const
        ).map(([key, label]) => (
          <View
            key={key}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <Body>{label}</Body>
            <Switch
              accessibilityLabel={label}
              value={profile[key]}
              onValueChange={(value) => save({ [key]: value })}
              trackColor={{ true: colors.primary, false: colors.outline }}
            />
          </View>
        ))}
        {[1, 1.2, 1.4].map((scale) => (
          <Choice
            key={scale}
            label={`Text size ${Math.round(scale * 100)}%`}
            selected={profile.textScale === scale}
            onPress={() => save({ textScale: scale })}
          />
        ))}
      </Panel>
      <Panel>
        <Title>Account</Title>
        {email && <Body>{email}</Body>}
        {capabilities?.passwordRecovery ? (
          <>
            <Button
              label="Change password by email"
              secondary
              disabled={!email}
              onPress={() =>
                router.push({
                  pathname: "/auth/forgot",
                  params: { email: email! },
                })
              }
            />
            <Body muted>
              Password changes use the same verified email link as recovery.
              Your learning history stays with this account.
            </Body>
          </>
        ) : (
          <Body muted>
            Password changes and recovery are unavailable in this early build.
          </Body>
        )}
        <Button
          label="Sign out"
          secondary
          onPress={() =>
            void signOut()
              .then(() => router.replace("/"))
              .catch(() =>
                setError("Sign-out could not finish. Please try again."),
              )
          }
        />
        {error && <Message>{error}</Message>}
      </Panel>
    </Screen>
  );
}
