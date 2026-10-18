import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  ActivityIndicator,
  type ViewStyle,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  lightColors,
  darkColors,
  type AppColors,
} from "@packages/design-tokens";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSegments } from "expo-router";
import { useAppBack } from "../navigation/useAppBack";
const Scale = createContext(1);
export const TextScaleProvider = Scale.Provider;
export function useTextScale() {
  return useContext(Scale);
}
export function useColors(): AppColors {
  return useColorScheme() === "dark" ? darkColors : lightColors;
}
export function Body({
  children,
  muted = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: object;
}) {
  const colors = useColors();
  const scale = useContext(Scale);
  return (
    <Text
      style={[
        styles.body,
        {
          color: muted ? colors.muted : colors.onSurface,
          fontSize: 16 * scale,
          lineHeight: 25 * scale,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  children,
  light = false,
}: {
  children: ReactNode;
  light?: boolean;
}) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={[
        styles.title,
        { color: light ? colors.onPrimary : colors.onSurface },
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  title,
  subtitle,
  footer,
  scrollRef,
  keyboardAware = false,
  chat = false,
  headerAside,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  scrollRef?: RefObject<ScrollView | null>;
  keyboardAware?: boolean;
  chat?: boolean;
  headerAside?: ReactNode;
}) {
  const colors = useColors(),
    back = useAppBack(),
    segments = useSegments();
  const showBack = segments.includes("(learning)")
    ? !segments.includes("(tabs)")
    : segments.includes("auth");
  const root = useRef<View>(null),
    hasFooter = Boolean(footer),
    avoidKeyboard = hasFooter || keyboardAware;
  const [frame, setFrame] = useState({ y: 0, height: 0 }),
    [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    if (!avoidKeyboard || Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
        setKeyboardTop(event.endCoordinates.screenY),
      ),
      hide = Keyboard.addListener("keyboardDidHide", () =>
        setKeyboardTop(null),
      );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [avoidKeyboard]);
  // Measure the actual visible frame so adjustResize and edge-to-edge windows
  // both work, without applying keyboard height twice or retaining it on hide.
  // Some Android IMEs place their suggestion strip above the reported frame.
  // Keep one control-height of room while it is open; remove it on hide.
  const inset =
    Platform.OS === "android" && avoidKeyboard && keyboardTop !== null
      ? Math.max(0, frame.y + frame.height - keyboardTop) + 48
      : 0;
  const header = (
    <View
      style={
        chat
          ? {
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 8,
              paddingVertical: 8,
              backgroundColor: colors.background,
            }
          : styles.header
      }
    >
      {showBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={back}
          style={{
            minWidth: 48,
            minHeight: 48,
            justifyContent: "center",
            alignItems: chat ? "center" : "flex-start",
          }}
        >
          <Ionicons name="arrow-back" size={26} color={colors.onPrimary} />
        </Pressable>
      )}
      <View style={chat ? { flex: 1, minWidth: 0, gap: 2 } : { gap: 12 }}>
        {chat ? (
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{
              fontSize: 22,
              fontWeight: "700",
              lineHeight: 28,
              color: colors.onPrimary,
            }}
          >
            {title}
          </Text>
        ) : (
          <Title light>{title}</Title>
        )}
        {subtitle && (
          <Text
            numberOfLines={chat ? 2 : undefined}
            style={[styles.subtitle, chat && { fontSize: 13, lineHeight: 19 }]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {headerAside}
    </View>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={
        footer ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]
      }
    >
      <View
        ref={root}
        style={{ flex: 1 }}
        onLayout={() =>
          root.current?.measureInWindow((_x, y, _width, height) =>
            setFrame((previous) =>
              previous.y === y && previous.height === height
                ? previous
                : { y, height },
            ),
          )
        }
      >
        <KeyboardAvoidingView
          style={{ flex: 1, paddingBottom: inset }}
          behavior={footer && Platform.OS !== "android" ? "padding" : undefined}
        >
          {chat && header}
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              chat
                ? { padding: 12, paddingBottom: 20, gap: 12, flexGrow: 1 }
                : styles.screen
            }
            style={
              chat ? { backgroundColor: colors.surfaceVariant } : undefined
            }
          >
            {!chat && header}
            {children}
          </ScrollView>
          {footer && (
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: chat ? 8 : 24,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              {footer}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface }, style]}>
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.surfaceVariant : colors.secondary,
          opacity: disabled || busy ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={secondary ? colors.onSurface : colors.onSecondary}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: secondary ? colors.onSurface : colors.onSecondary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.primary : colors.outline,
          backgroundColor: selected ? colors.surfaceVariant : colors.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: colors.onSurface,
          fontSize: 16,
          lineHeight: 24,
          fontWeight: selected ? "700" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  inputRef,
  ...props
}: TextInputProps & { label: string; inputRef?: RefObject<TextInput | null> }) {
  const colors = useColors();
  return (
    <View style={{ gap: 8 }}>
      <Body>{label}</Body>
      <TextInput
        ref={inputRef}
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            color: colors.onSurface,
            borderColor: colors.outline,
            backgroundColor: colors.surfaceVariant,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function Message({ children }: { children: ReactNode }) {
  const colors = useColors();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: colors.error, fontSize: 15, lineHeight: 23 }}
    >
      {children}
    </Text>
  );
}
export function Loading({
  label = "Opening your learning progress…",
}: {
  label?: string;
}) {
  const colors = useColors();
  return (
    <Screen title="Kiro JP">
      <Panel>
        <ActivityIndicator color={colors.primary} />
        <Body>{label}</Body>
      </Panel>
    </Screen>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 24, paddingBottom: 36, gap: 20, flexGrow: 1 },
  header: { gap: 12, marginTop: 12, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: "800", lineHeight: 38 },
  subtitle: { color: "#EDF0FF", fontSize: 16, lineHeight: 25 },
  panel: { padding: 24, borderRadius: 24, gap: 18 },
  body: { fontSize: 16, lineHeight: 25 },
  button: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
  },
  choice: { minHeight: 52, padding: 15, borderRadius: 16, borderWidth: 1 },
  input: {
    minHeight: 54,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
  },
  kanji: {
    fontSize: 58,
    fontWeight: "700",
    lineHeight: 78,
    textAlign: "center",
  },
});
