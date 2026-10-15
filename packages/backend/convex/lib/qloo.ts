"use node";
import {
  culturalEntityTypes,
  culturalQueryKey,
  type CulturalChoice,
  type CulturalEntity as Entity,
  type CulturalSnapshot,
} from "@packages/learning-core";
export const culturalTypes = culturalEntityTypes;
export type CulturalType = (typeof culturalTypes)[number];
export type CulturalEntity = Entity;
export interface InterestTag {
  id: string;
  name: string;
}
export interface QlooConfig {
  baseUrl: string;
  apiKey?: string;
  tagIdField?: "id" | "tag_id";
}
export interface QlooCacheEntry {
  items: unknown[];
  inputs: string[];
  checkedAt: number;
  expiresAt: number;
}
export interface QlooCache {
  read: (key: string) => Promise<QlooCacheEntry | null>;
  write: (key: string, entry: QlooCacheEntry) => Promise<void>;
  key: (input: string) => string;
}
export type QlooResult<T> =
  | { status: "ready"; items: T[]; inputs: string[]; checkedAt: number }
  | {
      status:
        | "unavailable"
        | "notConfigured"
        | "schemaPending"
        | "limitReached";
      items: [];
      inputs: string[];
    };
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function short(value: unknown, length: number) {
  return typeof value === "string" ? value.slice(0, length) : undefined;
}
export function decodeEntities(value: unknown): CulturalEntity[] {
  if (!Array.isArray(value)) throw new Error("Invalid Qloo entity envelope.");
  return value.slice(0, 5).flatMap((item) => {
    const row = record(item),
      type =
        row.subtype ??
        row.type ??
        (Array.isArray(row.types) && row.types.length === 1
          ? row.types[0]
          : undefined),
      properties = record(row.properties);
    if (
      typeof row.entity_id !== "string" ||
      !/^[a-zA-Z0-9:_-]{8,128}$/u.test(row.entity_id) ||
      typeof row.name !== "string" ||
      !(culturalTypes as readonly unknown[]).includes(type)
    )
      return [];
    return [
      {
        id: row.entity_id,
        name: row.name.slice(0, 160),
        type: type as CulturalType,
        ...(short(properties.description, 400)
          ? { description: short(properties.description, 400) }
          : {}),
        ...(short(row.disambiguation, 200)
          ? { disambiguation: short(row.disambiguation, 200) }
          : {}),
      },
    ];
  });
}
export function decodeTags(
  value: unknown,
  idField: "id" | "tag_id",
): InterestTag[] {
  if (!Array.isArray(value)) throw new Error("Invalid Qloo tag envelope.");
  return value.slice(0, 10).flatMap((item) => {
    const row = record(item),
      id = row[idField];
    return typeof id === "string" &&
      /^urn:tag:[a-zA-Z0-9:_-]{1,200}$/u.test(id) &&
      typeof row.name === "string"
      ? [{ id, name: row.name.slice(0, 160) }]
      : [];
  });
}
export function createQlooSession(
  config: QlooConfig,
  transport: typeof fetch = fetch,
  cache?: QlooCache,
  choices: readonly CulturalChoice[] = [],
) {
  const root = config.baseUrl.replace(/\/$/u, "");
  if (
    root &&
    ![
      "https://hackathon.api.qloo.com",
      "https://staging.api.qloo.com",
      "https://api.qloo.com",
    ].includes(root)
  )
    throw new Error("Unsupported Qloo host.");
  const entities = new Set<string>(),
    tags = new Set<string>(),
    recommendations: CulturalEntity[] = [];
  const names = new Map<string, string>();
  const context: CulturalSnapshot = { candidates: [], recommendations: [] };
  let calls = 0;
  const traces: {
    operation: string;
    inputs: string[];
    status: string;
    ids: string[];
  }[] = [];
  async function request<T>(
    operation: string,
    path: string,
    params: Record<string, string>,
    inputs: string[],
    decode: (data: Record<string, unknown>) => T[],
    variant = "",
  ): Promise<QlooResult<T>> {
    if (!root || !config.apiKey)
      return { status: "notConfigured", items: [], inputs };
    const cacheKey = cache?.key(
      JSON.stringify([
        "decoded-context-v3",
        root,
        operation,
        config.tagIdField ?? "",
        Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
        variant,
      ]),
    );
    if (cache && cacheKey) {
      try {
        const stored = await cache.read(cacheKey);
        if (
          stored &&
          stored.expiresAt > Date.now() &&
          stored.checkedAt <= Date.now() + 300_000
        ) {
          traces.push({
            operation,
            inputs: stored.inputs,
            status: "cached",
            ids: stored.items.map((item) => String(record(item).id)),
          });
          return {
            status: "ready",
            items: stored.items as T[],
            inputs: stored.inputs,
            checkedAt: stored.checkedAt,
          };
        }
      } catch {
        /* Cache failure does not block a bounded live request. */
      }
    }
    if (calls >= 3) return { status: "limitReached", items: [], inputs };
    calls += 1;
    try {
      const url = new URL(path, root);
      Object.entries(params).forEach(([key, value]) =>
        url.searchParams.set(key, value),
      );
      const response = await transport(url, {
        method: "GET",
        headers: { "X-Api-Key": config.apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Qloo unavailable.");
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error("Qloo response too large.");
      const data = record(JSON.parse(text));
      // Provisioned /search omits success and returns types[] on each item.
      // Tags/Insights still require their documented success:true envelope.
      const searchEnvelope =
        operation === "resolveFavorite" &&
        data.success === undefined &&
        Array.isArray(data.results) &&
        !("error" in data) &&
        !("errors" in data);
      if (data.success !== true && !searchEnvelope)
        throw new Error("Invalid Qloo envelope.");
      const items = decode(data);
      const checkedAt = Date.now();
      if (cache && cacheKey) {
        try {
          await cache.write(cacheKey, {
            items,
            inputs,
            checkedAt,
            expiresAt: checkedAt + 86_400_000,
          });
        } catch {
          /* The live result remains useful without a cache write. */
        }
      }
      traces.push({
        operation,
        inputs,
        status: "ready",
        ids: items.map((item) => String(record(item).id)),
      });
      return { status: "ready", items, inputs, checkedAt };
    } catch {
      traces.push({ operation, inputs, status: "unavailable", ids: [] });
      return { status: "unavailable", items: [], inputs };
    }
  }
  return {
    traces,
    recommendations,
    context,
    async resolveFavorite(query: string, type: CulturalType) {
      if (!query.trim() || query.length > 120 || !culturalTypes.includes(type))
        throw new Error("Invalid cultural search.");
      const result = await request(
        "resolveFavorite",
        "/search",
        { query: query.trim(), types: type, take: "5" },
        [query],
        (data) =>
          decodeEntities(data.results).filter((item) => item.type === type),
      );
      const selected = choices.find(
        (choice) =>
          culturalQueryKey(choice.query) === culturalQueryKey(query) &&
          choice.entity.type === type,
      );
      const chosen = selected
        ? result.items.filter((item) => item.id === selected.entity.id)
        : [];
      const exact = result.items.filter(
        (item) => item.name.toLowerCase() === query.trim().toLowerCase(),
      );
      // Ambiguous search results are suggestions, not a confirmed favorite.
      const confirmed =
        chosen.length === 1
          ? chosen
          : result.items.length === 1
            ? result.items
            : exact.length === 1
              ? exact
              : [];
      confirmed.forEach((item) => {
        entities.add(item.id);
        names.set(item.id, item.name);
      });
      const requiresChoice = result.items.length > 1 && !confirmed.length;
      if (
        requiresChoice &&
        !context.candidates.some(
          (candidate) =>
            culturalQueryKey(candidate.query) === culturalQueryKey(query) &&
            candidate.type === type,
        )
      )
        context.candidates.push({ query, type, items: result.items });
      return { ...result, requiresChoice };
    },
    async findInterestTags(query: string): Promise<QlooResult<InterestTag>> {
      if (!query.trim() || query.length > 120)
        throw new Error("Invalid interest search.");
      if (!config.apiKey)
        return { status: "notConfigured", items: [], inputs: [query] };
      // The published tag-item schema is open. Select the decoder only after
      // inspecting the provisioned response; no guess is called live-verified.
      if (!config.tagIdField)
        return { status: "schemaPending", items: [], inputs: [query] };
      const result = await request(
        "findInterestTags",
        "/v2/tags",
        { "filter.query": query.trim(), take: "10" },
        [query],
        (data) => decodeTags(record(data.results).tags, config.tagIdField!),
      );
      result.items.forEach((item) => {
        tags.add(item.id);
        names.set(item.id, item.name);
      });
      return result;
    },
    async recommendCulturalContexts(
      type: CulturalType,
      entityIds: string[],
      tagIds: string[],
      dislikes: readonly string[] = [],
    ) {
      if (
        !culturalTypes.includes(type) ||
        entityIds.length + tagIds.length > 10 ||
        entityIds.some((id) => !entities.has(id)) ||
        tagIds.some((id) => !tags.has(id)) ||
        (!entityIds.length && !tagIds.length)
      )
        throw new Error("Resolve real Qloo signals before recommending.");
      const params: Record<string, string> = {
        "filter.type": type,
        take: "5",
        "feature.explainability": "true",
      };
      if (entityIds.length)
        params["signal.interests.entities"] = entityIds.join(",");
      if (tagIds.length) params["signal.interests.tags"] = tagIds.join(",");
      if (type === "urn:entity:place")
        params["filter.geocode.country_code"] = "JP";
      const result = await request(
        "recommendCulturalContexts",
        "/v2/insights",
        params,
        [...entityIds, ...tagIds],
        (data) =>
          decodeEntities(record(data.results).entities).filter(
            (item) =>
              item.type === type &&
              !dislikes.includes(item.id) &&
              !dislikes.some(
                (dislike) => dislike.toLowerCase() === item.name.toLowerCase(),
              ),
          ),
        JSON.stringify([...dislikes].sort()),
      );
      recommendations.push(...result.items);
      if (result.status === "ready") {
        const inputs = [...entityIds, ...tagIds].map(
          (id) => names.get(id) ?? "a confirmed interest",
        );
        for (const entity of result.items)
          if (
            !context.recommendations.some(
              (item) => item.entity.id === entity.id,
            )
          )
            context.recommendations.push({
              entity,
              inputs,
              checkedAt: result.checkedAt,
            });
      }
      return result;
    },
  };
}
