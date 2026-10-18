import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColors, useTextScale } from "../../components/ui";
export function ChatIcon({
  label,
  icon,
  onPress,
  disabled = false,
  busy = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || busy ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Ionicons name={icon} size={23} color={colors.onPrimary} />
      )}
    </Pressable>
  );
}
export function ChatComposer({
  text,
  onChange,
  onSend,
  onSpeak,
  busy,
  sendDisabled,
  speakDisabled,
  maxLength = 1000,
  inputLabel = "Message your tutor",
  placeholder = "Message",
}: {
  text: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onSpeak?: () => void;
  busy: boolean;
  sendDisabled: boolean;
  speakDisabled?: boolean;
  maxLength?: number;
  inputLabel?: string;
  placeholder?: string;
}) {
  const colors = useColors(),
    scale = useTextScale();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
      {onSpeak && (
        <ChatIcon
          label="Speak a reply"
          icon="mic-outline"
          disabled={speakDisabled}
          onPress={onSpeak}
        />
      )}
      <TextInput
        accessibilityLabel={inputLabel}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={onChange}
        editable={!busy}
        multiline
        maxLength={maxLength}
        style={{
          flex: 1,
          minHeight: 48,
          maxHeight: 120,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.surfaceVariant,
          color: colors.onSurface,
          fontSize: 16 * scale,
          lineHeight: 24 * scale,
        }}
      />
      <ChatIcon
        label="Send message"
        icon="send"
        onPress={onSend}
        disabled={sendDisabled}
        busy={busy}
      />
    </View>
  );
}
export function ChatBubble({
  own,
  children,
}: {
  own: boolean;
  children: ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        alignSelf: own ? "flex-end" : "flex-start",
        maxWidth: "90%",
        minWidth: 80,
        borderRadius: 18,
        borderBottomRightRadius: own ? 4 : 18,
        borderBottomLeftRadius: own ? 18 : 4,
        padding: 14,
        gap: 10,
        backgroundColor: own ? colors.primary : colors.surface,
      }}
    >
      {children}
    </View>
  );
}
