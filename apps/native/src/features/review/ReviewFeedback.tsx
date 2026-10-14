import { useState } from "react";
import { useReviews } from "../../data/ReviewProvider";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button } from "../../components/ui";
export function ReviewFeedback({ eventId }: { eventId: string }) {
  const { profile } = useProfile();
  const reviews = useReviews(),
    receipt = reviews.receipts.get(eventId),
    feedback = receipt?.feedback;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!receipt) return null;
  const pending = receipt.assessment.outcome === "pending",
    expired =
      feedback?.status === "queued"
        ? Date.now() - feedback.updatedAt >= 90000
        : feedback?.status === "running" &&
          (feedback.leaseUntil ?? 0) <= Date.now();
  const canRetry =
    pending &&
    (!feedback || feedback.status === "unavailable" || expired) &&
    (feedback?.attempt ?? 0) < 3;
  if (!pending && !feedback && receipt.status !== "awaiting-parent")
    return null;
  return (
    <>
      {pending && (
        <Body muted>
          {feedback?.status === "unavailable" || expired
            ? "Sentence feedback is unavailable. Your answer and previous review schedule are saved."
            : feedback?.status === "queued" || feedback?.status === "running"
              ? "Checking your saved sentence. You can continue reviewing while feedback arrives."
              : reviews.online
                ? "Your sentence is saved and awaiting feedback."
                : "Connect for sentence feedback. Your draft and earlier work are saved."}
        </Body>
      )}
      {receipt.status === "awaiting-parent" && (
        <Body muted>
          Your answer is saved. Its review schedule is waiting for an earlier
          offline review to synchronize.
        </Body>
      )}
      {canRetry && (
        <Button
          label={
            feedback ? "Retry sentence feedback" : "Check my saved sentence"
          }
          secondary
          busy={busy}
          disabled={!reviews.online}
          onPress={() => {
            setBusy(true);
            setError("");
            void reviews
              .requestFeedback(eventId)
              .catch(() =>
                setError(
                  "Feedback couldn't start. Keep studying and try again later.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        />
      )}
      {pending &&
        (feedback?.attempt ?? 0) >= 3 &&
        (feedback?.status === "unavailable" || expired) && (
          <Body muted>
            This answer reached its feedback retry limit. It stays saved without
            a new grade; continue with prepared examples or another exercise.
          </Body>
        )}
      {feedback?.corrected && (
        <>
          <Body>
            {receipt.assessment.inputScript === "romaji"
              ? "Japanese version:"
              : "Suggested phrase:"}{" "}
            {feedback.corrected.japanese}
          </Body>
          {profile.furigana && <Body>{feedback.corrected.reading}</Body>}
          {profile.romaji && <Body>{feedback.corrected.romaji}</Body>}
          {profile.translations && <Body>{feedback.corrected.english}</Body>}
          <Body muted>
            Generated sentence feedback. Kana literacy and speaking are assessed
            separately.
          </Body>
        </>
      )}
      {error && <Body>{error}</Body>}
    </>
  );
}
