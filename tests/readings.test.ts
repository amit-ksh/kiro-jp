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
test("supported spoken particle spelling survives kana validation without altering syllables inside words", () => {
  assert.equal(
    canonicalTutorPhrase({
      japanese: "入口はどこですか。",
      reading: "いりぐちはどこですか",
      romaji: "iriguchi wa doko desu ka",
      english: "Where is the entrance?",
    }).romaji,
    "iriguchi wa doko desu ka",
  );
  assert.equal(
    canonicalTutorPhrase({
      japanese: "水をください。",
      reading: "みずをください",
      romaji: "mizu o kudasai",
      english: "Water, please.",
    }).romaji,
    "mizu o kudasai",
  );
  assert.equal(
    canonicalTutorPhrase({
      japanese: "駅へ行きます。",
      reading: "えきへいきます",
      romaji: "eki e ikimasu",
      english: "I go to the station.",
    }).romaji,
    "eki e ikimasu",
  );
  assert.equal(
    canonicalTutorPhrase({
      japanese: "葉",
      reading: "は",
      romaji: "wa",
      english: "leaf",
    }).romaji,
    "ha",
  );
  assert.equal(
    canonicalTutorPhrase({
      japanese: "花",
      reading: "はな",
      romaji: "wana",
      english: "flower",
    }).romaji,
    "hana",
  );
});
test("the two checked beginner greetings keep wa while lexical ha remains unchanged",()=>{
 for(const [japanese,romaji] of [["こんにちは","konnichiwa"],["こんばんは","konbanwa"]]){
  assert.equal(canonicalTutorPhrase({japanese,reading:japanese,romaji,english:"greeting"}).romaji,romaji);
  assert.equal(canonicalTutorPhrase({japanese,reading:japanese,romaji:"wrong",english:"greeting"}).romaji,romaji);
 }
 assert.equal(canonicalTutorPhrase({japanese:"はな",reading:"はな",romaji:"wrong",english:"flower"}).romaji,"hana");
});
