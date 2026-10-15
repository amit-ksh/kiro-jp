import { createCurriculum } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
import { directionsLesson } from "./directions.ts";
export const preparedLessons = [requestsLesson, directionsLesson] as const;
export const curriculum = createCurriculum(preparedLessons);
