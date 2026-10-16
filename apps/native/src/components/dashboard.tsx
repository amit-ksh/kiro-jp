import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Body, useColors, useTextScale } from "./ui";

export function SectionTitle({ children }: { children: ReactNode }) {
  const colors = useColors(),
    scale = useTextScale();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.onSurface,
        fontSize: 22 * scale,
        lineHeight: 29 * scale,
        fontWeight: "700",
      }}
    >
      {children}
    </Text>
  );
}

export function LearningTotals({
  inventory,
  onPress,
}: {
  inventory: { kanji: string[]; vocabulary: string[]; grammar: string[] };
  onPress?: () => void;
}) {
  const colors = useColors(),
    scale = useTextScale();
  const contents = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {[
        ["Kanji", inventory.kanji.length],
        ["Words", inventory.vocabulary.length],
        ["Patterns", inventory.grammar.length],
      ].map(([label, count]) => (
        <View key={label} style={{ flex: 1, minWidth: 64, gap: 2 }}>
          <Text
            style={{
              color: colors.onSurface,
              fontSize: 28 * scale,
              lineHeight: 36 * scale,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
            }}
          >
            {count}
          </Text>
          <Body muted style={{ fontSize: 14 * scale, lineHeight: 20 * scale }}>
            {label}
          </Body>
        </View>
      ))}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your progress: ${inventory.kanji.length} kanji introduced, ${inventory.vocabulary.length} words introduced, ${inventory.grammar.length} patterns practised. View details.`}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 60, opacity: pressed ? 0.7 : 1 })}
    >
      {contents}
    </Pressable>
  ) : (
    contents
  );
}

export function GoalMeter({
  milliseconds,
  minutes,
}: {
  milliseconds: number;
  minutes: number;
}) {
  const colors = useColors(),
    percent = Math.min(
      100,
      Math.max(0, (milliseconds / (minutes * 60_000)) * 100),
    );
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Today's study goal"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(percent),
        text: `${(milliseconds / 60000).toFixed(1)} of ${minutes} minutes`,
      }}
      style={{
        height: 8,
        backgroundColor: colors.surfaceVariant,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: 8,
          width: `${percent}%`,
          backgroundColor: colors.secondary,
          borderRadius: 4,
        }}
      />
    </View>
  );
}

export function ActionRow({
  label,
  detail,
  onPress,
  icon = "chevron-forward",
}: {
  label: string;
  detail?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}${detail ? `, ${detail}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.65 : 1,
        paddingVertical: 8,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Body style={{ fontWeight: "600" }}>{label}</Body>
        {detail && (
          <Body muted style={{ fontSize: 14 }}>
            {detail}
          </Body>
        )}
      </View>
      <Ionicons name={icon} size={20} color={colors.onSurface} />
    </Pressable>
  );
}

export function PlanStep({
  label,
  detail,
  done,
}: {
  label: string;
  detail?: string;
  done: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <Ionicons
        name={done ? "checkmark-circle" : "ellipse-outline"}
        color={done ? colors.success : colors.muted}
        size={22}
        style={{ marginTop: 2 }}
      />
      <View style={{ flex: 1 }}>
        <Body style={{ fontWeight: "600" }}>
          {label}
          {done ? " · done" : ""}
        </Body>
        {detail && (
          <Body muted style={{ fontSize: 14 }}>
            {detail}
          </Body>
        )}
      </View>
    </View>
  );
}
