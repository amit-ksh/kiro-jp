import { z } from "zod";
import type {
  WaniKaniFamiliarity,
  WaniKaniImportCode,
} from "@packages/learning-core/wanikani";

const origin = "https://api.wanikani.com";
const level = z.number().int().min(1).max(60);
const id = z.number().int().positive().safe();
const subjectType = z.enum(["kanji", "vocabulary", "kana_vocabulary"]);
const userSchema = z.object({
  object: z.literal("user"),
  data: z.object({
    level,
    subscription: z.object({ max_level_granted: level }),
  }),
});
const collectionSchema = z.object({
  object: z.literal("collection"),
  pages: z.object({ next_url: z.string().max(4000).nullable() }),
  total_count: z.number().int().min(0).max(10_000),
  data: z.array(z.unknown()).max(1000),
});
const subjectSchema = z.object({
  id,
  object: subjectType,
  data: z.object({
    characters: z.string().min(1).max(120),
    level,
    hidden_at: z.string().nullable(),
  }),
});
const assignmentSchema = z.object({
  id,
  object: z.literal("assignment"),
  data: z.object({
    subject_id: id,
    subject_type: subjectType,
    srs_stage: z.number().int().min(0).max(9),
    started_at: z.iso.datetime({ offset: true }).nullable(),
  }),
});
export class WaniKaniImportError extends Error {
  readonly code: WaniKaniImportCode;
  constructor(code: WaniKaniImportCode) {
    super(`WaniKani import: ${code}`);
    this.code = code;
  }
}
export interface FamiliarityTarget {
  type: "kanji" | "vocabulary";
  characters: string;
}
function safeUrl(raw: string, route: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WaniKaniImportError("invalid-response");
  }
  if (
    url.origin !== origin ||
    url.pathname !== `/v2/${route}` ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new WaniKaniImportError("invalid-response");
  return url;
}
async function boundedJson(response: Response) {
  if (!response.body) throw new WaniKaniImportError("invalid-response");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 1024 * 1024)
        throw new WaniKaniImportError("invalid-response");
      chunks.push(new Uint8Array(result.value));
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Token stays in this call's headers only. Never include upstream bodies/errors
// in an exception, saved snapshot, background job or diagnostic log.
export async function importWaniKani(
  token: string,
  targets: readonly FamiliarityTarget[],
  fetcher: typeof fetch = fetch,
) {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token))
    throw new WaniKaniImportError("invalid-token");
  if (
    targets.length > 200 ||
    targets.some((item) => !item.characters || item.characters.length > 120)
  )
    throw new WaniKaniImportError("invalid-response");
  const deadline = Date.now() + 30_000;
  let requests = 0;
  async function read(raw: string, route: string) {
    const url = safeUrl(raw, route);
    if (++requests > 20 || Date.now() >= deadline)
      throw new WaniKaniImportError("unavailable");
    const response = await fetcher(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(
        Math.min(8000, Math.max(1, deadline - Date.now())),
      ),
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
      },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new WaniKaniImportError(
        response.status === 401 || response.status === 403
          ? "invalid-token"
          : response.status === 429
            ? "rate-limited"
            : "unavailable",
      );
    }
    return boundedJson(response);
  }
  async function* pages(url: URL, route: string) {
    const seen = new Set<string>();
    const ids = new Set<number>();
    let expected: number | undefined;
    let next: string | null = url.href;
    while (next) {
      if (seen.has(next)) throw new WaniKaniImportError("invalid-response");
      seen.add(next);
      const page = collectionSchema.parse(await read(next, route));
      expected ??= page.total_count;
      if (expected !== page.total_count)
        throw new WaniKaniImportError("invalid-response");
      for (const row of page.data) {
        const item = z.object({ id }).parse(row);
        if (ids.has(item.id)) throw new WaniKaniImportError("invalid-response");
        ids.add(item.id);
      }
      yield page.data;
      next = page.pages.next_url;
    }
    if (ids.size !== expected)
      throw new WaniKaniImportError("invalid-response");
  }
  try {
    const user = userSchema.parse(await read(`${origin}/v2/user`, "user"));
    const maxLevelGranted = user.data.subscription.max_level_granted;
    const wanted = new Set(
      targets.map((item) => `${item.type}:${item.characters}`),
    );
    const subjects = new Map<number, z.infer<typeof subjectSchema>>();
    const slugs = [...new Set(targets.map((item) => item.characters))];
    for (let start = 0; start < slugs.length; start += 40) {
      const url = new URL(`${origin}/v2/subjects`);
      url.searchParams.set("slugs", slugs.slice(start, start + 40).join(","));
      url.searchParams.set("types", "kanji,vocabulary,kana_vocabulary");
      url.searchParams.set("hidden", "false");
      for await (const rows of pages(url, "subjects"))
        for (const row of rows) {
          const item = subjectSchema.parse(row);
          const keyType = item.object === "kanji" ? "kanji" : "vocabulary";
          if (
            item.data.hidden_at ||
            item.data.level > maxLevelGranted ||
            !wanted.has(`${keyType}:${item.data.characters}`)
          )
            continue;
          const prior = subjects.get(item.id);
          if (prior && JSON.stringify(prior) !== JSON.stringify(item))
            throw new WaniKaniImportError("invalid-response");
          subjects.set(item.id, item);
          if (subjects.size > 200)
            throw new WaniKaniImportError("invalid-response");
        }
    }
    const items = new Map<number, WaniKaniFamiliarity>();
    const subjectIds = [...subjects.keys()];
    for (let start = 0; start < subjectIds.length; start += 100) {
      const ids = subjectIds.slice(start, start + 100),
        allowed = new Set(ids);
      const url = new URL(`${origin}/v2/assignments`);
      url.searchParams.set("subject_ids", ids.join(","));
      url.searchParams.set("started", "true");
      for await (const rows of pages(url, "assignments"))
        for (const row of rows) {
          const assignment = assignmentSchema.parse(row),
            data = assignment.data;
          if (!allowed.has(data.subject_id))
            throw new WaniKaniImportError("invalid-response");
          const subject = subjects.get(data.subject_id)!;
          if (subject.object !== data.subject_type)
            throw new WaniKaniImportError("invalid-response");
          if (!data.started_at || data.srs_stage === 0) continue;
          const item: WaniKaniFamiliarity = {
            subjectId: subject.id,
            type: subject.object,
            characters: subject.data.characters,
            level: subject.data.level,
            srsStage: data.srs_stage,
            startedAt: data.started_at,
          };
          const prior = items.get(item.subjectId);
          if (prior && JSON.stringify(prior) !== JSON.stringify(item))
            throw new WaniKaniImportError("invalid-response");
          items.set(item.subjectId, item);
        }
    }
    return {
      userLevel: user.data.level,
      maxLevelGranted,
      items: [...items.values()].sort((a, b) => a.subjectId - b.subjectId),
    };
  } catch (error) {
    if (error instanceof WaniKaniImportError) throw error;
    throw new WaniKaniImportError(
      error instanceof z.ZodError || error instanceof SyntaxError
        ? "invalid-response"
        : "unavailable",
    );
  }
}
