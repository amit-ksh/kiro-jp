// Authoring candidates are not learner-visible until audio/package gates pass.
import { createCurriculum } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
import { directionsLesson } from "./directions.ts";
export const authoringLessons = [requestsLesson, directionsLesson] as const;
export const authoringCurriculum = createCurriculum(authoringLessons);
