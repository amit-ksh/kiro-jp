import type { SupportFlag } from "@packages/learning-core";

export interface ChatTranscriptHandoffPorts {
  isCurrent: () => boolean;
  confirm: (text: string) => Promise<string | undefined>;
  readDraft: () => string;
  readSupport: () => SupportFlag[];
  saveDraft: (
    step: "chat-support" | "chat-message",
    input: string,
  ) => Promise<void>;
}

const maximumLength = 1000;
function mergeTranscript(draft: string, transcript: string) {
  const combined = [draft.trimEnd(), transcript.trim()]
    .filter(Boolean)
    .join("\n");
  if (combined.length > maximumLength)
    throw new Error(
      "Shorten the transcript to fit with your existing message.",
    );
  return combined;
}

/** Explicitly keep dictation in the composer; this never sends a chat message. */
export async function applyChatVoiceTranscript(
  input: { text: string; edited: boolean },
  ports: ChatTranscriptHandoffPorts,
): Promise<{ support: SupportFlag[] } | undefined> {
  if (!ports.isCurrent() || !input.text.trim()) return;
  // Check before confirming so an oversized result remains editable and does
  // not leave the learner's recording marked confirmed unnecessarily.
  mergeTranscript(ports.readDraft(), input.text);
  if (!ports.isCurrent()) return;
  const transcript = await ports.confirm(input.text);
  if (!transcript?.trim() || !ports.isCurrent()) return;
  mergeTranscript(ports.readDraft(), transcript);
  const support = [
    ...new Set([
      ...ports.readSupport(),
      ...(input.edited ? ["transcriptEdited" as const] : []),
    ]),
  ];
  if (!ports.isCurrent()) return;
  // Save assistance first so the draft can never be sent without its flags.
  await ports.saveDraft("chat-support", JSON.stringify(support));
  if (!ports.isCurrent()) return;
  // A hint, suggested topic, or typed draft can change during persistence.
  // Read it again immediately before saving instead of overwriting that work.
  const combined = mergeTranscript(ports.readDraft(), transcript);
  if (!ports.isCurrent()) return;
  await ports.saveDraft("chat-message", combined);
  if (!ports.isCurrent()) return;
  return { support };
}
