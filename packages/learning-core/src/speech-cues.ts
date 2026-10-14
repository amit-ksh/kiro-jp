import type { PreparedLesson } from "./lesson.ts";
export function lessonSpeechCues(lesson: PreparedLesson) {
  const sentences = [
    ...new Map(
      [
        ...lesson.words.map((word) => word.example),
        ...lesson.grammar.examples,
      ].map((sentence) => [sentence.id, sentence]),
    ).values(),
  ];
  return [
    ...lesson.words.map((word) => ({
      id: `word-${word.id}`,
      text: word.word,
      reading: word.reading,
      meaning: word.meaning,
    })),
    ...sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      reading: sentence.reading,
      meaning: sentence.meaning,
    })),
    {
      id: "own-sentence",
      text: "Your own sentence",
      reading:
        "Say a sentence using today’s pattern, then check the transcript.",
      meaning: "Use vocabulary and grammar from this lesson.",
    },
  ];
}
