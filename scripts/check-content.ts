import { requestsLesson } from "../packages/content/src/requests.ts";
import { checkPreparedLesson } from "../packages/learning-core/src/content-check.ts";
const errors = checkPreparedLesson(requestsLesson);
if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ lesson: requestsLesson.id, version: requestsLesson.version, words: requestsLesson.words.length, kana: requestsLesson.kana.length, exercises: requestsLesson.exercises.length, check: requestsLesson.check.status, availability: "text-only; audio and speaking checks pending" }));
