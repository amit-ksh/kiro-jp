import { test } from "node:test";
import assert from "node:assert/strict";
import { accountCacheAccess, localAccountFromToken, localSessionFromToken } from "../packages/learning-core/src/auth-identity.ts";
const issuer = "https://example.convex.site";
const token = (sub: string, iss = issuer, aud = "convex") => `header.${Buffer.from(JSON.stringify({ sub, iss, aud })).toString("base64url")}.signature`;
test("local cache subject changes immediately when reset/sign-in changes account", () => {
  assert.equal(localAccountFromToken(token("accountA|sessionA"), issuer), "accountA");
  assert.equal(localAccountFromToken(token("accountB|sessionB"), issuer), "accountB");
  assert.equal(localAccountFromToken(null, issuer), null);
});
test("a token from another deployment or audience cannot select the old cache", () => {
  assert.equal(localAccountFromToken(token("accountA|sessionA", "https://other.convex.site"), issuer), null);
  assert.equal(localAccountFromToken(token("accountA|sessionA", issuer, "other"), issuer), null);
});
test("reset replaces the session identity while keeping the same account cache", () => {
  const before = token("accountA|oldSession");
  const after = token("accountA|resetSession");
  assert.notEqual(localSessionFromToken(before, issuer), localSessionFromToken(after, issuer));
  assert.equal(localAccountFromToken(before, issuer), localAccountFromToken(after, issuer));
  assert.equal(localSessionFromToken(token("accountA|../../session"), issuer), null);
});
test("malformed subjects and external garbage never select an account database", () => {
  for (const value of ["accountA", "accountA|sessionA|other", "../../other|sessionA", "|sessionA"]) assert.equal(localAccountFromToken(token(value), issuer), null);
  for (const value of ["not-a-token", "header.invalid.signature", "x".repeat(9000)]) assert.equal(localAccountFromToken(value, issuer), null);
});

test("remembered offline identity permits local study while cloud synchronization waits for matching server identity", () => {
  const offline = { subject: "accountA", currentId: undefined, rememberedId: "accountA", connected: false, serverLoading: true, serverAuthenticated: false };
  assert.deepEqual(accountCacheAccess(offline), { state: "ready", accountId: "accountA", cloudReady: false });
  assert.deepEqual(accountCacheAccess({ ...offline, connected: true, serverAuthenticated: true, serverLoading: false }), { state: "ready", accountId: "accountA", cloudReady: false });
  assert.deepEqual(accountCacheAccess({ ...offline, connected: true, serverAuthenticated: true, serverLoading: false, currentId: "accountA" }), { state: "ready", accountId: "accountA", cloudReady: true });
  assert.deepEqual(accountCacheAccess({ ...offline, currentId: "accountA", serverAuthenticated: true }), { state: "ready", accountId: "accountA", cloudReady: false });
});
test("a revoked connected account is quarantined without selecting another account's cache", () => {
  const ready = { subject: "accountA", currentId: "accountA", rememberedId: "accountA", connected: true, serverLoading: false, serverAuthenticated: true };
  for (const patch of [{ currentId: null }, { currentId: "accountB" }, { subject: "accountB" }, { subject: null }, { serverAuthenticated: false }])
    assert.deepEqual(accountCacheAccess({ ...ready, ...patch }), { state: "reconnect" });
  assert.deepEqual(accountCacheAccess({ ...ready, currentId: undefined, subject: "accountB" }), { state: "connect" });
  assert.deepEqual(accountCacheAccess({ ...ready, currentId: undefined, rememberedId: null }), { state: "connect" });
  // The account key is unchanged after a legitimate session replacement;
  // pending local work stays owned by A, and no unauthenticated upload is allowed.
  assert.deepEqual(accountCacheAccess({ ...ready, serverLoading: true }), { state: "ready", accountId: "accountA", cloudReady: false });
});
