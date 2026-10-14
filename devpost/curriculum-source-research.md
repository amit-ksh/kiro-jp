# Starter curriculum source checks

Work in progress, retrieved October 14, 2026. These notes prepare original teaching content. They do not publish a lesson, certify audio or claim native-speaker review. The checked app registry still contains requests v1 only.

## Directions: verified records

- [Irodori Starter word list](https://www.irodori.jpf.go.jp/assets/data/wordlist_X.pdf), L16-1, PDF page 56: 入口 / いりぐち / entrance and 出口 / でぐち / exit. L13-3 also contains the exit reading. PDF ruby splits characters across extracted lines, so searching a whole kanji word can miss it; the romaji lookup located the record.
- [Irodori Elementary 1 word list](https://www.irodori.jpf.go.jp/assets/data/wordlist_Y.pdf), L6-2, PDF page 16: 左 / ひだり / left and 右 / みぎ / right. The following page contains 神社 / じんじゃ / shrine, useful as supported context vocabulary rather than an extra assessed target.
- [Japan Foundation sentence-pattern reference](https://www.jpf.go.jp/j/urawa/j_rsorcs/textbook/setsumei_pdf/setsumei02_4.pdf), printed page 20: a classroom-location question uses Nはどこですか with a place answer ending in です. Its main topic is の; do not describe the whole sheet as a dedicated directions lesson.
- [Irodori Starter lesson 8](https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L08.pdf), L8-18 and L8-21: location questions and short です answers; distinguishes people with います from things with あります. The new lesson can focus on the simpler location question and supported right/left answers without teaching both verb systems as mastered grammar.
- [Marugoto Starter English wordbook](https://www.marugoto-online.jp/a1/support/pdf/MarugotoStarterWordbook_eng.pdf), printed page 58: corroborates the four kana readings. Some English glyphs are garbled in extracted text, so the clear Irodori records above are the primary lexical checks.

## Modeling issue to resolve before activation

The existing `LessonWord.meaning` serves both the kanji and its vocabulary word. This works for 水/water but is insufficient for 入 paired with 入口: a compound's meaning must not become the accepted meaning of its individual kanji. Add a separate word gloss while preserving the immutable requests v1 snapshot. Explain supported 口 in 入口/出口, teach the whole-word readings, and keep kanji meaning recall, word reading and vocabulary understanding distinct. Check the individual kanji glosses against an appropriate primary dictionary/source before marking the new lesson source-checked.

## Activation work still required

Author the original examples, mnemonics, word-specific reading notes, kana group and approved-answer exercises; check complete sentence segments/readings, alternative patterns and politeness. Bind the tutor to the selected lesson's target instead of the request-only rubric/forms. Add exact-version audio records, consistency checks and an immutable content package; generalize authoring/validation/publishing commands and native package/audio selection. Register only after those gates pass, then verify the full new lesson, speech, conversation, recap and reviews on Android. Repeat for the remaining five templates and their prerequisite rules. No textbook text, audio or PDF is being redistributed from these checks.
