// Authoring candidates are not learner-visible until audio/package gates pass.
import { createCurriculum } from "@packages/learning-core";
import { requestsLesson } from "./requests.ts";
import { directionsLesson } from "./directions.ts";
import { favoritesLesson } from "./favorites.ts";
import { availabilityLesson } from "./availability.ts";
import { desireLesson } from "./desire.ts";
export const authoringLessons = [
  requestsLesson,
  directionsLesson,
  favoritesLesson,
  availabilityLesson,
  desireLesson,
] as const;
export const authoringCurriculum = createCurriculum(authoringLessons);
