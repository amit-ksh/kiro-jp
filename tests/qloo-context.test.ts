import { test } from "node:test";
import assert from "node:assert/strict";
import { createQlooSession } from "../packages/backend/convex/lib/qloo.ts";
import {
  findConversationContext,
  selectInterestSignals,
  conversationContextStep,
  previousRecommendations,
  replyCultureSnapshot,
} from "../packages/backend/convex/lib/qlooContext.ts";

const tags = [
  { id: "urn:tag:genre:music:synthetic_anime", name: "Anime" },
  { id: "urn:tag:genre:media:synthetic_anime", name: "Anime" },
  { id: "urn:tag:keyword:qloo:synthetic_anime", name: "Anime" },
  { id: "urn:tag:genre:media:synthetic_other", name: "Anime club" },
];
const entity = {
  entity_id: "synthetic-series-id",
  name: "Synthetic series",
  type: "urn:entity",
  subtype: "urn:entity:tv_show",
};
const config = {
  baseUrl: "https://hackathon.api.qloo.com",
  apiKey: "synthetic",
  tagIdField: "id" as const,
};

test("context tool keeps Qloo IDs server-side and selects a matching media signal", async () => {
  const urls: URL[] = [];
  const session = createQlooSession(config, async (input) => {
    const url = new URL(String(input));
    urls.push(url);
    return Response.json(
      url.pathname === "/v2/tags"
        ? { success: true, results: { tags } }
        : { success: true, results: { entities: [entity] } },
    );
  });
  const result = await findConversationContext(session, {
    source: "interest",
    query: "anime",
    type: "urn:entity:tv_show",
  });
  assert.equal(result.status, "ready");
  assert.equal(result.items[0]?.id, entity.entity_id);
  assert.equal(urls.length, 2);
  assert.equal(urls[1]!.searchParams.get("signal.interests.tags"), tags[1]!.id);
  assert.deepEqual(session.context.recommendations[0]?.inputs, ["Anime"]);
  assert.equal(urls[1]!.searchParams.has("signal.interests.entities"), false);
});

test("ordinary, unavailable, empty and unrelated interests cannot invent signals", async () => {
  let calls = 0;
  const session = createQlooSession(config, async () => {
    calls++;
    return Response.json({ success: true, results: { tags: [] } });
  });
  assert.equal(
    (
      await findConversationContext(session, {
        source: "ordinary",
        query: "",
        type: "urn:entity:place",
      })
    ).status,
    "ordinary",
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await findConversationContext(session, {
        source: "interest",
        query: "anime",
        type: "urn:entity:tv_show",
      })
    ).items.length,
    0,
  );
  assert.equal(calls, 1);
  assert.deepEqual(selectInterestSignals(tags, "manga", "urn:entity:book"), []);
  assert.deepEqual(
    selectInterestSignals(tags.slice(0, 1), "anime", "urn:entity:tv_show"),
    [],
  );
  const missing = createQlooSession({ baseUrl: config.baseUrl });
  assert.equal(
    (
      await findConversationContext(missing, {
        source: "interest",
        query: "anime",
        type: "urn:entity:tv_show",
      })
    ).status,
    "notConfigured",
  );
  await assert.rejects(() =>
    findConversationContext(session, {
      source: "interest",
      query: "",
      type: "urn:entity:book",
    }),
  );
});

test("named favorites require disambiguation and a confirmed choice before Insights", async () => {
  const other = {
    ...entity,
    entity_id: "synthetic-other-id",
    name: "Other synthetic series",
  };
  let calls = 0;
  let signal: string | null = null;
  const transport: typeof fetch = async (input) => {
    calls++;
    if (new URL(String(input)).pathname === "/v2/insights")
      signal = new URL(String(input)).searchParams.get(
        "signal.interests.entities",
      );
    return Response.json(
      new URL(String(input)).pathname === "/search"
        ? { results: [entity, other] }
        : { success: true, results: { entities: [entity] } },
    );
  };
  const request = {
    source: "favorite" as const,
    query: "Series",
    type: "urn:entity:tv_show" as const,
  };
  const ambiguous = createQlooSession(config, transport);
  assert.equal(
    (await findConversationContext(ambiguous, request)).status,
    "awaitingChoice",
  );
  assert.equal(calls, 1);
  const chosen = createQlooSession(config, transport, undefined, [
    {
      query: "Series",
      entity: {
        id: other.entity_id,
        name: other.name,
        type: "urn:entity:tv_show",
      },
    },
  ]);
  const result = await findConversationContext(chosen, request);
  assert.equal(result.status, "ready");
  assert.equal(calls, 3);
  assert.equal(signal, other.entity_id);
});

