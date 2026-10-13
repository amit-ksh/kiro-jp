/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as aiBudget from "../aiBudget.js";
import type * as aiProbe from "../aiProbe.js";
import type * as aiQuota from "../aiQuota.js";
import type * as auth from "../auth.js";
import type * as emailLimits from "../emailLimits.js";
import type * as http from "../http.js";
import type * as lib_ai_providers from "../lib/ai/providers.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as profile from "../profile.js";
import type * as profileValues from "../profileValues.js";
import type * as study from "../study.js";
import type * as studyValues from "../studyValues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  aiBudget: typeof aiBudget;
  aiProbe: typeof aiProbe;
  aiQuota: typeof aiQuota;
  auth: typeof auth;
  emailLimits: typeof emailLimits;
  http: typeof http;
  "lib/ai/providers": typeof lib_ai_providers;
  "lib/email": typeof lib_email;
  "lib/ownership": typeof lib_ownership;
  profile: typeof profile;
  profileValues: typeof profileValues;
  study: typeof study;
  studyValues: typeof studyValues;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
