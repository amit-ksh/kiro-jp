import { useEffect, useState } from "react";
import {
  parseExamDate,
  type Goal,
  type LearningProfile,
} from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import {
  Body,
  Button,
  Choice,
  Field,
  Message,
  Panel,
  Title,
} from "../../components/ui";

export const learningGoalLabels: Record<Goal, string> = {
  conversation: "Daily conversation",
  travel: "Travel in Japan",
  jlpt: "Prepare for the JLPT",
  media: "Enjoy Japanese media",
};

export function LearningPreferences() {
  const { profile, update } = useProfile();
  const [draft, setDraft] = useState(profile.examDate ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [goalError, setGoalError] = useState("");
  const [targetError, setTargetError] = useState("");
  const [dateSaved, setDateSaved] = useState(false);
  useEffect(() => {
    if (!dirty) setDraft(profile.examDate ?? "");
  }, [profile.examDate, dirty]);
  const save = (patch: Partial<LearningProfile>, field: "goal" | "target") => {
    const setFailure = field === "goal" ? setGoalError : setTargetError;
    setFailure("");
    void update(patch).catch(() =>
      setFailure("Your preference couldn't be saved. Please try again."),
    );
  };
  async function saveDate(clear = false) {
    const date = clear ? undefined : parseExamDate(draft);
    setError("");
    setDateSaved(false);
    if (date === null) {
      setError("Enter a real date in YYYY-MM-DD format, such as 2026-12-06.");
      return;
    }
    setBusy(true);
    try {
      await update({ examDate: date });
      setDraft(date ?? "");
      setDirty(false);
      setDateSaved(true);
    } catch {
      setError(
        "The date couldn't be saved. Your entry is still here; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Panel>
        <Title>What are you learning for?</Title>
        {(Object.entries(learningGoalLabels) as [Goal, string][]).map(
          ([goal, label]) => (
            <Choice
              key={goal}
              label={label}
              selected={profile.goal === goal}
              onPress={() => save({ goal }, "goal")}
            />
          ),
        )}
        <Body muted>
          Your choice saves automatically. You can change it as your plans
          change.
        </Body>
        {goalError && <Message>{goalError}</Message>}
      </Panel>
      <Panel>
        <Title>Your JLPT target</Title>
        {(["N5", "N4", "N3", "N2", "N1"] as const).map((level) => (
          <Choice
            key={level}
            label={`Target ${level}`}
            selected={profile.targetJlpt === level}
            onPress={() => save({ targetJlpt: level }, "target")}
          />
        ))}
        {targetError && <Message>{targetError}</Message>}
        <Body muted>
          Current lessons cover selected N5/N4 patterns. Higher targets stay
          saved for your longer-term plan. Your starting level and practice
          evidence remain separate.
        </Body>
        <Field
          label="Exam date (optional)"
          placeholder="YYYY-MM-DD"
          value={draft}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          onChangeText={(value) => {
            setDraft(value);
            setDirty(true);
            setDateSaved(false);
            setError("");
          }}
          onSubmitEditing={() => void saveDate()}
          returnKeyType="done"
        />
        <Body muted>
          Save the calendar date you plan around. You can leave it blank or
          remove it later.
        </Body>
        <Button
          label="Save exam date"
          busy={busy}
          disabled={!dirty}
          onPress={() => void saveDate()}
        />
        {profile.examDate && (
          <Button
            label="Remove exam date"
            secondary
            disabled={busy}
            onPress={() => void saveDate(true)}
          />
        )}
        {dateSaved && (
          <Body muted>
            {profile.examDate ? "Exam date saved on this phone." : "No exam date set. This choice is saved on this phone."} Changes synchronize when you&apos;re connected.
          </Body>
        )}
        {error && <Message>{error}</Message>}
      </Panel>
    </>
  );
}
