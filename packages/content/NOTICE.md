# Dictionary and kanji-structure sources

`src/dictionary-data.ts` is a versioned starter catalog of 20 original radical labels, 24 kanji and 24 vocabulary entries. Its dictionary facts are extracts/adaptations of EDRDG's JMdict (selected English senses), KANJIDIC2 (English meanings, Japanese readings, classical radical numbers and stroke counts), and the basic KRADFILE (visual lookup elements), copyright James William Breen and EDRDG, under **CC BY-SA 4.0**. KRADFILE's header also credits Michael Raine. Those adapted extracts retain CC BY-SA 4.0. Original radical labels are marked separately; original teaching explanations/mnemonics and software are not represented as EDRDG material.

The catalog records source URLs, compressed-source SHA-256 hashes, dictionary creation dates (KRADFILE's date is retrieval/as-of date), exact JMdict entry/sense IDs, lesson links and a content-derived release ID. `dictionary-selection.json` explicitly selects the senses being referenced. These glosses are reference information and do not automatically become accepted quiz answers. Global Convex dictionary records contain no learner data, and previous published releases remain immutable. The app bundles the same catalog for offline access.

To update, at least monthly, download the three official files linked by `node scripts/dictionary-catalog.mjs --help`, then run `node --experimental-strip-types scripts/dictionary-catalog.mjs --build --source-dir <directory>`. Inspect changed IDs/readings/senses and `dictionary-selection.json`; run `pnpm dictionary:check`, content checks, tests and types. Deploy the checked backend and run the same command with `--publish` to publish the exact catalog to the configured development backend. The command does not fetch sources or change learner schedules. Updated teaching/answer keys require their own reviewed lesson version.

- [JMdict documentation](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html)
- [KRADFILE documentation](https://www.edrdg.org/krad/kradinf.html)
- [EDRDG dictionary licence](https://www.edrdg.org/edrdg/licence.html)

`src/kanji-readings.ts` is a 24-character extract of KANJIDIC2: Japanese on/kun readings and classical radical numbers only. KANJIDIC2 is copyright James William Breen and the Electronic Dictionary Research and Development Group (EDRDG), used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The extract retains that licence. No SKIP, Four Corner, Korean, Pinyin or other separately attributed dictionary codes are included.

- [KANJIDIC project and documentation](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project)
- [EDRDG licence and copyright statement](https://www.edrdg.org/edrdg/licence.html)
- [Source download](https://www.edrdg.org/kanjidic/kanjidic2.xml.gz)

`src/kanji-parts.ts` adapts component glyphs, positions and partial-component flags from KanjiVG, copyright Ulrich Apel and contributors, under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). This adapted structure data retains that licence. SVG stroke artwork is not redistributed in the app. Its pinned source revision is recorded in the file.

- [KanjiVG](https://kanjivg.tagaini.net/)
- [Structure documentation](https://kanjivg.tagaini.net/svg-format.html)
- [Source repository](https://github.com/KanjiVG/kanjivg)

Radical numbers were also checked against Unicode 17.0 `Unihan_IRGSources.txt`, `kRSUnicode`. Radical names use short English learning labels based on the Kangxi radical names; these labels are not word readings. Components describe visible structure, not a historical or pronunciation derivation.

Update procedure: at least monthly, download the latest KANJIDIC2 source, inspect its creation date, and refresh only `ja_on`, `ja_kun` and classical radical fields for the starter characters. Refresh KanjiVG to a pinned revision when appropriate, retaining top-level named parts, position and partial flag. Retain attribution/licence headers, record source dates/revisions, compare radicals against Unihan, and run content/type checks before publishing. The app exposes Sources from Settings and kanji details.
