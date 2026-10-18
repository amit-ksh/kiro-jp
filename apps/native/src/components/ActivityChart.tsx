import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Body, useColors } from "./ui";
type Day = { day: string; milliseconds: number; meaningful: boolean };
export function ActivityChart({
  days,
  compact = false,
}: {
  days: readonly Day[];
  compact?: boolean;
}) {
  const colors = useColors(),
    [selected, setSelected] = useState<string | null>(null);
  const active = days.find((day) => day.day === selected) ?? days.at(-1),
    ceiling = Math.max(5, ...days.map((day) => day.milliseconds / 60000)),
    height = compact ? 80 : 132;
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Body style={{ fontWeight: "700" }}>Daily activity</Body>
        <Body muted>{ceiling.toFixed(0)} min</Body>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: compact ? 6 : 10,
        }}
      >
        {days.map((day, index) => {
          const label = new Date(`${day.day}T12:00:00Z`).toLocaleDateString(
              "en-US",
              { weekday: "short", timeZone: "UTC" },
            ),
            minutes = day.milliseconds / 60000,
            isSelected = active?.day === day.day;
          return (
            <Pressable
              key={day.day}
              accessibilityRole="button"
              accessibilityLabel={`${day.day}: ${minutes.toFixed(1)} study minutes${day.meaningful ? ", study day earned" : ""}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(day.day)}
              style={{ flex: 1, minHeight: 48, gap: 6, alignItems: "center" }}
            >
              <View
                style={{
                  height,
                  width: "100%",
                  justifyContent: "flex-end",
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: minutes
                      ? Math.max(2, (height * minutes) / ceiling)
                      : 0,
                    width: "100%",
                    backgroundColor:
                      index === days.length - 1
                        ? colors.secondary
                        : colors.primary,
                    borderRadius: 6,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.onSurface,
                  fontWeight: isSelected ? "700" : "400",
                }}
              >
                {label}
              </Text>
              <View
                style={{
                  height: 4,
                  width: isSelected ? 20 : 4,
                  borderRadius: 2,
                  backgroundColor: isSelected
                    ? colors.navigationActive
                    : day.meaningful
                      ? colors.success
                      : colors.outline,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      {active && (
        <Body muted style={{ fontSize: 13, lineHeight: 20 }}>
          {new Date(`${active.day}T12:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          · {(active.milliseconds / 60000).toFixed(1)} min
        </Body>
      )}
    </View>
  );
}
