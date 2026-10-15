import { z } from "zod";
import type { CulturalSnapshot } from "@packages/learning-core";
import {
  culturalTypes,
  type CulturalType,
  type InterestTag,
  type createQlooSession,
} from "./qloo.ts";

export const contextRequestSchema = z.object({
  source: z.enum(["interest", "favorite", "ordinary"]),
  query: z.string().max(120),
  type: z.enum(culturalTypes),
});
export type ContextRequest = z.infer<typeof contextRequestSchema>;

function label(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/s$/u, "");
}

export function selectInterestSignals(
  items: readonly InterestTag[],
  query: string,
  type: CulturalType,
) {
  const namespaces =
    type === "urn:entity:place"
      ? ["urn:tag:category:place:", "urn:tag:genre:place:"]
      : type === "urn:entity:artist"
        ? ["urn:tag:genre:music:"]
        : [
            "urn:tag:genre:media:",
            "urn:tag:keyword:qloo:",
            "urn:tag:subgenre:qloo:",
          ];
  // Use only returned IDs with a matching label and applicable category. A
  // similarly spelled dish or an anime music tag is not a media signal.
  return items
    .filter((item) => label(item.name) === label(query))
    .filter((item) => namespaces.some((prefix) => item.id.startsWith(prefix)))
    .sort(
      (a, b) =>
        namespaces.findIndex((prefix) => a.id.startsWith(prefix)) -
        namespaces.findIndex((prefix) => b.id.startsWith(prefix)),
    )
    .slice(0, 1)
    .map((item) => item.id);
}

export async function findConversationContext(
  session: ReturnType<typeof createQlooSession>,
  request: ContextRequest,
  dislikes: readonly string[] = [],
) {
  contextRequestSchema.parse(request);
  if (request.source === "ordinary")
    return { status: "ordinary" as const, items: [] };
  if (!request.query.trim()) throw new Error("A cultural query is required.");
  if (request.source === "favorite") {
    const result = await session.resolveFavorite(request.query, request.type);
    if (result.status !== "ready" || !result.items.length) return result;
    if (result.requiresChoice)
      return { ...result, status: "awaitingChoice" as const };
    const choice = await session.recommendCulturalContexts(
      request.type,
      result.confirmedEntityIds,
      [],
      dislikes,
    );
    return { ...choice, provenance: session.context.recommendations };
  }
  const interestQuery = /^shrines$/iu.test(request.query.trim())
    ? "shrine"
    : request.query;
  const result = await session.findInterestTags(interestQuery);
  if (result.status !== "ready" || !result.items.length) return result;
  const signals = selectInterestSignals(
    result.items,
    interestQuery,
    request.type,
  );
  if (!signals.length)
    return { status: "noMatchingSignal" as const, items: [] };
  const recommendations = await session.recommendCulturalContexts(
    request.type,
    [],
    signals,
    dislikes,
  );
  return { ...recommendations, provenance: session.context.recommendations };
}

export function conversationContextStep(
  step: number,
  isTopic: boolean,
  configured: boolean,
) {
  if (step >= 2) return { toolChoice: "none" as const, activeTools: [] };
  if (step === 0 && isTopic && configured)
    return {
      toolChoice: {
        type: "tool" as const,
        toolName: "findConversationContext" as const,
      },
      activeTools: ["findConversationContext"] as "findConversationContext"[],
    };
  return {};
}

type Recommendation = CulturalSnapshot["recommendations"][number];
function allowed(item: Recommendation, dislikes: readonly string[]) {
  return !dislikes.some(
    (value) =>
      value === item.entity.id ||
      value.toLowerCase() === item.entity.name.toLowerCase(),
  );
}

// Call only with messages from the owned immutable job snapshot. Learner text
// and stale replies cannot introduce a source ID into the next turn.
export function previousRecommendations(
  messages: readonly {
    role: string;
    stale: boolean;
    culture?: CulturalSnapshot;
  }[],
  dislikes: readonly string[],
) {
  const found = new Map<string, Recommendation>();
  for (const message of messages.slice(-10).reverse()) {
    if (message.role !== "assistant" || message.stale) continue;
    for (const item of message.culture?.recommendations ?? [])
      if (allowed(item, dislikes) && !found.has(item.entity.id))
        found.set(item.entity.id, item);
  }
  return [...found.values()].slice(0, 10);
}

export function replyCultureSnapshot(
  current: CulturalSnapshot,
  previous: readonly Recommendation[],
  usedIds: readonly string[],
  dislikes: readonly string[],
): CulturalSnapshot {
  const available = new Map(
    [...previous, ...current.recommendations]
      .filter((item) => allowed(item, dislikes))
      .map((item) => [item.entity.id, item]),
  );
  if (usedIds.some((id) => !available.has(id))) {
    const error = new Error("Unsupported tutor context source.");
    error.name = "TutorContextEvidenceError";
    throw error;
  }
  const selected = new Set([
    ...current.recommendations
      .filter((item) => allowed(item, dislikes))
      .map((item) => item.entity.id),
    ...usedIds,
  ]);
  return {
    candidates: current.candidates,
    recommendations: [...selected].map((id) => available.get(id)!),
  };
}
