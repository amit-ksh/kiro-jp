import { createCurriculum } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
import { directionsLesson } from "./directions.ts";
import { favoritesLesson } from "./favorites.ts";
import { availabilityLesson } from "./availability.ts";
export const preparedLessons = [requestsLesson, directionsLesson, favoritesLesson, availabilityLesson] as const;
export const curriculum = createCurriculum(preparedLessons);
