import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { curriculum } from "@packages/content";
import {
  sessionProjection,
  exerciseForStep,
  type Assessment,
  type PreparedLesson,
  type SupportFlag,
} from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
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
  useColors,
} from "../../components/ui";
import { SentenceView } from "../../features/lessons/SentenceView";
import { useStudyTime } from "../../features/lessons/useStudyTime";
import { LessonConversation } from "../../features/conversation/LessonConversation";
import { SentenceFeedback } from "../../features/lessons/SentenceFeedback";
import { AudioPlay } from "../../features/speech/AudioPlay";
import { preparedLessonAudio } from "../../features/speech/lesson-audio";
import { useSpeech } from "../../features/speech/SpeechProvider";

export default function Lesson() {
  const { sessionId = "" } = useLocalSearchParams<{ sessionId: string }>();
  const study = useStudy();
  const lesson = curriculum.forSession(study.events, sessionId);
  if (study.loading) return <Loading label="Opening your saved lesson…" />;
  if (!lesson) return <Screen title="Find your session"><Panel><Body>This saved lesson version is not available here. Reconnect or update the app; your progress is retained.</Body><Button label="Go to Home" onPress={() => router.replace("/(learning)/(tabs)")} /></Panel></Screen>;
  return <LessonSession key={sessionId} sessionId={sessionId} lesson={lesson} />;
}
function LessonSession({ sessionId, lesson }: { sessionId: string; lesson: PreparedLesson }) {
  const lessonAudio = preparedLessonAudio(lesson.id, lesson.version);
  const study = useStudy();
  const speech = useSpeech();
  const colors = useColors();
  const events = useMemo(
    () => study.events.filter((event) => event.sessionId === sessionId),
    [study.events, sessionId],
  );
  const projection = useMemo(
    () => sessionProjection(lesson, events, study.checked),
    [events, study.checked, lesson],
  );
  const step = projection.next,
    snapshot = events.find((event) => event.kind === "started")?.context;
  const [input, setInput] = useState(""),
    [hintCount, setHintCount] = useState(0),
    [support, setSupport] = useState<SupportFlag[]>([]),
    [feedback, setFeedback] = useState<Assessment | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tiles, setTiles] = useState<number[]>([]);
  const time = useStudyTime(sessionId, step.id);
  const exercise = exerciseForStep(lesson, step.id);
  const lastAttempt = projection.attempts
    .filter((attempt) => attempt.event.stepId === step.id)
    .slice(-1)[0];
  const visibleFeedback =
    step.kind === "exercise"
      ? ((lastAttempt && study.checked[lastAttempt.event.eventId]) ??
        feedback ??
        lastAttempt?.assessment ??
        null)
      : null;
  const draft = study.drafts[`${sessionId}:${step.id}`] ?? "";
  const savedHints = events.filter(
    (event) => event.kind === "studied" && event.stepId === step.id,
  );
  const shownHints = Math.max(
    hintCount,
    ...savedHints.map((event) => Number(event.input) || 0),
  );
  const answer = input || draft;
  const effectiveTiles = tiles.length
    ? tiles
    : draft.startsWith("tiles:")
      ? draft
          .slice(6)
          .split(",")
          .filter(Boolean)
          .map(Number)
          .filter(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < (exercise?.tiles?.length ?? 0),
          )
      : [];
  const keepDraft = (value: string) => {
    void study
      .saveDraft(sessionId, step.id, value)
      .catch(() =>
        setError(
          "Your draft couldn't be saved yet. Keep this screen open and try again.",
        ),
      );
  };
  const word = lesson.words.find((item) => item.id === step.targetId);
  const settings = {
    romaji: snapshot?.romaji ?? true,
    readings: snapshot?.furigana ?? true,
    translation: snapshot?.translations ?? true,
  };
  const operation = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    time.pause();
    try {
      await work();
    } catch {
      setError("Your answer couldn't be saved. It is still here; try again.");
    } finally {
      setBusy(false);
    }
  };
  const advance = () =>
    void operation(async () => {
      await study.append({ sessionId, kind: "advanced", stepId: step.id });
      await study.saveDraft(sessionId, step.id, "");
      setInput("");
      setHintCount(0);
      setSupport([]);
      setFeedback(null);
      setTiles([]);
    });
  const submit = (dontKnow = false) =>
    void operation(async () => {
      const event = await study.append({
        sessionId,
        kind: "attempted",
        stepId: step.id,
        input:
          exercise?.kind === "tiles"
            ? effectiveTiles.map((index) => exercise.tiles![index]).join("")
            : answer,
        support,
        ...(study.drafts[`${sessionId}:${step.id}:speech-support`] === "transcriptEdited" && answer === draft ? { support: [...new Set([...support, "transcriptEdited" as const])] } : {}),
        dontKnow,
      });
      const assessed = sessionProjection(lesson, [
        ...events,
        event,
      ]).attempts.find(
        (attempt) => attempt.event.eventId === event.eventId,
      )?.assessment;
      if (assessed) setFeedback(assessed);
    });
  const hint = () =>
    void operation(async () => {
      if (!exercise) return;
      const flag: SupportFlag =
        shownHints === 0
          ? "wordBank"
          : shownHints === 1
            ? "patternHint"
            : "example";
      const count = Math.min(shownHints + 1, exercise.hints.length);
      await study.append({
        sessionId,
        kind: "studied",
        stepId: step.id,
        input: String(count),
        support: [flag],
      });
      setSupport((previous) => [...new Set([...previous, flag])]);
      setHintCount(count);
      time.interact();
    });
  if (study.loading) return <Loading label="Opening your saved lesson…" />;
  if (!snapshot)
    return (
      <Screen title="Find your session">
        <Panel>
          <Body>
            This session is not saved on this phone yet. Reconnect to
            synchronize it, or start a session from Home.
          </Body>
          <Button
            label="Go to Home"
            onPress={() => router.replace("/(learning)/(tabs)")}
          />
        </Panel>
      </Screen>
    );
  const position =
    projection.steps.findIndex((item) => item.id === step.id) + 1;
  const sentence = (
    value: (typeof lesson.grammar.examples)[number],
  ) => (
    <View key={value.id} style={{ gap: 8 }}>
      <SentenceView sentence={value} {...settings} />
      <AudioPlay
        source={lessonAudio[value.id]}
        sessionId={sessionId}
        label={value.text}
      />
    </View>
  );
  return (
    <Screen
      title={lesson.title}
      subtitle={`${snapshot.theme} · Step ${position} of ${projection.steps.length}`}
    >
      <View onTouchStart={time.interact}>
        <Panel>
          <Body muted>
            {step.id.startsWith("retry-") || step.id.startsWith("extra-")
              ? "Return practice · no scheduled advance"
              : step.kind === "exercise"
                ? "Try it · active recall"
                : step.kind === "recap"
                  ? "Your reusable reference"
                  : "Learn first"}
          </Body>
          {step.kind === "goal" && (
            <>
              <Title>Language you can use today.</Title>
              <Body>
                By the end, you&apos;ll be able to{" "}
                {lesson.outcome.toLowerCase()}.
              </Body>
              <Body>
                Learn {lesson.words.length} kanji, a little kana and one pattern. Then bring
                these words into a conversation about{" "}
                {snapshot.theme.toLowerCase()}.
              </Body>
              <Body muted>
                These text exercises are ready offline. The tutor opens after
                your lesson. Listen and record short attempts with this session.
              </Body>
              <Button
                label="Begin learning"
                onPress={() => {
                  time.interact();
                  advance();
                }}
                disabled={busy}
              />
            </>
          )}
          {step.kind === "word" && word && (
            <>
              <Text style={[styles.kanji, { color: colors.onSurface }]}>
                {word.kanji}
              </Text>
              <Title>{word.meaning}</Title>
              <Body>
                {word.word} · {word.reading}
                {settings.romaji ? ` · ${word.romaji[0]}` : ""}
              </Body>
              <Body>{word.readingNote}</Body>
              <Body>{word.mnemonic}</Body>
              <Body muted>Memory aid; not an etymology.</Body>
              <AudioPlay
                source={lessonAudio[`word-${word.id}`]}
                sessionId={sessionId}
                label={word.word}
              />
              {sentence(word.example)}
              <Button
                label="Practise this word aloud"
                secondary
                onPress={() => {
                  time.pause();
                  router.push({
                    pathname: "/(learning)/speech",
                    params: { sessionId, cueId: `word-${word.id}` },
                  });
                }}
              />
              <Button
                label="I studied this word"
                onPress={() => {
                  time.interact();
                  advance();
                }}
                disabled={busy}
              />
            </>
          )}
          {step.kind === "kana" && (
            <>
              <Title>A little hiragana.</Title>
              {lesson.kana.map((kana, index) => (
                <View key={kana.character} style={{ gap: 6 }}>
                  <Body style={{ fontSize: 30 }}>
                    {kana.character} · {kana.sound}
                  </Body>
                  <Body>{kana.note}</Body>
                  <AudioPlay
                    source={lessonAudio[`kana-${index + 1}`]}
                    sessionId={sessionId}
                    label={kana.character}
                  />
                </View>
              ))}
              <Body>
                In おちゃ, ちゃ combines ち with a small ゃ. You can use romaji
                while these characters become familiar.
              </Body>
              <Button
                label="Continue to grammar"
                onPress={() => {
                  time.interact();
                  advance();
                }}
                disabled={busy}
              />
            </>
          )}
          {step.kind === "grammar" && (
            <>
              <Title>Request an item politely.</Title>
              <Body style={{ fontSize: 24, fontWeight: "700" }}>
                {lesson.grammar.pattern}
              </Body>
              <Body>{lesson.grammar.explanation}</Body>
              {lesson.grammar.examples.map(sentence)}
              <Body>{lesson.grammar.register}</Body>
              <Body>{lesson.grammar.mistake}</Body>
              <Button
                label="Try it"
                onPress={() => {
                  time.interact();
                  advance();
                }}
                disabled={busy}
              />
            </>
          )}
          {exercise && !visibleFeedback && (
            <>
              <Title>
                {exercise.facet === "reading"
                  ? "Word reading"
                  : exercise.facet === "meaning"
                    ? "Meaning recall"
                    : exercise.facet === "kana"
                      ? "Kana literacy"
                      : "Use the pattern"}
              </Title>
              <Body>{exercise.prompt}</Body>
              {exercise.kind === "sentence" && (
                <Button
                  label="Practise a spoken answer"
                  secondary
                  onPress={() => {
                    time.pause();
                    setInput("");
                    router.push({
                      pathname: "/(learning)/speech",
                      params: {
                        sessionId,
                        cueId: lesson.grammar.examples[0]?.id ?? "own-sentence",
                        returnStep: exercise.id,
                      },
                    });
                  }}
                />
              )}
              {exercise.japanese && (
                <Text
                  style={[
                    styles.kanji,
                    {
                      color: colors.onSurface,
                      fontSize: exercise.kind === "gap" ? 30 : 56,
                    },
                  ]}
                >
                  {exercise.japanese}
                </Text>
              )}
              {exercise.kind === "choice" ? (
                exercise.options!.map((option) => (
                  <Choice
                    key={option}
                    label={option}
                    selected={answer === option}
                    onPress={() => {
                      time.interact();
                      setInput(option);
                      keepDraft(option);
                    }}
                  />
                ))
              ) : exercise.kind === "tiles" ? (
                <>
                  <Body style={{ fontSize: 25 }}>
                    {effectiveTiles
                      .map((index) => exercise.tiles![index])
                      .join(" ") || "Tap the pieces in order"}
                  </Body>
                  {exercise.tiles!.map((tile, index) => (
                    <Button
                      key={index}
                      label={tile}
                      secondary
                      disabled={effectiveTiles.includes(index)}
                      onPress={() => {
                        time.interact();
                        const next = [...effectiveTiles, index];
                        setTiles(next);
                        keepDraft(`tiles:${next.join(",")}`);
                      }}
                    />
                  ))}
                  <Button
                    label="Clear pieces"
                    secondary
                    onPress={() => {
                      time.interact();
                      setTiles([]);
                      keepDraft("");
                    }}
                  />
                </>
              ) : (
                <Field
                  label="Your answer"
                  value={answer}
                  onChangeText={(value) => {
                    time.interact();
                    setInput(value);
                    keepDraft(value);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={exercise.kind === "sentence"}
                  maxLength={1000}
                />
              )}
              {shownHints > 0 &&
                exercise.hints
                  .slice(0, shownHints)
                  .map((text, index) => <Body key={index}>{text}</Body>)}
              <Button
                label="Check my answer"
                disabled={
                  busy ||
                  (exercise.kind === "tiles"
                    ? !effectiveTiles.length
                    : !answer.trim())
                }
                onPress={() => submit()}
              />
              <Button
                label="I don't know"
                secondary
                disabled={busy}
                onPress={() => submit(true)}
              />
              {shownHints < exercise.hints.length && (
                <Button
                  label={shownHints ? "More help" : "Show a hint"}
                  secondary
                  disabled={busy}
                  onPress={hint}
                />
              )}
              <Body muted>
                Hints and sentence tiles count as supported practice.
              </Body>
            </>
          )}
          {visibleFeedback && (
            <>
              <Title>
                {visibleFeedback.outcome === "independent"
                  ? "That works."
                  : visibleFeedback.outcome === "assisted"
                    ? "Practised with support."
                    : visibleFeedback.outcome === "pending"
                      ? "Awaiting feedback."
                      : visibleFeedback.outcome === "validAlternative"
                        ? "A useful alternative."
                        : "Let’s practise this again."}
              </Title>
              <Body>
                Your answer:{" "}
                {lastAttempt?.event.input || input || "I don't know"}
              </Body>
              <Body>
                {exercise?.kind === "sentence" ? "Example" : "Expected"}:{" "}
                {visibleFeedback.expected}
              </Body>
              <Body>{visibleFeedback.explanation}</Body>
              {visibleFeedback.inputScript === "romaji" &&
                exercise?.facet === "reading" && (
                  <Body muted>
                    This demonstrates the word&apos;s reading, separately from
                    kana literacy.
                  </Body>
                )}
              <Button
                label="Continue"
                disabled={busy}
                onPress={() => {
                  time.interact();
                  advance();
                }}
              />
            </>
          )}
          {step.kind === "recap" && (
            <>
              <Title>You have begun learning.</Title>
              <Body>
                {projection.initiallyLearned.length} kanji introduced. Meaning
                and word-reading reviews are separate, with first reviews four
                hours after introduction.
              </Body>
              <Body>
                Grammar use:{" "}
                {projection.grammarState === "independent"
                  ? "demonstrated independently in an exercise"
                  : projection.grammarState === "assisted"
                    ? "practised with help"
                    : projection.grammarState === "pending"
                      ? "awaiting feedback"
                      : "needs practice"}
                .
              </Body>
              <Body>
                {speech.recordings.some(
                  (record) => record.sessionId === sessionId,
                )
                  ? "Speaking: recorded practice, awaiting assessment. "
                  : "Speaking: not practised. "}
                Finishing text exercises does not award mastery.
              </Body>
              <Body style={{ fontSize: 23, fontWeight: "700" }}>
                {lesson.grammar.pattern}
              </Body>
              {lesson.grammar.examples.map((example) => (
                <View key={example.id} style={{ gap: 10 }}>
                  {sentence(example)}
                  <Button
                    label={
                      events.some(
                        (event) =>
                          event.kind === "savedPhrase" &&
                          event.input === example.id,
                      )
                        ? "Saved for review"
                        : `Save ${example.text}`
                    }
                    secondary
                    disabled={
                      events.some(
                        (event) =>
                          event.kind === "savedPhrase" &&
                          event.input === example.id,
                      ) || busy
                    }
                    onPress={() =>
                      void operation(async () => {
                        await study.append({
                          sessionId,
                          kind: "savedPhrase",
                          stepId: "recap",
                          input: example.id,
                        });
                      })
                    }
                  />
                </View>
              ))}
              <Button
                label="Practise words and sentences aloud"
                onPress={() => {
                  time.pause();
                  router.push({
                    pathname: "/(learning)/speech",
                    params: { sessionId, cueId: lesson.grammar.examples[0]?.id ?? "own-sentence" },
                  });
                }}
              />
              <LessonConversation
                sessionId={sessionId}
                theme={snapshot.theme}
              />
              <Button
                label="Return to my daily plan"
                onPress={() => router.replace("/(learning)/(tabs)")}
              />
            </>
          )}
          {error && <Message>{error}</Message>}
        </Panel>
      </View>
      <SentenceFeedback sessionId={sessionId} />
      <Button
        label="Save and return Home"
        secondary
        disabled={busy}
        onPress={() => {
          time.pause();
          router.replace("/(learning)/(tabs)");
        }}
      />
      {study.pending > 0 && (
        <Panel>
          <Body>
            Saved on this phone · {study.pending} activities awaiting
            synchronization.
          </Body>
          {study.error && <Body>{study.error}</Body>}
          <Button label="Retry sync" secondary onPress={study.retry} />
        </Panel>
      )}
    </Screen>
  );
}
