import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conversationCategories,
  categoryContextRequest,
  categoryTopic,
  chooseCategoryContext,
} from "../packages/learning-core/src/conversation-category.ts";
import { createQlooSession } from "../packages/backend/convex/lib/qloo.ts";
import { loadCategoryContext } from "../packages/backend/convex/lib/categoryContext.ts";
import { selectInterestSignals } from "../packages/backend/convex/lib/qlooContext.ts";

test("an anime tag for books is not used as a television category filter", () => {
  const ids = selectInterestSignals(
    [
      {
        id: "urn:tag:genre:media:anime",
        name: "Anime",
        parentTypes: ["urn:entity:book"],
      },
      {
        id: "urn:tag:keyword:qloo:anime",
        name: "Anime",
        parentTypes: ["urn:entity:tv_show", "urn:entity:movie"],
      },
    ],
    "anime",
    "urn:entity:tv_show",
  );
  assert.deepEqual(ids, ["urn:tag:keyword:qloo:anime"]);
});

test("four chat categories map to real lookup types, including both anime and manga", () => {
  assert.deepEqual(
    conversationCategories.map((item) => item.label),
    ["Places", "Anime & Manga", "Food", "Daily Life"],
  );
  assert.equal(categoryTopic("food"), "Let's talk about Food.");
  assert.equal(categoryContextRequest("places", "same").query, "landmark");
  assert.equal(categoryContextRequest("food", "same").query, "restaurant");
  assert.equal(categoryContextRequest("daily-life", "same").query, "cafe");
  const media = ["a", "b"].map((seed) =>
    categoryContextRequest("anime-manga", seed),
  );
  assert.deepEqual(
    new Set(media.map((item) => item.type)),
    new Set(["urn:entity:tv_show", "urn:entity:book"]),
  );
  assert.throws(() => categoryTopic("invalid" as "food"));
});

test("a tap chooses only matching real recommendations, stays stable on retry and varies across new chats", () => {
  const rows = ["venue-a", "venue-b", "venue-c"].map((id) => ({
    entity: { id, name: id, type: "urn:entity:place" as const },
    inputs: ["Restaurant"],
    checkedAt: 123,
  }));
  assert.equal(
    chooseCategoryContext("food", "chat-1", rows, [])?.entity.id,
    chooseCategoryContext("food", "chat-1", [...rows].reverse(), [])?.entity.id,
  );
  assert(
    new Set(
      ["a", "b", "c"].map(
        (seed) => chooseCategoryContext("food", seed, rows, [])?.entity.id,
      ),
    ).size > 1,
  );
  const selected = chooseCategoryContext("food", "chat-1", rows, [])!;
  assert.notEqual(
    chooseCategoryContext("food", "chat-1", rows, [
      selected.entity.name.toUpperCase(),
    ])?.entity.id,
    selected.entity.id,
  );
  assert.equal(
    chooseCategoryContext("places", "chat", rows, []),
    undefined,
    "a restaurant seed is not a landmark seed",
  );
  assert.equal(chooseCategoryContext("food", "chat", [], []), undefined);
});

test("each category opener resolves real Qloo tags and selects a returned entity with provenance", async () => {
  for (const category of conversationCategories) {
    const request = categoryContextRequest(category.id, "seed");
    const urls: URL[] = [];
    const tagId =
      request.type === "urn:entity:place"
        ? `urn:tag:category:place:${request.query}`
        : `urn:tag:genre:media:${request.query}`;
    const session = createQlooSession(
      {
        baseUrl: "https://hackathon.api.qloo.com",
        apiKey: "synthetic",
        tagIdField: "id",
      },
      async (input) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json(
          url.pathname === "/v2/tags"
            ? {
                success: true,
                results: { tags: [{ id: tagId, name: request.query }] },
              }
            : {
                success: true,
                results: {
                  entities: [
                    {
                      entity_id: "real-returned-id",
                      name: "Returned topic",
                      subtype: request.type,
                    },
                  ],
                },
              },
        );
      },
    );
    const chosen = await loadCategoryContext(session, category.id, "seed", []);
    assert.equal(chosen?.entity.id, "real-returned-id");
    assert.deepEqual(chosen?.inputs, [request.query]);
    assert.equal(urls.length, 2);
    assert.equal(urls[0]?.searchParams.get("filter.query"), request.query);
    assert.equal(urls[1]?.searchParams.get("signal.interests.tags"), tagId);
    assert.equal(urls[1]?.searchParams.get("filter.tags"), tagId);
    assert.equal(urls[1]?.searchParams.get("filter.type"), request.type);
    if (request.type === "urn:entity:place")
      assert.equal(
        urls[1]?.searchParams.get("filter.geocode.country_code"),
        "JP",
      );
  }
});

test("empty, failed, unconfigured, wrong-type or disliked Qloo responses cannot become a category recommendation", async () => {
  const missing = createQlooSession({
    baseUrl: "https://hackathon.api.qloo.com",
  });
  assert.equal(
    await loadCategoryContext(missing, "food", "seed", []),
    undefined,
  );
  for (const failure of [
    "empty",
    "network",
    "wrong-type",
    "disliked",
  ] as const) {
    const session = createQlooSession(
      {
        baseUrl: "https://hackathon.api.qloo.com",
        apiKey: "synthetic",
        tagIdField: "id",
      },
      async (input) => {
        if (failure === "network") throw Error("Synthetic outage");
        const url = new URL(String(input));
        return Response.json(
          url.pathname === "/v2/tags"
            ? {
                success: true,
                results: {
                  tags:
                    failure === "empty"
                      ? []
                      : [
                          {
                            id: "urn:tag:category:place:restaurant",
                            name: "Restaurant",
                          },
                        ],
                },
              }
            : {
                success: true,
                results: {
                  entities: [
                    {
                      entity_id: "blocked",
                      name: "Blocked venue",
                      subtype:
                        failure === "wrong-type"
                          ? "urn:entity:book"
                          : "urn:entity:place",
                    },
                  ],
                },
              },
        );
      },
    );
    assert.equal(
      await loadCategoryContext(
        session,
        "food",
        "seed",
        failure === "disliked" ? ["blocked"] : [],
      ),
      undefined,
    );
  }
});
