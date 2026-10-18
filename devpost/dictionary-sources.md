# Dictionary-backed kanji learning

Checked 2026-10-18 against primary sources. The current increment covers the existing seven-lesson starter inventory; it is not a full WaniKani course or a complete JLPT dictionary curriculum.

- **JMdict:** selected Japanese/English word forms, readings and sense IDs. [Official documentation](https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html) describes spelling/reading restrictions and senses; the importer preserves those restrictions. Only explicitly selected senses are included. Lesson answer aliases are not automatically expanded.
- **KANJIDIC2:** English kanji meanings, on/kun readings, stroke counts and classical radical numbers. The older KANJIDIC count of 6,355 is not the total scope of KANJIDIC2. Existing starter radical checks against Unicode 17 remain intact.
- **Basic KRADFILE:** [official documentation](https://www.edrdg.org/krad/kradinf.html) describes visual lookup elements, including nested shapes and substitute glyphs. These differ from the 214 classical radicals and do not provide a historical derivation or a stroke-by-stroke formula. KRADFILE2/extended derivatives are not imported.
- **KanjiVG:** the existing pinned component glyph/position extract remains the source for visible top-level shape placement. It is kept separate from KRADFILE lookup elements.
- **Kanji alive:** [the official data repository](https://github.com/kanjialive/kanji-data-media) and [credits](https://kanjialive.com/credits/) provide useful CC BY 4.0 data/media but explicitly exclude certain mnemonics and textbook arrangements. No Kanji alive data or RapidAPI dependency is introduced by this increment; it can be evaluated later for specific audio/stroke media.

[EDRDG's licence statement](https://www.edrdg.org/edrdg/licence.html) covers JMdict's Japanese/English data, KANJIDIC2 and basic KRADFILE under CC BY-SA 4.0. The adapted extracts retain that licence, attribution, source links and a monthly update procedure. App Sources and `packages/content/NOTICE.md` expose those acknowledgements. EDRDG states that software using the files need not itself be open source. KanjiVG structure attribution remains separately CC BY-SA 3.0.

The app's original explanations, component recognition notes, memory stories, exercises and reviewed study ordering remain distinct from these reference datasets. No WaniKani lesson text, mnemonic, audio, artwork or proprietary level arrangement is copied; [WaniKani's terms](https://www.wanikani.com/terms) reserve its content. Authorized learner progress import remains a separate feature.

The learner clarified: **kanji remains the main study track**, with radical/component lessons explaining which shapes appear inside each kanji. No new radical-based unlock gates are introduced. Related vocabulary connects those kanji to daily-life examples, grammar and conversation through the existing reviewed lessons.

Implementation: a content-hashed 68-record release is bundled for offline reference and published immutably to global Convex dictionary tables. Exact source-file hashes/dates and JMdict entry/sense IDs are stored with the catalog. The admin-only publishing command accepts no arbitrary record payload; a repeat publish inserts zero rows. These tables contain no learner records and do not alter saved lesson versions, SRS closures or learning-data exports/deletion.
