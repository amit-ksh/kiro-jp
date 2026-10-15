import { useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";
import {
  useAction,
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { Body, Button, Field, Message, Title } from "../../components/ui";

const errors = {
  "invalid-token":
    "That token could not be used. Check your WaniKani token and try again.",
  "rate-limited":
    "WaniKani is limiting requests. Wait a minute, then try again.",
  "invalid-response":
    "The import was incomplete. Your previous import is retained. Try again later.",
  unavailable:
    "WaniKani could not be reached. Your previous import is retained. Try again when connected.",
  busy: "An import is already running or just finished. Wait a moment before retrying.",
  superseded:
    "This import was replaced or removed. Your latest choice is retained.",
};
export function WaniKaniImport({ onContinue }: { onContinue?: () => void }) {
  const { isAuthenticated } = useConvexAuth(),
    connection = useConvexConnectionState();
  const saved = useQuery(api.imports.get, isAuthenticated ? {} : "skip");
  const run = useAction(api.imports.run),
    clear = useMutation(api.imports.clear);
  const [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") setToken("");
    });
    return () => listener.remove();
  }, []);
  const online = isAuthenticated && connection.isWebSocketConnected;
  const blocked = busy || saved?.status === "running";
  const start = async () => {
    if (running.current || !online) return;
    running.current = true;
    const supplied = token.trim();
    setToken("");
    setBusy(true);
    setError("");
    setRemoving(false);
    try {
      const result = await run({ token: supplied });
      if (!result.ok) setError(errors[result.code ?? "unavailable"]);
    } catch {
      setError(errors.unavailable);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Title>WaniKani familiarity</Title>
      <Body>
        Import familiar kanji and vocabulary to help the tutor choose useful
        words. Grammar, listening and speaking are assessed separately.
      </Body>
      {saved?.snapshot && (
        <>
          <Body>
            {saved.snapshot.items.length} matching items imported ·{" "}
            {new Date(saved.snapshot.importedAt).toLocaleDateString()}
          </Body>
          <Body muted>
            WaniKani access covers levels 1–{saved.snapshot.maxLevelGranted}.
            Only items in this app&apos;s checked starter lessons are matched.
            This does not award mastery or skip reviews.
          </Body>
          {saved.snapshot.items.length > 0 && (
            <Body>
              {saved.snapshot.items
                .slice(0, 12)
                .map((item) => item.characters)
                .join(" · ")}
              {saved.snapshot.items.length > 12 ? " …" : ""}
            </Body>
          )}
        </>
      )}
      {!online && (
        <Body muted>
          Connect to import or remove familiarity. You can continue studying
          without an import.
        </Body>
      )}
      {online && (
        <>
          <Body muted>
            Use a personal access token with read-only access. It is used for
            this import and is not saved by the app. No reviews are written back
            to WaniKani.
          </Body>
          <Button
            label="Open WaniKani token settings"
            secondary
            onPress={() =>
              void Linking.openURL(
                "https://www.wanikani.com/settings/personal_access_tokens",
              ).catch(() =>
                setError(
                  "Open your WaniKani account settings to create a read-only personal access token.",
                ),
              )
            }
          />
          <Field
            label="Read-only WaniKani token"
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={200}
            editable={!blocked}
          />
          <Button
            label={
              saved?.snapshot ? "Refresh familiarity" : "Import familiarity"
            }
            busy={blocked}
            disabled={!token.trim()}
            onPress={() => void start()}
          />
        </>
      )}
      {saved?.status === "unavailable" && !error && (
        <Message>{errors[saved.errorCode ?? "unavailable"]}</Message>
      )}
      {error && <Message>{error}</Message>}
      {saved?.snapshot && (
        <>
          {onContinue && (
            <Button
              label="Continue with this import"
              disabled={blocked}
              onPress={onContinue}
            />
          )}
          {removing ? (
            <>
              <Body>
                Remove the imported familiarity? Your lessons and review history
                stay saved.
              </Body>
              <Button
                label="Confirm removal"
                secondary
                disabled={!online || blocked}
                onPress={() => {
                  setToken("");
                  setBusy(true);
                  setError("");
                  void clear({})
                    .then(() => setRemoving(false))
                    .catch(() =>
                      setError(
                        "The import could not be removed. Connect and try again.",
                      ),
                    )
                    .finally(() => setBusy(false));
                }}
              />
              <Button
                label="Keep my import"
                secondary
                onPress={() => setRemoving(false)}
              />
            </>
          ) : (
            <Button
              label="Remove imported familiarity"
              secondary
              disabled={!online || blocked}
              onPress={() => setRemoving(true)}
            />
          )}
        </>
      )}
    </>
  );
}
