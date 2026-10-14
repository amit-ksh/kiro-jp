import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalTutorPhrase } from "../packages/learning-core/src/readings.ts";
test("generated romaji follows its kana reading, including loanwords and doubled consonants", () => {
  assert.equal(
    canonicalTutorPhrase({
      japanese: "サンドイッチ",
      reading: "さんどいっち",
      romaji: "sandicchi",
      english: "sandwich",
    }).romaji,
    "sandoitchi",
  );
  assert.equal(
    canonicalTutorPhrase({
      japanese: "本",
      reading: "ほん",
      romaji: "wrong",
      english: "book",
    }).romaji,
    "hon",
  );
  assert.throws(() =>
    canonicalTutorPhrase({
      japanese: "水",
      reading: "水",
      romaji: "mizu",
      english: "water",
    }),
  );
});
