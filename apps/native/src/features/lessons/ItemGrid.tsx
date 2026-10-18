import { Pressable, Text, View } from "react-native";
import { Body, useColors, useTextScale } from "../../components/ui";
export function ItemGrid({
  items,
  onPress,
}: {
  items: readonly {
    id: string;
    glyph: string;
    label: string;
    done?: boolean;
  }[];
  onPress: (id: string) => void;
}) {
  const colors = useColors(),
    scale = useTextScale();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.glyph}, ${item.label}${item.done ? ", introduced" : ""}`}
          onPress={() => onPress(item.id)}
          style={({ pressed }) => ({
            minWidth: 72,
            maxWidth: "100%",
            minHeight: 78,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: item.done ? colors.primary : colors.surfaceVariant,
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text
            style={{
              fontSize: 30 * scale,
              lineHeight: 40 * scale,
              fontWeight: "600",
              color: item.done ? colors.onPrimary : colors.onSurface,
              textAlign: "center",
            }}
          >
            {item.glyph}
          </Text>
          <Body
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: item.done ? colors.onPrimary : colors.muted,
            }}
          >
            {item.label}
            {item.done ? " · Introduced" : ""}
          </Body>
        </Pressable>
      ))}
    </View>
  );
}
