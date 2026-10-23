import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { AudioSource } from "expo-audio";
import type { PreparedLesson } from "@packages/learning-core";
import { Button, useColors, useTextScale } from "../../components/ui";
import { useAppBack } from "../../navigation/useAppBack";
import { AudioPlay } from "../speech/AudioPlay";
import { SentenceView } from "./SentenceView";

export function WordStudyScreen({
  lesson,
  word,
  sessionId,
  audio,
  settings,
  busy,
  error,
  onInteract,
  onContinue,
  onSpeak,
}: {
  lesson: PreparedLesson;
  word: PreparedLesson["words"][number];
  sessionId: string;
  audio: Record<string, AudioSource>;
  settings: { romaji: boolean; readings: boolean; translation: boolean };
  busy: boolean;
  error: string;
  onInteract: () => void;
  onContinue: () => void;
  onSpeak: () => void;
}) {
  const colors = useColors(),
    scale = useTextScale(),
    back = useAppBack();
  const scheme = useColorScheme();
  useFocusEffect(
    useCallback(() => {
      const entry = StatusBar.pushStackEntry({
        barStyle: scheme === "dark" ? "light-content" : "dark-content",
      });
      return () => StatusBar.popStackEntry(entry);
    }, [scheme]),
  );
  const [notesOpen, setNotesOpen] = useState(false);
  const position = lesson.words.findIndex((item) => item.id === word.id) + 1;
  const meaning = word.vocabulary?.meaning ?? word.meaning;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.studyBackground }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 22,
          flexGrow: 1,
          maxWidth: 560,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={back}
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              justifyContent: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={25} color={colors.studyInk} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              fontSize: 14 * scale,
              lineHeight: 21 * scale,
              color: colors.studyMuted,
            }}
          >
            {lesson.title}
          </Text>
          <View
            style={{ alignItems: "flex-end" }}
            accessibilityLabel={`Word ${position} of ${lesson.words.length}`}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.secondary,
                }}
              />
              <Text
                style={{
                  fontSize: 24,
                  fontWeight: "600",
                  fontVariant: ["tabular-nums"],
                  color: colors.studyInk,
                }}
              >
                {position}
                <Text style={{ fontSize: 14, color: colors.studyMuted }}>
                  /{lesson.words.length}
                </Text>
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: colors.studyMuted }}>
              words
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 18,
            paddingVertical: 8,
          }}
        >
          {lesson.words.map((item) => (
            <Text
              key={item.id}
              accessibilityLabel={`${item.word}${item.id === word.id ? ", current word" : ""}`}
              style={{
                color: colors.studyMuted,
                fontSize: 15 * scale,
                lineHeight: 24 * scale,
                fontWeight: item.id === word.id ? "700" : "400",
              }}
            >
              {item.word}
            </Text>
          ))}
        </View>
        <View
          onTouchStart={onInteract}
          style={{
            backgroundColor: colors.studySurface,
            borderRadius: 28,
            padding: 24,
            gap: 28,
            flexGrow: 1,
          }}
        >
          <Text
            accessibilityLanguage="ja-JP"
            style={{
              color: colors.studyInk,
              fontSize: (word.word.length > 3 ? 64 : 88) * scale,
              lineHeight: (word.word.length > 3 ? 84 : 112) * scale,
              fontWeight: "400",
              paddingVertical: 6,
            }}
          >
            {word.word}
          </Text>
          <View style={{ gap: 6 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.studyInk,
                fontSize: 30 * scale,
                lineHeight: 39 * scale,
                fontWeight: "600",
              }}
            >
              {meaning.charAt(0).toUpperCase() + meaning.slice(1)}
            </Text>
            {settings.readings && (
              <Text
                accessibilityLanguage="ja-JP"
                style={{
                  color: colors.studyMuted,
                  fontSize: 16 * scale,
                  lineHeight: 25 * scale,
                }}
              >
                {word.reading}
              </Text>
            )}
            {settings.romaji && (
              <Text
                style={{
                  color: colors.studyMuted,
                  fontSize: 14 * scale,
                  lineHeight: 22 * scale,
                }}
              >
                {word.romaji[0]}
              </Text>
            )}
            {(word.word !== word.kanji || word.vocabulary) && (
              <Text
                style={{ color: colors.studyMuted, fontSize: 13, marginTop: 4 }}
              >
                Kanji · {word.kanji} — {word.meaning}
              </Text>
            )}
            <AudioPlay
              compact
              key={`word-${word.id}`}
              source={audio[`word-${word.id}`]}
              label={word.word}
              sessionId={sessionId}
            />
          </View>
          <View style={{ gap: 6 }}>
            <SentenceView compact sentence={word.example} {...settings} />
            <AudioPlay
              compact
              key={`sentence-${word.id}`}
              source={audio[word.example.id]}
              label={word.example.text}
              sessionId={sessionId}
            />
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Memory aid and reading notes"
            accessibilityState={{ expanded: notesOpen }}
            onPress={() => {
              onInteract();
              setNotesOpen((value) => !value);
            }}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text
              style={{ color: colors.studyInk, fontSize: 15 * scale, flex: 1 }}
            >
              Memory aid & reading notes
            </Text>
            <Ionicons
              name={notesOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.studyMuted}
            />
          </Pressable>
          {notesOpen && (
            <View style={{ gap: 12, paddingBottom: 12 }}>
              {[
                word.mnemonic,
                "Memory aid; not an etymology.",
                word.readingNote,
              ].map((note, index) => (
                <Text
                  key={index}
                  style={{
                    color: colors.studyMuted,
                    fontSize: 15 * scale,
                    lineHeight: 25 * scale,
                  }}
                >
                  {note}
                </Text>
              ))}
            </View>
          )}
          <Button
            label="I studied this word"
            disabled={busy}
            onPress={onContinue}
          />
          <Button
            label="Practise this word aloud"
            secondary
            disabled={busy}
            onPress={onSpeak}
          />
          {!!error && (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.error, fontSize: 16, lineHeight: 25 }}
            >
              {error}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
