import { useEffect, useRef, useState } from "react";
import { Text, type ScrollView } from "react-native";
import * as Crypto from "expo-crypto";
import {
  hasStrongRecall,
  type ReviewTrack,
  type SupportFlag,
} from "@packages/learning-core";
import { useReviews, type ReviewQuestion } from "../../../data/ReviewProvider";
import { useStudyTime } from "../../../features/lessons/useStudyTime";
import { ReviewFeedback } from "../../../features/review/ReviewFeedback";
import { SentenceFeedbackHistory } from "../../../features/review/SentenceFeedbackHistory";
import {
  Body,
  Button,
  Field,
  Panel,
  Screen,
  Title,
  styles,
  useColors,
} from "../../../components/ui";
export default function Review() {
  const reviews = useReviews(),
    colors = useColors(),
    run = reviews.run,
    question = run?.questions[run.index];
  const track = reviews.tracks.find((t) => t.id === question?.trackId),
    receipt = question ? reviews.receipts.get(question.eventId) : undefined;
  const savedAttempt = question
    ? reviews.attempts.find((e) => e.eventId === question.eventId)
    : undefined;
  const [draftInput, setInput] = useState(""),
    [draftSupport, setSupport] = useState<SupportFlag[]>([]),
    [answerQuestionId, setAnswerQuestionId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const input =
    answerQuestionId === question?.eventId ? draftInput : (run?.input ?? "");
  const support =
    answerQuestionId === question?.eventId
      ? draftSupport
      : (run?.support ?? []);
  const time = useStudyTime(
    run?.id ?? "review-preview",
    track?.id ?? "review-preview",
    "reviewActivity",
  );
  const pausePractice = time.pause;
  useEffect(() => {
    if (receipt?.assessment.outcome === "pending") pausePractice();
  }, [receipt?.assessment.outcome, pausePractice]);
  useEffect(() => {
    setAnswerQuestionId(question?.eventId ?? "");
    scroll.current?.scrollTo({ y: 0, animated: false });
    setInput(run?.input ?? "");
    setSupport(run?.support ?? []);
    setError("");
    // Restore each durable question draft once; ongoing typing stays local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.eventId]);
  const due = reviews.tracks
    .filter((t) => t.dueAt <= Date.now())
    .sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id));
  const makeQuestion = (
    item: ReviewTrack,
    extra = false,
    correction = false,
  ): ReviewQuestion | null => {
    const opportunity = reviews.opportunities.get(item.opportunityId);
    return opportunity
      ? {
          eventId: Crypto.randomUUID(),
          trackId: item.id,
          opportunity,
          mode: extra ? "extra" : "due",
          correction,
        }
      : null;
  };
  const act = (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    void work()
      .catch((cause) => {
        if (__DEV__)
          console.warn(
            "Review local action failure",
            cause instanceof Error
              ? cause.message
              : "Unknown local storage error",
          );
        setError("Your place is retained. Try again before continuing.");
      })
      .finally(() => setBusy(false));
  };
  const start = (extra: boolean) =>
    act(async () => {
      const questions = (extra ? reviews.tracks : due)
        .slice(0, 8)
        .flatMap((item) => {
          const q = makeQuestion(item, extra);
          return q ? [q] : [];
        });
      if (!questions.length) return;
      await reviews.saveRun({
        id: Crypto.randomUUID(),
        questions,
        index: 0,
        input: "",
        support: [],
      });
    });
  const store = (text: string, flags: SupportFlag[]) => {
    if (run)
      void reviews
        .saveRun({ ...run, input: text, support: flags })
        .catch(() =>
          setError(
            "The draft couldn't save. Retry before leaving this screen.",
          ),
        );
  };
  const next = () =>
    act(async () => {
      if (!run || !question || !track) return;
      time.pause();
      let questions = [...run.questions];
      if (
        !question.correction &&
        receipt &&
        ["incorrect", "dontKnow"].includes(receipt.assessment.outcome)
      ) {
        const after = questions.slice(run.index + 1, run.index + 3),
          distinct = new Set(
            after.map((q) => q.trackId).filter((id) => id !== track.id),
          );
        if (distinct.size < 2) {
          const extras = reviews.tracks
            .filter((t) => t.id !== track.id && !distinct.has(t.id))
            .slice(0, 2 - distinct.size)
            .flatMap((t) => {
              const q = makeQuestion(t, true);
              return q ? [q] : [];
            });
          questions.splice(run.index + 1 + after.length, 0, ...extras);
          extras.forEach((q) => distinct.add(q.trackId));
        }
        if (distinct.size >= 2) {
          const retry = makeQuestion(track, true, true);
          if (retry) questions.splice(run.index + 3, 0, retry);
        }
      }
      await reviews.saveRun({
        ...run,
        questions,
        index: run.index + 1,
        input: "",
        support: [],
      });
    });
  const done = Boolean(run && run.index >= run.questions.length);
  const stale = reviews.attempts.filter(
    (e) => reviews.receipts.get(e.eventId)?.status === "stale-practice",
  ).length;
  return (
    <Screen
      title="Bring it back."
      subtitle="Recall now. Remember for longer."
      scrollRef={scroll}
    >
      {reviews.loading ? (
        <Panel>
          <Body>Opening reviews saved on this phone…</Body>
        </Panel>
      ) : run && !done && question && track ? (
        <>
          <Panel>
            <Body muted>
              Question {run.index + 1} of {run.questions.length} ·{" "}
              {track.card.source === "phrase" ? "Saved phrase · " : ""}
              {track.card.facet}
            </Body>
            {track.card.facet === "grammar" ? (
              <Title>A polite request</Title>
            ) : (
              <Text
                style={[
                  styles.kanji,
                  { color: colors.onSurface },
                  track.card.source === "phrase"
                    ? { fontSize: 28, lineHeight: 40 }
                    : {},
                ]}
              >
                {track.card.exercise.japanese ?? track.card.label}
              </Text>
            )}
            <Body>{track.card.exercise.prompt}</Body>
            {question.mode === "extra" && (
              <Body muted>
                Extra practice — this answer will not advance the review
                schedule.
              </Body>
            )}
            {!savedAttempt ? (
              <>
                <Field
                  label="Your recall answer"
                  value={input}
                  editable={!busy}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(text) => {
                    time.interact();
                    setInput(text);
                    store(text, support);
                  }}
                />
                <Button
                  label="Check recall"
                  busy={busy}
                  disabled={!input.trim()}
                  onPress={() =>
                    act(async () => {
                      time.interact();
                      await reviews.submit(
                        question,
                        input,
                        support,
                        false,
                        run.id,
                      );
                    })
                  }
                />
                <Button
                  label="I don't know"
                  secondary
                  disabled={busy}
                  onPress={() =>
                    act(async () => {
                      time.interact();
                      await reviews.submit(question, "", support, true, run.id);
                    })
                  }
                />
                <Button
                  label={
                    support.includes("testedAnswer")
                      ? "Answer help shown"
                      : "Show a hint"
                  }
                  secondary
                  disabled={busy || support.includes("testedAnswer")}
                  onPress={() => {
                    time.interact();
                    const flags = [...support, "testedAnswer" as const];
                    setSupport(flags);
                    store(input, flags);
                  }}
                />
                {support.includes("testedAnswer") && (
                  <Body>
                    {track.card.exercise.hints[0] ??
                      track.card.exercise.expected}{" "}
                    · Using help is assisted practice.
                  </Body>
                )}
              </>
            ) : (
              <>
                <Title>
                  {receipt?.assessment.outcome === "independent"
                    ? "Recalled."
                    : receipt?.assessment.outcome === "assisted"
                      ? "Recalled with support."
                      : receipt?.assessment.outcome === "pending"
                        ? "Awaiting feedback."
                        : receipt?.assessment.outcome === "validAlternative"
                          ? "A useful alternative."
                          : "Let's bring this back."}
                </Title>
                <Body>
                  Your answer:{" "}
                  {savedAttempt.dontKnow ? "I don't know" : savedAttempt.input}
                </Body>
                <Body>
                  {track.card.exercise.kind === "sentence"
                    ? "Examples"
                    : "Expected"}
                  : {track.card.exercise.expected}
                </Body>
                <Body>
                  {receipt?.assessment.explanation ??
                    "Saved on this phone; review feedback is loading."}
                </Body>
                {track.card.exercise.kind === "sentence" && (
                  <ReviewFeedback
                    key={question.eventId}
                    eventId={question.eventId}
                  />
                )}
                {track.card.facet === "reading" &&
                  receipt?.assessment.inputScript === "romaji" && (
                    <Body muted>
                      This recalls the reading. Kana literacy is assessed
                      separately.
                    </Body>
                  )}
                {receipt?.status === "stale-practice" && (
                  <Body muted>
                    Your study was saved. Another device already resolved this
                    review, so this answer counts as extra practice.
                  </Body>
                )}
                {reviews.provisional.has(track.id) && (
                  <Body muted>
                    Saved offline or awaiting synchronization. This schedule is
                    provisional.
                  </Body>
                )}
                <Button label="Next review" busy={busy} onPress={next} />
              </>
            )}
          </Panel>
          <Button
            label="Save my review place"
            secondary
            disabled={busy}
            onPress={() => {
              time.pause();
              act(async () => {
                if (run) await reviews.saveRun({ ...run, input, support });
              });
            }}
          />
        </>
      ) : (
        <>
          {done && (
            <Panel>
              <Title>Practice saved.</Title>
              <Body>
                {run?.questions.length} review{" "}
                {run?.questions.length === 1 ? "attempt is" : "attempts are"}{" "}
                retained, including mistakes and supported answers. Mastery
                grows over later reviews.
              </Body>
              <Button
                label="Back to review queue"
                onPress={() => act(() => reviews.saveRun(null))}
              />
            </Panel>
          )}
          <Panel>
            <Title>
              {due.length
                ? `${due.length} ${due.length === 1 ? "review" : "reviews"} ready`
                : reviews.tracks.length
                  ? "You're ready for the next return."
                  : "Begin learning to build your queue"}
            </Title>
            <Body>
              {reviews.tracks.length
                ? `${reviews.tracks.length} review ${reviews.tracks.length === 1 ? "card" : "cards"}. Meanings, word readings, kana and grammar are practised separately. ${reviews.tracks.filter((t) => hasStrongRecall(t, Date.now())).length} with strong recall through spaced practice.`
                : "Finish a few lesson exercises or save a checked phrase. Word and kana reviews begin after four hours; grammar follows after a day."}
            </Body>
            {due.length > 0 && !done && (
              <Button label="Start review" onPress={() => start(false)} />
            )}
            {reviews.tracks.length > 0 && !done && (
              <Button
                label="Extra practice"
                secondary
                onPress={() => start(true)}
              />
            )}
            {reviews.tracks.length > 0 && (
              <Body muted>
                Prepared text cards work offline. Up to eight due questions per
                session; remaining reviews stay due.
              </Body>
            )}
            {reviews.provisional.size > 0 && (
              <Body muted>
                Some review schedules are provisional until synchronized.
              </Body>
            )}
          </Panel>
          {reviews.tracks.length > 0 && (
            <Panel>
              <Title>Upcoming returns</Title>
              {[...reviews.tracks]
                .sort((a, b) => a.dueAt - b.dueAt)
                .slice(0, 8)
                .map((item) => (
                  <Body key={item.id}>
                    {item.card.label} · {item.card.facet} ·{" "}
                    {item.dueAt <= Date.now()
                      ? "Due now"
                      : new Date(item.dueAt).toLocaleString()}
                  </Body>
                ))}
            </Panel>
          )}
        </>
      )}
      {stale > 0 && (
        <Panel>
          <Body>
            Your study was saved. The review schedule changed on another device;{" "}
            {stale} {stale === 1 ? "attempt counts" : "attempts count"} as extra
            practice. Earned progress is retained.
          </Body>
        </Panel>
      )}
      {(reviews.pending > 0 || reviews.error || error) && (
        <Panel>
          <Body>
            {error ||
              reviews.error ||
              `${reviews.pending} attempts saved on this phone, awaiting synchronized schedules.`}
          </Body>
          <Button
            label="Retry review synchronization"
            secondary
            onPress={reviews.retry}
          />
        </Panel>
      )}
      {(!run || done) && (
        <SentenceFeedbackHistory
          practise={(trackId) =>
            act(async () => {
              const target = reviews.tracks.find(
                (track) => track.id === trackId,
              );
              if (!target) return;
              const question = makeQuestion(target, true, true);
              if (question)
                await reviews.saveRun({
                  id: Crypto.randomUUID(),
                  questions: [question],
                  index: 0,
                  input: "",
                  support: [],
                });
            })
          }
        />
      )}
    </Screen>
  );
}
