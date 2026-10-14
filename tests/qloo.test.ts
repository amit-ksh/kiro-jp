import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createQlooSession,
  decodeEntities,
  decodeTags,
} from "../packages/backend/convex/lib/qloo.ts";
// Synthetic contract examples, never live Qloo data.
const entity = {
  entity_id: "synthetic-book-id",
  name: "Synthetic book",
  type: "urn:entity",
  subtype: "urn:entity:book",
  properties: { description: "A synthetic context." },
};
test("documented entity and Insights envelopes are distinct and malformed types are ignored", () => {
  assert.equal(decodeEntities([entity])[0]!.type, "urn:entity:book");
  assert.deepEqual(
    decodeEntities([{ ...entity, subtype: "urn:entity:script" }]),
    [],
  );
  assert.throws(() => decodeEntities({ entities: [entity] }));
  assert.deepEqual(
    decodeTags(
      [{ id: "urn:tag:synthetic:anime", name: "Synthetic anime" }],
      "id",
    ),
    [{ id: "urn:tag:synthetic:anime", name: "Synthetic anime" }],
  );
});
test("missing credentials never fabricate Qloo IDs or make a request", async () => {
  let dispatched = 0;
  const qloo = createQlooSession(
    { baseUrl: "https://hackathon.api.qloo.com" },
    async () => {
      dispatched++;
      throw new Error();
    },
  );
  assert.equal((await qloo.findInterestTags("anime")).status, "notConfigured");
  assert.equal(
    (await qloo.resolveFavorite("Synthetic book", "urn:entity:book")).status,
    "notConfigured",
  );
  assert.equal(dispatched, 0);
});
test("Qloo uses fixed GET routes, header authentication and only resolved signals", async () => {
  const requests: URL[] = [];
  const qloo = createQlooSession(
    {
      baseUrl: "https://hackathon.api.qloo.com",
      apiKey: "synthetic-key",
      tagIdField: "id",
    },
    async (input, init) => {
      const url = new URL(String(input));
      requests.push(url);
      assert.equal(init?.method, "GET");
      assert.equal(
        new Headers(init?.headers).get("X-Api-Key"),
        "synthetic-key",
      );
      assert.equal(url.searchParams.has("api_key"), false);
      return new Response(
        JSON.stringify(
          url.pathname === "/search"
            ? { success: true, results: [entity] }
            : { success: true, results: { entities: [entity] } },
        ),
        { status: 200 },
      );
    },
  );
  await assert.rejects(() =>
    qloo.recommendCulturalContexts("urn:entity:book", ["invented-id"], []),
  );
  const resolved = await qloo.resolveFavorite(
    "Synthetic book",
    "urn:entity:book",
  );
  const recommended = await qloo.recommendCulturalContexts(
    "urn:entity:book",
    [resolved.items[0]!.id],
    [],
  );
  assert.equal(recommended.status, "ready");
  assert.equal(requests[1]!.pathname, "/v2/insights");
  assert.equal(requests[1]!.searchParams.get("feature.explainability"), "true");
  assert.equal(
    requests[1]!.searchParams.has("filter.geocode.country_code"),
    false,
  );
  await qloo.resolveFavorite("Synthetic book", "urn:entity:book");
  assert.equal(
    (await qloo.resolveFavorite("Synthetic book", "urn:entity:book")).status,
    "limitReached",
  );
  assert.throws(() =>
    createQlooSession({
      baseUrl: "https://external.example.invalid",
      apiKey: "synthetic",
    }),
  );
});
test("open tag-item schema remains pending until its provisioned field is configured", async () => {
  const qloo = createQlooSession({
    baseUrl: "https://hackathon.api.qloo.com",
    apiKey: "synthetic-key",
  });
  assert.equal(
    (await qloo.findInterestTags("shrines")).status,
    "schemaPending",
  );
});
