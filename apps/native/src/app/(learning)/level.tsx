import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { starterLevels } from "@packages/content";
import { Body, Button, Choice, Panel, Screen } from "../../components/ui";
import { ItemGrid } from "../../features/lessons/ItemGrid";
import { OfflineLesson } from "../../features/lessons/OfflineLesson";
import { useLearningProgress } from "../../features/profile/useLearningProgress";
export default function Level() {
  const params = useLocalSearchParams<{ level: string }>(),
    level = starterLevels.find(
      (level) => level.number === Number(params.level),
    ),
    progress = useLearningProgress();
  const [kind, setKind] = useState<"radical" | "kanji" | "word">("kanji");
  if (!level)
    return (
      <Screen title="Level unavailable">
        <Button
          label="Show levels"
          onPress={() => router.replace("/(learning)/(tabs)/lessons")}
        />
      </Screen>
    );
  const items =
    kind === "radical"
      ? level.radicals.map((item) => ({
          id: String(item.number),
          glyph: item.glyph,
          label: item.name,
        }))
      : kind === "kanji"
        ? level.kanji.map((kanji) => ({
            id: kanji,
            glyph: kanji,
            label: "Kanji",
            done: progress.inventory.kanji.includes(kanji),
          }))
        : level.lesson.words.map((word) => ({
            id: word.id,
            glyph: word.word,
            label: word.reading,
            done: progress.inventory.vocabulary.includes(
              `${word.word}（${word.reading}）`,
            ),
          }));
  return (
    <Screen
      title={`Level ${level.number}`}
      subtitle={`${level.jlpt} · ${level.title}`}
    >
      <Panel>
        <Button
          label="Start this lesson"
          onPress={() =>
            router.push({
              pathname: "/(learning)/session-preview",
              params: { lessonId: level.lessonId },
            })
          }
        />
        <Body>{level.lesson.grammar.pattern}</Body>
        <OfflineLesson
          inline
          lessonId={level.lessonId}
          version={level.lesson.version}
        />
      </Panel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["kanji", "word", "radical"] as const).map((value) => (
          <Choice
            key={value}
            label={
              value === "radical"
                ? "Radicals"
                : value === "kanji"
                  ? "Kanji"
                  : "Vocabulary"
            }
            selected={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </View>
      <Panel>
        <ItemGrid
          items={items}
          onPress={(id) =>
            router.push({
              pathname: "/(learning)/item",
              params: { level: String(level.number), kind, id },
            })
          }
        />
      </Panel>
    </Screen>
  );
}
