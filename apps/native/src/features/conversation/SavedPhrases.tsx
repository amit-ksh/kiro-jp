import { useState } from "react";
import { useMutation, useConvexConnectionState } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useStudy } from "../../data/StudyProvider";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button, Panel, Title } from "../../components/ui";
export function SavedPhrases({ sourceIds }: { sourceIds?: string[] }) {
  const study = useStudy(),
    { profile } = useProfile(),
    connection = useConvexConnectionState(),
    retry = useMutation(api.references.retry);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const items = study.phrases.filter(
    (item) =>
      !sourceIds || item.sourceMessageIds.some((id) => sourceIds.includes(id)),
  );
  return (
    <>
      {items.map((item) => (
        <Panel key={item._id}>
          <Title>{item.phrase.japanese}</Title>
          {profile.furigana && <Body>{item.phrase.reading}</Body>}
          {profile.romaji && <Body muted>{item.phrase.romaji}</Body>}
          {profile.translations && <Body>{item.phrase.english}</Body>}
          <Body>
            {item.status === "approved"
              ? "Language checked"
              : item.status === "needsRevision"
                ? "Needs a correction · reference only"
                : "Awaiting feedback · saved as a reference"}
          </Body>
          <Body muted>
            {item.feedback} Model audio is unavailable for this phrase.
          </Body>
          {(item.status === "unavailable" || item.canRecheckRomaji) && (
            <Button
              label={
                item.canRecheckRomaji
                  ? "Recheck with kana-based romaji"
                  : "Retry phrase check"
              }
              secondary
              busy={busy === item._id}
              disabled={!connection.isWebSocketConnected || item.attempt >= 3}
              onPress={() => {
                setBusy(item._id);
                setError("");
                void retry({ phraseId: item._id })
                  .catch(() =>
                    setError(
                      "The check is unavailable. Your phrase remains saved.",
                    ),
                  )
                  .finally(() => setBusy(""));
              }}
            />
          )}
        </Panel>
      ))}
      {error && (
        <Panel>
          <Body>{error}</Body>
        </Panel>
      )}
      {!items.length && (
        <Panel>
          <Body>
            Save a useful phrase or correction from your conversation to keep it
            here. Only checked phrases become review cards.
          </Body>
        </Panel>
      )}
    </>
  );
}
