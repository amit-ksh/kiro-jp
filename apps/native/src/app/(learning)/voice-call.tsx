import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useConvexAuth,
  useConvexConnectionState,
  useQuery,
} from "convex/react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { api } from "@packages/backend/convex/_generated/api";
import type { Id } from "@packages/backend/convex/_generated/dataModel";
import { useProfile } from "../../data/ProfileProvider";
import { useStudy } from "../../data/StudyProvider";
import {
  Body,
  Button,
  Panel,
  Screen,
  Title,
  useColors,
} from "../../components/ui";
import { KiroMark } from "../../components/KiroMark";
import {
  useVoiceCall,
  type CallPhase,
} from "../../features/conversation/useVoiceCall";

const labels: Record<CallPhase, string> = {
  ready: "Ready to talk?",
  listening: "Listening…",
  transcribing: "Hearing your words…",
  thinking: "Preparing the reply…",
  speaking: "Kiro is speaking",
  paused: "Call paused",
};
function CallControl({
  label,
  icon,
  onPress,
  selected = false,
  end = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  selected?: boolean;
  end?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", gap: 6, flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: end
            ? colors.error
            : selected
              ? colors.secondary
              : colors.surfaceVariant,
          justifyContent: "center",
          alignItems: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons
          name={icon}
          size={25}
          color={
            end
              ? colors.onError
              : selected
                ? colors.onSecondary
                : colors.onSurface
          }
        />
      </Pressable>
      <Body style={{ fontSize: 13, textAlign: "center" }}>{label}</Body>
    </View>
  );
}
export default function VoiceCall() {
  const { conversationId = "" } = useLocalSearchParams<{
    conversationId: string;
  }>();
  const study = useStudy(),
    { profile } = useProfile(),
    auth = useConvexAuth();
  const connection = useConvexConnectionState(),
    colors = useColors();
  const valid = /^[a-z0-9]{20,40}$/u.test(conversationId);
  const remote = useQuery(
    api.conversation.get,
    valid && auth.isAuthenticated
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip",
  );
  const data = remote ?? study.chats[conversationId];
  const call = useVoiceCall(
    conversationId,
    data,
    auth.isAuthenticated && connection.isWebSocketConnected,
  );
  const [transcriptsOpen, setTranscriptsOpen] = useState(true);
  const cache = study.cacheChat;
  useEffect(() => {
    if (remote) void cache(remote);
  }, [remote, cache]);
  const segment = data?.segments.find(
    (item) => item.segmentId === data.conversation.currentSegmentId,
  );
  const messages =
    data?.messages.filter(
      (item) => item.segmentId === segment?.segmentId && !item.stale,
    ) ?? [];
  const reply = messages
    .filter((item) => item.role === "assistant")
    .at(-1)?.reply;
  const leave = () => {
    call.pause();
    if (router.canGoBack()) router.back();
    else if (valid)
      router.replace({
        pathname: "/(learning)/chat",
        params: { conversationId },
      });
    else router.replace("/(learning)/(tabs)/conversation");
  };
  return (
    <Screen
      title="Voice call"
      subtitle={data?.conversation.title ?? "Japanese practice"}
      footer={
        <View
          style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
        >
          <CallControl
            label={call.muted ? "Unmute" : "Mute"}
            icon={call.muted ? "mic-off" : "mic-outline"}
            selected={call.muted}
            onPress={call.toggleMute}
          />
          <CallControl
            label={call.running ? "Pause" : "Resume"}
            icon={call.running ? "pause" : "play"}
            selected={!call.running}
            onPress={() => (call.running ? call.pause() : call.resume())}
          />
          <CallControl label="End call" icon="call" end onPress={leave} />
        </View>
      }
    >
      <View style={{ alignItems: "center", paddingVertical: 20, gap: 16 }}>
        <KiroMark size={112} />
        <Title light>{labels[call.phase]}</Title>
        {call.phase === "listening" && (
          <Body style={{ color: colors.onPrimary, textAlign: "center" }}>
            {call.voiced
              ? "I can hear you. Pause when you're done."
              : "Speak naturally. Your turn sends after a short pause."}
          </Body>
        )}
      </View>
      {call.phase === "ready" && (
        <Panel>
          <Body>
            Your microphone listens only during your turn. Spoken replies are
            transcribed and sent automatically.
          </Body>
          <Button
            label="Start call"
            disabled={!call.ready}
            onPress={call.resume}
          />
        </Panel>
      )}
      {call.phase === "listening" && (
        <Button label="Send this turn" secondary onPress={call.finishTurn} />
      )}
      {call.error && (
        <Panel>
          <Body>{call.error}</Body>
          {call.permissionDenied && (
            <Button
              label="Enable microphone"
              secondary
              onPress={() => void Linking.openSettings()}
            />
          )}
          <Button label="Return to text chat" onPress={leave} />
        </Panel>
      )}
      {!connection.isWebSocketConnected && (
        <Panel>
          <Body>
            Voice calls need internet. Your saved chat is still available.
          </Body>
          <Button label="Open text chat" onPress={leave} />
        </Panel>
      )}
      {segment?.state === "ended" && (
        <Panel>
          <Body>
            This conversation has ended. Continue it from text chat to make
            another call.
          </Body>
          <Button label="Open conversation" onPress={leave} />
        </Panel>
      )}
      <Panel>
        <Button
          secondary
          label={transcriptsOpen ? "Hide transcript" : "Show transcript"}
          onPress={() => setTranscriptsOpen((value) => !value)}
        />
        {transcriptsOpen && (
          <>
            {call.transcript && (
              <View style={{ gap: 6 }}>
                <Body muted>You said</Body>
                <Body>{call.transcript}</Body>
              </View>
            )}
            {reply && (
              <View style={{ gap: 6 }}>
                <Body muted>Kiro</Body>
                <Body
                  style={{
                    fontSize: 24 * profile.textScale,
                    lineHeight: 34 * profile.textScale,
                  }}
                >
                  {reply.japanese}
                </Body>
                {profile.furigana && <Body>{reply.reading}</Body>}
                {profile.romaji && <Body muted>{reply.romaji}</Body>}
                {profile.translations && <Body>{reply.english}</Body>}
              </View>
            )}
            {!reply && !call.transcript && (
              <Body muted>Your words and the AI reply appear here.</Body>
            )}
          </>
        )}
      </Panel>
      <Button
        label="Text chat, hints and corrections"
        secondary
        onPress={leave}
      />
    </Screen>
  );
}
