import type {
  CheckedSentence,
  LessonWord,
  PreparedLesson,
} from "@packages/learning-core";
const grammarId = "ability-koto-dekimasu";
type WordPart = {
  text: string;
  reading: string;
  romaji: string;
  meaning: string;
};
const manga: WordPart = {
  text: "マンガ",
  reading: "まんが",
  romaji: "manga",
  meaning: "manga / comics (supported word using today's kana)",
};
const name: WordPart = {
  text: "名前",
  reading: "なまえ",
  romaji: "namae",
  meaning: "name (supported word; 名 and 前 are not extra recall targets)",
};
const japanese: WordPart = {
  text: "日本語",
  reading: "にほんご",
  romaji: "nihongo",
  meaning: "Japanese language (supported word)",
};
const music: WordPart = {
  text: "音楽",
  reading: "おんがく",
  romaji: "ongaku",
  meaning: "music (supported word from the favorites lesson)",
};
const read: WordPart = {
  text: "読む",
  reading: "よむ",
  romaji: "yomu",
  meaning: "read",
};
const write: WordPart = {
  text: "書く",
  reading: "かく",
  romaji: "kaku",
  meaning: "write",
};
const speak: WordPart = {
  text: "話す",
  reading: "はなす",
  romaji: "hanasu",
  meaning: "speak",
};
const listen: WordPart = {
  text: "聞く",
  reading: "きく",
  romaji: "kiku",
  meaning: "listen",
};
function ability(
  id: string,
  object: WordPart,
  verb: WordPart,
  meaning: string,
  place = false,
): CheckedSentence {
  return {
    id,
    text: `${place ? "ここで" : ""}${object.text}を${verb.text}ことができます。`,
    reading: `${place ? "ここで" : ""}${object.reading}を${verb.reading}ことができます`,
    romaji: `${place ? "koko de " : ""}${object.romaji} o ${verb.romaji} koto ga dekimasu`,
    meaning,
    segments: [
      ...(place
        ? [
            { text: "ここ", reading: "ここ", meaning: "here" },
            {
              text: "で",
              reading: "で",
              meaning: "where the action is possible",
            },
          ]
        : []),
      { text: object.text, reading: object.reading, meaning: object.meaning },
      { text: "を", reading: "を", meaning: "marks the object of the action" },
      {
        text: verb.text,
        reading: verb.reading,
        meaning: `${verb.meaning}, in dictionary form`,
      },
      {
        text: "こと",
        reading: "こと",
        meaning: "turns this action into the thing that is possible",
        grammar: grammarId,
      },
      {
        text: "が",
        reading: "が",
        meaning: "marks that action as what is possible",
        grammar: grammarId,
      },
      {
        text: "できます",
        reading: "できます",
        meaning: "can do; polite form",
        grammar: grammarId,
      },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const readBook = ability("can-read", manga, read, "I can read manga.");
const writeName = ability("can-write", name, write, "I can write my name.");
const speakJapanese = ability(
  "can-speak",
  japanese,
  speak,
  "I can speak Japanese.",
);
const listenHere = ability(
  "can-listen",
  music,
  listen,
  "You can listen to music here.",
  true,
);
const question: CheckedSentence = {
  ...speakJapanese,
  id: "can-speak-question",
  text: "日本語を話すことができますか。",
  reading: "にほんごをはなすことができますか",
  romaji: "nihongo o hanasu koto ga dekimasu ka",
  meaning: "Can you speak Japanese?",
  segments: [
    ...speakJapanese.segments.slice(0, -1),
    { text: "か", reading: "か", meaning: "marks a question" },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const response: CheckedSentence = {
  id: "can-read-yes",
  text: "はい、読むことができます。",
  reading: "はいよむことができます",
  romaji: "hai yomu koto ga dekimasu",
  meaning: "Yes, I can read it.",
  segments: [
    { text: "はい", reading: "はい", meaning: "yes" },
    { text: "、", reading: "", meaning: "pause" },
    ...readBook.segments.slice(2),
  ],
};
const negative: CheckedSentence = {
  id: "cannot-speak-yet",
  text: "まだ、日本語を話すことができません。",
  reading: "まだにほんごをはなすことができません",
  romaji: "mada nihongo o hanasu koto ga dekimasen",
  meaning: "I cannot speak Japanese yet.",
  segments: [
    {
      text: "まだ",
      reading: "まだ",
      meaning: "yet; with the negative ending here, not yet",
    },
    { text: "、", reading: "", meaning: "pause" },
    ...speakJapanese.segments.slice(0, -2),
    {
      text: "できません",
      reading: "できません",
      meaning: "cannot do; polite negative",
      grammar: grammarId,
    },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const foundation: CheckedSentence = {
  id: "support-want-watch",
  text: "アニメを見たいです。",
  reading: "あにめをみたいです",
  romaji: "anime o mitai desu",
  meaning: "I want to watch anime.",
  segments: [
    { text: "アニメ", reading: "あにめ", meaning: "anime" },
    { text: "を", reading: "を", meaning: "marks the object" },
    { text: "見", reading: "み", meaning: "masu stem of 見る" },
    { text: "たいです", reading: "たいです", meaning: "want to do the action" },
    { text: "。", reading: "", meaning: "sentence ending" },
  ],
};
const words: readonly LessonWord[] = [
  {
    id: "read",
    kanji: "読",
    meaning: "read",
    meaningAliases: ["read", "to read"],
    word: "読む",
    reading: "よむ",
    readingAliases: ["よむ"],
    romaji: ["yomu"],
    mnemonic:
      "Imagine a stack of pages beside a small speaking box. Link the whole character with reading words from a page.",
    readingNote:
      "読む is よむ, to read. 読みます is its polite form. This pattern uses the full dictionary form 読む, not the stem 読み. マンガ (まんが, manga/comics) reuses today's kana マ・ン・ガ. 本 (ほん, book) is another supported example word, not an additional kanji target.",
    example: readBook,
  },
  {
    id: "write",
    kanji: "書",
    meaning: "write",
    meaningAliases: ["write", "to write"],
    word: "書く",
    reading: "かく",
    readingAliases: ["かく"],
    romaji: ["kaku"],
    mnemonic:
      "Picture a pen making a row of marks above a square page. Connect the whole shape with writing.",
    readingNote:
      "書く is かく, to write; 書きます is the polite form. Keep く in 書くことができます. 名前 (なまえ, name) is fully supported; its two kanji are not added to this session's recall targets.",
    example: writeName,
  },
  {
    id: "speak",
    kanji: "話",
    meaning: "talk",
    meaningAliases: ["talk", "speak", "to talk", "to speak"],
    word: "話す",
    reading: "はなす",
    readingAliases: ["はなす"],
    romaji: ["hanasu"],
    mnemonic:
      "Imagine speech bubbles and a small microphone making one character together. Associate the whole shape with talking.",
    readingNote:
      "話す is はなす, to talk or speak; 話します is the polite form. Use 話すことができます, keeping the final す. 日本語 (にほんご, Japanese language) is a supported example word; its characters do not become new recall targets from this example.",
    example: speakJapanese,
  },
  {
    id: "listen",
    kanji: "聞",
    meaning: "hear",
    meaningAliases: ["hear", "listen", "ask", "to hear", "to listen", "to ask"],
    word: "聞く",
    reading: "きく",
    readingAliases: ["きく"],
    romaji: ["kiku"],
    mnemonic:
      "Picture sound arriving at a doorway where someone is ready to hear it. Link the whole character with hearing.",
    readingNote:
      "聞く is きく. Depending on context it can mean hear, listen or ask. Our model means listen to music. 聞きます is polite; keep the full 聞く before こと. 音楽 (おんがく, music) and ここで (koko de, here as an action location) have support.",
    example: listenHere,
  },
];
const kana = [
  {
    character: "マ",
    sound: "ma",
    note: "Katakana ma, as in マンガ (manga). Compare the shape with hiragana ま; the sound is the same.",
  },
  {
    character: "ン",
    sound: "n",
    note: "Katakana n, the middle sound in マンガ. Listen to the whole word as well as this character.",
  },
  {
    character: "ガ",
    sound: "ga",
    note: "Katakana ga is カ with two voicing marks. It is the final character of マンガ.",
  },
];
const ownAccepted = [
  "マンガを読むことができます",
  "まんがをよむことができます",
  "本を読むことができます",
  "ほんをよむことができます",
  "名前を書くことができます",
  "なまえをかくことができます",
  "日本語を話すことができます",
  "にほんごをはなすことができます",
  "ここで音楽を聞くことができます",
  "ここでおんがくをきくことができます",
  "日本語を話すことができますか",
  "にほんごをはなすことができますか",
  "まだ日本語を話すことができません",
  "まだにほんごをはなすことができません",
  "日本語を話すことができません",
  "にほんごをはなすことができません",
];
export const abilityLesson: PreparedLesson = {
  id: "ability",
  version: 1,
  level: "N4",
  title: "Say what you can do",
  outcome: "Say what you can do, ask about an ability and respond honestly",
  entry: {
    minimumBand: "early-n4",
    prerequisite: { lessonId: "desire", version: 1 },
    support: {
      explanation:
        "Build on the desire lesson's verb forms. A wish uses a masu stem: 見ます → 見たいです. Today's ability pattern instead keeps a whole dictionary-form verb: 見る → 見ることができます. The four new words show both forms: 読む / 読みます, 書く / 書きます, 話す / 話します, 聞く / 聞きます. を marks the action's object. Readings and meanings for 本, 名前, 日本語 and 音楽 stay available; they are supported examples, not extra kanji targets.",
      examples: [foundation],
    },
  },
  words,
  kana,
  grammar: {
    id: grammarId,
    pattern: "[dictionary-form verb] + ことができます",
    explanation:
      "Keep the complete dictionary form and add ことができます to say an action is possible: 読む → 読むことができます. It can describe an ability or something possible in the situation. Keep を inside the action: 本を読むことができます. Do not replace every verb ending with る; use the actual forms taught on the word cards. Add か to ask a question. できません is the polite negative, so まだ、日本語を話すことができません says you cannot speak Japanese yet. Use an example that fits you rather than claiming an ability you do not have.",
    register:
      "This is ordinary polite Japanese for describing ability or what an activity/place allows. ここで音楽を聞くことができます describes an available activity here, not a listening-comprehension score. 日本語, 名前, 本 and 音楽 have supported readings. Short everyday replies are also possible, but this session rehearses a full verb phrase so you can reuse the pattern.",
    mistake:
      "Use 読むことができます, not 読みことができます or 読みますことができます. Keep the full dictionary forms 書く, 話す and 聞く. 日本語が話せます is a valid different way to express ability; today's practice is the ことができます pattern.",
    examples: [
      readBook,
      speakJapanese,
      listenHere,
      question,
      response,
      negative,
    ],
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
      explanation: `The kanji ${word.kanji} is associated with ${word.meaning}. The full word ${word.word} has its own reading question.`,
      hints: [word.mnemonic, `The model meaning is ${word.meaning}.`],
    })),
    ...words.map((word) => ({
      id: `reading-${word.id}`,
      facet: "reading" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt: `Read this complete word: ${word.word}. Include its kana ending.`,
      japanese: word.word,
      expected: word.reading,
      accepted: word.readingAliases,
      romaji: word.romaji,
      explanation: word.readingNote,
      hints: [
        "Recall the full dictionary form, including its final kana.",
        `${word.word} is ${word.reading}.`,
      ],
    })),
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
        ...["ma", "n", "ga", "ka"]
          .filter((sound) => sound !== item.sound)
          .slice(0, 2),
      ],
      explanation: item.note,
      hints: [item.note, `Its sound is ${item.sound}.`],
    })),
    {
      id: "ability-choose",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Choose a polite sentence saying you can speak Japanese.",
      expected: speakJapanese.text,
      accepted: [speakJapanese.text],
      options: [speakJapanese.text, "日本語を話したいです。", "本をください。"],
      explanation:
        "話すことができます expresses the ability. 話したいです expresses a wish instead.",
      hints: [
        "Look for the full verb 話す and ことができます.",
        speakJapanese.text,
      ],
    },
    {
      id: "ability-dictionary",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Which form of 読む belongs directly before ことができます?",
      expected: "読む",
      accepted: ["読む"],
      options: ["読む", "読み", "読みます"],
      explanation:
        "Use the complete dictionary form 読む before こと, rather than the masu stem or the polite ます form.",
      hints: ["The pattern keeps the dictionary form unchanged.", "読む"],
    },
    {
      id: "ability-tiles",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt: "Build: I can read manga.",
      expected: readBook.text,
      accepted: [readBook.text],
      tiles: ["マンガ", "を", "読む", "ことが", "できます"],
      explanation:
        "マンガを読む is the action. ことができます says that action is possible.",
      hints: [
        "Start with マンガを, then the complete verb 読む.",
        readBook.text,
      ],
    },
    {
      id: "ability-gap",
      facet: "grammar",
      kind: "gap",
      targetId: grammarId,
      prompt:
        "Fill the missing complete verb: 名前を＿＿ことができます。 (I can write my name.)",
      expected: "書く",
      accepted: ["書く", "かく"],
      romaji: ["kaku"],
      explanation:
        "書く, not 書き or 書きます, is the full verb used before こと.",
      hints: [
        "Use the word meaning write in dictionary form.",
        "書く / かく / kaku",
      ],
    },
    {
      id: "ability-question",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "What does 日本語を話すことができますか ask?",
      expected: "Can you speak Japanese?",
      accepted: ["Can you speak Japanese?"],
      options: [
        "Can you speak Japanese?",
        "Do you want to speak Japanese?",
        "Where is the book?",
      ],
      explanation:
        "ことができます asks about what is possible; the final か makes it a question.",
      hints: [
        "Listen for できます rather than たいです.",
        "It asks whether the person can speak Japanese.",
      ],
    },
    {
      id: "ability-negative",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Choose an honest response saying you cannot speak Japanese yet.",
      expected: negative.text,
      accepted: [negative.text],
      options: [negative.text, speakJapanese.text, "日本語を話したいです。"],
      explanation:
        "まだ with できません says not yet able to do the action. A wish to speak is different.",
      hints: ["The negative ending is できません.", negative.text],
    },
    {
      id: "ability-own",
      facet: "sentence",
      kind: "sentence",
      targetId: grammarId,
      prompt:
        "Say you can read manga or a book, write your name or speak Japanese; say you cannot speak Japanese yet; or ask a friend about speaking Japanese. You may try another ability too.",
      expected:
        "マンガを読むことができます。 / 名前を書くことができます。 / 日本語を話すことができます。",
      accepted: ownAccepted,
      romaji: [
        "manga o yomu koto ga dekimasu",
        "manga wo yomu koto ga dekimasu",
        "hon o yomu koto ga dekimasu",
        "hon wo yomu koto ga dekimasu",
        "namae o kaku koto ga dekimasu",
        "namae wo kaku koto ga dekimasu",
        "nihongo o hanasu koto ga dekimasu",
        "nihongo wo hanasu koto ga dekimasu",
        "koko de ongaku o kiku koto ga dekimasu",
        "koko de ongaku wo kiku koto ga dekimasu",
        "nihongo o hanasu koto ga dekimasu ka",
        "nihongo wo hanasu koto ga dekimasu ka",
        "mada nihongo o hanasu koto ga dekimasen",
        "mada nihongo wo hanasu koto ga dekimasen",
        "nihongo o hanasu koto ga dekimasen",
        "nihongo wo hanasu koto ga dekimasen",
      ],
      alternatives: [
        "日本語が話せます",
        "nihongo ga hanasemasu",
        "日本語ができます",
        "nihongo ga dekimasu",
      ],
      explanation:
        "Use a full dictionary-form action with ことができます, or ことができません for a negative. A valid different ability form is recognized separately; it still leaves today's target for practice. Novel answers are retained for assessment.",
      hints: [
        "Words: マンガ (まんが), 本 (ほん), 名前 (なまえ), 日本語 (にほんご); verbs 読む, 書く, 話す.",
        "[dictionary-form verb] + ことができます; use できません for cannot.",
        "マンガを読むことができます。 / manga o yomu koto ga dekimasu",
      ],
    },
  ],
  check: {
    status: "sourceChecked",
    checkedAt: "2026-10-15",
    method:
      "Original AI-assisted teaching, practice sentences and invented visual associations, source-checked against the primary records listed here. Memory aids are not etymologies. No source mnemonic, dialogue or audio is copied; no native-speaker/expert review or JLPT syllabus certification is claimed. Audio has independent checks before release.",
    references: [
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L02.pdf",
        locator: "L2-5 to L2-6, speaking-language questions and responses",
        checked:
          "Polite ability question and honest positive/negative responses, including できます and できません. Original examples use the full action pattern from the next source.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/elementary01/pdf/Y_L05.pdf",
        locator: "L5-14, grammar note 3",
        checked:
          "Dictionary-form action plus ことができます, for ability or situational possibility; particle remains inside the action.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/読む",
        locator: "Meaning, reading and word-use record",
        checked: "読む / よむ / read; transitive whole verb, with を.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/書く",
        locator: "Meaning and reading record",
        checked: "書く / かく / write; preserve final く in dictionary form.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/話す",
        locator: "Meaning and reading record",
        checked: "話す / はなす / speak-talk; preserve final す.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/聞く",
        locator: "Meaning, reading and usage record",
        checked:
          "聞く / きく / hear-listen-ask; 音楽 example selects listening meaning.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/名前",
        locator: "Meaning and reading record",
        checked: "名前 / なまえ / name, as a fully supported example word.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/日本語",
        locator: "Meaning and reading record",
        checked:
          "日本語 / にほんご / Japanese language, as supported vocabulary.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/音楽",
        locator: "Meaning and reading record",
        checked:
          "音楽 / おんがく / music, supported from the earlier favorites session.",
      },
      ...["読", "書", "話", "聞"].map((character) => ({
        url: `https://www.wanikani.com/kanji/${character}`,
        locator: "Meaning record",
        checked: `Selected meaning for ${character}; no source mnemonic copied.`,
      })),
    ],
  },
};
