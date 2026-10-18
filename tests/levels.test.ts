import { test } from "node:test";
import assert from "node:assert/strict";
import {
  starterLevels,
  starterRadicals,
  kanjiRadical,
} from "../packages/content/src/levels.ts";
import { preparedLessons } from "../packages/content/src/curriculum.ts";
import { kanjiReadings } from "../packages/content/src/kanji-readings.ts";
import { kanjiParts } from "../packages/content/src/kanji-parts.ts";
test("starter levels cover each checked lesson and introduce each kanji once", () => {
  assert.deepEqual(
    starterLevels.map((level) => level.lessonId),
    preparedLessons.map((lesson) => lesson.id),
  );
  const actual = starterLevels.flatMap((level) => level.kanji),
    expected = [
      ...new Set(
        preparedLessons.flatMap((lesson) =>
          lesson.words.flatMap((word) =>
            [...word.kanji].filter((char) => /\p{Script=Han}/u.test(char)),
          ),
        ),
      ),
    ];
  assert.equal(actual.length, new Set(actual).size);
  assert.deepEqual([...actual].sort(), expected.sort());
});
test("checked readings and component references cover the complete starter inventory", () => {
  const inventory = starterLevels.flatMap((level) => level.kanji).sort();
  assert.deepEqual(Object.keys(kanjiReadings).sort(), inventory);
  assert.deepEqual(Object.keys(kanjiParts).sort(), inventory);
  for (const kanji of inventory) {
    const reading = kanjiReadings[kanji as keyof typeof kanjiReadings];
    assert.equal(reading.radical, kanjiRadical[kanji]);
    assert(reading.on.length + reading.kun.length > 0, kanji);
    assert(
      reading.on.every((item) => /^[ァ-ヺー-]+$/u.test(item)),
      kanji,
    );
    assert(
      reading.kun.every((item) => /^[ぁ-ゖー.-]+$/u.test(item)),
      kanji,
    );
  }
  assert.deepEqual(kanjiReadings.茶.kun, []);
  assert.deepEqual(
    kanjiParts.話.map((part) => part.glyph),
    ["言", "舌"],
  );
  assert.deepEqual(kanjiParts.水, []);
});
test("every starter kanji has a defined radical introduced by its level", () => {
  const available = new Set<number>();
  for (const level of starterLevels) {
    for (const radical of level.radicals) available.add(radical.number);
    for (const kanji of level.kanji) {
      assert(available.has(kanjiRadical[kanji]), kanji);
      assert(
        starterRadicals.some(
          (radical) => radical.number === kanjiRadical[kanji],
        ),
      );
    }
  }
  assert.equal(
    starterLevels.flatMap((level) => level.radicals).length,
    available.size,
  );
});
