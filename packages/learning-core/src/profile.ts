export type LearningBand = "foundations" | "early-n5" | "early-n4";
export type EstimatedLevel = "new" | "not-sure" | "n5" | "n4";
export type Goal = "conversation" | "travel" | "jlpt" | "media";
export type PlacementDomain = "kana" | "vocabulary" | "grammar" | "listening";
export type OnboardingStep = "setup" | "import" | "placement" | "interests" | "preview" | "complete";
export interface PlacementResponse { questionId: string; outcome: "correct" | "incorrect" | "dontKnow" | "unavailable"; bankVersion: number; }
export interface LearningProfile {
  estimatedLevel: EstimatedLevel;
  acceptedBand: LearningBand;
  goal: Goal;
  dailyMinutes: number;
  targetJlpt: "N5" | "N4" | "N3" | "N2" | "N1";
  examDate?: string;
  interests: string[];
  favorites: string[];
  dislikes: string[];
  onboardingStep: OnboardingStep;
  placementResponses: PlacementResponse[];
  placementSkipped: boolean;
  importSkipped: boolean;
  furigana: boolean;
  romaji: boolean;
  translations: boolean;
  textScale: number;
  audioSpeed: number;
  reminderEnabled: boolean;
}
export function initialProfile(): LearningProfile {
  return { estimatedLevel: "not-sure", acceptedBand: "foundations", goal: "conversation", dailyMinutes: 15, targetJlpt: "N5", interests: [], favorites: [], dislikes: [], onboardingStep: "setup", placementResponses: [], placementSkipped: false, importSkipped: false, furigana: true, romaji: true, translations: true, textScale: 1, audioSpeed: 1, reminderEnabled: false };
}
export function selectedBand(level: EstimatedLevel): LearningBand { return level === "n4" ? "early-n4" : level === "n5" ? "early-n5" : "foundations"; }
export function bandLabel(band: LearningBand): string { return { foundations: "Supported foundations", "early-n5": "Early N5", "early-n4": "Early N4" }[band]; }

// A calendar date stays a calendar date across timezones. Empty clears it;
// null means invalid. Never let Date silently roll February 30 into March.
export function parseExamDate(input: string): string | undefined | null {
  const value = input.trim();
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}
