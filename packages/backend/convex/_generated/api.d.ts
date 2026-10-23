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
import type * as accountData from "../accountData.js";
import type * as accountDeletion from "../accountDeletion.js";
import type * as aiBudget from "../aiBudget.js";
import type * as aiProbe from "../aiProbe.js";
import type * as aiQuota from "../aiQuota.js";
import type * as assessment from "../assessment.js";
import type * as assessmentAI from "../assessmentAI.js";
import type * as auth from "../auth.js";
import type * as content from "../content.js";
import type * as conversation from "../conversation.js";
import type * as conversationAI from "../conversationAI.js";
import type * as conversationJobs from "../conversationJobs.js";
import type * as conversationValues from "../conversationValues.js";
import type * as crons from "../crons.js";
import type * as culture from "../culture.js";
import type * as cultureValues from "../cultureValues.js";
import type * as dailyConversationAI from "../dailyConversationAI.js";
import type * as dailyConversationValues from "../dailyConversationValues.js";
import type * as dailyConversations from "../dailyConversations.js";
import type * as dictionary from "../dictionary.js";
import type * as emailLimits from "../emailLimits.js";
import type * as http from "../http.js";
import type * as importValues from "../importValues.js";
import type * as imports from "../imports.js";
import type * as lib_accountCleanup from "../lib/accountCleanup.js";
import type * as lib_ai_providers from "../lib/ai/providers.js";
import type * as lib_ai_readback from "../lib/ai/readback.js";
import type * as lib_ai_recap from "../lib/ai/recap.js";
import type * as lib_ai_sentence from "../lib/ai/sentence.js";
import type * as lib_ai_service from "../lib/ai/service.js";
import type * as lib_ai_speech from "../lib/ai/speech.js";
import type * as lib_categoryContext from "../lib/categoryContext.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_ownership from "../lib/ownership.js";
import type * as lib_qloo from "../lib/qloo.js";
import type * as lib_qlooContext from "../lib/qlooContext.js";
import type * as lib_readbackSource from "../lib/readbackSource.js";
import type * as lib_speechContract from "../lib/speechContract.js";
import type * as lib_wanikani from "../lib/wanikani.js";
import type * as profile from "../profile.js";
import type * as profileValues from "../profileValues.js";
import type * as qlooCache from "../qlooCache.js";
import type * as readback from "../readback.js";
import type * as readbackAI from "../readbackAI.js";
import type * as referenceAI from "../referenceAI.js";
import type * as references from "../references.js";
import type * as reviewAssessment from "../reviewAssessment.js";
import type * as reviewAssessmentAI from "../reviewAssessmentAI.js";
import type * as reviewValues from "../reviewValues.js";
import type * as reviews from "../reviews.js";
import type * as speech from "../speech.js";
import type * as speechAI from "../speechAI.js";
import type * as speechUpload from "../speechUpload.js";
import type * as speechValues from "../speechValues.js";
import type * as study from "../study.js";
import type * as studyValues from "../studyValues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  accountData: typeof accountData;
  accountDeletion: typeof accountDeletion;
  aiBudget: typeof aiBudget;
  aiProbe: typeof aiProbe;
  aiQuota: typeof aiQuota;
  assessment: typeof assessment;
  assessmentAI: typeof assessmentAI;
  auth: typeof auth;
  content: typeof content;
  conversation: typeof conversation;
  conversationAI: typeof conversationAI;
  conversationJobs: typeof conversationJobs;
  conversationValues: typeof conversationValues;
  crons: typeof crons;
  culture: typeof culture;
  cultureValues: typeof cultureValues;
  dailyConversationAI: typeof dailyConversationAI;
  dailyConversationValues: typeof dailyConversationValues;
  dailyConversations: typeof dailyConversations;
  dictionary: typeof dictionary;
  emailLimits: typeof emailLimits;
  http: typeof http;
  importValues: typeof importValues;
  imports: typeof imports;
  "lib/accountCleanup": typeof lib_accountCleanup;
  "lib/ai/providers": typeof lib_ai_providers;
  "lib/ai/readback": typeof lib_ai_readback;
  "lib/ai/recap": typeof lib_ai_recap;
  "lib/ai/sentence": typeof lib_ai_sentence;
  "lib/ai/service": typeof lib_ai_service;
  "lib/ai/speech": typeof lib_ai_speech;
  "lib/categoryContext": typeof lib_categoryContext;
  "lib/email": typeof lib_email;
  "lib/ownership": typeof lib_ownership;
  "lib/qloo": typeof lib_qloo;
  "lib/qlooContext": typeof lib_qlooContext;
  "lib/readbackSource": typeof lib_readbackSource;
  "lib/speechContract": typeof lib_speechContract;
  "lib/wanikani": typeof lib_wanikani;
  profile: typeof profile;
  profileValues: typeof profileValues;
  qlooCache: typeof qlooCache;
  readback: typeof readback;
  readbackAI: typeof readbackAI;
  referenceAI: typeof referenceAI;
  references: typeof references;
  reviewAssessment: typeof reviewAssessment;
  reviewAssessmentAI: typeof reviewAssessmentAI;
  reviewValues: typeof reviewValues;
  reviews: typeof reviews;
  speech: typeof speech;
  speechAI: typeof speechAI;
  speechUpload: typeof speechUpload;
  speechValues: typeof speechValues;
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
