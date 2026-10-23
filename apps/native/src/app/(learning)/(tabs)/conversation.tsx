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
  ActivityIndicator,
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
import {
  categoryTopic,
  conversationCategories,
  type ConversationCategory,
} from "@packages/learning-core";
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
  const active = useRef(true);
  const starting = useRef(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ConversationCategory | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const begin = async (category?: ConversationCategory) => {
    const chosenTopic = category ? categoryTopic(category) : topic;
    if (
      starting.current ||
      !chosenTopic.trim() ||
      !auth.isAuthenticated ||
      !connection.isWebSocketConnected
    )
      return;
    starting.current = true;
    setBusy(true);
    setSelectedCategory(category ?? null);
    setError("");
    try {
      let intent = {
        clientId: Crypto.randomUUID(),
        segmentId: Crypto.randomUUID(),
        topic: chosenTopic,
        ...(category ? { category } : {}),
      };
      try {
        const saved = JSON.parse(
          study.drafts["conversation-create:chat-pending"] ?? "null",
        ) as typeof intent | null;
        if (saved?.topic === chosenTopic && saved.category === category)
          intent = saved;
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
      starting.current = false;
      if (active.current) {
        setBusy(false);
        setSelectedCategory(null);
      }
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
  const categoryIcons = {
    places: "location-outline",
    "anime-manga": "book-outline",
    food: "restaurant-outline",
    "daily-life": "sunny-outline",
  } as const;
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
            sendDisabled={
              !topic.trim() ||
              !auth.isAuthenticated ||
              !connection.isWebSocketConnected
            }
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
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              maxWidth: 420,
              width: "100%",
              alignSelf: "center",
            }}
          >
            {conversationCategories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                disabled={
                  busy ||
                  !auth.isAuthenticated ||
                  !connection.isWebSocketConnected
                }
                accessibilityState={{
                  disabled:
                    busy ||
                    !auth.isAuthenticated ||
                    !connection.isWebSocketConnected,
                  busy: busy && selectedCategory === category.id,
                }}
                accessibilityLabel={`Start a conversation about ${category.label}`}
                accessibilityHint="Chooses a topic with Qloo and starts your chat"
                onPress={() => void begin(category.id)}
                style={({ pressed }) => ({
                  width: "47.5%",
                  aspectRatio: 1,
                  minHeight: 144,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  gap: 16,
                  justifyContent: "center",
                  opacity:
                    pressed || (busy && selectedCategory !== category.id)
                      ? 0.65
                      : 1,
                })}
              >
                {busy && selectedCategory === category.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={categoryIcons[category.id]}
                    size={30}
                    color={colors.navigationActive}
                  />
                )}
                <Body
                  style={{
                    fontWeight: "600",
                    fontSize: 16 * profile.textScale,
                    lineHeight: 23 * profile.textScale,
                  }}
                >
                  {category.label}
                </Body>
              </Pressable>
            ))}
          </View>
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
              <Body muted>Your chats</Body>
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
