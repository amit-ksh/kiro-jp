import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  componentLessons,
  kanjiParts,
  starterLevels,
  starterRadicals,
} from "@packages/content";
import {
  Body,
  Button,
  Panel,
  Screen,
  Title,
  useColors,
  useTextScale,
} from "../../components/ui";
import { ItemGrid } from "../../features/lessons/ItemGrid";
export default function ComponentLesson() {
  const { glyph = "" } = useLocalSearchParams<{ glyph: string }>(),
    lesson = componentLessons[glyph],
    colors = useColors(),
    scale = useTextScale();
  if (!lesson)
    return (
      <Screen title="Component unavailable">
        <Button
          label="Show levels"
          onPress={() => router.replace("/(learning)/(tabs)/lessons")}
        />
      </Screen>
    );
  const radical = starterRadicals.find(
    (item) =>
      item.glyph === glyph ||
      item.canonical === glyph ||
      (glyph === "飠" && item.number === 184),
  );
  const kanji = starterLevels
    .flatMap((level) => level.kanji)
    .filter(
      (character) =>
        character === glyph ||
        kanjiParts[character as keyof typeof kanjiParts].some(
          (part) => part.glyph === glyph,
        ),
    );
  return (
    <Screen title="Learn a component">
      <Panel>
        <Text
          style={{
            fontSize: 72 * scale,
            lineHeight: 100 * scale,
            textAlign: "center",
            color: colors.onSurface,
          }}
        >
          {glyph}
        </Text>
        <Title>{lesson.name}</Title>
        {lesson.forms && <Body>{lesson.forms}</Body>}
        <Body>{lesson.note}</Body>
        <Body muted>
          {radical
            ? `Dictionary radical ${radical.number} · `
            : "Visual component · "}
          English recognition label, not a word reading.
        </Body>
      </Panel>
      <Panel>
        <Title>Find it in these kanji</Title>
        <ItemGrid
          items={kanji.map((character) => ({
            id: character,
            glyph: character,
            label: componentLessons[character]?.name ?? "Kanji",
          }))}
          onPress={(id) =>
            router.push({
              pathname: "/(learning)/item",
              params: {
                kind: "kanji",
                id,
                level: String(
                  starterLevels.find((level) => level.kanji.includes(id))!
                    .number,
                ),
              },
            })
          }
        />
        {!kanji.length && (
          <Body>
            This shape is included in the starter reference; its related lesson
            is not available yet.
          </Body>
        )}
      </Panel>
      <Button
        label="Sources"
        secondary
        onPress={() => router.push("/(learning)/sources")}
      />
    </Screen>
  );
}
