import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  useMutation,
  useQuery,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useProfile } from "../../../data/ProfileProvider";
import { useStudy } from "../../../data/StudyProvider";
import {
  Body,
  Button,
  Field,
  Message,
  Panel,
  Screen,
  Title,
} from "../../../components/ui";
export default function Conversation() {
  const { profile } = useProfile(),
    study = useStudy(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const list = useQuery(
      api.conversation.list,
      auth.isAuthenticated ? {} : "skip",
    ),
    start = useMutation(api.conversation.start);
  const [topic, setTopic] = useState(
      study.drafts["conversation-create:topic"] ?? "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ids = useRef({
    clientId: Crypto.randomUUID(),
    segmentId: Crypto.randomUUID(),
  });
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const begin = async () => {
    setBusy(true);
    setError("");
    try {
      let intent = { ...ids.current, topic };
      try {
        const saved = JSON.parse(
          study.drafts["conversation-create:chat-pending"] ?? "null",
        ) as typeof intent | null;
        if (saved?.topic === topic) intent = saved;
      } catch {
        /* Keep the visible topic available. */
      }
      await study.saveDraft(
        "conversation-create",
        "chat-pending",
        JSON.stringify(intent),
      );
      const result = await start(intent);
      await study.saveDraft("conversation-create", "chat-pending", "");
      if (!active.current) return;
      router.push({
        pathname: "/(learning)/chat",
        params: { conversationId: result.conversationId },
      });
      ids.current = {
        clientId: Crypto.randomUUID(),
        segmentId: Crypto.randomUUID(),
      };
    } catch {
      if (active.current)
        setError(
          "The conversation couldn't start. Your topic is saved; reconnect or try again later.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const available =
    list ??
    Object.values(study.chats)
      .map((chat) => chat.conversation)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Screen
      title="Talk about what you love."
      subtitle="One conversation. Your topic."
    >
      <Panel>
        <Title>What would you like to discuss?</Title>
        <Body>
          Type a topic, such as shrines or your favorite anime. Your topic takes
          priority over saved interests.
        </Body>
        <Field
          label="Conversation topic"
          value={topic}
          editable={!busy}
          maxLength={500}
          onChangeText={(value) => {
            setTopic(value);
            void study.saveDraft("conversation-create", "topic", value);
          }}
        />
        {profile.interests.map((interest) => (
          <Button
            key={interest}
            label={`Talk about ${interest}`}
            secondary
            onPress={() => {
              setTopic(`Let's talk about ${interest.toLowerCase()}.`);
              void study.saveDraft(
                "conversation-create",
                "topic",
                `Let's talk about ${interest.toLowerCase()}.`,
              );
            }}
          />
        ))}
        <Button
          label="Start conversation"
          busy={busy}
          disabled={!topic.trim() || !connection.isWebSocketConnected}
          onPress={() => void begin()}
        />
        {!connection.isWebSocketConnected && (
          <Body>
            Your draft is saved. New tutor replies need internet; available
            lessons and reviews can continue offline.
          </Body>
        )}
        {error && <Message>{error}</Message>}
      </Panel>
      <Button
        label="Saved conversation phrases"
        secondary
        onPress={() => router.push("/(learning)/saved-phrases")}
      />
      {available.map((chat) => (
        <Panel key={chat._id}>
          <Title>{chat.title}</Title>
          <Button
            label="Open saved conversation"
            secondary
            onPress={() =>
              router.push({
                pathname: "/(learning)/chat",
                params: { conversationId: chat._id },
              })
            }
          />
        </Panel>
      ))}
    </Screen>
  );
}
