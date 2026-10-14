import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useConvexConnectionState } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { requestsLesson } from "@packages/content";
import { assessFixed, exerciseForStep } from "@packages/learning-core";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Panel, Title } from "../../components/ui";
import { View } from "react-native";
import { useStudyTime } from "./useStudyTime";
export function SentenceFeedback({ sessionId }: { sessionId: string }) {
  const study = useStudy(),
    connection = useConvexConnectionState(),
    request = useMutation(api.assessment.request);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const timing = useStudyTime(
    sessionId,
    requestsLesson.exercises.find((exercise) => exercise.kind === "sentence")!
      .id,
  );
  const requested = useRef(new Set<string>());
  const attempts = useMemo(
    () =>
      study.events.filter(
        (event) =>
          event.sessionId === sessionId &&
          event.kind === "attempted" &&
          exerciseForStep(requestsLesson, event.stepId)?.kind === "sentence" &&
          assessFixed(
            exerciseForStep(requestsLesson, event.stepId)!,
            event.input ?? "",
            event.support,
            event.dontKnow,
          ).outcome === "pending",
      ),
    [study.events, sessionId],
  );
  useEffect(() => {
    if (!connection.isWebSocketConnected || study.pending > 0) return;
    const candidate = attempts.find(
      (event) =>
        !study.sentenceFeedback[event.eventId] &&
        !requested.current.has(event.eventId),
    );
    if (!candidate) return;
    requested.current.add(candidate.eventId);
    void request({ eventId: candidate.eventId }).catch(() =>
      setError(
        "Your sentence remains saved. Feedback is unavailable; retry when ready.",
      ),
    );
  }, [
    attempts,
    connection.isWebSocketConnected,
    study.pending,
    study.sentenceFeedback,
    request,
  ]);
  return (
    <View onTouchStart={timing.interact}>
      {attempts.map((event) => {
        const row = study.sentenceFeedback[event.eventId],
          assessment = study.checked[event.eventId];
        return (
          <Panel key={event.eventId}>
            <Title>Your own sentence</Title>
            <Body>{event.input}</Body>
            <Body>
              {assessment?.explanation ??
                row?.assessment?.explanation ??
                "Awaiting feedback. Your answer and study time are saved."}
            </Body>
            {row?.corrected && (
              <>
                <Body>
                  {assessment?.outcome === "incorrect"
                    ? "Suggested correction"
                    : "Japanese version"}
                  : {row.corrected.japanese}
                </Body>
                <Body>{row.corrected.reading}</Body>
                <Body>{row.corrected.english}</Body>
                <Body muted>
                  Generated language feedback; speaking was not assessed.
                </Body>
              </>
            )}
            {!assessment && (
              <Button
                label={
                  row?.status === "queued" || row?.status === "running"
                    ? "Feedback is being prepared"
                    : "Check my sentence"
                }
                secondary
                busy={busy === event.eventId}
                disabled={
                  !connection.isWebSocketConnected ||
                  Boolean(
                    row &&
                    (row.status === "queued" || row.status === "running") &&
                    Date.now() - row.updatedAt < 90_000,
                  ) ||
                  (row?.attempt ?? 0) >= 3
                }
                onPress={() => {
                  setBusy(event.eventId);
                  setError("");
                  void request({ eventId: event.eventId })
                    .catch(() =>
                      setError(
                        "Synchronize your saved answer, then retry. A service failure is not a wrong answer.",
                      ),
                    )
                    .finally(() => setBusy(""));
                }}
              />
            )}
          </Panel>
        );
      })}
      {error && (
        <Panel>
          <Body>{error}</Body>
        </Panel>
      )}
    </View>
  );
}
