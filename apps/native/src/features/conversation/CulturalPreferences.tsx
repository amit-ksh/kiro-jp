import { useState } from "react";
import {
  useQuery,
  useMutation,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Panel, Title } from "../../components/ui";
export function CulturalPreferences() {
  const { isAuthenticated } = useConvexAuth(),
    connection = useConvexConnectionState();
  const favorites = useQuery(api.culture.list, isAuthenticated ? {} : "skip"),
    remove = useMutation(api.culture.removeFavorite);
  const { profile, update } = useProfile(),
    study = useStudy();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const names = new Map(
    Object.values(study.chats).flatMap((chat) =>
      chat.messages.flatMap(
        (message) =>
          message.culture?.recommendations.map(
            (item) => [item.entity.id, item.entity.name] as const,
          ) ?? [],
      ),
    ),
  );
  return (
    <Panel>
      <Title>Cultural preferences</Title>
      <Body>
        Your confirmed favorites help distinguish names. A new chat topic still
        takes priority.
      </Body>
      {!connection.isWebSocketConnected && (
        <Body>Connect to view or change confirmed favorites.</Body>
      )}
      {favorites?.map((favorite) => (
        <Button
          key={favorite._id}
          label={`Remove favorite: ${favorite.entity.name}`}
          secondary
          busy={busy === favorite._id}
          disabled={!!busy || !connection.isWebSocketConnected}
          onPress={() => {
            setBusy(favorite._id);
            setError("");
            void remove({ id: favorite._id })
              .catch(() =>
                setError(
                  "This favorite couldn't be removed. Try again when connected.",
                ),
              )
              .finally(() => setBusy(""));
          }}
        />
      ))}
      {favorites?.length === 0 && (
        <Body muted>
          Specific favorites you confirm in chat will appear here.
        </Body>
      )}
      {profile.dislikes.map((id) => (
        <Button
          key={id}
          label={`Allow again: ${names.get(id) ?? "saved cultural suggestion"}`}
          secondary
          disabled={!!busy}
          onPress={() => {
            setBusy(id);
            setError("");
            void update((current) => ({
              dislikes: current.dislikes.filter((item) => item !== id),
            }))
              .catch(() =>
                setError(
                  "This preference couldn't be saved. Please try again.",
                ),
              )
              .finally(() => setBusy(""));
          }}
        />
      ))}
      {error && <Body>{error}</Body>}
    </Panel>
  );
}
