export interface VoiceTurnIntent {
  segmentId: string;
  text: string;
  messageId: string;
}

export interface VoiceTurnDispatchPorts<T extends VoiceTurnIntent> {
  saveDraft: (
    sessionId: string,
    stepId: string,
    value: string,
  ) => Promise<void>;
  submit: (intent: T) => Promise<unknown>;
  isCurrent: () => boolean;
}

/** A cancelled call may retain a pending turn, but may never dispatch new work. */
export async function dispatchVoiceTurn<T extends VoiceTurnIntent>(
  intent: T,
  ports: VoiceTurnDispatchPorts<T>,
): Promise<boolean> {
  if (!ports.isCurrent()) return false;
  // Persist and dispatch one immutable JSON payload, including its original ID
  // and assistance flags, even if its caller changes state during a disk write.
  const pending = JSON.stringify(intent),
    snapshot = JSON.parse(pending) as T;
  if (!ports.isCurrent()) return false;
  await ports.saveDraft(snapshot.segmentId, "chat-message", snapshot.text);
  if (!ports.isCurrent()) return false;
  await ports.saveDraft(snapshot.segmentId, "chat-pending", pending);
  if (!ports.isCurrent()) return false;
  await ports.submit(snapshot);
  if (!ports.isCurrent()) return false;
  for (const [step, value] of [
    ["chat-message", ""],
    ["chat-pending", ""],
    ["chat-support", "[]"],
  ] as const) {
    if (!ports.isCurrent()) return false;
    await ports.saveDraft(snapshot.segmentId, step, value);
    if (!ports.isCurrent()) return false;
  }
  return true;
}
