import type {
  CheckedSentence,
  LessonWord,
  PreparedLesson,
} from "@packages/learning-core";

const grammarId = "try-te-mimasu";
type Part = { text: string; reading: string; romaji: string; meaning: string };
type Action = {
  stem: string;
  reading: string;
  romaji: string;
  meaning: string;
};
const manga: Part = {
  text: "このマンガ",
  reading: "このまんが",
  romaji: "kono manga",
  meaning: "this manga; この means this before a noun",
};
const riceBall: Part = {
  text: "おにぎり",
  reading: "おにぎり",
  romaji: "onigiri",
  meaning: "onigiri / rice ball (supported word)",
};
const ramen: Part = {
  text: "ラーメン",
  reading: "らーめん",
  romaji: "raamen",
  meaning: "ramen (supported word; ー lengthens the preceding vowel)",
};
const anime: Part = {
  text: "アニメ",
  reading: "あにめ",
  romaji: "anime",
  meaning: "anime (supported word)",
};
const buy: Action = {
  stem: "買っ",
  reading: "かっ",
  romaji: "kat",
  meaning: "buy; 買って is the te-form of 買う",
};
const make: Action = {
  stem: "作っ",
  reading: "つくっ",
  romaji: "tsukut",
  meaning: "make; 作って is the te-form of 作る",
};
const eat: Action = {
  stem: "食べ",
  reading: "たべ",
  romaji: "tabe",
  meaning: "eat; 食べて is the te-form of 食べる",
};
const watch: Action = {
  stem: "見",
  reading: "み",
  romaji: "mi",
  meaning: "watch; 見て is the te-form of 見る",
};

