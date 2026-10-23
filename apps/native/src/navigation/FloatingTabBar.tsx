import { useEffect, useState } from "react";
import { Keyboard, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColors } from "../components/ui";

const icons = {
  index: ["home-outline", "home"],
  lessons: ["book-outline", "book"],
  review: ["layers-outline", "layers"],
  conversation: ["chatbubbles-outline", "chatbubbles"],
  profile: ["person-outline", "person"],
} as const;

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const colors = useColors(),
    insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  if (keyboardOpen) return null;
  return (
    <View
      style={{
        backgroundColor: colors.background,
        paddingTop: 8,
        paddingHorizontal: Math.max(insets.left, insets.right, 20),
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 36,
          padding: 6,
          minHeight: 64,
          flexDirection: "row",
          alignItems: "center",
          maxWidth: 480,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]!.options,
            selected = state.index === index;
          const icon = icons[route.name as keyof typeof icons];
          if (!icon) return null;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ?? options.title ?? route.name
              }
              testID={options.tabBarButtonTestID}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented)
                  navigation.navigate(route.name, route.params);
              }}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 48,
                minHeight: 52,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed
                  ? colors.surfaceVariant
                  : "transparent",
              })}
            >
              <Ionicons
                name={icon[selected ? 1 : 0]}
                size={24}
                color={selected ? colors.secondary : colors.muted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
