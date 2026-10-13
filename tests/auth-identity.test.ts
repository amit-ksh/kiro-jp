import { test } from "node:test";
import assert from "node:assert/strict";
import { localAccountFromToken, localSessionFromToken } from "../packages/learning-core/src/auth-identity.ts";
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
