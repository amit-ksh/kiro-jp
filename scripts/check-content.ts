import { requestsLesson } from "../packages/content/src/requests.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
import fs from "node:fs";
import { createHash } from "node:crypto";
const errors = checkPreparedLesson(requestsLesson);
const audioDirectory = "packages/content/assets/requests-v1";
const expectedAudio = new Map([
  ...requestsLesson.words.map(
    (word) => [`word-${word.id}`, word.reading] as const,
  ),
  ...requestsLesson.kana.map(
    (kana, index) => [`kana-${index + 1}`, kana.character] as const,
  ),
  ...[
    ...requestsLesson.words.map((word) => word.example),
    ...requestsLesson.grammar.examples,
  ].map((sentence) => [sentence.id, sentence.reading + "。"] as const),
]);
for (const id of expectedAudio.keys())
  if (
    !fs.existsSync(`${audioDirectory}/${id}.json`) ||
    !fs.existsSync(`${audioDirectory}/${id}.wav`)
  )
    errors.push(`${id}: model audio is missing.`);
for (const name of fs
  .readdirSync(audioDirectory)
  .filter((name) => name.endsWith(".json"))) {
  const record = JSON.parse(
    fs.readFileSync(`${audioDirectory}/${name}`, "utf8"),
  );
  const audio = fs.readFileSync(`${audioDirectory}/${record.id}.wav`);
  if (
    record.lessonVersion !== requestsLesson.version ||
    record.id !== name.slice(0, -5) ||
    record.text !== expectedAudio.get(record.id) ||
    record.languageCheck?.matches !== true ||
    record.languageCheck.audioHash !== record.sha256 ||
    createHash("sha256").update(audio).digest("hex") !== record.sha256
  )
    errors.push(`${record.id}: audio consistency/hash gate is incomplete.`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({
      lesson: requestsLesson.id,
      version: requestsLesson.version,
      words: requestsLesson.words.length,
      kana: requestsLesson.kana.length,
      exercises: requestsLesson.exercises.length,
      check: requestsLesson.check.status,
      availability:
        "text and AI-transcript-consistent audio; native playback/speech gates separate",
    }),
  );
