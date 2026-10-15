import { useEffect, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { api } from "@packages/backend/convex/_generated/api";
import { strongestGoal } from "@packages/learning-core";
import { curriculum } from "@packages/content";
import { useStudy } from "../../data/StudyProvider";
import { Body, Button, Message } from "../../components/ui";
export function LessonConversation({
  sessionId,
  theme,
}: {
  sessionId: string;
  theme: string;
}) {
  const auth = useConvexAuth(),
    connection = useConvexConnectionState(),
    study = useStudy();
  const lesson = curriculum.forSession(study.events,sessionId);
  const goal = useQuery(
    api.conversation.lessonGoal,
    auth.isAuthenticated ? { sessionId } : "skip",
  );
  const existing = useQuery(
    api.conversation.forLesson,
    auth.isAuthenticated ? { sessionId } : "skip",
  );
  const cached = Object.values(study.chats).filter((chat) =>
    chat.segments.some((segment) => segment.lessonSessionId === sessionId),
  );
  const savedId =
    existing ??
    cached.sort(
      (a, b) => b.conversation.updatedAt - a.conversation.updatedAt,
    )[0]?.conversation._id;
  const state =
    goal?.state ??
    strongestGoal(
      cached.flatMap((chat) => [
        ...chat.messages.flatMap((message) =>
          message.goal ? [message.goal] : [],
        ),
        ...(chat.lessonGoals ?? [])
          .filter((goal) => goal.sessionId === sessionId)
          .map((goal) => ({
            state: goal.state,
            messageId: "saved-goal",
            meaningful: false,
            explanation: "Previously accepted evidence.",
          })),
      ]),
    );
  const start = useMutation(api.conversation.start),
    ids = useRef({
      clientId: Crypto.randomUUID(),
      segmentId: Crypto.randomUUID(),
    });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const begin = async () => {
    if (savedId) {
      router.push({
        pathname: "/(learning)/chat",
        params: { conversationId: savedId },
      });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await start({
        ...ids.current,
        topic: `Let's talk about ${theme.toLowerCase()}. Help me use ${lesson?.grammar.pattern ?? "today's grammar pattern"} naturally when it fits.`,
        lessonSessionId: sessionId,
      });
      if (active.current) {
        ids.current = {
          clientId: Crypto.randomUUID(),
          segmentId: Crypto.randomUUID(),
        };
        router.push({
          pathname: "/(learning)/chat",
          params: { conversationId: result.conversationId },
        });
      }
    } catch {
      if (active.current)
        setError(
          "Your lesson is saved. Reconnect and synchronize it, then retry the conversation.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <>
      <Body>
        Conversation goal:{" "}
        {state === "independent"
          ? "demonstrated independently"
          : state === "assisted"
            ? "practised with support"
            : state === "awaitingAssessment"
              ? "awaiting assessment"
              : "not yet practised"}
        . Chat completion and mastery remain separate.
      </Body>
      <Button
        label="Open my lesson conversation"
        busy={busy}
        disabled={!connection.isWebSocketConnected && !savedId}
        onPress={() => void begin()}
      />
      {!connection.isWebSocketConnected && (
        <Body>
          Connect when ready for conversation; your text lesson and reference
          remain available offline.
        </Body>
      )}
      {error && <Message>{error}</Message>}
    </>
  );
}
