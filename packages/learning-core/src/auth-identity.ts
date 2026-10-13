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
