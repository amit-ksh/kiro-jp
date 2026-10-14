import { getAuthUserId } from "@convex-dev/auth/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { boundedSpeechBody } from "./lib/speechContract";
import { inspectRecording } from "@packages/learning-core";
function reply(status: number, code: string) {
  return Response.json(
    { code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export const upload = httpAction(async (ctx, request) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) return reply(401, "SIGN_IN_REQUIRED");
  const url = new URL(request.url),
    id = url.searchParams.get("id"),
    attempt = Number(url.searchParams.get("attempt"));
  if (
    !id ||
    !/^[a-z0-9]{16,64}$/.test(id) ||
    !Number.isSafeInteger(attempt) ||
    attempt < 1 ||
    attempt > 3
  )
    return reply(400, "INVALID_UPLOAD");
  let claim: number | undefined, storageId: Id<"_storage"> | undefined;
  try {
    const permit = await ctx.runMutation(internal.speech.beginUpload, {
      id: id as Id<"speechAttempts">,
      userId,
      attempt,
    });
    if (permit.state === "rejected") return reply(403, "RECORDING_UNAVAILABLE");
    if (permit.state === "existing")
      return reply(
        permit.status === "uploading" ? 409 : 200,
        "ALREADY_RECEIVED",
      );
    claim = permit.claim;
    const bytes = await boundedSpeechBody(request),
      media = inspectRecording(bytes);
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (hash !== permit.sha256 || bytes.length !== permit.bytes)
      throw new Error("RECORDING_MISMATCH");
    storageId = await ctx.storage.store(
      new Blob([bytes], { type: "audio/mp4" }),
    );
    if (
      !(await ctx.runMutation(internal.speech.attach, {
        id: id as Id<"speechAttempts">,
        claim,
        storageId,
        durationMillis: media.durationMillis,
      }))
    )
      throw new Error("UPLOAD_EXPIRED");
    storageId = undefined; // The owned job now holds the temporary blob.
    return reply(200, "RECEIVED");
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (storageId) await ctx.storage.delete(storageId);
    if (claim !== undefined)
      await ctx.runMutation(internal.speech.failUpload, {
        id: id as Id<"speechAttempts">,
        claim,
        code,
      });
    return reply(
      code === "AUDIO_TOO_LARGE"
        ? 413
        : code === "UNSUPPORTED_AUDIO"
          ? 415
          : code.startsWith("INVALID_") || code === "RECORDING_MISMATCH"
            ? 422
            : 503,
      "RECORDING_NOT_ACCEPTED",
    );
  }
});