test("topic context selection stays bounded and absent access never forces a tool", () => {
  assert.deepEqual(conversationContextStep(0, true, true), {
    toolChoice: { type: "tool", toolName: "findConversationContext" },
    activeTools: ["findConversationContext"],
  });
  assert.deepEqual(conversationContextStep(0, false, true), {});
  assert.deepEqual(conversationContextStep(0, true, false), {});
  assert.deepEqual(conversationContextStep(1, true, true), {});
  assert.deepEqual(conversationContextStep(2, true, true), {
    toolChoice: "none",
    activeTools: [],
  });
});

test("later turns can reuse only real non-stale assistant context from the recent snapshot", () => {
  const recommendation = {
    entity: {
      id: entity.entity_id,
      name: entity.name,
      type: "urn:entity:tv_show" as const,
    },
    inputs: ["Anime"],
    checkedAt: 1234,
  };
  const snapshot = { candidates: [], recommendations: [recommendation] };
  assert.deepEqual(
    previousRecommendations(
      [{ role: "user", stale: false, culture: snapshot }],
      [],
    ),
    [],
  );
  assert.deepEqual(
    previousRecommendations(
      [{ role: "assistant", stale: true, culture: snapshot }],
      [],
    ),
    [],
  );
  const prior = previousRecommendations(
    [{ role: "assistant", stale: false, culture: snapshot }],
    [],
  );
  assert.equal(prior.length, 1);
  const result = replyCultureSnapshot(
    { candidates: [], recommendations: [] },
    prior,
    [entity.entity_id],
    [],
  );
  assert.deepEqual(result.recommendations, [recommendation]);
  assert.equal(result.recommendations[0]!.checkedAt, 1234);
  assert.throws(
    () => replyCultureSnapshot(snapshot, prior, ["invented-source-id"], []),
    { name: "TutorContextEvidenceError" },
  );
  assert.deepEqual(
    replyCultureSnapshot({ candidates: [], recommendations: [] }, prior, [], [])
      .recommendations,
    [],
  );
});

test("disliked or out-of-window sources cannot be reused, and new sources take precedence", () => {
  const recommendation = {
    entity: {
      id: entity.entity_id,
      name: entity.name,
      type: "urn:entity:tv_show" as const,
    },
    inputs: ["Anime"],
    checkedAt: 1234,
  };
  const snapshot = { candidates: [], recommendations: [recommendation] };
  const message = { role: "assistant", stale: false, culture: snapshot };
  assert.deepEqual(
    previousRecommendations([message], [entity.name.toUpperCase()]),
    [],
  );
  assert.deepEqual(
    previousRecommendations(
      [
        message,
        ...Array.from({ length: 10 }, () => ({ role: "user", stale: false })),
      ],
      [],
    ),
    [],
  );
  assert.throws(
    () =>
      replyCultureSnapshot(
        snapshot,
        [recommendation],
        [entity.entity_id],
        [entity.entity_id],
      ),
    { name: "TutorContextEvidenceError" },
  );
  const refreshed = { ...recommendation, checkedAt: 5678 };
  assert.equal(
    replyCultureSnapshot(
      { candidates: [], recommendations: [refreshed] },
      [recommendation],
      [entity.entity_id],
      [],
    ).recommendations[0]!.checkedAt,
    5678,
  );
});

test("shrine plurals, category ordering and dislikes retain the resolved boundary", async () => {
  const shrine = {
    id: "urn:tag:category:place:synthetic_shrine",
    name: "Shrine",
  };
  assert.deepEqual(
    selectInterestSignals([shrine], "shrines", "urn:entity:place"),
    [shrine.id],
  );
  const session = createQlooSession(config, async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/v2/tags")
      assert.equal(url.searchParams.get("filter.query"), "shrine");
    return Response.json(
      url.pathname === "/v2/tags"
        ? { success: true, results: { tags: [shrine] } }
        : {
            success: true,
            results: { entities: [{ ...entity, subtype: "urn:entity:place" }] },
          },
    );
  });
  const result = await findConversationContext(
    session,
    { source: "interest", query: "shrines", type: "urn:entity:place" },
    [entity.entity_id],
  );
  assert.equal(result.status, "ready");
  assert.equal(result.items.length, 0);
  assert.equal(session.context.recommendations.length, 0);
});
