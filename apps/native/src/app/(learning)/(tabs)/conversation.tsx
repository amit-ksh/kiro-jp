import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useMutation,
  usePaginatedQuery,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import { useProfile } from "../../../data/ProfileProvider";
import { useStudy } from "../../../data/StudyProvider";
import {
  ChatComposer,
  ChatIcon,
} from "../../../features/conversation/ChatControls";
import {
  Body,
  Button,
  Message,
  Screen,
  Title,
  useColors,
} from "../../../components/ui";
export default function Conversation() {
  const { profile } = useProfile(),
    study = useStudy(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState(),
    colors = useColors();
  const history = usePaginatedQuery(
      api.conversation.history,
      auth.isAuthenticated ? {} : "skip",
      { initialNumItems: 20 },
    ),
    start = useMutation(api.conversation.start);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [search, setSearch] = useState("");
  const topic = study.drafts["conversation-create:topic"] ?? "";
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
    if (busy || !topic.trim()) return;
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
        /* Preserve the visible draft. */
      }
      await study.saveDraft(
        "conversation-create",
        "chat-pending",
        JSON.stringify(intent),
      );
      const result = await start(intent);
      await study.saveDraft("conversation-create", "chat-pending", "");
      await study.saveDraft("conversation-create", "topic", "");
      if (!active.current) return;
      ids.current = {
        clientId: Crypto.randomUUID(),
        segmentId: Crypto.randomUUID(),
      };
      router.push({
        pathname: "/(learning)/chat",
        params: { conversationId: result.conversationId },
      });
    } catch {
      if (active.current)
        setError(
          "Couldn't start the chat. Your message is saved. Please try again.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const available =
    (connection.isWebSocketConnected && history.status !== "LoadingFirstPage"
      ? history.results
      : undefined) ??
    Object.values(study.chats)
      .map((chat) => chat.conversation)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  const filtered = available.filter((chat) =>
    chat.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const suggestions = [
    ...new Set([...profile.interests, ...profile.favorites]),
  ].slice(0, 4);
  return (
    <>
      <Screen
        chat
        title="Conversation"
        headerAside={
          <ChatIcon
            label="Chat history"
            icon="menu-outline"
            onPress={() => setHistoryOpen(true)}
          />
        }
        footer={
          <ChatComposer
            text={topic}
            onChange={(value) =>
              void study.saveDraft("conversation-create", "topic", value)
            }
            onSend={() => void begin()}
            busy={busy}
            sendDisabled={!topic.trim() || !connection.isWebSocketConnected}
            maxLength={500}
            inputLabel="Start a Japanese conversation"
            placeholder="What would you like to talk about?"
          />
        }
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            gap: 28,
            paddingHorizontal: 12,
            paddingVertical: 32,
          }}
        >
          <View style={{ gap: 10 }}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={36}
              color={colors.primary}
            />
            <Title>What would you like to talk about?</Title>
            <Body muted>Practise Japanese, one conversation at a time.</Body>
          </View>
          {suggestions.length > 0 && (
            <View style={{ gap: 8 }}>
              {suggestions.map((interest) => (
                <Pressable
                  key={interest}
                  accessibilityRole="button"
                  disabled={busy}
                  accessibilityLabel={`Talk about ${interest}`}
                  onPress={() =>
                    void study.saveDraft(
                      "conversation-create",
                      "topic",
                      `Let's talk about ${interest}.`,
                    )
                  }
                  style={({ pressed }) => ({
                    minHeight: 48,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Body style={{ flex: 1 }}>{interest}</Body>
                  <Ionicons
                    name="arrow-up-outline"
                    size={18}
                    color={colors.muted}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
        {!connection.isWebSocketConnected && (
          <Body muted>Offline · your draft is saved</Body>
        )}
        {error && <Message>{error}</Message>}
      </Screen>
      <Modal
        visible={historyOpen}
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ padding: 16, gap: 16, flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Title>Chats</Title>
              <View style={{ flex: 1 }} />
              <ChatIcon
                label="Close chat history"
                icon="close-outline"
                onPress={() => setHistoryOpen(false)}
              />
            </View>
            <Button
              label="New chat"
              onPress={() => {
                setHistoryOpen(false);
                setError("");
              }}
            />
            <TextInput
              accessibilityLabel="Search recent chats"
              placeholder="Search recent chats"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              style={{
                minHeight: 48,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceVariant,
                color: colors.onSurface,
                fontSize: 16 * profile.textScale,
              }}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 4, paddingBottom: 24 }}
            >
              <Body muted>
                {connection.isWebSocketConnected
                  ? "Your chats"
                  : "Chats saved on this phone"}
              </Body>
              {filtered.map((chat) => (
                <Pressable
                  key={chat._id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${chat.title}`}
                  onPress={() => {
                    setHistoryOpen(false);
                    router.push({
                      pathname: "/(learning)/chat",
                      params: { conversationId: chat._id },
                    });
                  }}
                  style={({ pressed }) => ({
                    minHeight: 64,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.outline,
                    backgroundColor: pressed
                      ? colors.surfaceVariant
                      : colors.surface,
                    gap: 4,
                  })}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 16 * profile.textScale,
                      lineHeight: 24 * profile.textScale,
                      color: colors.onSurface,
                      fontWeight: "600",
                    }}
                  >
                    {chat.title}
                  </Text>
                  <Body muted style={{ fontSize: 12, lineHeight: 18 }}>
                    {new Date(chat.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </Body>
                </Pressable>
              ))}
              {!filtered.length && (
                <Body muted>
                  {search
                    ? "No matching chats."
                    : history.status === "LoadingFirstPage" &&
                        connection.isWebSocketConnected
                      ? "Loading chats…"
                      : "Your conversations will appear here."}
                </Body>
              )}
              {connection.isWebSocketConnected &&
                (history.status === "CanLoadMore" ||
                  history.status === "LoadingMore") && (
                  <Button
                    secondary
                    label="Load older chats"
                    busy={history.status === "LoadingMore"}
                    onPress={() => history.loadMore(20)}
                  />
                )}
            </ScrollView>
            <Button
              secondary
              label="Saved phrases"
              onPress={() => {
                setHistoryOpen(false);
                router.push("/(learning)/saved-phrases");
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