function trying(
  id: string,
  object: Part,
  verb: Action,
  meaning: string,
  wish = false,
): CheckedSentence {
  const ending = wish ? "てみたいです" : "てみます";
  return {
    id,
    text: `${object.text}を${verb.stem}${ending}。`,
    reading: `${object.reading}を${verb.reading}${ending}`,
    romaji: `${object.romaji} o ${verb.romaji}${wish ? "te mitai desu" : "te mimasu"}`,
    meaning,
    segments: [
      { text: object.text, reading: object.reading, meaning: object.meaning },
      { text: "を", reading: "を", meaning: "marks the action's object" },
      { text: verb.stem, reading: verb.reading, meaning: verb.meaning },
      {
        text: ending,
        reading: ending,
        meaning: wish ? "want to try doing the action" : "try doing the action",
        grammar: grammarId,
      },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const tryBuy = trying("try-buy", manga, buy, "I'll try buying this manga.");
const tryMake = trying("try-make", riceBall, make, "I'll try making onigiri.");
const tryEat = trying("try-eat", ramen, eat, "I'll try eating ramen.");
const tryWatch = trying("try-watch", anime, watch, "I'll try watching anime.");
const wish = trying(
  "want-try-eat",
  ramen,
  eat,
  "I want to try eating ramen.",
  true,
);
const question: CheckedSentence = {
  ...tryMake,
  id: "try-make-question",
  text: "おにぎりを作ってみますか。",
  reading: "おにぎりをつくってみますか",
  romaji: "onigiri o tsukutte mimasu ka",
  meaning: "Will you try making onigiri?",
  segments: [
    ...tryMake.segments.slice(0, -1),
    { text: "か", reading: "か", meaning: "question ending" },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const response: CheckedSentence = {
  id: "try-make-yes",
  text: "はい、作ってみます。",
  reading: "はいつくってみます",
  romaji: "hai tsukutte mimasu",
  meaning: "Yes, I'll try making them.",
  segments: [
    { text: "はい", reading: "はい", meaning: "yes" },
    { text: "、", reading: "", meaning: "pause" },
    ...tryMake.segments.slice(2),
  ],
};
const support: CheckedSentence = {
  id: "support-watch-ability",
  text: "アニメを見ることができます。",
  reading: "あにめをみることができます",
  romaji: "anime o miru koto ga dekimasu",
  meaning: "I can watch anime.",
  segments: [
    { text: "アニメ", reading: "あにめ", meaning: "anime" },
    { text: "を", reading: "を", meaning: "marks the object" },
    { text: "見る", reading: "みる", meaning: "watch, in dictionary form" },
    {
      text: "ことができます",
      reading: "ことができます",
      meaning: "can do the action",
      grammar: "ability-koto-dekimasu",
    },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};

const words: readonly LessonWord[] = [
  {
    id: "buy",
    kanji: "買",
    meaning: "buy",
    meaningAliases: ["buy", "purchase", "to buy", "to purchase"],
    word: "買う",
    reading: "かう",
    readingAliases: ["かう"],
    romaji: ["kau"],
    mnemonic:
      "Picture a shop basket above the price of something you choose to buy. Connect the whole shape with buying.",
    readingNote:
      "買う is かう, to buy. The polite form is 買います; today's te-form is 買って (かって), with a small っ. この means this before a noun. マンガ (まんが, manga) stays supported.",
    example: tryBuy,
  },
  {
    id: "make",
    kanji: "作",
    meaning: "make",
    meaningAliases: [
      "make",
      "create",
      "build",
      "to make",
      "to create",
      "to build",
    ],
    word: "作る",
    reading: "つくる",
    readingAliases: ["つくる"],
    romaji: ["tsukuru"],
    mnemonic:
      "Imagine a person standing beside a workbench, making something one piece at a time. Link the whole character with making.",
    readingNote:
      "作る is つくる, to make. 作ります is polite, and 作って (つくって) is its te-form. Despite ending in る, it follows the group that gives って; do not change it to 作て. おにぎり (onigiri, rice ball) is supported vocabulary.",
    example: tryMake,
  },
  {
    id: "eat",
    kanji: "食",
    meaning: "eat",
    meaningAliases: ["eat", "meal", "to eat"],
    word: "食べる",
    vocabulary: { meaning: "to eat", meaningAliases: ["eat", "to eat"] },
    reading: "たべる",
    readingAliases: ["たべる"],
    romaji: ["taberu"],
    mnemonic:
      "Imagine opening a covered lunch tray. Associate this whole character with eating a meal.",
    readingNote:
      "食べる is たべる, to eat. Its te-form is 食べて (たべて): remove the final る and add て. 食 can mean meal as an individual kanji, but 食べる is an action. ラーメン (らーめん, ramen) has the vowel-length mark ー; raamen is the supported romaji.",
    example: tryEat,
  },
  {
    id: "watch",
    kanji: "見",
    meaning: "see",
    meaningAliases: ["see", "look", "watch", "to see", "to look", "to watch"],
    word: "見る",
    reading: "みる",
    readingAliases: ["みる"],
    romaji: ["miru"],
    mnemonic:
      "Picture an eye above two feet stopping to look around. Connect the whole shape with seeing.",
    readingNote:
      "見る is みる, to see, look or watch. 見ます is polite, while 見て (みて) is its te-form. In アニメを見てみます the first 見 is the action watch; the following hiragana みます adds try. They have different jobs.",
    example: tryWatch,
  },
];
const kana = [
  {
    character: "ラ",
    sound: "ra",
    note: "Katakana ra, the first character in ラーメン. The following ー holds its vowel longer: raa.",
  },
  {
    character: "メ",
    sound: "me",
    note: "Katakana me, as in ラーメン. アニメ also contains メ; hear the word as well as the character.",
  },
  {
    character: "ン",
    sound: "n",
    note: "Katakana n, the final mora in ラーメン. This reinforces ン from the ability lesson's マンガ.",
  },
];
const approved = [tryBuy, tryMake, tryEat, tryWatch, wish, question, response];
const ownAccepted = approved.flatMap((s) => [s.text, s.reading]);
const ownRomaji = approved.flatMap((s) => [
  s.romaji,
  s.romaji.replace(/ o /gu, " wo "),
]);

export const tryLesson: PreparedLesson = {
  id: "try",
  version: 1,
  level: "N4",
  title: "Try something new",
  outcome:
    "Say what you will try or would like to try, and answer a simple suggestion",
  entry: {
    minimumBand: "early-n4",
    prerequisite: { lessonId: "ability", version: 1 },
    support: {
      explanation:
        "Ability used a dictionary form before ことができます. Trying uses a te-form before みます. Here are all four forms you need: 買う → 買って (かう → かって), 作る → 作って (つくる → つくって), 食べる → 食べて (たべる → たべて), 見る → 見て (みる → みて). 買う and 作る keep the small っ sound. 食べる and 見る drop る before て; this is not a rule for every verb ending in る. を marks the object. These forms and all supported words stay available while you practise.",
      examples: [support],
    },
  },
  words,
  kana,
  grammar: {
    id: grammarId,
    pattern: "[verb in て-form] + みます",
    explanation:
      "Use the taught te-form and add みます to try an action and see how it goes. 食べる becomes 食べて, then 食べてみます. For a wish, use みたいです instead: 食べてみたいです means I want to try eating it. Keep を inside the action. Add か for a question. Choose something you actually want to try; an example is practice rather than a promise.",
    register:
      "Ordinary polite Japanese for an experiment or a new experience. It does not mean struggle unsuccessfully to do something. Auxiliary みます is written in hiragana; it is different from 見ます meaning see/watch. A plain wish such as 食べたいです is valid Japanese but does not explicitly say try.",
    mistake:
      "Say 買ってみます and 作ってみます, with small っ; not 買てみます, 作てみます or dictionary-form + みます. 食べてみます and 見てみます need て too. In 見てみます, keep the action 見 and the auxiliary み distinct.",
    examples: [tryEat, tryWatch, tryMake, question, response, wish],
  },
  exercises: [
    ...words.map((word) => ({
      id: `meaning-${word.id}`,
      facet: "meaning" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt: "Recall this kanji's meaning in English.",
      japanese: word.kanji,
      expected: word.meaning,
      accepted: word.meaningAliases,
      explanation: `The kanji ${word.kanji} is associated with ${word.meaning}. Read the whole verb in its separate reading question.`,
      hints: [word.mnemonic, `The model meaning is ${word.meaning}.`],
    })),
    ...words.map((word) => ({
      id: `reading-${word.id}`,
      facet: "reading" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt: `Read the complete dictionary-form word ${word.word}, including its kana ending.`,
      japanese: word.word,
      expected: word.reading,
      accepted: word.readingAliases,
      romaji: word.romaji,
      explanation: word.readingNote,
      hints: [
        "Recall the dictionary form rather than the te-form.",
        `${word.word} is ${word.reading}.`,
      ],
    })),
    {
      id: "vocabulary-eat",
      facet: "meaning",
      kind: "recall",
      targetId: "eat",
      prompt: "What does the complete verb 食べる mean in English?",
      japanese: "食べる",
      expected: "to eat",
      accepted: ["eat", "to eat"],
      explanation:
        "食べる means to eat. Meal can describe 食, but is not the meaning of this whole verb.",
      hints: ["This word describes an action.", "食べる means to eat."],
    },
    ...kana.map((item, i) => ({
      id: `kana-${i + 1}`,
      facet: "kana" as const,
      kind: "choice" as const,
      targetId: item.character,
      prompt: `Which sound does ${item.character} make?`,
      japanese: item.character,
      expected: item.sound,
      accepted: [item.sound],
      options: [
        item.sound,
        ...["ra", "me", "n", "ma"].filter((s) => s !== item.sound).slice(0, 2),
      ],
      explanation: item.note,
      hints: [item.note, `Its sound is ${item.sound}.`],
    })),
    {
      id: "try-choice",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Choose: I'll try watching anime.",
      expected: tryWatch.text,
      accepted: [tryWatch.text],
      options: [
        tryWatch.text,
        "アニメを見ます。",
        "アニメを見ることができます。",
      ],
      explanation:
        "見てみます says try watching. 見ます says watch, and 見ることができます says can watch.",
      hints: ["Find the te-form followed by みます.", tryWatch.text],
    },
    {
      id: "try-te-form",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Which te-form of 作る belongs directly before みます?",
      expected: "作って",
      accepted: ["作って"],
      options: ["作って", "作て", "作る"],
      explanation: "作る becomes 作って, including small っ, before みます.",
      hints: ["This verb does not simply drop its final る.", "作って"],
    },
    {
      id: "try-tiles",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt: "Build: I'll try eating ramen.",
      expected: tryEat.text,
      accepted: [tryEat.text],
      tiles: ["ラーメン", "を", "食べて", "みます"],
      explanation:
        "ラーメンを食べて is the action in te-form. みます adds try.",
      hints: ["Begin with ラーメンを, then 食べて.", tryEat.text],
    },
    {
      id: "try-gap",
      facet: "grammar",
      kind: "gap",
      targetId: grammarId,
      prompt: "Fill the missing part: このマンガを買っ___みます。",
      japanese: "このマンガを買っ___みます。",
      expected: "て",
      accepted: ["て"],
      romaji: ["te"],
      explanation: "Keep 買って together; 買う has the te-form 買って.",
      hints: ["Complete the te-form before みます.", "て"],
    },
    {
      id: "try-wish",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "What does ラーメンを食べてみたいです mean?",
      expected: "I want to try eating ramen.",
      accepted: ["I want to try eating ramen."],
      options: [
        "I want to try eating ramen.",
        "I can eat ramen.",
        "I have already eaten ramen.",
      ],
      explanation:
        "てみたいです combines trying with a wish. It does not say the action is already completed.",
      hints: ["みたいです expresses a wish to try.", wish.meaning],
    },
    {
      id: "try-response",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt:
        "Answer positively to おにぎりを作ってみますか: Yes, I'll try making them.",
      expected: response.text,
      accepted: [response.text],
      tiles: ["はい", "、", "作って", "みます"],
      explanation:
        "The action can be understood from the question. 作ってみます gives the full try pattern in your reply.",
      hints: ["Keep the te-form 作って before みます.", response.text],
    },
    {
      id: "try-own",
      facet: "grammar",
      kind: "sentence",
      targetId: grammarId,
      prompt:
        "Say what you will try or would like to try: buying this manga, making onigiri, eating ramen or watching anime. You can also ask or answer a simple suggestion, or write another idea.",
      expected: tryEat.text,
      accepted: ownAccepted,
      romaji: ownRomaji,
      alternatives: [
        "ラーメンを食べたいです",
        "らーめんをたべたいです",
        "raamen o tabetai desu",
        "raamen wo tabetai desu",
        "アニメを見ます",
        "あにめをみます",
        "anime o mimasu",
      ],
      explanation:
        "A complete te-form + みます or みたいです demonstrates today's pattern. Other valid Japanese is recognized separately, and new sentences can wait for checked feedback.",
      hints: [
        "Useful words: ラーメン ramen; おにぎり onigiri; このマンガ this manga; アニメ anime.",
        "Te-forms: 買って, 作って, 食べて, 見て. Add みます or みたいです.",
        tryEat.text,
      ],
    },
  ],
  check: {
    status: "sourceChecked",
    checkedAt: "2026-10-15",
    method:
      "AI-assisted original authoring checked against first-party grammar and meaning/reading records; not native-speaker review. No textbook dialogue, source mnemonic or audio copied.",
    references: [
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/elementary01/pdf/Y_L12.pdf",
        locator: "L12-18, grammar note 4",
        checked:
          "Te-form plus auxiliary みる for trying an action; polite forms and distinction from literal watching. Original contexts/explanations authored here.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/elementary01/pdf/Y_L10.pdf",
        locator: "L10-16, grammar note 1",
        checked:
          "Te-form plus みたい expresses wishing to try; the lesson uses a simple polite wish, without adding the consultation construction.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/resources/Grammar_Worksheets_Answer.pdf",
        locator: "Elementary 1 te-form summary and answers",
        checked:
          "作る → 作って, 買う → 買って, 食べる → 食べて and 見る → 見て. Selected forms supplied explicitly rather than presenting an incomplete universal rule.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/elementary01/pdf/Y_L05.pdf",
        locator: "L5-14, grammar note 3",
        checked:
          "Dictionary form plus ことができます in the pinned ability refresher.",
      },
      ...[
        ["買う", "かう / to buy"],
        ["作る", "つくる / to make; godan"],
        ["食べる", "たべる / to eat; ichidan"],
        ["見る", "みる / to see, look or watch; ichidan"],
      ].map(([word, record]) => ({
        url: `https://www.wanikani.com/vocabulary/${encodeURIComponent(word!)}`,
        locator: "Meaning, reading and word-type records",
        checked: record!,
      })),
      ...[
        ["買", "buy"],
        ["作", "make"],
        ["食", "eat / meal, distinct from verb meaning"],
        ["見", "see / look / watch"],
      ].map(([kanji, record]) => ({
        url: `https://www.wanikani.com/kanji/${encodeURIComponent(kanji!)}`,
        locator: "Individual meaning records",
        checked: record!,
      })),
    ],
  },
};
