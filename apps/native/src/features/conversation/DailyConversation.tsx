import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  useConvexAuth,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { localDayAt } from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Message, Panel, useColors } from "../../components/ui";
import { ActionRow, SectionTitle } from "../../components/dashboard";

export function DailyConversation() {
  const { profile, syncState, update } = useProfile(),
    study = useStudy(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState(),
    colors = useColors();
  const [now, setNow] = useState(Date.now),
    [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true),
    requested = useRef("");
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      active.current = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const day = localDayAt(now, new Date(now).getTimezoneOffset()),
    offsetMinutes = new Date(now).getTimezoneOffset();
  const connected = auth.isAuthenticated && connection.isWebSocketConnected;
  const daily = useQuery(
    api.dailyConversations.get,
    auth.isAuthenticated ? { day, offsetMinutes } : "skip",
  );
  const request = useMutation(api.dailyConversations.request),
    start = useMutation(api.conversation.start);
  const hasInterests = Boolean(
    profile.interests.length || profile.favorites.length,
  );
  useEffect(() => {
    if (
      !connected ||
      syncState !== "saved" ||
      daily?.status !== "needed" ||
      !hasInterests
    )
      return;
    const key = `${day}:${daily.contextKey}`;
    if (requested.current === key) return;
    requested.current = key;
    void request({ day, offsetMinutes }).catch(() => {
      if (active.current)
        setError("Suggestions couldn't load. Try again when you're connected.");
    });
  }, [connected, syncState, daily, day, offsetMinutes, hasInterests, request]);
  const suggestion =
    syncState === "saved" && daily?.status === "ready"
      ? daily.suggestion
      : undefined;
  const begin = async () => {
    if (!suggestion || !connected || busy) return;
    setBusy(true);
    setError("");
    try {
      const key = `daily-conversation-${day}`;
      let intent = {
        clientId: Crypto.randomUUID(),
        segmentId: Crypto.randomUUID(),
        topic: suggestion.topic,
      };
      try {
        const saved = JSON.parse(
          study.drafts[`${key}:chat-pending`] ?? "null",
        ) as typeof intent | null;
        if (saved?.topic === intent.topic) intent = saved;
      } catch {
        /* Keep a fresh stable request. */
      }
      await study.saveDraft(key, "chat-pending", JSON.stringify(intent));
      const result = await start(intent);
      await study.saveDraft(key, "chat-pending", "");
      if (active.current)
        router.push({
          pathname: "/(learning)/chat",
          params: { conversationId: result.conversationId },
        });
    } catch {
      if (active.current)
        setError("Couldn't start the chat. Try again; your request is saved.");
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <Panel style={{ padding: 20, gap: 12 }}>
      <SectionTitle>Today’s conversation</SectionTitle>
      {suggestion ? (
        <>
          <Body style={{ fontWeight: "700" }}>{suggestion.title}</Body>
          <Body muted>Inspired by {suggestion.interest}</Body>
          <Button
            label="Start chat"
            secondary
            disabled={!connected || busy}
            busy={busy}
            onPress={() => void begin()}
          />
          {!connected && <Body muted>Connect to start this chat.</Body>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={{ minHeight: 48, justifyContent: "center" }}
          >
            <Body style={{ color: colors.primary, fontWeight: "700" }}>
              {expanded ? "Hide details" : "Why this topic?"}
            </Body>
          </Pressable>
          {expanded && (
            <View style={{ gap: 8 }}>
              <Body muted>
                Qloo · {suggestion.inputs.join(", ")}. Checked{" "}
                {new Date(suggestion.checkedAt).toLocaleDateString()}.
              </Body>
              <Button
                label="Not interested"
                secondary
                disabled={busy || !connected}
                onPress={() =>
                  void update({
                    dislikes: [
                      ...new Set([...profile.dislikes, suggestion.entity.id]),
                    ],
                  }).catch(() =>
                    setError(
                      "Couldn't save that preference. Please try again.",
                    ),
                  )
                }
              />
              <ActionRow
                label="Edit interests"
                onPress={() => router.push("/(learning)/settings")}
              />
            </View>
          )}
        </>
      ) : (
        <>
          <Body muted>
            {!hasInterests
              ? "Choose interests for daily conversation ideas."
              : !connected
                ? "Connect for today's suggestion."
                : daily?.status === "unavailable"
                  ? "No suggestion available right now."
                  : "Finding a topic for you…"}
          </Body>
          <ActionRow
            label={hasInterests ? "Choose your own topic" : "Choose interests"}
            onPress={() =>
              router.push(
                hasInterests
                  ? "/(learning)/(tabs)/conversation"
                  : "/(learning)/settings",
              )
            }
          />
          {hasInterests &&
            connected &&
            (((daily?.status === "unavailable" ||
              daily?.status === "pending") &&
              "updatedAt" in daily &&
              now - daily.updatedAt >= 120_000) ||
              Boolean(error)) &&
            (daily?.attempts ?? 0) < 6 && (
              <Button
                label="Retry suggestion"
                secondary
                onPress={() => {
                  setError("");
                  void request({ day, offsetMinutes }).catch(() =>
                    setError("Suggestions couldn't load. Please try again."),
                  );
                }}
              />
            )}
        </>
      )}
      {error && <Message>{error}</Message>}
    </Panel>
  );
}
