import { createCurriculum } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
export const preparedLessons = [requestsLesson] as const;
export const curriculum = createCurriculum(preparedLessons);
