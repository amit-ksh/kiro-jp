import type {
  CheckedSentence,
  LessonWord,
  PreparedLesson,
} from "@packages/learning-core";
const grammarId = "desire-tai";
function desire(
  id: string,
  object: { text: string; reading: string; romaji: string; meaning: string },
  particle: "に" | "を" | "が",
  stem: { text: string; reading: string; romaji: string; meaning: string },
  meaning: string,
): CheckedSentence {
  return {
    id,
    text: `${object.text}${particle}${stem.text}たいです。`,
    reading: `${object.reading}${particle}${stem.reading}たいです`,
    romaji: `${object.romaji} ${particle === "に" ? "ni" : particle === "が" ? "ga" : "o"} ${stem.romaji}tai desu`,
    meaning,
    segments: [
      { text: object.text, reading: object.reading, meaning: object.meaning },
      {
        text: particle,
        reading: particle,
        meaning:
          particle === "に"
            ? "marks the destination"
            : "marks the thing involved in the desired action",
      },
      { text: stem.text, reading: stem.reading, meaning: stem.meaning },
      {
        text: "たい",
        reading: "たい",
        meaning: "want to do the action",
        grammar: grammarId,
      },
      {
        text: "です",
        reading: "です",
        meaning: "polite ending",
        grammar: grammarId,
      },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const japan = {
  text: "日本",
  reading: "にほん",
  romaji: "nihon",
  meaning: "Japan (supported word from the favorites lesson)",
};
const anime = {
  text: "アニメ",
  reading: "あにめ",
  romaji: "anime",
  meaning: "anime / animation",
};
const sushi = {
  text: "すし",
  reading: "すし",
  romaji: "sushi",
  meaning: "sushi",
};
const water = {
  text: "水",
  reading: "みず",
  romaji: "mizu",
  meaning: "water (supported word, not an extra recall target)",
};
const goStem = {
  text: "行き",
  reading: "いき",
  romaji: "iki",
  meaning: "masu stem of 行く, go",
};
const seeStem = {
  text: "見",
  reading: "み",
  romaji: "mi",
  meaning: "masu stem of 見る, see/watch",
};
const eatStem = {
  text: "食べ",
  reading: "たべ",
  romaji: "tabe",
  meaning: "masu stem of 食べる, eat",
};
const drinkStem = {
  text: "飲み",
  reading: "のみ",
  romaji: "nomi",
  meaning: "masu stem of 飲む, drink",
};
const go = desire("want-go", japan, "に", goStem, "I want to go to Japan.");
const watch = desire(
  "want-watch",
  anime,
  "を",
  seeStem,
  "I want to watch anime.",
);
const eat = desire("want-eat", sushi, "を", eatStem, "I want to eat sushi.");
const drink = desire(
  "want-drink",
  water,
  "を",
  drinkStem,
  "I want to drink water.",
);
const drinkGa = desire(
  "want-drink-ga",
  water,
  "が",
  drinkStem,
  "I want to drink water.",
);
const question: CheckedSentence = {
  id: "want-watch-question",
  text: "アニメを見たいですか。",
  reading: "あにめをみたいですか",
  romaji: "anime o mitai desu ka",
  meaning: "Would you like to watch anime?",
  segments: [
    ...watch.segments.slice(0, -1),
    {
      text: "か",
      reading: "か",
      meaning: "marks a question",
      grammar: grammarId,
    },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const response: CheckedSentence = {
  id: "want-watch-yes",
  text: "はい、見たいです。",
  reading: "はいみたいです",
  romaji: "hai mitai desu",
  meaning: "Yes, I'd like to watch it.",
  segments: [
    { text: "はい", reading: "はい", meaning: "yes" },
    { text: "、", reading: "", meaning: "pause" },
    {
      text: seeStem.text,
      reading: seeStem.reading,
      meaning: "watch the anime just mentioned",
    },
    {
      text: "たい",
      reading: "たい",
      meaning: "want to do the action",
      grammar: grammarId,
    },
    {
      text: "です",
      reading: "です",
      meaning: "polite ending",
      grammar: grammarId,
    },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const words: readonly LessonWord[] = [
  {
    id: "go",
    kanji: "行",
    meaning: "go",
    meaningAliases: ["go", "to go"],
    word: "行く",
    reading: "いく",
    readingAliases: ["いく", "ゆく"],
    romaji: ["iku", "yuku"],
    mnemonic:
      "Picture two sets of footprints beside a path. Link this whole shape with going somewhere.",
    readingNote:
      "行く, to go, is usually いく in our model. ゆく is another accepted reading of the standalone word. Our everyday desire example uses 行く → 行きます → 行きたいです (いく → いきます → いきたいです). 日本 (にほん, Japan) is supported from the favorites lesson; に marks the destination.",
    example: go,
  },
  {
    id: "watch",
    kanji: "見",
    meaning: "see",
    meaningAliases: ["see", "to see", "look", "watch"],
    word: "見る",
    reading: "みる",
    readingAliases: ["みる"],
    romaji: ["miru"],
    mnemonic:
      "Imagine a little screen standing on two feet, ready for you to see a picture. Associate the whole shape with seeing.",
    readingNote:
      "見る is みる, to see, look or watch. For anime, watch is natural English. 見る → 見ます → 見たいです (みる → みます → みたいです). アニメ (あにめ, anime) supplies this session's katakana ア・ニ・メ. Its supported reading remains available.",
    example: watch,
  },
  {
    id: "eat",
    kanji: "食",
    meaning: "eat",
    meaningAliases: ["eat", "to eat", "meal"],
    word: "食べる",
    vocabulary: { meaning: "to eat", meaningAliases: ["to eat", "eat"] },
    reading: "たべる",
    readingAliases: ["たべる"],
    romaji: ["taberu"],
    mnemonic:
      "Imagine a covered lunch tray waiting to be opened. Connect the whole shape with eating a meal.",
    readingNote:
      "The complete verb 食べる is たべる, to eat. 食 can have a meal meaning as a kanji, but 食べる is an action, not the noun meal. 食べる → 食べます → 食べたいです (たべる → たべます → たべたいです). すし, sushi, is supported vocabulary in the example.",
    example: eat,
  },
  {
    id: "drink",
    kanji: "飲",
    meaning: "drink",
    meaningAliases: ["drink", "to drink"],
    word: "飲む",
    reading: "のむ",
    readingAliases: ["のむ"],
    romaji: ["nomu"],
    mnemonic:
      "Picture a cup beside a bent straw. Link this whole shape with taking a drink.",
    readingNote:
      "飲む is のむ, to drink. 飲む → 飲みます → 飲みたいです (のむ → のみます → のみたいです). Keep the み in the desire form. 水 (みず, water) is supported here rather than an additional kanji test. 水を飲みたいです and 水が飲みたいです both express wanting to drink water.",
    example: drink,
  },
];
const kana = [
  {
    character: "ア",
    sound: "a",
    note: "Katakana a, the first character of アニメ. It has the same sound as hiragana あ, with a different shape.",
  },
  {
    character: "ニ",
    sound: "ni",
    note: "Katakana ni, in the middle of アニメ. Compare it with hiragana に without assuming the shapes are the same.",
  },
  {
    character: "メ",
    sound: "me",
    note: "Katakana me, at the end of アニメ. Listen to each character and then the whole word.",
  },
];
const ownAccepted = [
  "日本に行きたいです",
  "にほんにいきたいです",
  "日本へ行きたいです",
  "にほんへいきたいです",
  "アニメを見たいです",
  "あにめをみたいです",
  "アニメが見たいです",
  "あにめがみたいです",
  "すしを食べたいです",
  "すしをたべたいです",
  "すしが食べたいです",
  "すしがたべたいです",
  "水を飲みたいです",
  "みずをのみたいです",
  "水が飲みたいです",
  "みずがのみたいです",
  "アニメを見たいですか",
  "あにめをみたいですか",
];
export const desireLesson: PreparedLesson = {
  id: "desire",
  version: 1,
  title: "Say what you want to do",
  outcome: "Say an activity you would like to do and ask a friend about theirs",
  words,
  kana,
  grammar: {
    id: grammarId,
    pattern: "[verb masu-stem] + たいです",
    explanation:
      "To say what you want to do, take the taught polite ます form, remove ます, and add たいです. Use the forms shown with each word: 行きます → 行きたいです; 見ます → 見たいです; 食べます → 食べたいです; 飲みます → 飲みたいです. Do not attach たい directly to every dictionary form. With an object, を or が can both be natural: 水を飲みたいです / 水が飲みたいです. For going somewhere, use a destination such as 日本に. Add か to ask a peer about their wish. After アニメを見たいですか, はい、見たいです is a short yes response. Wanting to do something is different from saying you already do it or simply like it.",
    register:
      "です makes these ordinary polite statements of your own wishes. The supported question is a friendly exchange between peers; formal invitations or customer-service expressions can be learned later. Describe your own wish or ask the other person, rather than assuming what they want. 日本, 水 and すし have supported readings/meanings and are not extra recall targets in this session.",
    mistake:
      "Use the masu stem: 見たいです, not 見るたいです; 飲みたいです, not 飲むたいです or 飲たいです. Both を and が can mark the desired object here. A destination for 行きたいです uses に or へ, not を just because other examples use it.",
    examples: [watch, go, eat, drinkGa, question, response],
  },
  exercises: [
    ...words.map((word) => ({
      id: `meaning-${word.id}`,
      facet: "meaning" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt: "What meaning did we learn for this kanji? Answer in English.",
      japanese: word.kanji,
      expected: word.meaning,
      accepted: word.meaningAliases,
      explanation: `${word.kanji} has the meaning ${word.meaning} in this session. The complete verb is practised separately.`,
      hints: [word.mnemonic, `The taught meaning is ${word.meaning}.`],
    })),
    ...words.flatMap((word) =>
      word.vocabulary
        ? [
            {
              id: `vocabulary-${word.id}`,
              facet: "meaning" as const,
              kind: "recall" as const,
              targetId: word.id,
              prompt: "What does this complete verb mean? Answer in English.",
              japanese: word.word,
              expected: word.vocabulary.meaning,
              accepted: word.vocabulary.meaningAliases,
              explanation:
                "食べる is an action, to eat. The kanji's meal alias does not name the complete verb.",
              hints: [word.readingNote, "The verb means to eat."],
            },
          ]
        : [],
    ),
    ...words.map((word) => ({
      id: `reading-${word.id}`,
      facet: "reading" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt:
        "Read this complete dictionary-form verb, including its kana ending. Kana or romaji is welcome.",
      japanese: word.word,
      expected: word.reading,
      accepted: word.readingAliases,
      romaji: word.romaji,
      explanation: word.readingNote,
      hints: [
        `Think of the whole verb for ${word.meaning}.`,
        `${word.word} is ${word.reading} (${word.romaji[0]}).`,
      ],
    })),
    ...kana.map((k) => ({
      id: `kana-${k.sound}`,
      facet: "kana" as const,
      kind: "recall" as const,
      targetId: k.character,
      prompt: "Which sound does this katakana make? Type its sound in romaji.",
      japanese: k.character,
      expected: k.sound,
      accepted: [k.sound],
      romaji: [k.sound],
      explanation: `${k.character} represents ${k.sound}. Find its shape again in アニメ.`,
      hints: [`The sound is ${k.sound}.`],
    })),
    {
      id: "desire-choice",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Which sentence says that you want to watch anime?",
      expected: watch.text,
      accepted: [watch.text],
      options: [watch.text, "アニメを見ます。", "アニメが好きです。"],
      explanation:
        "見たいです expresses a wish to watch. 見ます alone does not add wanting, and 好きです expresses a preference.",
      hints: ["Use 見 + たいです.", watch.text],
    },
    {
      id: "desire-tiles",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt: "Arrange the pieces to say you want to watch anime.",
      expected: watch.text,
      accepted: ["アニメを見たいです"],
      tiles: ["たいです", "アニメ", "見", "を"],
      explanation:
        "アニメを names the object; 見 is the taught masu stem; たいです adds wanting. These tiles provide support.",
      hints: [
        "[object] + を + [masu stem] + たいです",
        "アニメ → を → 見 → たいです",
      ],
    },
    {
      id: "desire-gap",
      facet: "grammar",
      kind: "gap",
      targetId: grammarId,
      prompt:
        "Add the desire ending after the taught stem 見 (み), before です.",
      japanese: "アニメを見（　）です。",
      expected: "たい",
      accepted: ["たい"],
      romaji: ["tai"],
      explanation:
        "見ます without ます gives 見; add たいです to form 見たいです.",
      hints: [
        "Use the ending that expresses wanting to do the action.",
        "The missing ending is たい (tai).",
      ],
    },
    {
      id: "desire-question-meaning",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Read or listen to this question. What does it ask?",
      japanese: question.text,
      expected: "Would you like to watch anime?",
      accepted: ["Would you like to watch anime?"],
      options: [
        "Would you like to watch anime?",
        "Do you have anime?",
        "Do you like anime?",
      ],
      explanation:
        "見たいです asks about wanting to watch, and か marks the question. This is different from 好きですか, asking what someone likes.",
      hints: [
        "Notice 見たいです and the final か.",
        "It asks whether the other person wants to watch anime.",
      ],
    },
    {
      id: "desire-response",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt:
        "A friend asks アニメを見たいですか. Choose a short answer saying yes, you want to watch it.",
      expected: response.text,
      accepted: [response.text],
      options: [response.text, "本はありますか。", "水をください。"],
      explanation:
        "はい、見たいです states a wish to watch the anime already mentioned. A selected answer is supported comprehension rather than an independent spoken response.",
      hints: ["Use はい and the taught desire form of 見る.", response.text],
    },
    {
      id: "desire-own",
      facet: "sentence",
      kind: "sentence",
      targetId: grammarId,
      prompt:
        "Tell a friend you want to watch anime, eat sushi, drink water or go to Japan; or ask if they want to watch anime. You may try another activity too.",
      expected:
        "アニメを見たいです。 / すしを食べたいです。 / 水を飲みたいです。 / 日本に行きたいです。",
      accepted: ownAccepted,
      romaji: [
        "anime o mitai desu",
        "anime wo mitai desu",
        "anime ga mitai desu",
        "sushi o tabetai desu",
        "sushi wo tabetai desu",
        "sushi ga tabetai desu",
        "mizu o nomitai desu",
        "mizu wo nomitai desu",
        "mizu ga nomitai desu",
        "nihon ni ikitai desu",
        "nihon e ikitai desu",
        "anime o mitai desu ka",
        "anime wo mitai desu ka",
      ],
      alternatives: ["アニメが好きです", "anime ga suki desu"],
      explanation:
        "A correct masu stem followed by たいです expresses the wish. を and が are both approved object variants. Romaji can demonstrate the grammar without proving kana literacy; novel activities remain saved for assessment.",
      hints: [
        "Word bank: アニメ, すし, 水 (みず), 日本 (にほん); stems 見 (み), 食べ (たべ), 飲み (のみ), 行き (いき).",
        "[masu stem] + たいです",
        "アニメを見たいです。 / anime o mitai desu",
      ],
    },
  ],
  check: {
    status: "sourceChecked",
    checkedAt: "2026-10-15",
    method:
      "Original AI-assisted examples, explanations and invented memory aids, cross-checked against the listed first-party language records. No source mnemonic, textbook dialogue or audio is redistributed. Memory aids are not etymologies. No expert/native-speaker review is claimed. Model audio has separate checks before release.",
    references: [
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L18.pdf",
        locator: "L18-1 and L18-16, grammar note 1",
        checked:
          "Desire statements/questions about an activity; taught masu stem plus たいです; both を and が with a desired object. No original dialogue copied.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/wordlist_X.pdf",
        locator: "PDF page 13 (L5 food words), page 36 (L11 interests)",
        checked:
          "すし / sushi and アニメ / anime. Katakana ア・ニ・メ is reused in the supported anime word; existing 日本/水 have explicit reading support.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E8%A1%8C%E3%81%8F",
        locator: "Meaning, reading and patterns of use",
        checked:
          "行く / いく / go, with に or へ for the destination; full word is distinct from an isolated on reading.",
      },
      {
        url: "https://japanknowledge.com/articles/blognihongo/entry.html?11=&entryid=102",
        locator:
          "Dictionary editor Akira Kaminaga, article 102, body paragraphs 3–6",
        checked:
          "Both いく and ゆく are valid readings of standalone 行く; the model uses ordinary いく. No article prose copied.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E8%A6%8B%E3%82%8B",
        locator: "Meaning and reading records",
        checked: "見る / みる / see-look-watch, as an ichidan verb.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E9%A3%9F%E3%81%B9%E3%82%8B",
        locator: "Meaning and reading records",
        checked:
          "食べる / たべる / to eat, distinct from the individual kanji's meal alias.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E9%A3%B2%E3%82%80",
        locator: "Meaning and reading records",
        checked:
          "飲む / のむ / to drink; the taught masu stem is 飲み rather than 飲む.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E8%A1%8C",
        locator: "Meaning and vocabulary records",
        checked: "Selected individual go meaning; no source mnemonic copied.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E8%A6%8B",
        locator: "Meaning and vocabulary records",
        checked: "Selected individual see meaning, linked to 見る.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E9%A3%9F",
        locator: "Meaning records",
        checked:
          "Eat and meal meanings at kanji level; separate whole-verb meaning exercise.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E9%A3%B2",
        locator: "Meaning and vocabulary records",
        checked: "Selected individual drink meaning, linked to 飲む.",
      },
    ],
  },
};
