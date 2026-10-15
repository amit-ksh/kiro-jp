import { z } from "zod";
export const tutorAssessmentSchema = z.object({
  validity: z.enum(["appropriate", "needsCorrection", "uncertain"]),
  meaningfulJapanese: z.boolean(),
  target: z.enum(["used", "notUsed", "uncertain"]),
  messageId: z.string().max(140),
  span: z.string().max(1000),
  explanation: z.string().min(1).max(400),
});
export function recapOutputSchema(candidateIds: readonly string[]) {
  if (
    candidateIds.length > 6 ||
    new Set(candidateIds).size !== candidateIds.length ||
    candidateIds.some((id) => !id || id.length > 140)
  )
    throw new Error("Invalid recap candidate snapshot.");
  const recap = z.string().min(1).max(1500);
  // Already accepted evidence needs no model reassessment. Omitting that field
  // removes the opportunity to invent a candidate from recent conversation.
  if (!candidateIds.length) return z.object({ recap });
  return z.object({
    recap,
    assessments: z
      .array(
        tutorAssessmentSchema.extend({
          messageId: z.enum([...candidateIds] as [string, ...string[]]),
        }),
      )
      .max(candidateIds.length),
  });
}
