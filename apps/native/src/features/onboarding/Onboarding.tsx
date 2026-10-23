import { useCallback, useEffect, useRef, useState } from "react";
import { Text, type ScrollView } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { placementAudio } from "./placement-audio";
import { WaniKaniImport } from "../imports/WaniKaniImport";
import { placementBank, recommendFirstLesson } from "@packages/content";
import { InterestPicker } from "../profile/InterestPicker";
import { onboardingSteps as steps } from "../../navigation/policy";
import {
  bandLabel,
  recommendLevel,
  selectedBand,
  shouldOfferFollowups,
  type EstimatedLevel,
  type Goal,
  type LearningBand,
  type OnboardingStep,
  type PlacementQuestion,
  type PlacementResponse,
} from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import {
  Body,
  Button,
  Choice,
  Field,
  Loading,
  Message,
  Panel,
  Screen,
  Title,
  styles,
} from "../../components/ui";

function PlacementAudio({
  audioId,
  onReady,
}: {
  audioId: string;
  onReady: () => void;
}) {
  const [error, setError] = useState("");
  const source = placementAudio[audioId];
  const player = useAudioPlayer(source ?? null);
  const status = useAudioPlayerStatus(player);
  useEffect(() => {
    if (status.currentTime > 0.2 || status.didJustFinish) onReady();
  }, [status.currentTime, status.didJustFinish, onReady]);
  if (!source)
    return (
      <Body muted>
        Listening audio is unavailable. You can continue without assessing this
        question.
      </Body>
    );
  return (
    <>
      <Button
        label="Listen to the question"
        secondary
        disabled={!status.isLoaded}
        onPress={() => {
          setError("");
          void player
            .seekTo(0)
            .then(() => player.play())
            .catch(() =>
              setError(
                "Audio couldn't play. Try again or continue without assessing this question.",
              ),
            );
        }}
      />
      {error && <Message>{error}</Message>}
      <Body muted>
        If audio cannot play, continue without assessing this question.
      </Body>
    </>
  );
}
export function Onboarding() {
  const scroll = useRef<ScrollView>(null);
  const {
    profile,
    loading,
    update,
    syncState,
    error: storageError,
    adoptCloud,
    retry,
  } = useProfile();
  const [error, setError] = useState("");
  const [heard, setHeard] = useState(false);
  const onHeard = useCallback(() => setHeard(true), []);
  const currentStep = profile.onboardingStep;
  const index = steps.findIndex((step) => step === currentStep);
  const starter = placementBank.filter((q) => q.phase === "starter");
  const questions: readonly PlacementQuestion[] = shouldOfferFollowups(
    placementBank,
    profile.placementResponses,
  )
    ? placementBank
    : starter;
  const answeredIds = new Set(
    profile.placementResponses.map((answer) => answer.questionId),
  );
  const question = questions.find((q) => !answeredIds.has(q.id));
  const recommendation = recommendLevel(
    placementBank,
    profile.placementResponses,
  );
  const lesson = recommendFirstLesson(profile.interests, profile.acceptedBand);
  async function save(patch: Parameters<typeof update>[0]) {
    setError("");
    try {
      await update(patch);
    } catch {
      setError(
        "Your answer couldn't be saved. Keep this screen open and try again.",
      );
    }
  }
  async function move(step: OnboardingStep) {
    await save({ onboardingStep: step });
  }
  async function answer(outcome: PlacementResponse["outcome"]) {
    if (!question) return;
    await save((current) => ({
      placementResponses: [
        ...current.placementResponses.filter(
          (item) => item.questionId !== question.id,
        ),
        { questionId: question.id, bankVersion: question.bankVersion, outcome },
      ],
    }));
    setHeard(false);
  }
  if (loading) return <Loading />;
  if (syncState === "error")
    return (
      <Screen title="Your learning storage needs attention.">
        <Panel>
          <Message>{storageError || "Local storage is unavailable."}</Message>
          <Body>
            No answers have been marked as saved. Restart the app to retry
            without discarding existing study data.
          </Body>
        </Panel>
      </Screen>
    );
  return (
    <Screen
      title={
        currentStep === "setup"
          ? "Learning setup"
          : currentStep === "import"
            ? "WaniKani"
            : currentStep === "placement"
              ? "Level check"
              : currentStep === "interests"
                ? "Interests"
                : "First session"
      }
      subtitle={`Learning setup · ${index + 1} of ${steps.length}`}
      scrollRef={scroll}
      keyboardAware
    >
      {syncState === "conflict" && (
        <Panel>
          <Body>
            Your setup changed on another device. Your local answers remain
            saved.
          </Body>
          <Button
            label="Use cloud setup and keep local draft"
            secondary
            onPress={() => void adoptCloud()}
          />
        </Panel>
      )}
      <Panel>
        {currentStep === "setup" && (
          <>
            <Title>Your starting point</Title>
            {(
              [
                ["new", "Completely new"],
                ["not-sure", "I'm not sure"],
                ["n5", "Learning the basics / N5"],
                ["n4", "Some experience / N4"],
              ] as [EstimatedLevel, string][]
            ).map(([id, label]) => (
              <Choice
                key={id}
                label={label}
                selected={profile.estimatedLevel === id}
                onPress={() =>
                  void save({
                    estimatedLevel: id,
                    acceptedBand: selectedBand(id),
                  })
                }
              />
            ))}
            <Title>What would you like to do?</Title>
            {(
              [
                ["conversation", "Daily conversation"],
                ["travel", "Travel in Japan"],
                ["jlpt", "Prepare for the JLPT"],
                ["media", "Enjoy anime, manga and Japanese media"],
              ] as [Goal, string][]
            ).map(([id, label]) => (
              <Choice
                key={id}
                label={label}
                selected={profile.goal === id}
                onPress={() => void save({ goal: id })}
              />
            ))}
            <Title>Your daily study goal</Title>
            {[5, 10, 15, 20, 30].map((minutes) => (
              <Choice
                key={minutes}
                label={`${minutes} minutes a day`}
                selected={profile.dailyMinutes === minutes}
                onPress={() => void save({ dailyMinutes: minutes })}
              />
            ))}
            {profile.goal === "jlpt" && (
              <>
                <Title>Target JLPT level</Title>
                {(["N5", "N4", "N3", "N2", "N1"] as const).map((level) => (
                  <Choice
                    key={level}
                    label={level}
                    selected={profile.targetJlpt === level}
                    onPress={() => void save({ targetJlpt: level })}
                  />
                ))}
                <Body muted>
                  Starter lessons focus on N5/N4. Higher-level courses will
                  follow.
                </Body>
                <Field
                  label="Optional exam date (YYYY-MM-DD)"
                  value={profile.examDate ?? ""}
                  onChangeText={(value) => void save({ examDate: value })}
                  placeholder="2026-12-06"
                />
              </>
            )}
            <Button label="Continue" onPress={() => void move("import")} />
          </>
        )}
        {currentStep === "import" && (
          <>
            <WaniKaniImport
              onContinue={() =>
                void save({ importSkipped: false, onboardingStep: "placement" })
              }
            />
            <Button
              label="Skip for now"
              secondary
              onPress={() =>
                void save({ importSkipped: true, onboardingStep: "placement" })
              }
            />
          </>
        )}
        {currentStep === "placement" && question && (
          <>
            <Body muted>
              Question {profile.placementResponses.length + 1} of{" "}
              {questions.length} · {question.domain}
            </Body>
            <Title>{question.prompt}</Title>
            {question.japanese && (
              <Text style={[styles.kanji, { color: "#37469E" }]}>
                {question.japanese}
              </Text>
            )}
            {question.domain === "listening" && (
              <PlacementAudio
                key={question.id}
                audioId={question.audioId!}
                onReady={onHeard}
              />
            )}
            {(question.domain !== "listening" || heard) && (
              <>
                {question.options.map((option, i) => (
                  <Choice
                    key={option}
                    label={option}
                    selected={false}
                    onPress={() =>
                      void answer(
                        i === question.correctIndex ? "correct" : "incorrect",
                      )
                    }
                  />
                ))}
                <Button
                  label="I don't know"
                  secondary
                  onPress={() => void answer("dontKnow")}
                />
              </>
            )}
            {question.domain === "listening" && !heard && (
              <Button
                label="Continue without assessing this question"
                secondary
                onPress={() => void answer("unavailable")}
              />
            )}
            <Button
              label="Skip level check and use my selected level"
              secondary
              onPress={() =>
                void save({
                  placementSkipped: true,
                  acceptedBand: selectedBand(profile.estimatedLevel),
                  onboardingStep: "interests",
                })
              }
            />
          </>
        )}
        {currentStep === "placement" && !question && (
          <>
            <Title>{bandLabel(recommendation.band)}</Title>
            <Body>{recommendation.explanation}</Body>
            <Button
              label="Accept this level"
              onPress={() =>
                void save({
                  acceptedBand: recommendation.band,
                  onboardingStep: "interests",
                })
              }
            />
            <Body>You can adjust the starting point:</Body>
            {(["foundations", "early-n5", "early-n4"] as LearningBand[]).map(
              (band) => (
                <Choice
                  key={band}
                  label={bandLabel(band)}
                  selected={profile.acceptedBand === band}
                  onPress={() => void save({ acceptedBand: band })}
                />
              ),
            )}
            <Button
              label="Continue with my adjustment"
              secondary
              onPress={() => void move("interests")}
            />
          </>
        )}
        {currentStep === "interests" && (
          <>
            <InterestPicker scrollRef={scroll} />
            <Button label="Continue" onPress={() => void move("preview")} />
            <Button
              label="Skip personalization for now"
              secondary
              onPress={() =>
                void save({
                  interests: [],
                  favorites: [],
                  onboardingStep: "preview",
                })
              }
            />
          </>
        )}
        {currentStep === "preview" && (
          <>
            <Body>
              {bandLabel(profile.acceptedBand)} · {profile.dailyMinutes} minutes
              a day
            </Body>
            <Title>{lesson.title}</Title>
            <Text style={[styles.kanji, { color: "#37469E", fontSize: 40 }]}>
              {lesson.kanji.join(" ")}
            </Text>
            <Body>{lesson.pattern}</Body>
            <Body>By the end: {lesson.outcome.toLowerCase()}.</Body>
            <Button
              label="Start my session"
              onPress={() => void move("complete")}
            />
          </>
        )}
        {error && <Message>{error}</Message>}
        {index > 0 && (
          <Button
            label="Back"
            secondary
            onPress={() => void move(steps[index - 1])}
          />
        )}
      </Panel>
      {storageError && (
        <Panel>
          <Body>
            {storageError}
          </Body>
          <Button label="Retry sync" secondary onPress={retry} />
        </Panel>
      )}
    </Screen>
  );
}
