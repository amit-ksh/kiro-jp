import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@packages/backend/convex/_generated/api";

export const authNamespace = (process.env.EXPO_PUBLIC_CONVEX_URL ?? "unconfigured").replace(/[^a-zA-Z0-9]/g, "");
export const authKeys = ["__convexAuthJWT", "__convexAuthRefreshToken", "__convexAuthOAuthVerifier"].map(key => `${key}_${authNamespace}`);
const queueKey = `revocation-index-${authNamespace}`;
let revoking = false;
let queueWrites = Promise.resolve();
function serializeQueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = queueWrites.then(operation);
  queueWrites = result.then(() => {}, () => {});
  return result;
}
export async function queueRevocation(token: string | null) {
  await serializeQueue(async () => {
    const refresh = await SecureStore.getItemAsync(authKeys[1]);
    if (!token && !refresh) return;
    const id = `revoke-${Crypto.randomUUID()}`;
    await SecureStore.setItemAsync(id, JSON.stringify({ token, refresh }));
    const ids: string[] = JSON.parse(await SecureStore.getItemAsync(queueKey) ?? "[]");
    await SecureStore.setItemAsync(queueKey, JSON.stringify([...ids, id]));
  });
}
export async function clearUsableTokens() { await Promise.all(authKeys.map(key => SecureStore.deleteItemAsync(key))); }
export async function flushRevocations() {
  const url = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!url || revoking) return;
  revoking = true;
  try {
    const ids: string[] = await serializeQueue(async () => JSON.parse(await SecureStore.getItemAsync(queueKey) ?? "[]"));
    for (const id of ids) {
      const stored = await SecureStore.getItemAsync(id); if (!stored) continue;
      const pending: { token: string | null; refresh: string | null } = JSON.parse(stored);
      const client = new ConvexHttpClient(url, { logger: false, fetch: async (input, init) => { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000); try { return await fetch(input, { ...init, signal: controller.signal }); } finally { clearTimeout(timeout); } } });
      try {
        if (pending.token) client.setAuth(pending.token);
        let authenticated = false;
        try { authenticated = (await client.query(api.account.current, {})) !== null; } catch { /* An expired JWT requires refresh before revocation. */ }
        if (!authenticated) {
          if (!pending.refresh) continue;
          client.clearAuth();
          const result = await client.action(api.auth.signIn, { refreshToken: pending.refresh });
          if (!result.tokens) continue;
          // Only the protected revocation queue receives rotated credentials.
          await SecureStore.setItemAsync(id, JSON.stringify({ token: result.tokens.token, refresh: result.tokens.refreshToken }));
          client.setAuth(result.tokens.token);
          if (!(await client.query(api.account.current, {}))) continue;
        }
        // signOut can succeed anonymously without revoking anything. Establish
        // authenticated identity first so expired tokens cannot lose the queue.
        await client.action(api.auth.signOut, {});
        await serializeQueue(async () => {
          const current: string[] = JSON.parse(await SecureStore.getItemAsync(queueKey) ?? "[]");
          await SecureStore.setItemAsync(queueKey, JSON.stringify(current.filter(value => value !== id)));
          await SecureStore.deleteItemAsync(id);
        });
      } catch { /* Retain protected revocation for the next connected foreground. */ }
    }
  } finally { revoking = false; }
}
