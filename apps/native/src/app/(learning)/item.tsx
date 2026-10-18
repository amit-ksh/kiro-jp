import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  starterLevels,
  starterRadicals,
  kanjiRadical,
  kanjiReadings,
  kanjiParts,
} from "@packages/content";
import {
  Body,
  Button,
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
  }>();
  const level = starterLevels.find(
    (item) => item.number === Number(params.level),
  );
  const colors = useColors();
  const { profile } = useProfile();
  const [allReadings, setAllReadings] = useState(false);
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
  if (!level || (!radical && !word))
    return (
      <Screen title="Item unavailable">
        <Button
          label="Show levels"
          onPress={() => router.replace("/(learning)/(tabs)/lessons")}
        />
      </Screen>
    );
  const openKanji = (id: string) =>
    router.push({
      pathname: "/(learning)/item",
      params: {
        kind: "kanji",
        id,
        level: String(
          starterLevels.find((item) => item.kanji.includes(id))!.number,
        ),
      },
    });
  const openRadical = (number: number) =>
    router.push({
      pathname: "/(learning)/item",
      params: {
        kind: "radical",
        id: String(number),
        level: String(
          starterLevels.find((item) =>
            item.radicals.some((radical) => radical.number === number),
          )!.number,
        ),
      },
    });
  const dictionary = kanji
    ? kanjiReadings[kanji as keyof typeof kanjiReadings]
    : undefined;
  const parts = kanji ? kanjiParts[kanji as keyof typeof kanjiParts] : [];
  const mainRadical =
    dictionary &&
    starterRadicals.find((item) => item.number === dictionary.radical);
  const glyph = radical?.glyph ?? kanji ?? word!.word;
  return (
    <Screen
      title={radical ? "Radical" : kanji ? "Kanji" : "Vocabulary"}
      subtitle={`Level ${level.number}`}
    >
      <Panel>
        <Text
          style={{
            fontSize: 72 * profile.textScale,
            lineHeight: 100 * profile.textScale,
            textAlign: "center",
            color: colors.onSurface,
          }}
        >
          {glyph}
        </Text>
        <Title>
          {radical?.name ??
            (kanji
              ? word!.meaning
              : (word!.vocabulary?.meaning ?? word!.meaning))}
        </Title>
        {radical ? (
          <>
            <Body muted>
              Dictionary radical {radical.number}
              {radical.glyph !== radical.canonical
                ? ` · ${radical.canonical}`
                : ""}
            </Body>
            <Body>
              A shape used to group and look up kanji. Its English name is a
              memory aid.
            </Body>
          </>
        ) : (
          <Body>{word!.mnemonic}</Body>
        )}
      </Panel>
      {dictionary && (
        <Panel>
          <Title>Readings</Title>
          <Body muted>On’yomi · Chinese-derived</Body>
          <Body style={{ fontSize: 23 }}>
            {(allReadings ? dictionary.on : dictionary.on.slice(0, 3)).join(
              " · ",
            ) || "None listed"}
          </Body>
          <Body muted>Kun’yomi · Native Japanese</Body>
          <Body style={{ fontSize: 23 }}>
            {(allReadings ? dictionary.kun : dictionary.kun.slice(0, 3)).join(
              " · ",
            ) || "None listed"}
          </Body>
          {(dictionary.on.length > 3 || dictionary.kun.length > 3) && (
            <Button
              secondary
              label={
                allReadings ? "Show fewer readings" : "All dictionary readings"
              }
              onPress={() => setAllReadings((value) => !value)}
            />
          )}
          <Body muted>
            A dot separates the kanji reading from its kana ending; a dash marks
            an attached form.
          </Body>
        </Panel>
      )}
      {mainRadical && (
        <Panel>
          <Title>Parts to notice</Title>
          <Button
            secondary
            label={`${mainRadical.glyph} · ${mainRadical.name} radical`}
            onPress={() => openRadical(mainRadical.number)}
          />
          {parts.length ? (
            <View style={{ gap: 12 }}>
              {parts.map((part, index) => {
                const name = starterRadicals.find(
                  (item) =>
                    item.glyph === part.glyph || item.canonical === part.glyph,
                )?.name;
                return (
                  <View
                    key={`${part.glyph}-${index}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <Body style={{ fontSize: 36, lineHeight: 48 }}>
                      {part.glyph}
                    </Body>
                    <Body style={{ flex: 1 }}>
                      {[
                        name,
                        part.position && part.position.replaceAll("-", " "),
                        part.partial && "partial shape",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Component"}
                    </Body>
                  </View>
                );
              })}
            </View>
          ) : (
            <Body>{glyph} is itself the radical shown above.</Body>
          )}
          <Body muted>
            Notice these shapes within {glyph}; other strokes may complete the
            character.
          </Body>
        </Panel>
      )}
      {radical ? (
        <Panel>
          <Title>Kanji using this radical</Title>
          <ItemGrid
            items={starterLevels
              .flatMap((item) => item.kanji)
              .filter((item) => kanjiRadical[item] === radical.number)
              .map((item) => ({ id: item, glyph: item, label: "Kanji" }))}
            onPress={openKanji}
          />
        </Panel>
      ) : (
        <Panel>
          <Title>In a useful word</Title>
          <Body style={{ fontSize: 26 }}>
            {word!.word} · {word!.reading}
          </Body>
          <Body>{word!.readingNote}</Body>
          <SentenceView
            sentence={word!.example}
            romaji={profile.romaji}
            readings={profile.furigana}
            translation={profile.translations}
          />
        </Panel>
      )}
      <Button
        label="Practise in the lesson"
        onPress={() =>
          router.push({
            pathname: "/(learning)/session-preview",
            params: { lessonId: level.lessonId },
          })
        }
      />
      <Button
        label="Sources & reading guide"
        secondary
        onPress={() => router.push("/(learning)/sources")}
      />
    </Screen>
  );
}
