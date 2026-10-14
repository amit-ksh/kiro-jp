export const culturalEntityTypes = [
  "urn:entity:place",
  "urn:entity:book",
  "urn:entity:tv_show",
  "urn:entity:movie",
  "urn:entity:artist",
] as const;
export type CulturalEntityType = (typeof culturalEntityTypes)[number];
export interface CulturalEntity {
  id: string;
  name: string;
  type: CulturalEntityType;
  description?: string;
  disambiguation?: string;
}
export interface CulturalSnapshot {
  candidates: {
    query: string;
    type: CulturalEntityType;
    items: CulturalEntity[];
  }[];
  recommendations: {
    entity: CulturalEntity;
    inputs: string[];
    checkedAt: number;
  }[];
}
export interface CulturalChoice {
  query: string;
  entity: CulturalEntity;
}
export function culturalQueryKey(query: string) {
  return query.normalize("NFKC").trim().toLowerCase();
}
// A selection is valid only for an identity actually offered in this snapshot.
export function chooseCulturalCandidate(
  snapshot: CulturalSnapshot,
  query: string,
  entityId: string,
) {
  const candidate = snapshot.candidates.find(
    (item) =>
      culturalQueryKey(item.query) === culturalQueryKey(query) &&
      item.items.some((entity) => entity.id === entityId),
  );
  const entity = candidate?.items.find(
    (item) => item.id === entityId && item.type === candidate.type,
  );
  if (!candidate || !entity)
    throw new Error("Choose a favorite from these saved results.");
  return { query: candidate.query, entity };
}
