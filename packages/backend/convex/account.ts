import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { requireUser } from "./lib/ownership";

export const capabilities = query({ args: {}, handler: () => ({
  emailVerification: process.env.ACCOUNT_EMAIL_ENABLED === "true",
  passwordRecovery: process.env.ACCOUNT_EMAIL_ENABLED === "true",
}) });

export const current = query({ args: {}, handler: async ctx => {
  const id = await getAuthUserId(ctx); if (!id) return null;
  const user = await ctx.db.get(id); return user ? { id: user._id, email: user.email ?? "" } : null;
} });
export const passwordResetEmail = query({ args: {}, handler: async ctx => {
  const userId = await requireUser(ctx);
  const accounts = await ctx.db.query("authAccounts").withIndex("userIdAndProvider", q => q.eq("userId", userId).eq("provider", "password")).collect();
  return accounts[0]?.providerAccountId ?? null;
} });
