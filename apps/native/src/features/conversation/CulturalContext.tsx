import { useState } from "react";
import { View } from "react-native";
import { useMutation, useConvexConnectionState } from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import type { CachedChat } from "../../data/StudyProvider";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button, Title } from "../../components/ui";
export function CulturalContext({
  message,
  onTopic,
  canDiscuss,
}: {
  message: CachedChat["messages"][number];
  onTopic: (topic: string) => void;
  canDiscuss: boolean;
}) {
  const { profile, update, syncState } = useProfile(),
    connection = useConvexConnectionState();
  const select = useMutation(api.culture.selectFavorite);
  const [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const context = message.culture;
  if (
    !context ||
    (!context.candidates.length && !context.recommendations.length)
  )
    return null;
  return (
    <View style={{ gap: 12 }}>
      {context.candidates.map((candidate) => (
        <View key={`${candidate.type}:${candidate.query}`} style={{ gap: 8 }}>
          <Title>Which {candidate.query}?</Title>
          <Body>
            Qloo found more than one match. Choose your favorite, or keep
            talking without choosing.
          </Body>
          {candidate.items.map((entity) => (
            <View key={entity.id} style={{ gap: 6 }}>
              <Body>{entity.name}</Body>
              {entity.disambiguation && (
                <Body muted>{entity.disambiguation}</Body>
              )}
              {entity.description && <Body muted>{entity.description}</Body>}
              <Button
                label={
                  message.culturalChoices?.some(
                    (choice) =>
                      choice.query === candidate.query &&
                      choice.entityId === entity.id,
                  )
                    ? `Previously chosen: ${entity.name}`
                    : `Choose ${entity.name}`
                }
                secondary
                busy={busy === entity.id}
                disabled={!!busy || !connection.isWebSocketConnected}
                onPress={() => {
                  setBusy(entity.id);
                  setNotice("");
                  void select({
                    messageId: message.messageId,
                    query: candidate.query,
                    entityId: entity.id,
                  })
                    .then((result) =>
                      setNotice(
                        `Selected ${result.name}. Your next reply can use this favorite for suggestions.`,
                      ),
                    )
                    .catch(() =>
                      setNotice(
                        "The choice couldn't be saved. Keep talking or try again when connected.",
                      ),
                    )
                    .finally(() => setBusy(""));
                }}
              />
            </View>
          ))}
        </View>
      ))}
      {context.recommendations.map(({ entity, inputs, checkedAt }) => {
        const disliked =
          profile.dislikes.includes(entity.id) ||
          profile.dislikes.some(
            (value) => value.toLowerCase() === entity.name.toLowerCase(),
          );
        return (
          <View key={entity.id} style={{ gap: 8 }}>
            <Title>{entity.name}</Title>
            <Body muted>
              Suggested by Qloo from {inputs.join(", ")}. Checked{" "}
              {new Date(checkedAt).toLocaleDateString()}.
            </Body>
            {entity.description && <Body>{entity.description}</Body>}
            {disliked ? (
              <Body>
                You disliked this suggestion. It will be excluded from new
                recommendations.
              </Body>
            ) : (
              <>
                <Button
                  label={`Talk about ${entity.name}`}
                  secondary
                  disabled={!!busy || !canDiscuss}
                  onPress={() => onTopic(`Let's talk about ${entity.name}.`)}
                />
                <Button
                  label={`Dislike ${entity.name}`}
                  secondary
                  disabled={!!busy || profile.dislikes.length >= 100}
                  onPress={() => {
                    setBusy(entity.id);
                    setNotice("");
                    void update((current) => ({
                      dislikes: [...new Set([...current.dislikes, entity.id])],
                    }))
                      .then(() =>
                        setNotice(
                          "Dislike saved on this phone. It will apply online after synchronization.",
                        ),
                      )
                      .catch(() =>
                        setNotice(
                          "The dislike couldn't be saved. Please try again.",
                        ),
                      )
                      .finally(() => setBusy(""));
                  }}
                />
              </>
            )}
          </View>
        );
      })}
      {notice && <Body>{notice}</Body>}
      {syncState === "conflict" && (
        <Body>
          Preferences changed on another device. Open Home to review the saved
          changes before new suggestions.
        </Body>
      )}
    </View>
  );
}
