import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useColors, useTextScale } from "../../components/ui";
import type { useChatVoiceInput } from "./useChatVoiceInput";

type VoiceInput = ReturnType<typeof useChatVoiceInput>;

function VoiceAction({
  label,
  icon,
  onPress,
  primary = false,
  disabled = false,
  iconOnly = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  iconOnly?: boolean;
}) {
  const colors = useColors(),
    scale = useTextScale();
  const color = primary ? colors.onSecondary : colors.onSurface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        minWidth: 48,
        paddingHorizontal: iconOnly ? 12 : 14,
        paddingVertical: 10,
        borderRadius: 24,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary ? colors.secondary : colors.surfaceVariant,
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={color} />
      {!iconOnly && (
        <Text
          style={{
            color,
            fontSize: 14 * scale,
            lineHeight: 20 * scale,
            fontWeight: "600",
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Inline dictation stays in the chat; using a transcript never sends it. */
export function ChatVoiceInput({
  voice,
  onUse,
  onPractice,
  onPause,
}: {
  voice: VoiceInput;
  onUse: (text: string, edited: boolean) => Promise<void>;
  onPractice: () => void;
  onPause: () => void;
}) {
  const colors = useColors(),
    scale = useTextScale();
  const [draft, setDraft] = useState(voice.transcript),
    [notice, setNotice] = useState(""),
    [applying, setApplying] = useState(false);
  useEffect(() => {
    setDraft(voice.transcript);
    setNotice("");
  }, [voice.recordingId, voice.transcript]);
  const working =
    voice.status === "starting" || voice.status === "transcribing";
  const recording = voice.status === "recording";
  const ready = voice.status === "ready";
  const locked = applying || voice.usingTranscript;
  const seconds = Math.floor(Math.max(0, voice.durationMillis) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const close = () => {
    onPause();
    voice.cancel();
  };
  const run = (work: () => Promise<void>) => {
    setNotice("");
    void work().catch(() =>
      setNotice("That didn't work. Try again or type instead."),
    );
  };
  const caption = {
    idle: "Voice input",
    starting: "Opening microphone…",
    recording: "Recording",
    transcribing: "Getting your transcript…",
    ready: "Check transcript",
    error: "Voice input paused",
  }[voice.status];
  return (
    <View style={{ padding: 8, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {working ? (
          <ActivityIndicator color={colors.onSurface} />
        ) : (
          <Ionicons
            name={
              recording
                ? "radio-button-on"
                : ready
                  ? "chatbubble-outline"
                  : "mic-off-outline"
            }
            size={20}
            color={recording ? colors.error : colors.muted}
          />
        )}
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: colors.onSurface,
            fontSize: 16 * scale,
            lineHeight: 24 * scale,
            fontWeight: "600",
            flex: 1,
          }}
        >
          {caption}
        </Text>
        {recording && (
          <Text
            accessibilityLabel={`${seconds} seconds recorded`}
            style={{
              color: colors.onSurface,
              fontSize: 16 * scale,
              fontVariant: ["tabular-nums"],
            }}
          >
            {time}
          </Text>
        )}
        <VoiceAction
          label="Cancel voice input"
          icon="close"
          iconOnly
          onPress={close}
          disabled={locked}
        />
      </View>

      {recording && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            style={{
              flex: 1,
              color: colors.muted,
              fontSize: 14 * scale,
              lineHeight: 21 * scale,
            }}
          >
            Speak naturally, then tap Stop.
          </Text>
          <VoiceAction
            label="Stop"
            icon="stop"
            primary
            onPress={() => {
              onPause();
              run(voice.stop);
            }}
          />
        </View>
      )}

      {ready && (
        <>
          <TextInput
            accessibilityLabel="Edit voice transcript"
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              setNotice("");
              onPractice();
            }}
            onFocus={onPractice}
            onBlur={onPause}
            editable={!locked}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            placeholder="Type what you meant"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 64,
              maxHeight: 140,
              padding: 12,
              borderRadius: 14,
              backgroundColor: colors.surfaceVariant,
              color: colors.onSurface,
              fontSize: 16 * scale,
              lineHeight: 24 * scale,
            }}
          />
          <Button
            label="Use transcript"
            busy={locked}
            disabled={!draft.trim()}
            onPress={() => {
              onPause();
              setApplying(true);
              setNotice("");
              void onUse(draft.trim(), draft.trim() !== voice.transcript.trim())
                .catch((error: unknown) =>
                  setNotice(
                    error instanceof Error
                      ? error.message
                      : "Couldn't use the transcript. Try again or type instead.",
                  ),
                )
                .finally(() => setApplying(false));
            }}
          />
        </>
      )}

      {(voice.error || notice) && (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: colors.error,
            fontSize: 14 * scale,
            lineHeight: 21 * scale,
          }}
        >
          {notice || voice.error}
        </Text>
      )}

      {!working && !recording && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {voice.permissionDenied ? (
              <VoiceAction
                label="Enable microphone"
                icon="settings-outline"
                onPress={() => run(() => Linking.openSettings())}
              />
            ) : (
              <VoiceAction
                label="Record again"
                icon="mic-outline"
                onPress={() => {
                  onPause();
                  run(voice.start);
                }}
                disabled={locked}
              />
            )}
            {voice.canRetry && (
              <VoiceAction
                label="Retry transcript"
                icon="refresh-outline"
                onPress={() => run(voice.retry)}
                disabled={locked}
              />
            )}
            <VoiceAction
              label="Type instead"
              icon="keypad-outline"
              onPress={close}
              disabled={locked}
            />
          </View>
        </>
      )}
    </View>
  );
}
