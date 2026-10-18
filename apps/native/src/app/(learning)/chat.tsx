import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  useMutation,
  useQuery,
  useConvexAuth,
  useConvexConnectionState,
} from "convex/react";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import {
  strongestGoal,
  type SupportFlag,
  type TutorPhrase,
} from "@packages/learning-core";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import { useStudyTime } from "../../features/lessons/useStudyTime";
import { SavedPhrases } from "../../features/conversation/SavedPhrases";
import { CulturalContext } from "../../features/conversation/CulturalContext";
import {
  ChatBubble,
  ChatComposer,
  ChatIcon,
} from "../../features/conversation/ChatControls";
import {
  Body,
  Button,
  Loading,
  Message,
  Panel,
  Screen,
  Title,
  useColors,
} from "../../components/ui";
import { ScrollView, View } from "react-native";
export default function Chat() {
  const { conversationId = "" } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const { profile } = useProfile(),
    study = useStudy(),
    auth = useConvexAuth(),
    connection = useConvexConnectionState();
  const [viewSegment, setViewSegment] = useState("");
  const [expandedMessages, setExpandedMessages] = useState<string[]>([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const colors = useColors();
  const validId = /^[a-z0-9]{20,40}$/u.test(conversationId);
  const remote = useQuery(
    api.conversation.get,
    auth.isAuthenticated && validId
      ? {
          conversationId: conversationId as Id<"conversations">,
          ...(viewSegment ? { segmentId: viewSegment } : {}),
        }
      : "skip",
  );
  const capabilities = useQuery(api.account.capabilities);
  const data = remote ?? study.chats[conversationId];
  const submit = useMutation(api.conversation.submit),
    finish = useMutation(api.conversation.finish),
    continuePractice = useMutation(api.conversation.continuePractice),
    retry = useMutation(api.conversation.retry),
    prepareRecap = useMutation(api.conversation.prepareRecap),
    savePhrase = useMutation(api.references.saveConversationPhrase);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [support, setSupport] = useState<SupportFlag[]>([]),
    [openHints, setOpenHints] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [now, setNow] = useState(Date.now());
  const active = useRef(true);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    if (!viewSegment) {
      const frame = requestAnimationFrame(() =>
        scroll.current?.scrollToEnd({ animated: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [remote?.messages.length, viewSegment]);
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      active.current = false;
      clearInterval(timer);
    };
  }, []);
  const cacheChat = study.cacheChat;
  useEffect(() => {
    if (remote) void cacheChat(remote);
  }, [remote, cacheChat]);
  const segment = data?.segments.find(
    (item) =>
      item.segmentId === (viewSegment || data.conversation.currentSegmentId),
  );
  const timing = useStudyTime(
    segment?.segmentId ?? "unavailable-chat",
    "chat",
    "conversationActivity",
  );
  const draftKey = segment?.segmentId ?? conversationId;
  const text = study.drafts[`${draftKey}:chat-message`] ?? "";
  const savedSupport: SupportFlag[] = (() => {
    try {
      const flags = JSON.parse(
        study.drafts[`${draftKey}:chat-support`] ?? "[]",
      );
      return Array.isArray(flags)
        ? flags.filter(
            (flag) =>
              flag === "suggestedReply" ||
              flag === "wordBank" ||
              flag === "patternHint" ||
              flag === "transcriptEdited",
          )
        : [];
    } catch {
      return [];
    }
  })();
  const recordHelp = () => {
    timing.interact();
    const flags = [
      ...new Set([...support, ...savedSupport, "suggestedReply" as const]),
    ];
    setSupport(flags);
    void study.saveDraft(draftKey, "chat-support", JSON.stringify(flags));
  };
  const messages =
    data?.messages.filter(
      (message) => message.segmentId === segment?.segmentId && !message.stale,
    ) ?? [];
  const goals =
    data?.messages.flatMap((message) => (message.goal ? [message.goal] : [])) ??
    [];
  const goal =
    data?.lessonGoals?.find(
      (item) => item.sessionId === segment?.lessonSessionId,
    )?.state ?? strongestGoal(goals);
  const job = data?.jobs.find((item) => item.id === segment?.lastReplyJobId);
  const recap = data?.jobs.find((item) => item.id === segment?.recapJobId);
  const replyFailed = Boolean(
    job &&
    (job.status === "failed" ||
      (job.status === "queued" && now - job.updatedAt >= 90_000) ||
      (job.status === "running" && (job.leaseUntil ?? Infinity) <= now)),
  );
  const operation = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch {
      setError(
        "The conversation couldn't continue right now. Your message is saved. Retry, resume later or continue studying.",
      );
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const send = () =>
    void operation(async () => {
      if (!segment) return;
      timing.pause();
      const fresh = {
        conversationId: conversationId as Id<"conversations">,
        segmentId: segment.segmentId,
        messageId: Crypto.randomUUID(),
        expectedRevision: segment.revision,
        text,
        support: [...new Set([...support, ...savedSupport])],
        practiceStamp: {
          occurredAt: Date.now(),
          offsetMinutes: new Date().getTimezoneOffset(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      let intent = fresh;
      try {
        const saved = JSON.parse(
          study.drafts[`${draftKey}:chat-pending`] ?? "null",
        ) as typeof fresh | null;
        if (
          saved?.text === text &&
          saved.segmentId === segment.segmentId &&
          saved.conversationId === conversationId
        )
          intent = saved;
      } catch {
        /* Preserve the visible draft if its old request metadata was interrupted. */
      }
      await study.saveDraft(draftKey, "chat-pending", JSON.stringify(intent));
      await submit(intent);
      await study.saveDraft(draftKey, "chat-message", "");
      await study.saveDraft(draftKey, "chat-support", "[]");
      await study.saveDraft(draftKey, "chat-pending", "");
      if (active.current) setSupport([]);
    });
  const phrase = (value: TutorPhrase) => (
    <View style={{ gap: 6 }}>
      <Body style={{ fontSize: 24 }}>{value.japanese}</Body>
      {profile.furigana && <Body>{value.reading}</Body>}
      {profile.romaji && <Body muted>{value.romaji}</Body>}
      {profile.translations && <Body>{value.english}</Body>}
    </View>
  );
  const save = (
    messageId: string,
    source: "useful" | "correction",
    index: number,
  ) =>
    void operation(async () => {
      const result = await savePhrase({
        conversationId: conversationId as Id<"conversations">,
        messageId,
        source,
        index,
      });
      if (active.current)
        setNotice(
          result.status === "approved"
            ? "Saved. This phrase matches checked learning material."
            : "Saved as a reference. Its language will be checked before spaced reviews.",
        );
    });
  const composer =
    segment?.state === "active" ? (
      <ChatComposer
        text={text}
        busy={busy}
        speakDisabled={busy || Boolean(segment.pendingJobId)}
        onSpeak={() => {
          timing.pause();
          router.push({
            pathname: "/(learning)/speech",
            params: { conversationSegmentId: segment.segmentId },
          });
        }}
        onChange={(value) => {
          if (
            /[ぁ-ゖァ-ヶ一-龯]/u.test(value) ||
            /\b(?:kudasai|desu|suki|mizu|ocha|arigatou|konnichiwa)\b/iu.test(
              value,
            )
          )
            timing.interact();
          void study.saveDraft(draftKey, "chat-message", value);
        }}
        sendDisabled={
          !text.trim() ||
          Boolean(segment.pendingJobId) ||
          !connection.isWebSocketConnected
        }
        onSend={send}
      />
    ) : undefined;
  if (!validId || remote === null)
    return (
      <Screen title="Conversation unavailable">
        <Panel>
          <Body>Reopen a saved conversation from your account.</Body>
          <Button
            label="Go to conversations"
            onPress={() => router.replace("/(learning)/(tabs)/conversation")}
          />
        </Panel>
      </Screen>
    );
  if ((!data || !segment) && !connection.isWebSocketConnected)
    return (
      <Screen title="Conversation saved online">
        <Panel>
          <Body>
            Connect once to cache this chat on your phone. Your available
            lessons and references can still be studied offline.
          </Body>
          <Button
            label="Continue offline study"
            onPress={() => router.replace("/(learning)/(tabs)")}
          />
          <Button
            label="Back to conversations"
            secondary
            onPress={() => router.replace("/(learning)/(tabs)/conversation")}
          />
        </Panel>
      </Screen>
    );
  if (!data || !segment)
    return (
      <Loading
        label={
          connection.isWebSocketConnected
            ? "Opening your conversation…"
            : "Connect once to prepare this conversation for offline reading."
        }
      />
    );
  return (
    <Screen
      chat
      title="Kiro"
      subtitle={data.conversation.title}
      footer={composer}
      scrollRef={scroll}
      headerAside={
        <ChatIcon
          label="Conversation options"
          icon="ellipsis-vertical"
          onPress={() => setOptionsOpen((value) => !value)}
        />
      }
    >
      {optionsOpen && (
        <Panel>
          {!capabilities?.culturalPersonalization && (
            <Body>Cultural recommendations are unavailable right now.</Body>
          )}
          {segment.lessonSessionId && (
            <Body>
              Lesson conversation goal:{" "}
              {goal === "independent"
                ? "demonstrated independently"
                : goal === "assisted"
                  ? "practised with support"
                  : goal === "awaitingAssessment"
                    ? "awaiting assessment"
                    : "not yet practised"}
              .
            </Body>
          )}
        </Panel>
      )}
      {optionsOpen && data.segments.length > 1 && (
        <Panel>
          <Button
            label={
              historyOpen ? "Hide practice history" : "Show practice history"
            }
            secondary
            onPress={() => setHistoryOpen((previous) => !previous)}
          />
          {historyOpen &&
            data.segments.map((item, index) => (
              <Button
                key={item.segmentId}
                label={
                  item.segmentId === data.conversation.currentSegmentId
                    ? "Open current practice"
                    : `View completed practice ${index + 1}`
                }
                secondary
                disabled={item.segmentId === segment.segmentId}
                onPress={() => {
                  timing.pause();
                  setViewSegment(item.segmentId);
                  setHistoryOpen(false);
                  scroll.current?.scrollTo({ y: 0, animated: true });
                }}
              />
            ))}
        </Panel>
      )}
      {messages.map((message) => (
        <ChatBubble key={message.messageId} own={message.role === "user"}>
          {message.reply ? (
            <>
              <Body style={{ fontSize: 21, lineHeight: 31 }}>
                {message.reply.japanese}
              </Body>
              {profile.translations && (
                <Body muted>{message.reply.english}</Body>
              )}
              <Button
                label={
                  expandedMessages.includes(message.messageId)
                    ? "Hide learning help"
                    : "Learning help"
                }
                secondary
                onPress={() =>
                  setExpandedMessages((previous) =>
                    previous.includes(message.messageId)
                      ? previous.filter((id) => id !== message.messageId)
                      : [...previous, message.messageId],
                  )
                }
              />
              {expandedMessages.includes(message.messageId) && (
                <>
                  {profile.furigana && <Body>{message.reply.reading}</Body>}
                  {profile.romaji && <Body muted>{message.reply.romaji}</Body>}
                  {!profile.translations && (
                    <Body>{message.reply.english}</Body>
                  )}
                  <CulturalContext
                    message={message}
                    canDiscuss={segment.state === "active"}
                    onTopic={(topic) => {
                      void study.saveDraft(draftKey, "chat-message", topic);
                      scroll.current?.scrollToEnd({ animated: true });
                    }}
                  />
                  <Button
                    label="Review this reply"
                    secondary
                    onPress={timing.interact}
                  />
                  {message.reply.corrections.map((correction, index) => (
                    <View key={index} style={{ gap: 6 }}>
                      <Body>Your phrase: {correction.original}</Body>
                      {phrase(correction.corrected)}
                      <Body>{correction.explanation}</Body>
                      <Button
                        label={`Save correction ${index + 1}`}
                        secondary
                        disabled={busy || !connection.isWebSocketConnected}
                        onPress={() =>
                          save(message.messageId, "correction", index)
                        }
                      />
                    </View>
                  ))}
                  {message.reply.usefulPhrases.map((value, index) => (
                    <View key={`useful-${index}`} style={{ gap: 8 }}>
                      {phrase(value)}
                      <Button
                        label={`Save useful phrase ${index + 1}`}
                        secondary
                        disabled={busy || !connection.isWebSocketConnected}
                        onPress={() => save(message.messageId, "useful", index)}
                      />
                    </View>
                  ))}
                  {message.reply.hints.length > 0 &&
                    !openHints.includes(message.messageId) && (
                      <Button
                        label="Show reply hints"
                        secondary
                        disabled={busy || segment.state === "ended"}
                        onPress={() => {
                          recordHelp();
                          setOpenHints((previous) => [
                            ...previous,
                            message.messageId,
                          ]);
                        }}
                      />
                    )}
                  {openHints.includes(message.messageId) &&
                    message.reply.hints.map((hint, index) => (
                      <View key={index} style={{ gap: 8 }}>
                        {phrase(hint)}
                        <Button
                          label={`Try this phrase ${index + 1}`}
                          secondary
                          disabled={busy || segment.state === "ended"}
                          onPress={() => {
                            recordHelp();
                            void study.saveDraft(
                              draftKey,
                              "chat-message",
                              hint.japanese,
                            );
                          }}
                        />
                      </View>
                    ))}
                </>
              )}
            </>
          ) : (
            <Body
              style={{
                color:
                  message.role === "user" ? colors.onPrimary : colors.onSurface,
              }}
            >
              {message.text}
            </Body>
          )}
          <Body
            style={{
              alignSelf: "flex-end",
              fontSize: 11,
              lineHeight: 16,
              color: message.role === "user" ? colors.onPrimary : colors.muted,
            }}
          >
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Body>
        </ChatBubble>
      ))}
      {notice && (
        <Panel>
          <Body>{notice}</Body>
        </Panel>
      )}
      {segment.state === "active" ? (
        (segment.pendingJobId || replyFailed || optionsOpen) && (
          <Panel>
            {segment.pendingJobId && (
              <Body>Your message is saved. Preparing the next reply…</Body>
            )}
            {job && replyFailed && (
              <>
                <Body>
                  The tutor reply is unavailable right now. Your message remains
                  saved.
                </Body>
                <Button
                  label="Retry reply"
                  secondary
                  disabled={
                    busy || job.attempt >= 3 || !connection.isWebSocketConnected
                  }
                  onPress={() =>
                    void operation(async () => {
                      await retry({ jobId: job.id });
                    })
                  }
                />
              </>
            )}
            {optionsOpen && (
              <Button
                label="Finish conversation"
                secondary
                disabled={busy || !connection.isWebSocketConnected}
                onPress={() =>
                  void operation(async () => {
                    timing.pause();
                    await finish({
                      conversationId: conversationId as Id<"conversations">,
                      segmentId: segment.segmentId,
                      expectedRevision: segment.revision,
                    });
                  })
                }
              />
            )}
          </Panel>
        )
      ) : (
        <Panel>
          <Title>Practice saved.</Title>
          <Body>
            {recap?.recap ??
              "Your messages are saved. The recap is pending or unavailable; you can revisit the practice below."}
          </Body>
          {!recap && (
            <Button
              label="Prepare recap"
              secondary
              disabled={busy || !connection.isWebSocketConnected}
              onPress={() =>
                void operation(async () => {
                  await prepareRecap({
                    conversationId: conversationId as Id<"conversations">,
                    segmentId: segment.segmentId,
                  });
                })
              }
            />
          )}
          {recap?.status === "failed" && (
            <Button
              label="Retry recap"
              secondary
              disabled={
                busy || recap.attempt >= 3 || !connection.isWebSocketConnected
              }
              onPress={() =>
                void operation(async () => {
                  await retry({ jobId: recap.id });
                })
              }
            />
          )}
          {segment.segmentId === data.conversation.currentSegmentId && (
            <Button
              label={
                segment.lessonSessionId && goal === "notObserved"
                  ? "Practise this pattern"
                  : "Continue conversation"
              }
              disabled={busy || !connection.isWebSocketConnected}
              onPress={() =>
                void operation(async () => {
                  timing.pause();
                  await continuePractice({
                    conversationId: conversationId as Id<"conversations">,
                    previousSegmentId: segment.segmentId,
                    segmentId: Crypto.randomUUID(),
                  });
                  if (active.current) setViewSegment("");
                })
              }
            />
          )}
        </Panel>
      )}
      {segment.state === "ended" && (
        <SavedPhrases
          sourceIds={messages.map((message) => message.messageId)}
        />
      )}
      {!connection.isWebSocketConnected && (
        <Panel>
          <Body>
            Offline: saved messages and your draft remain available. New replies
            and conversation controls need internet.
          </Body>
        </Panel>
      )}
      {error && (
        <Panel>
          <Message>{error}</Message>
        </Panel>
      )}
      {optionsOpen && (
        <>
          <Button
            label="Resume later"
            secondary
            onPress={() => router.replace("/(learning)/(tabs)/conversation")}
          />
          <Button
            label="Continue studying"
            secondary
            onPress={() => router.replace("/(learning)/(tabs)")}
          />
        </>
      )}
    </Screen>
  );
}
