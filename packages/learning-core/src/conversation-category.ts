import type { CulturalEntityType, CulturalSnapshot } from "./culture.ts";

export const conversationCategories = [
  { id: "places", label: "Places" },
  { id: "anime-manga", label: "Anime & Manga" },
  { id: "food", label: "Food" },
  { id: "daily-life", label: "Daily Life" },
] as const;
export type ConversationCategory =
  (typeof conversationCategories)[number]["id"];

const requests: Record<
  ConversationCategory,
  readonly { query: string; type: CulturalEntityType }[]
> = {
  places: [{ query: "landmark", type: "urn:entity:place" }],
  "anime-manga": [
    { query: "anime", type: "urn:entity:tv_show" },
    { query: "manga", type: "urn:entity:book" },
  ],
  food: [{ query: "restaurant", type: "urn:entity:place" }],
  "daily-life": [{ query: "cafe", type: "urn:entity:place" }],
};
function index(seed: string, length: number) {
  let hash = 0;
  for (const character of seed)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return hash % length;
}
export function categoryTopic(category: ConversationCategory) {
  const entry = conversationCategories.find((item) => item.id === category);
  if (!entry) throw new Error("Unknown conversation category.");
  return `Let's talk about ${entry.label}.`;
}
export function categoryContextRequest(
  category: ConversationCategory,
  seed: string,
) {
  const pool = requests[category];
  if (!pool) throw new Error("Unknown conversation category.");
  return { source: "interest" as const, ...pool[index(seed, pool.length)]! };
}
export function chooseCategoryContext(
  category: ConversationCategory,
  seed: string,
  recommendations: CulturalSnapshot["recommendations"],
  dislikes: readonly string[],
) {
  const request = categoryContextRequest(category, seed);
  const blocked = new Set(
    dislikes.map((value) => value.normalize("NFKC").trim().toLowerCase()),
  );
  const pool = [
    ...new Map(
      recommendations
        .filter(
          (item) =>
            (item.entity.type === request.type ||
              (request.query === "anime" &&
                item.entity.type === "urn:entity:movie")) &&
            item.inputs.some(
              (input) =>
                input.normalize("NFKC").trim().toLowerCase() === request.query,
            ) &&
            !blocked.has(
              item.entity.id.normalize("NFKC").trim().toLowerCase(),
            ) &&
            !blocked.has(
              item.entity.name.normalize("NFKC").trim().toLowerCase(),
            ),
        )
        .map((item) => [item.entity.id, item]),
    ).values(),
  ].sort((a, b) => a.entity.id.localeCompare(b.entity.id));
  return pool.length ? pool[index(seed, pool.length)] : undefined;
}
