import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, retrieveAccount } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { accountEmail } from "./lib/email";
import { ConvexCredentials, type ConvexCredentialsUserConfig } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const passwordProvider = Password<DataModel>({
    profile(params) {
      const email = String(params.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ConvexError({ code: "INVALID_EMAIL", message: "Enter a valid email address." });
      return { email };
    },
    validatePasswordRequirements(password) {
      if (password.length < 10 || password.length > 128) throw new ConvexError({ code: "INVALID_PASSWORD", message: "Use a password between 10 and 128 characters." });
    },
    ...(process.env.ACCOUNT_EMAIL_ENABLED === "true" ? { verify: accountEmail("verify"), reset: accountEmail("reset") } : {}),
});
// The installed Password provider stores its implementation in options, as
// ConvexCredentials does. Wrap that authorize function without writing credentials.
const options = (passwordProvider as typeof passwordProvider & { options: ConvexCredentialsUserConfig<DataModel> }).options;
const limitedPassword = ConvexCredentials<DataModel>({
  ...options,
  async authorize(params, ctx) {
    const email = String(params.email ?? "").trim().toLowerCase();
    const emailEnabled = process.env.ACCOUNT_EMAIL_ENABLED === "true";
    let requestsEmail = emailEnabled && (params.flow === "signUp" || params.flow === "reset" || (params.flow === "email-verification" && !params.code));
    if (emailEnabled && params.flow === "signIn" && typeof params.password === "string") {
      // Unverified password sign-ins also send a verification email. Validate
      // credentials before reserving; ordinary verified sign-ins have no quota.
      const account = await retrieveAccount(ctx, { provider: "password", account: { id: email, secret: params.password } });
      if (!account) throw new Error("Invalid credentials");
      requestsEmail = account.user.emailVerificationTime === undefined;
    }
    if (requestsEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254) {
      const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email)));
      const recipientKey = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      await ctx.runMutation(internal.emailLimits.reserve, { recipientKey });
    }
    return await options.authorize(params, ctx);
  },
});
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [limitedPassword],
  callbacks: {
    async redirect({ redirectTo }) {
      const origin = process.env.SITE_URL;
      if (!origin) throw new Error("SITE_URL must be configured for authentication links.");
      const url = new URL(redirectTo, origin);
      if (url.origin !== new URL(origin).origin) throw new Error("Invalid redirect origin.");
      return url.toString();
    },
  },
});
