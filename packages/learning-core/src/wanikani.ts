export type WaniKaniSubjectType = "kanji" | "vocabulary" | "kana_vocabulary";
export interface WaniKaniFamiliarity {
  subjectId: number;
  type: WaniKaniSubjectType;
  characters: string;
  level: number;
  srsStage: number;
  startedAt: string;
}
export interface WaniKaniSnapshot {
  importedAt: number;
  userLevel: number;
  maxLevelGranted: number;
  items: WaniKaniFamiliarity[];
}
export type WaniKaniImportCode =
  | "invalid-token"
  | "rate-limited"
  | "unavailable"
  | "invalid-response";
