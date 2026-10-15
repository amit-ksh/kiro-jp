import type {
  CheckedSentence,
  LessonWord,
  PreparedLesson,
} from "@packages/learning-core";

const grammarId = "availability-arimasu";
function question(
  id: string,
  item: string,
  reading: string,
  romaji: string,
  english: string,
): CheckedSentence {
  return {
    id,
    text: `${item}はありますか。`,
    reading: `${reading}はありますか`,
    romaji: `${romaji} wa arimasu ka`,
    meaning: english,
    segments: [
      { text: item, reading, meaning: item === "店" ? "a shop" : "books" },
      {
        text: "は",
        reading: "は",
        meaning: "sets the item as the topic; pronounced wa",
        grammar: grammarId,
      },
      {
        text: "あります",
        reading: "あります",
        meaning: "is available / exists",
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
const shop = question(
  "shop-question",
  "店",
  "みせ",
  "mise",
  "Is there a shop?",
);
const book = question(
  "book-question",
  "本",
  "ほん",
  "hon",
  "Do you have books?",
);
function describedBook(
  id: string,
  adjective: string,
  reading: string,
  romaji: string,
  meaning: string,
): CheckedSentence {
  return {
    ...question(
      id,
      `${adjective}本`,
      `${reading}ほん`,
      `${romaji} hon`,
      `Do you have ${meaning} books?`,
    ),
    segments: [{ text: adjective, reading, meaning }, ...book.segments],
  };
}
const newBooks = describedBook(
  "new-books-question",
  "新しい",
  "あたらしい",
  "atarashii",
  "new",
);
const oldBooks = describedBook(
  "old-books-question",
  "古い",
  "ふるい",
  "furui",
  "old",
);
const shortQuestion: CheckedSentence = {
  id: "book-short-question",
  text: "本、ありますか。",
  reading: "ほんありますか",
  romaji: "hon arimasu ka",
  meaning: "Do you have books?",
  segments: [
    book.segments[0]!,
    {
      text: "、",
      reading: "",
      meaning: "brief pause; the topic particle is omitted",
    },
    ...book.segments.slice(2),
  ],
};
function reply(id: string, yes: boolean): CheckedSentence {
  const first = yes ? "はい" : "いいえ",
    verb = yes ? "あります" : "ありません";
  return {
    id,
    text: `${first}、${verb}。`,
    reading: first + verb,
    romaji: yes ? "hai arimasu" : "iie arimasen",
    meaning: yes ? "Yes, we do." : "No, we don't.",
    // Replies are supported listening material, not evidence of asking the target question.
    segments: [
      { text: first, reading: first, meaning: yes ? "yes" : "no" },
      { text: "、", reading: "", meaning: "pause" },
      {
        text: verb,
        reading: verb,
        meaning: yes ? "it is available" : "it is not available",
      },
      { text: "。", reading: "", meaning: "sentence ending" },
    ],
  };
}
const positive = reply("availability-yes", true),
  negative = reply("availability-no", false);
const words: readonly LessonWord[] = [
  {
    id: "shop",
    kanji: "店",
    meaning: "shop",
    meaningAliases: ["shop", "store", "a shop", "a store"],
    word: "店",
    reading: "みせ",
    readingAliases: ["みせ"],
    romaji: ["mise"],
    mnemonic:
      "Picture a price label in a square display window. Connect this whole shape with a shop.",
    readingNote:
      "The ordinary word 店 is みせ, shop or store. Other compounds may use てん; this question asks for the whole word 店. 店はありますか can ask whether a shop exists in the area being discussed.",
    example: shop,
  },
  {
    id: "book",
    kanji: "本",
    meaning: "book",
    meaningAliases: ["book", "a book", "books"],
    word: "本",
    reading: "ほん",
    readingAliases: ["ほん"],
    romaji: ["hon"],
    mnemonic:
      "Picture an open book with a tiny bookmark across its lower pages. Connect the whole shape with a book.",
    readingNote:
      "本 is ほん, book. It is reinforced from the request lesson. Japanese does not require a plural ending here: 本はありますか can ask whether the shop has books. Use the title when asking about a particular book.",
    example: book,
  },
  {
    id: "new",
    kanji: "新",
    meaning: "new",
    meaningAliases: ["new"],
    word: "新しい",
    reading: "あたらしい",
    readingAliases: ["あたらしい"],
    romaji: ["atarashii"],
    mnemonic:
      "Imagine peeling a bright label from a freshly opened parcel. Link this shape to something new.",
    readingNote:
      "新しい, new, is あたらしい. Include しい when recalling the complete adjective; しん alone is not this word. Put it directly before 本 to say 新しい本, new books. No の is needed between this adjective and the noun.",
    example: newBooks,
  },
  {
    id: "old",
    kanji: "古",
    meaning: "old",
    meaningAliases: ["old", "ancient"],
    word: "古い",
    reading: "ふるい",
    readingAliases: ["ふるい"],
    romaji: ["furui"],
    mnemonic:
      "Picture a faded date stamp above a little box kept for years. Associate the whole shape with an old object.",
    readingNote:
      "古い is ふるい: keep the final い in the complete word. 古い本 means old books; it does not specifically mean secondhand books. Use 古い for things or long-standing relationships, not to describe an elderly person.",
    example: oldBooks,
  },
];
const kana = [
  { character: "み", sound: "mi", note: "The first kana in みせ, shop." },
  { character: "せ", sound: "se", note: "The second kana in みせ, shop." },
  {
    character: "ふ",
    sound: "fu",
    note: "The first kana in ふるい, old. Listen to the model; fu is an approximate spelling of its sound.",
  },
];
export const availabilityLesson: PreparedLesson = {
  id: "availability",
  version: 1,
  title: "Ask what is available",
  outcome:
    "Ask whether a shop has something and understand a short yes or no answer",
  words,
  kana,
  grammar: {
    id: grammarId,
    pattern: "[item] + はありますか",
    explanation:
      "Name a thing, add は (pronounced wa), then ありますか (arimasu ka) to ask whether it is available. あります describes existence or availability of things; か makes the question. In a shop, 本はありますか means Do you have books? The topic particle は may be omitted: 本、ありますか is also natural. New or old can describe the book directly: 新しい本 / 古い本. Short replies はい、あります and いいえ、ありません tell you whether it is available. These replies are supported listening examples; today's active goal is to ask the question.",
    register:
      "The ます form is an ordinary polite way to ask staff about an item. It can also ask whether a shop exists in an understood area. This pattern is about things; people and animals normally use います instead. A positive reply is not a guarantee about a real shop's stock: conversation practice is simulated.",
    mistake:
      "Write は, pronounced wa, for the topic marker. Keep the question ending か. 本をありますか does not fit this pattern. 新しい本 needs no の. A request such as 本をください is useful after availability is clear, but does not ask whether the item is available.",
    examples: [book, newBooks, oldBooks, shortQuestion, positive, negative],
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
      explanation: `${word.kanji} has the meaning ${word.meaning} in this session.`,
      hints: [word.mnemonic, `The taught kanji meaning is ${word.meaning}.`],
    })),
    ...words.map((word) => ({
      id: `reading-${word.id}`,
      facet: "reading" as const,
      kind: "recall" as const,
      targetId: word.id,
      prompt:
        "How do you read this whole word, including its kana ending? Kana or romaji is welcome.",
      japanese: word.word,
      expected: word.reading,
      accepted: word.readingAliases,
      romaji: word.romaji,
      explanation: word.readingNote,
      hints: [
        `Think of the word for ${word.meaning}.`,
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
      explanation: `${k.character} is represented by ${k.sound}. Hear it in the whole word too.`,
      hints: [`The sound is ${k.sound}.`],
    })),
    {
      id: "availability-choice",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt: "Which question asks whether a shop has books?",
      expected: book.text,
      accepted: [book.text],
      options: [book.text, "本をください。", "本が好きです。"],
      explanation:
        "本はありますか asks whether books are available. 本をください requests a book; 本が好きです says you like books.",
      hints: ["Use ありますか to ask about availability.", book.text],
    },
    {
      id: "availability-tiles",
      facet: "grammar",
      kind: "tiles",
      targetId: grammarId,
      prompt: "Arrange the pieces to ask whether the shop has new books.",
      expected: newBooks.text,
      accepted: ["新しい本はありますか"],
      tiles: ["ありますか", "本", "新しい", "は"],
      explanation:
        "新しい directly describes 本, then はありますか asks whether those books are available. Tiles provide support.",
      hints: [
        "[description] + 本 + は + ありますか",
        "新しい → 本 → は → ありますか",
      ],
    },
    {
      id: "availability-gap",
      facet: "grammar",
      kind: "gap",
      targetId: grammarId,
      prompt:
        "Fill the written topic particle pronounced wa in the full pattern.",
      japanese: "本（　）ありますか。",
      expected: "は",
      accepted: ["は"],
      romaji: ["wa"],
      explanation:
        "The topic particle is written は and pronounced wa. It can be omitted in a short natural question; this exercise practises the full written pattern.",
      hints: ["Use the topic particle pronounced wa.", "Write は, or type wa."],
    },
    {
      id: "availability-yes-meaning",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt:
        "Read or listen to the reply to 本はありますか. What does it mean?",
      japanese: positive.text,
      expected: "Yes, we have them.",
      accepted: ["Yes, we have them."],
      options: [
        "Yes, we have them.",
        "No, we don't have them.",
        "Where are the books?",
      ],
      explanation:
        "はい、あります confirms that the item is available. Understanding a selected reply is supported comprehension, not proof that you asked the question independently.",
      hints: ["はい means yes.", "あります says that it is available."],
    },
    {
      id: "availability-no-meaning",
      facet: "grammar",
      kind: "choice",
      targetId: grammarId,
      prompt:
        "Read or listen to this shop reply. Are the requested books available?",
      japanese: negative.text,
      expected: "No, they are not available.",
      accepted: ["No, they are not available."],
      options: [
        "No, they are not available.",
        "Yes, they are available.",
        "They are new.",
      ],
      explanation:
        "いいえ means no; ありません says the item is not available. A staff member may add an apology. This is listening/reading support for the exchange.",
      hints: [
        "Notice いいえ and the negative ending ません.",
        "The reply says the item is not available.",
      ],
    },
    {
      id: "availability-own",
      facet: "sentence",
      kind: "sentence",
      targetId: grammarId,
      prompt:
        "Ask staff whether they have books, new books or old books. You can try asking about another item too.",
      expected:
        "本はありますか。 / 新しい本はありますか。 / 古い本はありますか。",
      accepted: [
        "本はありますか",
        "ほんはありますか",
        "本ありますか",
        "ほんありますか",
        "新しい本はありますか",
        "あたらしいほんはありますか",
        "新しい本ありますか",
        "あたらしいほんありますか",
        "古い本はありますか",
        "ふるいほんはありますか",
        "古い本ありますか",
        "ふるいほんありますか",
      ],
      romaji: [
        "hon wa arimasu ka",
        "hon arimasu ka",
        "atarashii hon wa arimasu ka",
        "atarashii hon arimasu ka",
        "furui hon wa arimasu ka",
        "furui hon arimasu ka",
      ],
      alternatives: ["本をください", "hon wo kudasai", "hon o kudasai"],
      explanation:
        "The item followed by はありますか asks whether it is available. Omitting は is natural and still demonstrates the question. A correct romaji answer does not prove kana literacy. A request alone uses a different pattern.",
      hints: [
        "Word bank: 本 (ほん), 新しい本 (あたらしいほん), 古い本 (ふるいほん).",
        "[item] + はありますか",
        "本はありますか。 / hon wa arimasu ka",
      ],
    },
  ],
  check: {
    status: "sourceChecked",
    checkedAt: "2026-10-15",
    method:
      "Original AI-assisted examples, explanations and invented visual memory aids, checked against the listed first-party language sources. Memory aids are not etymologies. No expert/native-speaker review is claimed. Audio is checked separately before release.",
    references: [
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L06.pdf",
        locator: "L6-19, grammar note 4",
        checked:
          "N（は）ありますか asks whether a thing is available; polite あります and optional topic は. No textbook dialogue is redistributed.",
      },
      {
        url: "https://www.irodori.jpf.go.jp/assets/data/resources/Grammar_Worksheets_X.pdf",
        locator:
          "PDF page 13, L6 note 4; PDF page 15, L7 note 3; page 16 adjective examples",
        checked:
          "Availability question in a staff/customer exchange, short positive and negative replies, and the adjective forms 新しい/古い. Examples and exercise prompts are original.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E5%BA%97",
        locator: "Meaning and reading records",
        checked:
          "Shop/store meaning and kun reading used by 店/みせ, distinct from compound てん. No source mnemonic copied.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E5%BA%97",
        locator: "Meaning, reading and patterns-of-use records",
        checked:
          "店 is shop/store and read みせ; 店がある expresses existence of a shop.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E6%9C%AC",
        locator: "Meaning and vocabulary records",
        checked:
          "Book meaning and the familiar 本/ほん word, reinforced from the request lesson.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E6%96%B0",
        locator: "Meaning and found-in-vocabulary records",
        checked:
          "Individual 新 means new; 新しい is a complete adjective with a different whole-word reading.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E6%96%B0%E3%81%97%E3%81%84",
        locator: "Meaning, reading, word type and patterns of use",
        checked:
          "新しい means new, reads あたらしい, is an い adjective and can directly precede a noun.",
      },
      {
        url: "https://www.wanikani.com/kanji/%E5%8F%A4",
        locator: "Meaning and found-in-vocabulary records",
        checked:
          "Individual 古 means old, applied to things rather than an elderly person; 古い reads ふるい.",
      },
      {
        url: "https://www.wanikani.com/vocabulary/%E5%8F%A4%E3%81%84",
        locator: "Meaning, reading and word type",
        checked:
          "古い is an い adjective, read ふるい, for old things/long-standing relationships. It is not the word secondhand.",
      },
    ],
  },
};
