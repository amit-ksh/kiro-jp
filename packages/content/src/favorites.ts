import type { CheckedSentence, LessonWord, PreparedLesson } from "@packages/learning-core";
const grammarId = "likes-suki";
function likes(id: string, word: string, reading: string, romaji: string, english: string): CheckedSentence {
  return {
    id, text: `${word}が好きです。`, reading: `${reading}がすきです`,
    romaji: `${romaji} ga suki desu`, meaning: `I like ${english}.`,
    segments: [
      {text: word, reading, meaning: english},
      {text: "が", reading: "が", meaning: "marks what is liked", grammar: grammarId},
      {text: "好き", reading: "すき", meaning: "liked", grammar: grammarId},
      {text: "です", reading: "です", meaning: "polite ending", grammar: grammarId},
      {text: "。", reading: "", meaning: "sentence ending"},
    ],
  };
}
const japan = likes("like-japan", "日本", "にほん", "nihon", "Japan");
const book = likes("like-books", "本", "ほん", "hon", "books");
const music = likes("like-music", "音楽", "おんがく", "ongaku", "music");
const sound: CheckedSentence = {
  ...likes("like-sound", "音", "おと", "oto", "this sound"),
  text: "この音が好きです。", reading: "このおとがすきです", romaji: "kono oto ga suki desu",
  segments: [{text:"この",reading:"この",meaning:"this"}, ...likes("like-sound", "音", "おと", "oto", "sound").segments],
};
const question: CheckedSentence = {
  id: "music-question", text: "音楽が好きですか。", reading: "おんがくがすきですか",
  romaji: "ongaku ga suki desu ka", meaning: "Do you like music?",
  segments: [...music.segments.slice(0,-1), {text:"か",reading:"か",meaning:"marks a question",grammar:grammarId}, {text:"。",reading:"",meaning:"sentence ending"}],
};
const askBack: CheckedSentence = {
  id: "likes-question", text: "何が好きですか。", reading: "なにがすきですか",
  romaji: "nani ga suki desu ka", meaning: "What do you like?",
  segments: [{text:"何",reading:"なに",meaning:"what"}, ...question.segments.slice(1)],
};
const response: CheckedSentence = {
  id: "likes-response", text: "はい、好きです。", reading: "はいすきです",
  romaji: "hai suki desu", meaning: "Yes, I do.",
  segments: [
    {text:"はい",reading:"はい",meaning:"yes"}, {text:"、",reading:"",meaning:"pause"},
    {text:"好き",reading:"すき",meaning:"like the thing just mentioned",grammar:grammarId},
    {text:"です",reading:"です",meaning:"polite ending",grammar:grammarId},
    {text:"。",reading:"",meaning:"sentence ending"},
  ],
};
const words: readonly LessonWord[] = [
  {
    id:"japan",kanji:"日",meaning:"sun",meaningAliases:["sun","the sun","day"],
    word:"日本",vocabulary:{meaning:"Japan",meaningAliases:["Japan"]},
    reading:"にほん",readingAliases:["にほん","にっぽん"],romaji:["nihon","nippon"],
    mnemonic:"Imagine sunlight resting inside a small window. Link the shape with the sun and a new day.",
    readingNote:"日本 is the country Japan. Our model uses にほん; にっぽん is also accepted. 日 has a sun/day meaning, while the whole word 日本 means Japan. 本 appears again on its own as ほん, book, in this session. A character does not keep one fixed reading in every word.",
    example:japan,
  },
  {
    id:"book",kanji:"本",meaning:"book",meaningAliases:["book","a book","books"],
    word:"本",reading:"ほん",readingAliases:["ほん"],romaji:["hon"],
    mnemonic:"Picture an open book with a tiny bookmark across its lower pages. Connect the whole shape with a book.",
    readingNote:"The ordinary word 本, book, is ほん. It can refer to books in general in 本が好きです. You also hear ほん at the end of にほん (日本); the whole word 日本 has its own meaning.",
    example:book,
  },
  {
    id:"sound",kanji:"音",meaning:"sound",meaningAliases:["sound","a sound","noise"],
    word:"音",reading:"おと",readingAliases:["おと"],romaji:["oto"],
    mnemonic:"Imagine a small speaker with a square display beneath it. Associate the whole shape with a sound coming out.",
    readingNote:"For a sound in この音 (this sound), 音 is おと. In the compound 音楽, the same character contributes おん. Practise the reading of the specific word shown.",
    example:sound,
  },
  {
    id:"music",kanji:"楽",meaning:"music",meaningAliases:["music","comfort","ease","pleasure"],
    word:"音楽",vocabulary:{meaning:"music",meaningAliases:["music"]},
    reading:"おんがく",readingAliases:["おんがく"],romaji:["ongaku"],
    mnemonic:"Picture a little stage on a stand, surrounded by tapping hands. Connect this shape with music.",
    readingNote:"音楽 means music and is read おんがく: 音 contributes おん and 楽 contributes がく here. 楽 also has comfort/ease/pleasure senses in other words; 音楽 as a whole means music. We assess that vocabulary meaning separately.",
    example:music,
  },
];
const kana = [
  {character:"に",sound:"ni",note:"The first sound in にほん (Japan)."},
  {character:"ほ",sound:"ho",note:"Hear this sound in ほん (book) and にほん."},
  {character:"ん",sound:"n",note:"The last kana in ほん and にほん. Listen to the whole word as well as the individual kana."},
];
export const favoritesLesson: PreparedLesson = {
  id:"favorites",version:1,title:"Talk about what you like",
  outcome:"Say what you like, ask about another person's interests and respond",
  words,kana,
  grammar:{
    id:grammarId,pattern:"[thing] + が好きです",
    explanation:"Name something you like, add が, then 好きです (すきです). が marks the thing you like. 好き describes liking; it does not use the request particle を. 好 is supported here as part of すき, not an extra kanji recall target. Add か to ask a polite question. When the thing is already clear, はい、好きです is a short yes response. 何 (なに, what) in 何が好きですか lets you ask back.",
    register:"です makes this an ordinary polite way to discuss interests with someone you have just met. Share your own preferences and invite theirs; liking Japanese media does not require matching someone else's taste.",
    mistake:"For today's full pattern, use が: 音楽が好きです. を好きです does not fit this pattern. This lesson practises a positive preference; do not assume everyone likes the same thing.",
    examples:[japan,music,question,askBack,response],
  },
  exercises:[
    ...words.map(word=>({
      id:`meaning-${word.id}`,facet:"meaning" as const,kind:"recall" as const,targetId:word.id,
      prompt:"What meaning did we learn for this kanji? Answer in English.",japanese:word.kanji,
      expected:word.meaning,accepted:word.meaningAliases,
      explanation:`${word.kanji} has the meaning ${word.meaning} in this session. A whole vocabulary word can have its own meaning.`,
      hints:[word.mnemonic,`The taught kanji meaning is ${word.meaning}.`],
    })),
    ...words.flatMap(word=>word.vocabulary?[{
      id:`vocabulary-${word.id}`,facet:"meaning" as const,kind:"recall" as const,targetId:word.id,
      prompt:"What does this whole vocabulary word mean? Answer in English.",japanese:word.word,
      expected:word.vocabulary.meaning,accepted:word.vocabulary.meaningAliases,
      explanation:`${word.word} is ${word.reading} (${word.romaji[0]}) and means ${word.vocabulary.meaning}. This checks the complete word.`,
      hints:[word.readingNote,`The whole word means ${word.vocabulary.meaning}.`],
    }]:[]),
    ...words.map(word=>({
      id:`reading-${word.id}`,facet:"reading" as const,kind:"recall" as const,targetId:word.id,
      prompt:"How do you read this whole word? Kana or romaji is welcome.",japanese:word.word,
      expected:word.reading,accepted:word.readingAliases,romaji:word.romaji,
      explanation:word.readingNote,hints:[`Think of the word for ${word.vocabulary?.meaning??word.meaning}.`,`${word.word} is ${word.reading} (${word.romaji[0]}).`],
    })),
    ...kana.map(k=>({
      id:`kana-${k.sound}`,facet:"kana" as const,kind:"recall" as const,targetId:k.character,
      prompt:"Which sound does this hiragana make? Type its sound in romaji.",japanese:k.character,
      expected:k.sound,accepted:[k.sound],romaji:[k.sound],
      explanation:`${k.character} is represented by ${k.sound}. Practise it in the whole word too.`,hints:[`The sound is ${k.sound}.`],
    })),
    {
      id:"likes-choice",facet:"grammar",kind:"choice",targetId:grammarId,
      prompt:"Which sentence says that you like music?",expected:music.text,accepted:[music.text],
      options:[music.text,"音楽をください。",question.text],
      explanation:"音楽 is music; が好きです says you like it. A final か would turn it into a question.",hints:["Use が好きです to state a preference.",music.text],
    },
    {
      id:"likes-tiles",facet:"grammar",kind:"tiles",targetId:grammarId,
      prompt:"Arrange the pieces to say that you like books.",expected:book.text,accepted:["本が好きです"],
      tiles:["好きです","本","が"],explanation:"The thing you like comes before が好きです. Sentence tiles provide support.",hints:["[thing] + が + 好きです","本 → が → 好きです"],
    },
    {
      id:"likes-gap",facet:"grammar",kind:"gap",targetId:grammarId,
      prompt:"Fill the particle that marks the thing you like.",japanese:"音楽（　）好きです。",
      expected:"が",accepted:["が"],romaji:["ga"],
      explanation:"が marks what you like in this pattern: 音楽が好きです.",hints:["Use the preference marker, rather than the request particle を.","The missing particle is が (ga)."],
    },
    {
      id:"likes-question-meaning",facet:"grammar",kind:"choice",targetId:grammarId,
      prompt:"Read or listen to this question. What does it ask?",japanese:question.text,
      expected:"Do you like music?",accepted:["Do you like music?"],
      options:["Do you like music?","Where is the music?","Music, please."],
      explanation:"か makes this a question about whether the other person likes music.",hints:["Notice が好きです and the final か.","It asks whether someone likes music."],
    },
    {
      id:"likes-response",facet:"grammar",kind:"choice",targetId:grammarId,
      prompt:"Someone asks 音楽が好きですか. Choose a short answer saying yes, you do like it.",
      expected:response.text,accepted:[response.text],options:[response.text,"音楽はどこですか。","音楽をください。"],
      explanation:"When music is already the subject of the exchange, はい、好きです means Yes, I do. This supported choice is not an independent speaking assessment.",hints:["はい says yes, and 好きです expresses the preference.",response.text],
    },
    {
      id:"likes-own",facet:"sentence",kind:"sentence",targetId:grammarId,
      prompt:"Tell a new acquaintance you like music, books or Japan, or ask whether they like music. Use today's preference pattern. You may try another interest too.",
      expected:"音楽が好きです。 / 本が好きです。 / 日本が好きです。 / 音楽が好きですか。",
      accepted:["音楽が好きです","おんがくがすきです","本が好きです","ほんがすきです","日本が好きです","にほんがすきです","にっぽんがすきです","音楽が好きですか","おんがくがすきですか"],
      romaji:["ongaku ga suki desu","hon ga suki desu","nihon ga suki desu","nippon ga suki desu","ongaku ga suki desu ka"],
      alternatives:["音楽は好きです","ongaku wa suki desu"],
      explanation:"The thing you like followed by が好きです states your preference; adding か asks about theirs. Approved romaji demonstrates the pattern without proving kana literacy.",
      hints:["Word bank: 音楽 (おんがく), 本 (ほん), 日本 (にほん).","[thing] + が好きです","音楽が好きです。 / ongaku ga suki desu"],
    },
  ],
  check:{
    status:"sourceChecked",checkedAt:"2026-10-15",
    method:"Original AI-assisted explanations, examples and invented memory aids, source-checked against the listed first-party grammar and lexical records. Memory aids are not etymologies. No native-speaker or expert review is claimed. Audio is checked separately before release.",
    references:[
      {url:"https://www.erin.jpf.go.jp/materials/key-phrases/download/erin_lesson07_key-phrases_explanation.pdf",locator:"Lesson 7, pages 1–3",checked:"Noun + が好きです, the polite question ending か, and an appropriate short 好きです response when the topic is already known."},
      {url:"https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L11.pdf",locator:"L11-3, L11-7/8, L11-19/20",checked:"Discussing interests, asking back with なにが好きですか, music/book context vocabulary and natural questions/responses. No source dialogue is redistributed."},
      {url:"https://www.irodori.jpf.go.jp/assets/data/wordlist_X.pdf",locator:"L11-1/2, PDF pages 36–37; L5-1",checked:"音楽/おんがく/music, 本/ほん/book, and 好きです/すきです. Kana group に・ほ・ん is reused in checked vocabulary."},
      {url:"https://www.wanikani.com/kanji/%E6%97%A5",locator:"Meaning and vocabulary records",checked:"Individual sun/day meanings; Japanese country vocabulary has a separate meaning. No mnemonic copied."},
      {url:"https://www.wanikani.com/vocabulary/%E6%97%A5%E6%9C%AC",locator:"Meaning and reading records",checked:"日本 means Japan; both にほん and にっぽん are accepted readings."},
      {url:"https://www.wanikani.com/kanji/%E6%9C%AC",locator:"Meaning and vocabulary records",checked:"Book meaning for the individual kanji; whole compounds remain separate."},
      {url:"https://www.wanikani.com/vocabulary/%E9%9F%B3",locator:"Meaning and reading records",checked:"音 as おと for sound/noise, distinct from おん in 音楽."},
      {url:"https://www.wanikani.com/kanji/%E6%A5%BD",locator:"Meanings and found-in-vocabulary records",checked:"Music is a kanji sense alongside comfort/ease/pleasure; 音楽 has a separate music-only vocabulary meaning."},
      {url:"https://www.wanikani.com/vocabulary/%E9%9F%B3%E6%A5%BD",locator:"Meaning and reading records",checked:"音楽 means music and is read おんがく. No proprietary mnemonic or explanation copied."},
    ],
  },
};
