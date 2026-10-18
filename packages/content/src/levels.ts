import { preparedLessons } from "./curriculum.ts";
import type { PreparedLesson } from "@packages/learning-core";
export const radicalSource = {
  url: "https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip",
  file: "Unihan_IRGSources.txt · kRSUnicode",
  names: "https://www.unicode.org/charts/PDF/U2F00.pdf",
  checkedAt: "2026-10-18",
} as const;
export const starterRadicals = [
  { number: 9, glyph: "亻", canonical: "人", name: "Person" },
  { number: 11, glyph: "入", canonical: "入", name: "Enter" },
  { number: 13, glyph: "冂", canonical: "冂", name: "Enclosure" },
  { number: 17, glyph: "凵", canonical: "凵", name: "Open box" },
  { number: 30, glyph: "口", canonical: "口", name: "Mouth" },
  { number: 48, glyph: "工", canonical: "工", name: "Work" },
  { number: 53, glyph: "广", canonical: "广", name: "Shelter" },
  { number: 69, glyph: "斤", canonical: "斤", name: "Axe" },
  { number: 72, glyph: "日", canonical: "日", name: "Sun" },
  { number: 73, glyph: "曰", canonical: "曰", name: "Say" },
  { number: 75, glyph: "木", canonical: "木", name: "Tree" },
  { number: 85, glyph: "水", canonical: "水", name: "Water" },
  { number: 128, glyph: "耳", canonical: "耳", name: "Ear" },
  { number: 140, glyph: "艹", canonical: "艸", name: "Grass" },
  { number: 144, glyph: "行", canonical: "行", name: "Walk" },
  { number: 147, glyph: "見", canonical: "見", name: "See" },
  { number: 149, glyph: "言", canonical: "言", name: "Speech" },
  { number: 154, glyph: "貝", canonical: "貝", name: "Shell" },
  { number: 180, glyph: "音", canonical: "音", name: "Sound" },
  { number: 184, glyph: "食", canonical: "食", name: "Eat" },
] as const;
export const kanjiRadical: Readonly<Record<string, number>> = {
  水: 85,
  茶: 140,
  本: 75,
  円: 13,
  入: 11,
  出: 17,
  右: 30,
  左: 48,
  日: 72,
  音: 180,
  楽: 75,
  店: 53,
  新: 69,
  古: 30,
  行: 144,
  見: 147,
  食: 184,
  飲: 184,
  読: 149,
  書: 73,
  話: 149,
  聞: 128,
  買: 154,
  作: 9,
};
const seenKanji = new Set<string>(),
  seenRadicals = new Set<number>();
export const starterLevels = (preparedLessons as readonly PreparedLesson[]).map(
  (lesson, index) => {
    const kanji = [
      ...new Set(
        lesson.words.flatMap((word) =>
          [...word.kanji].filter((character) =>
            /\p{Script=Han}/u.test(character),
          ),
        ),
      ),
    ].filter((character) => {
      if (seenKanji.has(character)) return false;
      seenKanji.add(character);
      return true;
    });
    const radicalNumbers = [
      ...new Set(kanji.map((character) => kanjiRadical[character])),
    ].filter((number) => {
      if (!number || seenRadicals.has(number)) return false;
      seenRadicals.add(number);
      return true;
    });
    return {
      number: index + 1,
      lessonId: lesson.id,
      title: lesson.title,
      jlpt: lesson.level ?? (lesson.entry ? "N4" : "N5"),
      kanji,
      radicals: starterRadicals.filter((radical) =>
        radicalNumbers.includes(radical.number),
      ),
      lesson,
    };
  },
);
