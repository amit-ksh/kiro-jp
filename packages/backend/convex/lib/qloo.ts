"use node";
export const culturalTypes = [
  "urn:entity:place",
  "urn:entity:book",
  "urn:entity:tv_show",
  "urn:entity:movie",
  "urn:entity:artist",
] as const;
export type CulturalType = (typeof culturalTypes)[number];
export interface CulturalEntity {
  id: string;
  name: string;
  type: CulturalType;
  description?: string;
  disambiguation?: string;
}
export interface InterestTag {
  id: string;
  name: string;
}
export interface QlooConfig {
  baseUrl: string;
  apiKey?: string;
  tagIdField?: "id" | "tag_id";
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
      type = row.subtype ?? row.type,
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
  ): Promise<QlooResult<T>> {
    if (!root || !config.apiKey)
      return { status: "notConfigured", items: [], inputs };
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
      if (data.success !== true) throw new Error("Invalid Qloo envelope.");
      const items = decode(data);
      traces.push({
        operation,
        inputs,
        status: "ready",
        ids: items.map((item) => String(record(item).id)),
      });
      return { status: "ready", items, inputs, checkedAt: Date.now() };
    } catch {
      traces.push({ operation, inputs, status: "unavailable", ids: [] });
      return { status: "unavailable", items: [], inputs };
    }
  }
  return {
    traces,
    recommendations,
    async resolveFavorite(query: string, type: CulturalType) {
      if (!query.trim() || query.length > 120 || !culturalTypes.includes(type))
        throw new Error("Invalid cultural search.");
      const result = await request(
        "resolveFavorite",
        "/search",
        { query: query.trim(), types: type, take: "5" },
        [query],
        (data) => decodeEntities(data.results),
      );
      const exact = result.items.filter(
        (item) => item.name.toLowerCase() === query.trim().toLowerCase(),
      );
      // Ambiguous search results are suggestions, not a confirmed favorite.
      const confirmed =
        result.items.length === 1
          ? result.items
          : exact.length === 1
            ? exact
            : [];
      confirmed.forEach((item) => entities.add(item.id));
      return result;
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
      result.items.forEach((item) => tags.add(item.id));
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
              !dislikes.includes(item.id) &&
              !dislikes.some(
                (dislike) => dislike.toLowerCase() === item.name.toLowerCase(),
              ),
          ),
      );
      recommendations.push(...result.items);
      return result;
    },
  };
}
