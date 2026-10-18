import { test } from "node:test";
import assert from "node:assert/strict";
import { initialProfile } from "../packages/learning-core/src/profile.ts";
import {
  chooseDailyConversation,
  dailyContextRequests,
  dailyConversationKey,
  dailyOrdinal,
} from "../packages/learning-core/src/daily-conversation.ts";
import { createQlooSession } from "../packages/backend/convex/lib/qloo.ts";
import { findConversationContext } from "../packages/backend/convex/lib/qlooContext.ts";

const entity = (id: string, name = id) => ({
  id,
  name,
  type: "urn:entity:tv_show" as const,
});
const rows = ["series-01", "series-02", "series-03"].map((id) => ({
  entity: entity(id),
  inputs: ["Anime"],
  checkedAt: 123456,
}));
test("daily context rotates interests by calendar date, with safe broad-category mappings and no anonymous defaults", () => {
  const profile = {
    ...initialProfile(),
    interests: ["Food", "Anime", "Manga", "Culture"],
  };
  const first = dailyContextRequests(profile, "2026-10-18"),
    second = dailyContextRequests(profile, "2026-10-19");
  assert.notEqual(first[0]?.interest, second[0]?.interest);
  const requests = [...first, ...second];
  assert(
    requests.some(
      (item) =>
        item.interest === "Food" &&
        item.query === "restaurant" &&
        item.type === "urn:entity:place",
    ),
  );
  assert(
    requests.some(
      (item) => item.interest === "Manga" && item.type === "urn:entity:book",
    ),
  );
  assert.deepEqual(dailyContextRequests(initialProfile(), "2026-10-18"), []);
  assert.throws(() => dailyOrdinal("2026-02-30"));
});
test("the same local day is stable across refreshes; recent and disliked results cannot win over fresh alternatives", () => {
  const a = chooseDailyConversation("2026-10-18", "Anime", rows, [])!;
  assert.deepEqual(
    a,
    chooseDailyConversation("2026-10-18", "Anime", [...rows].reverse(), []),
  );
  const b = chooseDailyConversation("2026-10-19", "Anime", rows, [], [a])!;
  assert.notEqual(a.entity.id, b.entity.id);
  const c = chooseDailyConversation(
    "2026-10-20",
    "Anime",
    rows,
    [a.entity.id, b.entity.name],
    [b, a],
  )!;
  assert(![a.entity.id, b.entity.id].includes(c.entity.id));
  assert.equal(c.checkedAt, 123456);
  assert.deepEqual(c.inputs, ["Anime"]);
});
test("one available subject rotates the conversation angle instead of claiming new Qloo facts", () => {
  const a = chooseDailyConversation(
    "2026-10-18",
    "Anime",
    rows.slice(0, 1),
    [],
  )!;
  const b = chooseDailyConversation(
    "2026-10-19",
    "Anime",
    rows.slice(0, 1),
    [],
    [a],
  )!;
  assert.equal(a.entity.id, b.entity.id);
  assert.notEqual(a.topic, b.topic);
  assert(b.topic.length <= 500);
  assert(b.topic.includes("let me change the subject"));
  assert.equal(
    chooseDailyConversation(
      "2026-10-18",
      "Anime",
      rows,
      rows.map((item) => item.entity.id),
    ),
    null,
  );
});
test("preference revisions invalidate cached topics without invalidating on unrelated settings", () => {
  const profile = { ...initialProfile(), interests: ["Anime", "Food"] };
  const key = dailyConversationKey(profile);
  assert.equal(
    key,
    dailyConversationKey({
      ...profile,
      interests: ["Food", "anime"],
      dailyMinutes: 30,
    }),
  );
  assert.notEqual(
    key,
    dailyConversationKey({ ...profile, dislikes: ["series-01"] }),
  );
  assert.notEqual(
    key,
    dailyConversationKey({ ...profile, acceptedBand: "early-n4" }),
  );
  assert.notEqual(
    key,
    dailyConversationKey(profile, [
      { query: "Favorite", entity: entity("series-01") },
    ]),
  );
});
test("daily recommendation uses actual decoded Qloo IDs and provenance; unavailable and ambiguous sources produce no recommendation", async () => {
  const urls: URL[] = [];
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
              results: {
                tags: [{ id: "urn:tag:genre:media:anime", name: "Anime" }],
              },
            }
          : {
              success: true,
              results: {
                entities: [
                  {
                    entity_id: "series-01",
                    name: "Synthetic anime",
                    subtype: "urn:entity:tv_show",
                  },
                ],
              },
            },
      );
    },
  );
  const request = dailyContextRequests(
    { ...initialProfile(), interests: ["Anime"] },
    "2026-10-18",
  )[0]!;
  await findConversationContext(session, request, []);
  const chosen = chooseDailyConversation(
    "2026-10-18",
    "Anime",
    session.context.recommendations,
    [],
  )!;
  assert.equal(chosen.entity.id, "series-01");
  assert.deepEqual(chosen.inputs, ["Anime"]);
  assert.equal(
    urls[1]?.searchParams.get("signal.interests.tags"),
    "urn:tag:genre:media:anime",
  );
  const unavailable = createQlooSession({
    baseUrl: "https://hackathon.api.qloo.com",
  });
  assert.equal(
    (await findConversationContext(unavailable, request)).status,
    "notConfigured",
  );
  assert.equal(
    chooseDailyConversation(
      "2026-10-18",
      "Anime",
      unavailable.context.recommendations,
      [],
    ),
    null,
  );
  const ambiguous = createQlooSession(
    { baseUrl: "https://hackathon.api.qloo.com", apiKey: "synthetic" },
    async () =>
      Response.json({
        success: true,
        results: [
          {
            entity_id: "synthetic-one",
            name: "One",
            subtype: "urn:entity:tv_show",
          },
          {
            entity_id: "synthetic-two",
            name: "Two",
            subtype: "urn:entity:tv_show",
          },
        ],
      }),
  );
  assert.equal(
    (
      await findConversationContext(ambiguous, {
        source: "favorite",
        query: "Unknown favorite",
        type: "urn:entity:tv_show",
      })
    ).status,
    "awaitingChoice",
  );
  assert.equal(
    chooseDailyConversation(
      "2026-10-18",
      "Unknown favorite",
      ambiguous.context.recommendations,
      [],
    ),
    null,
  );
});
