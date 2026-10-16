export type DeletionIntent = {
  version: 1;
  accountId: string;
  receipt: string;
  phase: "requested" | "complete";
};
export function parseDeletionIntent(value: string): DeletionIntent {
  const intent = JSON.parse(value) as DeletionIntent;
  if (
    intent.version !== 1 ||
    !/^[A-Za-z0-9]{1,128}$/.test(intent.accountId) ||
    !/^[a-f0-9]{64}$/.test(intent.receipt) ||
    !["requested", "complete"].includes(intent.phase)
  )
    throw new Error("Account deletion recovery data could not be read.");
  return intent;
}
interface Ports {
  status: () => Promise<{ status: "pending" | "complete" } | null>;
  request: () => Promise<unknown>;
  cleanup: () => Promise<void>;
  complete: () => Promise<void>;
}
export async function advanceDeletion(ports: Ports) {
  const state = await ports.status();
  if (!state) await ports.request();
  // A receipt found after a lost acknowledgement is enough: never require the
  // old credentials or submit another request after the server has accepted it.
  await ports.cleanup();
  if (state?.status !== "complete") return "pending" as const;
  await ports.complete();
  return "complete" as const;
}
