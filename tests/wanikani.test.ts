import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importWaniKani,
  WaniKaniImportError,
} from "../packages/backend/convex/lib/wanikani.ts";
const token = "synthetic-read-only-token-0000";
const targets = [
  { type: "kanji" as const, characters: "水" },
  { type: "vocabulary" as const, characters: "日本" },
];
const user = (max = 60) => ({
  object: "user",
  data: {
    level: 20,
    subscription: { max_level_granted: max },
    username: "must-not-persist",
  },
});
const subject = (
  id: number,
  characters: string,
  type = "kanji",
  level = 1,
  hidden_at: string | null = null,
) => ({
  id,
  object: type,
  data: { characters, level, hidden_at, meaning_mnemonic: "must-not-copy" },
});
const assignment = (
  id: number,
  subjectId: number,
  type = "kanji",
  stage = 6,
  started: string | null = "2026-10-01T00:00:00.000000Z",
) => ({
  id,
  object: "assignment",
  data: {
    subject_id: subjectId,
    subject_type: type,
    srs_stage: stage,
    started_at: started,
  },
});
const collection = (
  data: unknown[],
  next: string | null = null,
  total = data.length,
) => ({
  object: "collection",
  pages: { next_url: next },
  total_count: total,
  data,
});
function fixture(responses: (unknown | Response | Error)[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init: init! });
    assert.equal(url.origin, "https://api.wanikani.com");
    assert.equal(init!.method, "GET");
    assert.equal(init!.redirect, "error");
    const headers = init!.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${token}`);
    assert.equal(headers["Wanikani-Revision"], "20170710");
    assert.equal(init!.body, undefined);
    const response = responses.shift();
    assert.notEqual(response, undefined, "unexpected upstream request");
    if (response instanceof Error) throw response;
    return response instanceof Response ? response : Response.json(response);
  };
  return { calls, fetcher };
}
const rejectsCode = (code: string) => (error: unknown) =>
  error instanceof WaniKaniImportError &&
  error.code === code &&
  !String(error).includes(token);

test("paginated import keeps only matched external familiarity, without private prose or local skill claims", async () => {
  const f = fixture([
    user(),
    collection(
      [subject(1, "水")],
      "https://api.wanikani.com/v2/subjects?page_after_id=1",
      2,
    ),
    collection([subject(2, "日本", "vocabulary")], null, 2),
    collection(
      [assignment(100, 1)],
      "https://api.wanikani.com/v2/assignments?page_after_id=100",
      2,
    ),
    collection([assignment(101, 2, "vocabulary", 9)], null, 2),
  ]);
  const result = await importWaniKani(token, targets, f.fetcher);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1]!.srsStage, 9);
  assert.equal(result.maxLevelGranted, 60);
  assert.equal(result.userLevel, 20);
  assert.equal(f.calls[1]!.url.searchParams.get("slugs"), "水,日本");
  assert.equal(f.calls[3]!.url.searchParams.get("subject_ids"), "1,2");
  assert.deepEqual(
    Object.keys(result.items[0]!).sort(),
    [
      "characters",
      "level",
      "srsStage",
      "startedAt",
      "subjectId",
      "type",
    ].sort(),
  );
  assert(
    !/must-not|mastery|grammar|speaking|password|token|username|mnemonic/.test(
      JSON.stringify(result),
    ),
  );
});
test("subscription restrictions, hidden/unrelated subjects and unstarted assignments never create familiarity", async () => {
  const f = fixture([
    user(3),
    collection([
      subject(1, "水"),
      subject(2, "日本", "vocabulary", 5),
      subject(3, "水", "kanji", 1, "2026-01-01T00:00:00Z"),
      subject(4, "犬"),
    ]),
    collection([assignment(100, 1, "kanji", 0, null)]),
  ]);
  const result = await importWaniKani(token, targets, f.fetcher);
  assert.deepEqual(result.items, []);
  assert.equal(result.maxLevelGranted, 3);
  assert.equal(f.calls[2]!.url.searchParams.get("subject_ids"), "1");
});
test("unauthorized and rate-limited calls stop without forwarding their bodies or retrying", async () => {
  for (const [status, code] of [
    [401, "invalid-token"],
    [403, "invalid-token"],
    [429, "rate-limited"],
    [503, "unavailable"],
  ] as const) {
    const f = fixture([new Response(`private upstream ${token}`, { status })]);
    await assert.rejects(
      importWaniKani(token, targets, f.fetcher),
      rejectsCode(code),
    );
    assert.equal(f.calls.length, 1);
  }
  const f = fixture([]);
  await assert.rejects(
    importWaniKani("bad token", targets, f.fetcher),
    rejectsCode("invalid-token"),
  );
  assert.equal(f.calls.length, 0);
});
test("pagination cannot send the personal token to another origin, path, credentials or fragment", async () => {
  for (const next of [
    "https://example.com/v2/subjects",
    "https://api.wanikani.com/v2/reviews",
    "https://user@api.wanikani.com/v2/subjects",
    "https://api.wanikani.com/v2/subjects#unsafe",
    "http://api.wanikani.com/v2/subjects",
    "not a pagination URL",
  ]) {
    const f = fixture([user(), collection([subject(1, "水")], next, 2)]);
    await assert.rejects(
      importWaniKani(token, targets, f.fetcher),
      rejectsCode("invalid-response"),
    );
    assert.equal(f.calls.length, 2);
  }
});
test("cycles, repeated identities and truncated or changing collections reject the entire candidate", async () => {
  const initial =
    "https://api.wanikani.com/v2/subjects?slugs=%E6%B0%B4%2C%E6%97%A5%E6%9C%AC&types=kanji%2Cvocabulary%2Ckana_vocabulary&hidden=false";
  for (const responses of [
    [user(), collection([subject(1, "水")], initial, 2)],
    [user(), collection([subject(1, "水"), subject(1, "水")])],
    [user(), collection([subject(1, "水")], null, 2)],
    [
      user(),
      collection(
        [subject(1, "水")],
        "https://api.wanikani.com/v2/subjects?page_after_id=1",
        2,
      ),
      collection([subject(2, "日本", "vocabulary")], null, 3),
    ],
  ]) {
    const f = fixture(responses);
    await assert.rejects(
      importWaniKani(token, targets, f.fetcher),
      rejectsCode("invalid-response"),
    );
  }
});
test("mismatched or impossible assignments cannot become imported skills", async () => {
  for (const row of [
    assignment(100, 999),
    assignment(100, 1, "vocabulary"),
    assignment(100, 1, "kanji", 10),
    assignment(100, 1, "kanji", 6, "not-a-date"),
  ]) {
    const f = fixture([
      user(),
      collection([subject(1, "水")]),
      collection([row]),
    ]);
    await assert.rejects(
      importWaniKani(token, targets, f.fetcher),
      rejectsCode("invalid-response"),
    );
  }
});
test("malformed/oversize bodies and transport failures remain sanitized", async () => {
  for (const [response, code] of [
    [new Response(token), "invalid-response"],
    [new Response("x".repeat(1024 * 1024 + 1)), "invalid-response"],
    [Error(`transport header ${token}`), "unavailable"],
  ] as const) {
    const f = fixture([response]);
    await assert.rejects(
      importWaniKani(token, targets, f.fetcher),
      rejectsCode(code),
    );
  }
});
test("an empty successful catalog match makes no assignment request", async () => {
  const f = fixture([user(3), collection([])]);
  const result = await importWaniKani(token, targets, f.fetcher);
  assert.deepEqual(result.items, []);
  assert.equal(f.calls.length, 2);
});

test("long pagination stops at the total request bound without returning a partial snapshot", async () => {
  const pages = Array.from({ length: 21 }, (_, index) =>
    collection(
      [subject(index + 1, "水")],
      `https://api.wanikani.com/v2/subjects?page_after_id=${index + 1}`,
      21,
    ),
  );
  const f = fixture([user(), ...pages]);
  await assert.rejects(
    importWaniKani(token, targets, f.fetcher),
    rejectsCode("unavailable"),
  );
  assert.equal(f.calls.length, 20);
});
