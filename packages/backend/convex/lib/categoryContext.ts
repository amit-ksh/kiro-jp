import {
  categoryContextRequest,
  chooseCategoryContext,
  type ConversationCategory,
} from "@packages/learning-core";
import { selectInterestSignals } from "./qlooContext.ts";
import type { createQlooSession } from "./qloo.ts";

export async function loadCategoryContext(
  session: ReturnType<typeof createQlooSession>,
  category: ConversationCategory,
  seed: string,
  dislikes: readonly string[],
) {
  try {
    const request = categoryContextRequest(category, seed);
    const tags = await session.findInterestTags(request.query);
    if (tags.status !== "ready") return undefined;
    const signals = selectInterestSignals(
      tags.items,
      request.query,
      request.type,
    );
    if (!signals.length) return undefined;
    let result = await session.recommendCulturalContexts(
      request.type,
      [],
      signals,
      dislikes,
      signals,
    );
    // Some Qloo catalogs have anime films but no television entries for this
    // exact genre tag. Keep the same verified tag and the three-request bound.
    if (
      result.status === "ready" &&
      !result.items.length &&
      request.type === "urn:entity:tv_show"
    )
      result = await session.recommendCulturalContexts(
        "urn:entity:movie",
        [],
        signals,
        dislikes,
        signals,
      );
    if (result.status === "ready")
      return chooseCategoryContext(
        category,
        seed,
        session.context.recommendations,
        dislikes,
      );
  } catch {
    // Category selection still starts ordinary chat when Qloo cannot respond.
  }
  return undefined;
}
