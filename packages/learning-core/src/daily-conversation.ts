import {
  culturalQueryKey,
  type CulturalEntity,
  type CulturalEntityType,
  type CulturalSnapshot,
} from "./culture.ts";
import type { LearningProfile } from "./profile.ts";

export type DailyConversationProfile = Pick<
  LearningProfile,
  "interests" | "favorites" | "dislikes" | "acceptedBand"
>;
export interface DailyConversationSuggestion {
  title: string;
  topic: string;
  interest: string;
  entity: CulturalEntity;
  inputs: string[];
  checkedAt: number;
  angle: number;
}
export function dailyConversationKey(
  profile: DailyConversationProfile,
  choices: readonly { query: string; entity: CulturalEntity }[] = [],
) {
  const values = (items: readonly string[]) =>
    [...new Set(items.map(culturalQueryKey))].sort();
  return JSON.stringify([
    "daily-v1",
    values(profile.interests),
    values(profile.favorites),
    values(profile.dislikes),
    profile.acceptedBand,
    choices
      .map((item) => [
        culturalQueryKey(item.query),
        item.entity.id,
        item.entity.type,
      ])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
export function dailyOrdinal(day: string) {
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid local day.");
  return Math.floor(timestamp / 86_400_000);
}
const broad: Record<string, { query: string; type: CulturalEntityType }> = {
  food: { query: "restaurant", type: "urn:entity:place" },
  culture: { query: "museum", type: "urn:entity:place" },
  places: { query: "landmark", type: "urn:entity:place" },
  travel: { query: "landmark", type: "urn:entity:place" },
  anime: { query: "anime", type: "urn:entity:tv_show" },
  manga: { query: "manga", type: "urn:entity:book" },
  music: { query: "j-pop", type: "urn:entity:artist" },
  "daily life": { query: "cafe", type: "urn:entity:place" },
};
export function dailyContextRequests(
  profile: DailyConversationProfile,
  day: string,
) {
  const values = [
    ...new Map(
      [
        ...profile.interests.map((interest) => ({
          interest,
          source: "interest" as const,
          ...(broad[culturalQueryKey(interest)] ?? {
            query: interest,
            type: "urn:entity:place" as const,
          }),
        })),
        ...profile.favorites.map((interest) => ({
          interest,
          query: interest,
          source: "favorite" as const,
          type: "urn:entity:tv_show" as const,
        })),
      ].map((item) => [
        `${culturalQueryKey(item.interest)}:${item.source}`,
        item,
      ]),
    ).values(),
  ];
  if (!values.length) return [];
  const index = dailyOrdinal(day) % values.length;
  return [...values.slice(index), ...values.slice(0, index)].slice(0, 3);
}
export function chooseDailyConversation(
  day: string,
  interest: string,
  recommendations: CulturalSnapshot["recommendations"],
  dislikes: readonly string[],
  recent: readonly Pick<DailyConversationSuggestion, "entity" | "angle">[] = [],
): DailyConversationSuggestion | null {
  const blocked = new Set(dislikes.map(culturalQueryKey));
  const candidates = [
    ...new Map(
      recommendations
        .filter(
          (item) =>
            !blocked.has(culturalQueryKey(item.entity.id)) &&
            !blocked.has(culturalQueryKey(item.entity.name)),
        )
        .map((item) => [item.entity.id, item]),
    ).values(),
  ].sort((a, b) => a.entity.id.localeCompare(b.entity.id));
  if (!candidates.length) return null;
  const fresh = candidates.filter(
    (item) => !recent.some((old) => old.entity.id === item.entity.id),
  );
  const pool = fresh.length
    ? fresh
    : candidates.filter((item) => item.entity.id !== recent[0]?.entity.id);
  const available = pool.length ? pool : candidates;
  const chosen = available[dailyOrdinal(day) % available.length]!;
  const angles =
    chosen.entity.type === "urn:entity:place"
      ? [
          "Plan a visit",
          "Ask about a place",
          "Share what you like",
          "Invite a friend",
        ]
      : [
          "Share your favorites",
          "Ask for a recommendation",
          "Describe what you enjoy",
          "Invite a friend to try it",
        ];
  let angle = dailyOrdinal(day) % angles.length;
  if (recent[0]?.entity.id === chosen.entity.id && recent[0].angle === angle)
    angle = (angle + 1) % angles.length;
  return {
    title: `${angles[angle]}: ${chosen.entity.name}`,
    topic: `Let's practise Japanese about ${chosen.entity.name}. ${angles[angle]}. Start a natural conversation at my Japanese level, help me express my ideas, and let me change the subject.`,
    interest,
    entity: chosen.entity,
    inputs: chosen.inputs.slice(0, 10),
    checkedAt: chosen.checkedAt,
    angle,
  };
}
