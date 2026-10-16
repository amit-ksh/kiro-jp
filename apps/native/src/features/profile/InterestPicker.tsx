import { useEffect, useRef, useState, type RefObject } from "react";
import { Pressable, View, type ScrollView, type TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { interests } from "@packages/content";
import { useProfile } from "../../data/ProfileProvider";
import { Body, Button, Field, Message, useColors } from "../../components/ui";

export function InterestPicker({
  scrollRef,
}: {
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const { profile, update } = useProfile(),
    colors = useColors();
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reveal = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<TextInput>(null);
  useEffect(
    () => () => {
      if (reveal.current) clearTimeout(reveal.current);
    },
    [],
  );
  const custom = [
    ...new Set([
      ...profile.interests.filter(
        (item) => !(interests as readonly string[]).includes(item),
      ),
      ...profile.favorites,
    ]),
  ];
  const save = async (patch: Parameters<typeof update>[0]) => {
    setError("");
    try {
      await update(patch);
      return true;
    } catch {
      setError("Your interests couldn't be saved. Please try again.");
      return false;
    }
  };
  const add = async () => {
    const value = draft.trim();
    if (!value || busy) return;
    if (profile.favorites.length >= 20) {
      setError(
        "You can save up to 20 custom interests. Remove one to add another.",
      );
      return;
    }
    setBusy(true);
    if (
      await save((current) => ({
        favorites: current.favorites.some(
          (item) => item.toLowerCase() === value.toLowerCase(),
        )
          ? current.favorites
          : [...current.favorites, value],
      }))
    )
      setDraft("");
    setBusy(false);
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {interests.map((interest) => {
          const selected = profile.interests.includes(interest);
          return (
            <Pressable
              key={interest}
              accessibilityRole="checkbox"
              accessibilityLabel={interest}
              accessibilityState={{ checked: selected }}
              onPress={() =>
                void save((current) => ({
                  interests: current.interests.includes(interest)
                    ? current.interests.filter((item) => item !== interest)
                    : [...current.interests, interest],
                }))
              }
              style={({ pressed }) => ({
                minHeight: 48,
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: selected
                  ? colors.navigationActive
                  : colors.outline,
                backgroundColor: selected
                  ? colors.surfaceVariant
                  : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {selected && (
                <Ionicons name="checkmark" size={18} color={colors.onSurface} />
              )}
              <Body style={{ fontWeight: selected ? "700" : "500" }}>
                {interest}
              </Body>
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Add your own interest"
        inputRef={input}
        autoCorrect={false}
        autoCapitalize="none"
        placeholder="e.g. ramen"
        value={draft}
        onChangeText={setDraft}
        maxLength={120}
        editable={!busy}
        returnKeyType="done"
        onFocus={() => {
          if (reveal.current) clearTimeout(reveal.current);
          reveal.current = setTimeout(() => {
            if (input.current)
              scrollRef?.current?.scrollResponderScrollNativeHandleToKeyboard(
                input.current,
                120,
                true,
              );
          }, 300);
        }}
        onSubmitEditing={() => void add()}
      />
      <Button
        label="Add interest"
        secondary
        disabled={!draft.trim()}
        busy={busy}
        onPress={() => void add()}
      />
      {custom.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {custom.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`Remove interest: ${item}`}
              onPress={() =>
                void save((current) => ({
                  interests: current.interests.filter(
                    (value) => value !== item,
                  ),
                  favorites: current.favorites.filter(
                    (value) => value !== item,
                  ),
                }))
              }
              style={({ pressed }) => ({
                minHeight: 48,
                maxWidth: "100%",
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 16,
                backgroundColor: colors.surfaceVariant,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Body style={{ flexShrink: 1 }}>{item}</Body>
              <Ionicons name="close" size={18} color={colors.onSurface} />
            </Pressable>
          ))}
        </View>
      )}
      {error && <Message>{error}</Message>}
    </View>
  );
}
