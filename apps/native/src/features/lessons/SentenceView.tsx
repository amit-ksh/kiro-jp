import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { CheckedSentence } from "@packages/learning-core";
import { Body, useColors } from "../../components/ui";
export function SentenceView({ sentence, romaji, readings, translation }: { sentence: CheckedSentence; romaji: boolean; readings: boolean; translation: boolean }) {
  const colors = useColors(); const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={`Break down ${sentence.text}`} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={{ color: colors.onSurface, fontSize: 25, lineHeight: 38, fontWeight: "600" }}>{sentence.text}</Text></Pressable>{readings && <Body>{sentence.reading}</Body>}{romaji && <Body muted>{sentence.romaji}</Body>}{translation && <Body>{sentence.meaning}</Body>}{expanded && <View style={{ gap: 8 }}>{sentence.segments.filter(segment => segment.text !== "。").map((segment, index) => <Body key={index}>{segment.text} · {segment.reading} · {segment.meaning}</Body>)}</View>}</View>;
}
