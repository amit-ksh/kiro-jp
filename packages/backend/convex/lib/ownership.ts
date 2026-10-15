import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  // A signed JWT can outlive its account. This read also serializes public
  // learning writes with confirmed deletion in Convex's transaction ordering.
  if (!id || !(await ctx.db.get(id))) throw new ConvexError({ code: "AUTH_REQUIRED", message: "Sign in to access your learning progress." });
  return id;
}
