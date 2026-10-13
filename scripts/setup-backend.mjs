import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, createPublicKey } from "node:crypto";

const root = process.cwd();
const source = [".env", ".env.local", "starter-japanese/.env"].find(file => fs.existsSync(path.join(root, file)));
if (!source) throw new Error("Private environment file is missing.");
process.loadEnvFile(path.join(root, source));
const env = process.env;
env.PATH = `${path.join(root, "node_modules/.bin")}${path.delimiter}${env.PATH ?? env.Path ?? ""}`;
delete env.Path;
const mailEnabled = env.ACCOUNT_EMAIL_ENABLED === "true";
const needed = ["CONVEX_DEPLOY_KEY", "SITE_URL", "CONVEX_CLOUD_URL", "CONVEX_ACTION_URL", ...(mailEnabled ? ["RESEND_API_KEY", "RESEND_FROM"] : [])];
const missing = needed.filter(name => !env[name]);
if (missing.length) { console.error(JSON.stringify({ status: "needs-configuration", missing })); process.exit(1); }
const keyType = env.CONVEX_DEPLOY_KEY.split(":")[0];
if (keyType === "preview") { console.error("This is a preview deploy key. Configure the matching development deploy key for the existing Convex URLs. No new preview deployment was created."); process.exit(1); }
const keyDeployment = env.CONVEX_DEPLOY_KEY.split("|")[0].split(":").at(-1);
if (new URL(env.CONVEX_CLOUD_URL).hostname !== `${keyDeployment}.convex.cloud`) { console.error("The deployment key and configured cloud URL do not match. No deployment attempted."); process.exit(1); }
if (new URL(env.CONVEX_ACTION_URL).hostname !== `${keyDeployment}.convex.site`) { console.error("The configured action URL does not match this deployment. No deployment attempted."); process.exit(1); }
const site = new URL(env.SITE_URL.includes("://") ? env.SITE_URL : `https://${env.SITE_URL}`);
if (site.protocol !== "https:") { console.error("SITE_URL must be an HTTPS landing origin."); process.exit(1); }
const cli = path.join(root, "node_modules/convex/bin/main.js");
const redact = output => {
  let text = String(output);
  for (const name of ["CONVEX_DEPLOY_KEY", "RESEND_API_KEY", "GEMINI_API_KEY", "CLOUDFLARE_GATEWAY_TOKEN", "CLOUDFLARE_WORKERS_AI_TOKEN", "OPENROUTER_API_KEY", "QLOO_API_KEY"]) if (env[name]) text = text.replaceAll(env[name], "[redacted]");
  return text.replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted private key]");
};
function run(args, quiet = false) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: path.join(root, "packages/backend"), env, encoding: "utf8" });
  if (!quiet) process.stdout.write(redact((result.stdout ?? "") + (result.stderr ?? "")));
  return result;
}
const existingPrivate = run(["env", "get", "JWT_PRIVATE_KEY"], true);
const existingJwks = run(["env", "get", "JWKS"], true);
let privateKey = existingPrivate.status === 0 ? existingPrivate.stdout?.trim() : "";
if (!privateKey) privateKey = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } }).privateKey;
const publicJwk = createPublicKey(privateKey).export({ format: "jwk" });
const values = {
  ...(env.RESEND_API_KEY ? { RESEND_API_KEY: env.RESEND_API_KEY } : {}),
  ...(env.RESEND_FROM ? { RESEND_FROM: env.RESEND_FROM } : {}),
  SITE_URL: site.origin,
  ACCOUNT_EMAIL_ENABLED: mailEnabled ? "true" : "false",
  GEMINI_ALLOW_PAID: env.GEMINI_ALLOW_PAID ?? "false",
  GEMINI_BUDGET_MICROUSD: env.GEMINI_BUDGET_MICROUSD ?? "0",
  ...Object.fromEntries(["GEMINI_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_GATEWAY_ID", "CLOUDFLARE_GATEWAY_TOKEN", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_GATEWAY_PATH", "AI_CONVERSATION_PROVIDER", "QLOO_API_KEY", "QLOO_API_URL"].filter(name => env[name]).map(name => [name, env[name]])),
};
if (!existingPrivate.stdout?.trim() || existingPrivate.status !== 0) values.JWT_PRIVATE_KEY = privateKey;
if (!existingJwks.stdout?.trim() || existingJwks.status !== 0) values.JWKS = JSON.stringify({ keys: [{ ...publicJwk, use: "sig", alg: "RS256" }] });
let jwksNeedsRepair = false;
try { if (existingJwks.status === 0 && existingJwks.stdout?.trim()) JSON.parse(existingJwks.stdout.trim()); } catch { jwksNeedsRepair = true; }
const temporary = path.join(root, ".env.backend-setup");
const publicTemporary = path.join(root, ".env.backend-jwks");
try {
  fs.writeFileSync(temporary, Object.entries(values).map(([name, value]) => `${name}=${name === "JWKS" ? `'${value}'` : JSON.stringify(value)}`).join("\n") + "\n", { mode: 0o600 });
  if (jwksNeedsRepair) {
    fs.writeFileSync(publicTemporary, JSON.stringify({ keys: [{ ...publicJwk, use: "sig", alg: "RS256" }] }));
    if (run(["env", "set", "JWKS", "--from-file", publicTemporary]).status !== 0) throw new Error("Public signing metadata repair failed. Existing private key was preserved.");
  }
  const set = run(["env", "set", "--from-file", temporary]);
  if (set.status !== 0) { console.error("Environment setup did not succeed. Existing values were not force-overwritten."); process.exitCode = 1; }
  else {
    if (run(["codegen", "--typecheck", "disable"]).status !== 0) throw new Error("Backend API generation failed; deployment stopped.");
    const check = spawnSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "convex"], { cwd: path.join(root, "packages/backend"), env, encoding: "utf8" });
    process.stdout.write(redact((check.stdout ?? "") + (check.stderr ?? "")));
    if (check.status !== 0) { console.error("Backend TypeScript failed; deployment stopped."); process.exitCode = check.status ?? 1; }
    else { console.log("Backend TypeScript passed using the hoisted workspace compiler."); const deployed = run(["deploy", "--typecheck", "disable"]); process.exitCode = deployed.status ?? 1; }
  }
} finally { for (const file of [temporary, publicTemporary]) if (fs.existsSync(file)) fs.unlinkSync(file); }
