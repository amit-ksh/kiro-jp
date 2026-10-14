// This selects a local cache from an already library-managed token. It is not
// signature verification or authority for server access; Convex validates that.
export function localSessionFromToken(token: string | null, expectedIssuer: string): string | null {
  if (!token || token.length > 8192) return null;
  try {
    const parts = token.split("."); if (parts.length !== 3) return null;
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claim = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
    if (claim.iss !== expectedIssuer || claim.aud !== "convex" || typeof claim.sub !== "string") return null;
    const [user, session, extra] = claim.sub.split("|");
    return user && session && !extra && /^[a-zA-Z0-9_-]+$/.test(user) && /^[a-zA-Z0-9_-]+$/.test(session) ? claim.sub : null;
  } catch { return null; }
}
export function localAccountFromToken(token: string | null, expectedIssuer: string): string | null {
  return localSessionFromToken(token, expectedIssuer)?.split("|")[0] ?? null;
}

export function accountCacheAccess(input: {
  subject: string | null;
  currentId: string | null | undefined;
  rememberedId: string | null | undefined;
  connected: boolean;
  serverLoading: boolean;
  serverAuthenticated: boolean;
}):
  | { state: "reconnect" }
  | { state: "connect" }
  | { state: "ready"; accountId: string; cloudReady: boolean } {
  const { subject, currentId, rememberedId } = input;
  if (
    !subject || currentId === null ||
    (currentId !== undefined && currentId !== subject) ||
    (input.connected && !input.serverLoading && !input.serverAuthenticated)
  ) return { state: "reconnect" };
  if (currentId !== subject && rememberedId !== subject)
    return { state: "connect" };
  return {
    state: "ready",
    accountId: subject,
    // Remembered local identity permits offline study, never cloud upload.
    cloudReady: input.connected && !input.serverLoading &&
      input.serverAuthenticated && currentId === subject,
  };
}
