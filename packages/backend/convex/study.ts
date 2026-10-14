import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { curriculum } from "@packages/content";
import { exerciseForStep, validateStudyEvent, type StudyEvent } from "@packages/learning-core";
import { requireUser } from "./lib/ownership";
import { studyEventValue } from "./studyValues";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const changes = query({ args: { afterCursor: v.number() }, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  if (!Number.isInteger(args.afterCursor) || args.afterCursor < 0) throw new ConvexError("Invalid progress cursor.");
  const rows = await ctx.db.query("studyEvents").withIndex("by_user_cursor", q => q.eq("userId", userId).gt("cursor", args.afterCursor)).order("asc").take(50);
  return rows.map(row => ({ event: row.event as StudyEvent, cursor: row.cursor }));
} });
export const push = mutation({ args: { events: v.array(studyEventValue) }, handler: async (ctx, args) => {
  const userId = await requireUser(ctx);
  if (args.events.length > 50 || JSON.stringify(args.events).length > 100_000) throw new ConvexError("Study upload is too large.");
  const counter = await ctx.db.query("studyCursors").withIndex("by_user", q => q.eq("userId", userId)).unique();
  let cursor = counter?.cursor ?? 0;
  const receipts: { eventId: string; cursor: number }[] = [];
  for (const raw of args.events) {
    const event = raw as StudyEvent;
    const lesson = curriculum.forEvent(event);
    if (event.kind === "conversationTurn") throw new ConvexError("Conversation language evidence is assessed on the server.");
    try { validateStudyEvent(event, lesson, Date.now()); } catch { throw new ConvexError("Check the saved study activity before retrying."); }
    const previous = await ctx.db.query("studyEvents").withIndex("by_user_event", q => q.eq("userId", userId).eq("event.eventId", event.eventId)).unique();
    if (previous) {
      if (canonical(previous.event) !== canonical(event)) throw new ConvexError("A saved activity ID cannot be replaced with another answer.");
      receipts.push({ eventId: event.eventId, cursor: previous.cursor }); continue;
    }
    if(event.kind==="reviewActivity" || (event.kind === "audioActivity" && event.lessonId === "review")) {
      const trackId = event.kind === "reviewActivity" ? event.stepId : event.stepId.slice(7);
      const track=await ctx.db.query("reviewTracks").withIndex("by_user_track",q=>q.eq("userId",userId).eq("track.id",trackId)).unique();
      if(!track)throw new ConvexError("Prepare this owned review card before syncing its study time.");
    } else if (event.kind === "conversationActivity" || (event.kind === "audioActivity" && event.lessonId === "conversation")) {
      const segment = await ctx.db.query("conversationSegments").withIndex("by_user_segment", q => q.eq("userId", userId).eq("segmentId", event.sessionId)).unique();
      if (!segment) throw new ConvexError("Study activity needs an owned conversation segment.");
    } else if (event.kind === "audioActivity" && event.lessonId === "library") {
      // Shared validation binds this activity to a known checked content version/clip.
      // It is account-owned listening effort, without creating a lesson or recall grade.
    } else if (event.kind === "audioActivity" && event.lessonId === "reference") {
      const phraseId = ctx.db.normalizeId("savedPhrases",event.sessionId);
      const phrase = phraseId ? await ctx.db.get(phraseId) : null;
      if (!phrase || phrase.userId !== userId || phrase.status !== "approved") throw new ConvexError("Listening activity needs an owned checked reference.");
    } else {
    const session = await ctx.db.query("studySessions").withIndex("by_user_session", q => q.eq("userId", userId).eq("sessionId", event.sessionId)).unique();
    if (event.kind === "started") {
      if (session) throw new ConvexError("This session already has a starting snapshot.");
      await ctx.db.insert("studySessions", { userId, sessionId: event.sessionId, lessonId: event.lessonId, version: event.lessonVersion, startedAt: event.occurredAt });
    } else if (!session || session.lessonId !== event.lessonId || session.version !== event.lessonVersion) throw new ConvexError("The session snapshot must synchronize first.");
    if (event.kind === "advanced" && lesson && exerciseForStep(lesson, event.stepId)) {
      const priorAttempt = await ctx.db.query("studyEvents").withIndex("by_user_step_kind", q => q.eq("userId", userId).eq("event.sessionId", event.sessionId).eq("event.stepId", event.stepId).eq("event.kind", "attempted")).first();
      if (!priorAttempt) throw new ConvexError("Complete an attempt before continuing.");
    }
    }
    cursor += 1;
    await ctx.db.insert("studyEvents", { userId, cursor, event });
    receipts.push({ eventId: event.eventId, cursor });
  }
  if (counter) await ctx.db.patch(counter._id, { cursor }); else await ctx.db.insert("studyCursors", { userId, cursor });
  return receipts;
} });
