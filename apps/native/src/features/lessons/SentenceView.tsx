import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CheckedSentence } from "@packages/learning-core";
import { grammarReferences } from "@packages/content";
import { router } from "expo-router";
import { Body, Button, useColors } from "../../components/ui";
export function SentenceView({
  sentence,
  romaji,
  readings,
  translation,
  grammarLinks = true,
}: {
  sentence: CheckedSentence;
  romaji: boolean;
  readings: boolean;
  translation: boolean;
  grammarLinks?: boolean;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const grammar = grammarLinks
    ? grammarReferences.filter((entry) =>
        sentence.segments.some(
          (segment) => segment.grammar === entry.lesson.grammar.id,
        ),
      )
    : [];
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Break down ${sentence.text}`}
        onPress={() => setExpanded((value) => !value)}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text
          style={{
            color: colors.onSurface,
            fontSize: 25,
            lineHeight: 38,
            fontWeight: "600",
          }}
        >
          {sentence.text}
        </Text>
      </Pressable>
      {readings && <Body>{sentence.reading}</Body>}
      {romaji && <Body muted>{sentence.romaji}</Body>}
      {translation && <Body>{sentence.meaning}</Body>}
      {expanded && (
        <View style={{ gap: 8 }}>
          {sentence.segments
            .filter((segment) => segment.text !== "。")
            .map((segment, index) => (
              <Body key={index}>
                {segment.text} · {segment.reading} · {segment.meaning}
              </Body>
            ))}
          {grammar.map((entry) => (
            <Button
              key={entry.id}
              label={`Explain ${entry.lesson.grammar.pattern}`}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(learning)/grammar/[id]",
                  params: { id: entry.id },
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}
