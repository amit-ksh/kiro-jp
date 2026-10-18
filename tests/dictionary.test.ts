import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  jmdictCandidates,
  kanjidicFacts,
  kradFacts,
} from "../scripts/lib/dictionary-source.mjs";
import { dictionaryCatalog } from "../packages/content/src/dictionary-data.ts";
import {
  assertDictionaryCatalog,
  findDictionaryEntry,
} from "../packages/content/src/dictionary.ts";
import { preparedLessons } from "../packages/content/src/curriculum.ts";
import {
  componentLessons,
  kanjiComponentStories,
  componentPosition,
} from "../packages/content/src/component-lessons.ts";
import { kanjiParts } from "../packages/content/src/kanji-parts.ts";
import { starterRadicals } from "../packages/content/src/levels.ts";
test("each taught component has a recognition lesson and each kanji has an original component story", () => {
  for (const [kanji, parts] of Object.entries(kanjiParts)) {
    assert(kanjiComponentStories[kanji]);
    for (const part of parts)
      assert(componentLessons[part.glyph]?.note, `${kanji}: ${part.glyph}`);
  }
  for (const radical of starterRadicals)
    assert(componentLessons[radical.glyph]?.note);
  assert.equal(componentPosition("tare"), "around the top and left");
  assert.equal(componentPosition("kamae"), "enclosing");
  assert(
    kanjiComponentStories.話.includes("言") &&
      kanjiComponentStories.話.includes("舌"),
  );
});
test("JMdict bindings respect spelling, reading and sense restrictions", () => {
  const source = `<!ENTITY n "noun (common)"><entry><ent_seq>123</ent_seq><k_ele><keb>生</keb></k_ele><k_ele><keb>性</keb></k_ele><r_ele><reb>せい</reb><re_restr>性</re_restr></r_ele><r_ele><reb>なま</reb><re_restr>生</re_restr></r_ele><sense><pos>&n;</pos><stagk>生</stagk><stagr>なま</stagr><gloss>raw</gloss><gloss xml:lang="ger">roh</gloss></sense><sense><stagk>性</stagk><gloss>nature</gloss></sense></entry>`;
  const result = jmdictCandidates(source, [
    { word: "生", reading: "なま" },
    { word: "生", reading: "せい" },
    { word: "性", reading: "せい" },
  ]);
  assert.deepEqual(result.get("生|なま")?.[0].senses, [
    { number: 1, glosses: ["raw"], pos: ["noun (common)"] },
  ]);
  assert.deepEqual(result.get("生|せい"), []);
  assert.deepEqual(result.get("性|せい")?.[0].senses, [
    { number: 2, glosses: ["nature"], pos: ["noun (common)"] },
  ]);
});
test("kana-only readings are not attached to a kanji spelling", () => {
  const source =
    "<entry><ent_seq>1</ent_seq><k_ele><keb>物</keb></k_ele><r_ele><reb>もの</reb><re_nokanji/></r_ele><sense><gloss>thing</gloss></sense></entry>";
  assert.deepEqual(
    jmdictCandidates(source, [{ word: "物", reading: "もの" }]).get("物|もの"),
    [],
  );
});
test("kanji facts retain English meanings and separate reading types", () => {
  const source =
    '<character><literal>茶</literal><misc><stroke_count>9</stroke_count></misc><radical><rad_value rad_type="classical">140</rad_value></radical><reading_meaning><rmgroup><reading r_type="ja_on">チャ</reading><reading r_type="pinyin">cha2</reading><meaning>tea</meaning><meaning m_lang="fr">thé</meaning></rmgroup></reading_meaning></character>';
  assert.deepEqual(kanjidicFacts(source, ["茶"]), {
    茶: {
      meanings: ["tea"],
      strokeCount: 9,
      radical: 140,
      on: ["チャ"],
      kun: [],
    },
  });
  assert.throws(() => kanjidicFacts(source, ["水"]));
});
test("KRADFILE is a lookup component set, distinct from a single radical", () => {
  assert.deepEqual(
    kradFacts("# source\n話 : 言 口 舌\n水 : 水\n", ["話", "水"]),
    { 話: ["言", "口", "舌"], 水: ["水"] },
  );
  assert.throws(() => kradFacts("水 : 水", ["茶"]));
});
test("starter dictionary has stable source identities and complete bidirectional connections", () => {
  assertDictionaryCatalog(dictionaryCatalog);
  assert.equal(dictionaryCatalog.entries.length, 68);
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        sources: dictionaryCatalog.sources,
        entries: dictionaryCatalog.entries,
      }),
    )
    .digest("hex");
  assert.equal(dictionaryCatalog.release, "starter-" + digest.slice(0, 16));
  for (const entry of dictionaryCatalog.entries)
    for (const key of entry.relatedKeys)
      assert(
        dictionaryCatalog.entries
          .find((item) => item.key === key)
          ?.relatedKeys.includes(entry.key),
      );
  for (const lesson of preparedLessons)
    for (const word of lesson.words) {
      const entry = findDictionaryEntry(
        dictionaryCatalog.entries,
        "vocabulary",
        word.word,
        word.reading,
      );
      assert(entry);
      assert(entry.lessonIds.includes(lesson.id));
      assert(entry.sourceEntryIds.every((id) => /^\d+#sense-\d+$/u.test(id)));
    }
  assert.equal(
    findDictionaryEntry(dictionaryCatalog.entries, "kanji", "水")
      ?.radicalNumber,
    85,
  );
  assert.deepEqual(
    findDictionaryEntry(dictionaryCatalog.entries, "kanji", "茶")?.kun,
    [],
  );
  assert(
    !findDictionaryEntry(dictionaryCatalog.entries, "radical", "水")?.readings
      .length,
  );
  const invalid = structuredClone(dictionaryCatalog);
  invalid.entries[0].relatedKeys.push("missing");
  assert.throws(() => assertDictionaryCatalog(invalid));
});
test("dictionary command validates arguments before reading configuration or sources", () => {
  for (const args of [
    ["--unknown"],
    ["--build"],
    ["--check", "--publish"],
    ["--source-dir", "missing"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/dictionary-catalog.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2);
    assert.match(result.stdout, /help:/u);
    assert.doesNotMatch(result.stdout, /KEY|secret|password/iu);
  }
  const version = spawnSync(
    process.execPath,
    ["scripts/dictionary-catalog.mjs", "--version"],
    { encoding: "utf8" },
  );
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), "1.0.0");
});
