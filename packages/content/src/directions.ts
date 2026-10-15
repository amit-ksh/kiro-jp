import type {
  CheckedSentence,
  LessonWord,
  PreparedLesson,
} from "@packages/learning-core";
const grammarId = "location-doko";
function where(
  id: string,
  word: string,
  reading: string,
  roman: string,
  meaning: string,
): CheckedSentence {
  return {
    id,
    text: `${word}はどこですか。`,
    reading: `${reading}はどこですか`,
    romaji: `${roman} wa doko desu ka`,
    meaning: `Where is the ${meaning}?`,
    segments: [
      { text: word, reading, meaning },
      {
        text: "は",
        reading: "わ",
        meaning: "marks what we are asking about",
        grammar: grammarId,
      },
      { text: "どこ", reading: "どこ", meaning: "where", grammar: grammarId },
      {
        text: "です",
        reading: "です",
        meaning: "polite ending",
        grammar: grammarId,
      },
      {
        text: "か",
        reading: "か",
        meaning: "marks a question",
        grammar: grammarId,
      },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const entrance = where(
  "where-entrance",
  "入口",
  "いりぐち",
  "iriguchi",
  "entrance",
);
const exit = where("where-exit", "出口", "でぐち", "deguchi", "exit");
function side(
  id: string,
  word: string,
  reading: string,
  roman: string,
  place: string,
  direction: string,
  kana: string,
  romaji: string,
): CheckedSentence {
  return {
    id,
    text: `${word}は${direction}です。`,
    reading: `${reading}は${kana}です`,
    romaji: `${roman} wa ${romaji} desu`,
    meaning: `The ${place} is on the ${direction === "右" ? "right" : "left"}.`,
    segments: [
      { text: word, reading, meaning: place },
      { text: "は", reading: "わ", meaning: "marks the topic" },
      {
        text: direction,
        reading: kana,
        meaning: direction === "右" ? "right" : "left",
      },
      { text: "です", reading: "です", meaning: "polite ending" },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const right = side(
  "direction-right",
  "入口",
  "いりぐち",
  "iriguchi",
  "entrance",
  "右",
  "みぎ",
  "migi",
);
const left = side(
  "direction-left",
  "出口",
  "でぐち",
  "deguchi",
  "exit",
  "左",
  "ひだり",
  "hidari",
);
const polite: CheckedSentence = {
  id: "where-entrance-polite",
  text: `すみません。${entrance.text}`,
  reading: `すみません。${entrance.reading}`,
  romaji: `sumimasen. ${entrance.romaji}`,
  meaning: "Excuse me. Where is the entrance?",
  segments: [
    { text: "すみません", reading: "すみません", meaning: "excuse me" },
    { text: "。", reading: "", meaning: "sentence ending" },
    ...entrance.segments,
  ],
};
const words: readonly LessonWord[] = [
  {
    id: "entrance",
    kanji: "入",
    meaning: "enter",
    meaningAliases: ["enter", "to enter"],
    word: "入口",
    vocabulary: {
      meaning: "entrance",
      meaningAliases: ["entrance", "entryway", "the entrance"],
    },
    reading: "いりぐち",
    readingAliases: ["いりぐち"],
    romaji: ["iriguchi"],
    mnemonic:
      "Picture two paths joining at the doorway you enter. Link this shape with entering.",
    readingNote:
      "入口 is the whole word いりぐち, meaning entrance. 入 relates to entering. The supported component 口 means mouth and is read ぐち here; do not try to read each character using a single fixed sound.",
    example: entrance,
  },
  {
    id: "exit",
    kanji: "出",
    meaning: "exit",
    meaningAliases: ["exit", "to exit", "go out"],
    word: "出口",
    vocabulary: {
      meaning: "exit",
      meaningAliases: ["exit", "the exit", "way out"],
    },
    reading: "でぐち",
    readingAliases: ["でぐち"],
    romaji: ["deguchi"],
    mnemonic:
      "Picture a stack of boxes going out through a loading door. Connect the shape with exiting.",
    readingNote:
      "出口 is the whole word でぐち, meaning exit. 出 contributes で in this word. The supported 口 is ぐち here, as in 入口. Other words can use other readings.",
    example: exit,
  },
  {
    id: "right",
    kanji: "右",
    meaning: "right",
    meaningAliases: ["right", "right side", "the right"],
    word: "右",
    reading: "みぎ",
    readingAliases: ["みぎ"],
    romaji: ["migi"],
    mnemonic:
      "Imagine the small square as a parcel waiting on the right-hand path. Associate the entire character with right.",
    readingNote:
      "For the direction right, read this word みぎ. 入口は右です says the entrance is on the right.",
    example: right,
  },
  {
    id: "left",
    kanji: "左",
    meaning: "left",
    meaningAliases: ["left", "left side", "the left"],
    word: "左",
    reading: "ひだり",
    readingAliases: ["ひだり"],
    romaji: ["hidari"],
    mnemonic:
      "Imagine a little workbench on the left-hand path. Link the lower shape with that left-hand place.",
    readingNote:
      "For the direction left, read this word ひだり. 出口は左です says the exit is on the left.",
    example: left,
  },
];
const kana = [
  {
    character: "い",
    sound: "i",
    note: "The first sound in いりぐち (entrance).",
  },
  {
    character: "り",
    sound: "ri",
    note: "Reuse this sound in いりぐち and ひだり.",
  },
  {
    character: "ぐ",
    sound: "gu",
    note: "The two small marks change く (ku) into ぐ (gu), as in いりぐち and でぐち.",
  },
];
export const directionsLesson: PreparedLesson = {
  id: "directions",
  version: 1,
  title: "Find your way",
  outcome:
    "Ask where the entrance or exit is and understand a simple right or left answer",
  words,
  kana,
  grammar: {
    id: grammarId,
    pattern: "[place] + はどこですか",
    explanation:
      "Name the place, add は, then どこですか to ask where it is. Here は is pronounced wa. 入口はどこですか asks where the entrance is. A short answer such as 右です means it is on the right; 左です means it is on the left.",
    register:
      "This is an ordinary polite location question. Use すみません to get someone's attention before asking a staff member or passerby. In a shrine or shop, ask where a place is without assuming you may enter restricted areas.",
    mistake:
      "Use the topic particle は, pronounced wa, in this question: 入口はどこですか. Do not substitute を or read は as ha here.",
    examples: [entrance, exit, polite],
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
      explanation: `${word.kanji} has the meaning ${word.meaning} in this lesson. The meaning of a complete vocabulary word is checked separately when needed.`,
      hints: [word.mnemonic, `The kanji meaning is ${word.meaning}.`],
    })),
    ...words.flatMap((word) =>
      word.vocabulary
        ? [
            {
              id: `vocabulary-${word.id}`,
              facet: "meaning" as const,
              kind: "recall" as const,
              targetId: word.id,
              prompt:
                "What does this whole vocabulary word mean? Answer in English.",
              japanese: word.word,
              expected: word.vocabulary.meaning,
              accepted: word.vocabulary.meaningAliases,
              explanation: `${word.word} is ${word.reading} (${word.romaji[0]}) and means ${word.vocabulary.meaning}. This is the whole word, not the meaning of only ${word.kanji}.`,
              hints: [
                `This word names a place used when entering or leaving.`,
                `${word.word} means ${word.vocabulary.meaning}.`,
              ],
            },
          ]
        : [],
    ),
    ...words.map((word) => ({
      id: `reading-${word.id}`,
      facet: "reading" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt: "How do you read this whole word? Kana or romaji is welcome.",
      japanese: word.word,
      expected: word.reading,
      accepted: word.readingAliases,
      romaji: word.romaji,
      explanation: word.readingNote,
      hints: [
        `Think of the word for ${word.vocabulary?.meaning ?? word.meaning}.`,
        `${word.word} is ${word.reading} (${word.romaji[0]}).`,
      ],
    })),
    ...kana.map((k) => ({
      id: `kana-${k.sound}`,
      facet: "kana" as const,
      kind: "recall" as const,
      targetId: k.character,
      prompt: "Which sound does this hiragana make? Type its sound in romaji.",
      japanese: k.character,
      expected: k.sound,
      accepted: [k.sound],
      romaji: [k.sound],
      explanation: `${k.character} makes the sound ${k.sound}. This checks the kana itself, separately from vocabulary reading.`,
      hints: [`The sound is ${k.sound}.`],
    })),
    {
      id: "location-choice",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Which question asks where the exit is?",
      expected: exit.text,
      accepted: [exit.text],
      options: [entrance.text, exit.text, left.text],
      explanation: "出口 names the exit, and はどこですか asks where it is.",
      hints: [
        "Look for 出口 followed by today's location question.",
        exit.text,
      ],
    },
    {
      id: "location-tiles",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt: "Arrange the pieces to ask where the entrance is.",
      expected: entrance.text,
      accepted: ["入口はどこですか"],
      tiles: ["どこですか", "入口", "は"],
      explanation:
        "Place first, then は, then どこですか. The tiles provide support.",
      hints: ["[place] + は + どこですか", "入口 → は → どこですか"],
    },
    {
      id: "location-gap",
      facet: "grammar",
      kind: "gap",
      targetId: grammarId,
      prompt:
        "Fill the missing topic particle. Kana or its spoken sound is welcome.",
      japanese: "入口（　）どこですか。",
      expected: "は",
      accepted: ["は"],
      romaji: ["wa", "ha"],
      explanation: "Write は and pronounce it wa when marking the topic.",
      hints: [
        "Use the topic marker, not the request particle を.",
        "The missing particle is は (wa).",
      ],
    },
    {
      id: "direction-right-meaning",
      facet: "meaning",
      kind: "choice",
      targetId: "right",
      prompt: "Read or listen to the example. Which side is the entrance on?",
      japanese: right.text,
      expected: "Right",
      accepted: ["Right"],
      options: ["Right", "Left", "It does not say"],
      explanation:
        "右 (みぎ) means right. The answer locates the entrance on the right.",
      hints: ["Find the direction word after は.", "右 means right."],
    },
    {
      id: "direction-left-meaning",
      facet: "meaning",
      kind: "choice",
      targetId: "left",
      prompt: "Read or listen to the example. Which side is the exit on?",
      japanese: left.text,
      expected: "Left",
      accepted: ["Left"],
      options: ["Right", "Left", "It does not say"],
      explanation:
        "左 (ひだり) means left. The answer locates the exit on the left.",
      hints: ["Find the direction word after は.", "左 means left."],
    },
    {
      id: "location-own",
      facet: "sentence",
      kind: "sentence",
      targetId: grammarId,
      prompt:
        "At a shrine, shop or station, ask where the entrance or exit is using today's pattern.",
      expected: "入口はどこですか。 / 出口はどこですか。",
      accepted: [
        "入口はどこですか",
        "入り口はどこですか",
        "出口はどこですか",
        "いりぐちはどこですか",
        "でぐちはどこですか",
        "すみません入口はどこですか",
        "すみません出口はどこですか",
      ],
      romaji: [
        "iriguchi wa doko desu ka",
        "deguchi wa doko desu ka",
        "sumimasen iriguchi wa doko desu ka",
        "sumimasen deguchi wa doko desu ka",
      ],
      alternatives: [
        "入口はどこにありますか",
        "出口はどこにありますか",
        "iriguchi wa doko ni arimasu ka",
        "deguchi wa doko ni arimasu ka",
      ],
      explanation:
        "You named the place and used はどこですか to ask its location politely.",
      hints: [
        "Word bank: 入口 (いりぐち), 出口 (でぐち).",
        "[place] + はどこですか",
        "入口はどこですか。 / iriguchi wa doko desu ka",
      ],
    },
  ],
  check: {
    status: "sourceChecked",
    checkedAt: "2026-10-14",
    method:
      "Original AI-assisted explanations, examples and memory aids; source-checked against the listed Japan Foundation records and individual kanji glosses. Memory aids are invented, not etymologies. No native-speaker or expert review is claimed. Audio is checked separately before activation.",
    references: [
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/wordlist_X.pdf",
        locator: "L16-1, PDF page 56",
        checked:
          "入口/いりぐち/entrance and 出口/でぐち/exit as whole vocabulary words.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/wordlist_Y.pdf",
        locator: "L6-2, PDF page 16",
        checked:
          "右/みぎ/right and 左/ひだり/left; keep directional word meanings distinct from English correct/remaining.",
      },
      {
        url: "https://www.jpf.go.jp/j/urawa/j_rsorcs/textbook/setsumei_pdf/setsumei02_4.pdf",
        locator: "Printed page 20, classroom-location example",
        checked:
          "Nはどこですか question and a short location answer ending in です.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L08.pdf",
        locator: "L8-18 and L8-21",
        checked:
          "Location questions, polite/short location answers and distinction between people and things; no claim to teach both verb systems.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E5%85%A5",
        locator: "Meaning and vocabulary sections",
        checked:
          "Individual kanji gloss enter, distinct from the whole word entrance; no mnemonic or lesson text copied.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E5%87%BA",
        locator: "Meaning and vocabulary sections",
        checked:
          "Individual kanji gloss exit and whole word 出口; no mnemonic or lesson text copied.",
      },
      {url:"https://www.wanikani.com/kanji/%E5%8F%A3",locator:"Meaning and vocabulary sections",checked:"Mouth gloss for the supported 口 component; compound readings are checked in the Japan Foundation entries. No mnemonic copied."},
    ],
  },
};
