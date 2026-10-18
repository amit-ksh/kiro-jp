import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  starterLevels,
  starterRadicals,
  dictionaryCatalog,
  findDictionaryEntry,
  kanjiParts,
  type DictionaryEntry,
  componentLessons,
  kanjiComponentStories,
  componentPosition,
} from "@packages/content";
import {
  Body,
  Button,
  Choice,
  Panel,
  Screen,
  Title,
  useColors,
} from "../../components/ui";
import { useProfile } from "../../data/ProfileProvider";
import { ItemGrid } from "../../features/lessons/ItemGrid";
import { SentenceView } from "../../features/lessons/SentenceView";
export default function LearningItem() {
  const params = useLocalSearchParams<{
      level: string;
      kind: string;
      id: string;
    }>(),
    level = starterLevels.find((item) => item.number === Number(params.level)),
    colors = useColors(),
    { profile } = useProfile();
  const [section, setSection] = useState<
      "meaning" | "readings" | "connections"
    >("meaning"),
    [details, setDetails] = useState(false);
  const radical =
    params.kind === "radical"
      ? level?.radicals.find((item) => item.number === Number(params.id))
      : undefined;
  const kanji =
    params.kind === "kanji" && level?.kanji.includes(params.id)
      ? params.id
      : undefined;
  const word = level?.lesson.words.find((item) =>
    params.kind === "word"
      ? item.id === params.id
      : kanji && item.kanji.includes(kanji),
  );
  const entry = radical
    ? dictionaryCatalog.entries.find(
        (item) => item.key === `radical:${radical.number}`,
      )
    : kanji
      ? findDictionaryEntry(dictionaryCatalog.entries, "kanji", kanji)
      : word
        ? findDictionaryEntry(
            dictionaryCatalog.entries,
            "vocabulary",
            word.word,
            word.reading,
          )
        : undefined;
  if (!level || !entry)
    return (
      <Screen title="Item unavailable">
        <Button
          label="Show levels"
          onPress={() => router.replace("/(learning)/(tabs)/lessons")}
        />
      </Screen>
    );
  const related = entry.relatedKeys.flatMap((key) => {
    const item = dictionaryCatalog.entries.find((item) => item.key === key);
    return item ? [item] : [];
  });
  const primaryRadical =
    entry.kind === "kanji"
      ? starterRadicals.find((item) => item.number === entry.radicalNumber)
      : undefined;
  const parts = kanji ? kanjiParts[kanji as keyof typeof kanjiParts] : [];
  const open = (key: string) => {
    const selected = dictionaryCatalog.entries.find((item) => item.key === key);
    if (!selected) return;
    const targetLevel = starterLevels.find((level) =>
      selected.kind === "radical"
        ? level.radicals.some((item) => item.number === selected.radicalNumber)
        : selected.kind === "kanji"
          ? level.kanji.includes(selected.characters)
          : level.lesson.words.some(
              (word) =>
                word.word === selected.characters &&
                selected.readings.includes(word.reading),
            ),
    );
    if (!targetLevel) return;
    const id =
      selected.kind === "radical"
        ? String(selected.radicalNumber)
        : selected.kind === "kanji"
          ? selected.characters
          : targetLevel.lesson.words.find(
              (word) =>
                word.word === selected.characters &&
                selected.readings.includes(word.reading),
            )!.id;
    router.push({
      pathname: "/(learning)/item",
      params: {
        kind: selected.kind === "vocabulary" ? "word" : selected.kind,
        id,
        level: String(targetLevel.number),
      },
    });
  };
  const connections = (kind: DictionaryEntry["kind"]) =>
    related
      .filter((item) => item.kind === kind)
      .map((item) => ({
        id: item.key,
        glyph: item.characters,
        label: item.meanings[0],
      }));
  return (
    <Screen
      title={
        entry.kind === "vocabulary"
          ? "Vocabulary"
          : entry.kind === "kanji"
            ? "Kanji"
            : "Radical"
      }
      subtitle={`Level ${level.number}`}
    >
      <Panel>
        <Text
          style={{
            fontSize: 64 * profile.textScale,
            lineHeight: 88 * profile.textScale,
            textAlign: "center",
            color: colors.onSurface,
          }}
        >
          {entry.characters}
        </Text>
        <Title>{entry.meanings[0]}</Title>
        {entry.kind === "vocabulary" && (
          <Body style={{ textAlign: "center", fontSize: 22 }}>
            {entry.readings.join(" · ")}
          </Body>
        )}
        {entry.strokeCount > 0 && (
          <Body muted>{entry.strokeCount} strokes</Body>
        )}
      </Panel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(["meaning", "readings", "connections"] as const)
          .filter((value) => entry.kind !== "radical" || value !== "readings")
          .map((value) => (
            <Choice
              key={value}
              label={
                value === "meaning"
                  ? "Meaning"
                  : value === "readings"
                    ? "Readings"
                    : "Related items"
              }
              selected={section === value}
              onPress={() => setSection(value)}
            />
          ))}
      </View>
      {section === "meaning" && (
        <>
          <Panel>
            <Title>Meaning</Title>
            <Body>{entry.meanings.join(" · ")}</Body>
            {word && (
              <>
                <Title>Memory aid</Title>
                <Body>
                  {kanji ? kanjiComponentStories[kanji] : word.mnemonic}
                </Body>
                {kanji && (
                  <Body muted>
                    Original memory story · not a historical origin
                  </Body>
                )}
              </>
            )}
            {radical && (
              <>
                <Title>Recognize the shape</Title>
                <Body>{componentLessons[radical.glyph]?.note}</Body>
                <Body muted>
                  Look for {radical.glyph}
                  {radical.glyph !== radical.canonical
                    ? ` (a form of ${radical.canonical})`
                    : ""}{" "}
                  in the kanji below. “{radical.name}” names the shape; it is
                  not a word reading.
                </Body>
              </>
            )}
          </Panel>
          {primaryRadical && (
            <Panel>
              <Title>Components</Title>
              <Button
                secondary
                label={`${primaryRadical.glyph} · ${primaryRadical.name} radical`}
                onPress={() => open(`radical:${primaryRadical.number}`)}
              />
              {parts.length ? (
                <View style={{ gap: 12 }}>
                  {parts.map((part, index) => (
                    <Pressable
                      key={`${part.glyph}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Learn component ${part.glyph}, ${componentLessons[part.glyph]?.name ?? "shape"}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(learning)/component",
                          params: { glyph: part.glyph },
                        })
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 16,
                        minHeight: 64,
                      }}
                    >
                      <Body style={{ fontSize: 36, lineHeight: 48 }}>
                        {part.glyph}
                      </Body>
                      <Body style={{ flex: 1 }}>
                        {[
                          componentLessons[part.glyph]?.name,
                          part.position && componentPosition(part.position),
                          part.partial && "partial shape",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Component"}
                      </Body>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Body>
                  {entry.characters} is itself the radical shown above.
                </Body>
              )}
              <Button
                secondary
                label={
                  details ? "Hide component lookup" : "More component details"
                }
                onPress={() => setDetails((value) => !value)}
              />
              {details && (
                <>
                  <Body>
                    KRADFILE lookup elements: {entry.components.join(" · ")}
                  </Body>
                  <Body muted>
                    These can include nested shapes or substitute glyphs. They
                    describe visual lookup parts, not an equation or historical
                    origin.
                  </Body>
                </>
              )}
            </Panel>
          )}
          {radical && (
            <Panel>
              <Title>Used in kanji</Title>
              <ItemGrid items={connections("kanji")} onPress={open} />
            </Panel>
          )}
        </>
      )}
      {section === "readings" && (
        <Panel>
          {entry.kind === "kanji" ? (
            <>
              <Title>On’yomi</Title>
              <Body style={{ fontSize: 23 }}>
                {entry.on.join(" · ") || "None listed"}
              </Body>
              <Body muted>Chinese-derived readings</Body>
              <Title>Kun’yomi</Title>
              <Body style={{ fontSize: 23 }}>
                {entry.kun.join(" · ") || "None listed"}
              </Body>
              <Body muted>
                Native Japanese readings. A dot separates the kanji reading from
                its kana ending; a dash marks an attached form.
              </Body>
            </>
          ) : (
            <>
              <Title>Word reading</Title>
              <Body style={{ fontSize: 26 }}>{entry.readings.join(" · ")}</Body>
            </>
          )}
          {word && (
            <>
              <Title>In this lesson</Title>
              <Body style={{ fontSize: 24 }}>
                {word.word} · {word.reading}
              </Body>
              <Body>{word.readingNote}</Body>
            </>
          )}
        </Panel>
      )}
      {section === "connections" && (
        <>
          {(["radical", "kanji", "vocabulary"] as const).map((kind) => {
            const items = connections(kind);
            return items.length ? (
              <Panel key={kind}>
                <Title>
                  {kind === "radical"
                    ? "Radicals"
                    : kind === "kanji"
                      ? "Kanji"
                      : "Vocabulary"}
                </Title>
                <ItemGrid items={items} onPress={open} />
              </Panel>
            ) : null;
          })}
          {word && (
            <Panel>
              <Title>In a sentence</Title>
              <SentenceView
                sentence={word.example}
                romaji={profile.romaji}
                readings={profile.furigana}
                translation={profile.translations}
              />
            </Panel>
          )}
        </>
      )}
      <Button
        label="Learn & practise"
        onPress={() =>
          router.push({
            pathname: "/(learning)/session-preview",
            params: { lessonId: level.lessonId },
          })
        }
      />
      <Button
        label="Sources"
        secondary
        onPress={() => router.push("/(learning)/sources")}
      />
    </Screen>
  );
}
