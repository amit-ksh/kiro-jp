import { useState } from "react";
import { useReviews } from "../../data/ReviewProvider";
import { useStudyTime } from "../lessons/useStudyTime";
import { ReviewFeedback } from "./ReviewFeedback";
import { Body, Button, Panel, Title } from "../../components/ui";

function SentenceResult({
  eventId,
  practise,
}: {
  eventId: string;
  practise: (trackId: string) => void;
}) {
  const reviews = useReviews(),
    event = reviews.attempts.find((event) => event.eventId === eventId),
    receipt = reviews.receipts.get(eventId);
  const [expanded, setExpanded] = useState(false);
  const time = useStudyTime(
    event?.sessionId ?? "feedback-preview",
    event?.trackId ?? "feedback-preview",
    "reviewActivity",
  );
  if (!event || !receipt) return null;
  const status =
    receipt.assessment.outcome === "pending"
      ? "Awaiting feedback"
      : receipt.assessment.outcome === "independent" ||
          receipt.assessment.outcome === "assisted"
        ? "Pattern used"
        : receipt.assessment.outcome === "validAlternative"
          ? "Another useful pattern"
          : "Needs practice";
  return (
    <Panel>
      <Body muted>
        {event.localDay} · {status}
      </Body>
      <Body>{event.dontKnow ? "I don't know" : event.input}</Body>
      <Button
        label={expanded ? "Hide sentence feedback" : "Read sentence feedback"}
        secondary
        onPress={() => {
          if (expanded) time.pause();
          else time.interact();
          setExpanded((value) => !value);
        }}
      />
      {expanded && (
        <>
          <Body>{receipt.assessment.explanation}</Body>
          <ReviewFeedback eventId={eventId} />
          <Button
            label="Practise this pattern"
            secondary
            onPress={() => {
              time.pause();
              practise(event.trackId);
            }}
          />
        </>
      )}
    </Panel>
  );
}
export function SentenceFeedbackHistory({
  practise,
}: {
  practise: (trackId: string) => void;
}) {
  const reviews = useReviews(),
    [limit, setLimit] = useState(5);
  const history = reviews.attempts
    .filter((event) =>
      reviews.tracks.some(
        (track) =>
          track.id === event.trackId && track.card.exercise.kind === "sentence",
      ),
    )
    .sort((a, b) => b.occurredAt - a.occurredAt || b.sequence - a.sequence);
  if (!history.length) return null;
  return (
    <>
      <Panel>
        <Title>Your sentence feedback</Title>
        <Body>
          Saved answers stay here when feedback arrives after you finish a
          review session.
        </Body>
      </Panel>
      {history.slice(0, limit).map((event) => (
        <SentenceResult
          key={event.eventId}
          eventId={event.eventId}
          practise={practise}
        />
      ))}
      {history.length > limit && (
        <Button
          label="Show earlier sentence feedback"
          secondary
          onPress={() => setLimit((count) => count + 5)}
        />
      )}
    </>
  );
}
