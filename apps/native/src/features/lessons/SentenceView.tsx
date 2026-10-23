import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CheckedSentence } from "@packages/learning-core";
import { grammarReferences } from "@packages/content";
import { router } from "expo-router";
import { Body, Button, useColors, useTextScale } from "../../components/ui";
export function SentenceView({
  sentence,
  romaji,
  readings,
  translation,
  grammarLinks = true,
  compact = false,
}: {
  sentence: CheckedSentence;
  romaji: boolean;
  readings: boolean;
  translation: boolean;
  grammarLinks?: boolean;
  compact?: boolean;
}) {
  const palette = useColors(),
    scale = useTextScale();
  const colors = compact
    ? { ...palette, onSurface: palette.studyInk, muted: palette.studyMuted }
    : palette;
  const supportStyle = compact
    ? { color: colors.muted, fontSize: 14 * scale, lineHeight: 22 * scale }
    : undefined;
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
            fontSize: compact ? 18 * scale : 25,
            lineHeight: compact ? 29 * scale : 38,
            fontWeight: compact ? "400" : "600",
          }}
        >
          {sentence.text}
        </Text>
      </Pressable>
      {readings && <Body style={supportStyle}>{sentence.reading}</Body>}
      {romaji && (
        <Body muted style={supportStyle}>
          {sentence.romaji}
        </Body>
      )}
      {translation && <Body style={supportStyle}>{sentence.meaning}</Body>}
      {expanded && (
        <View style={{ gap: 8 }}>
          {sentence.segments
            .filter((segment) => segment.text !== "。")
            .map((segment, index) => (
              <Body
                key={index}
                style={compact ? { color: colors.onSurface } : undefined}
              >
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
