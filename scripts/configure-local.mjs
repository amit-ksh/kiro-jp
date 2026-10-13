import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = [".env", ".env.local", "starter-japanese/.env"].find(file => fs.existsSync(path.join(root, file)));
if (!source) { console.error("Add a private .env file using .env.example, then run pnpm config:local."); process.exit(1); }
const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string"));
Object.assign(env, process.loadEnvFile ? (() => { process.loadEnvFile(path.join(root, source)); return process.env; })() : {});
function writeConfig(file, values) {
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const names = new Set(Object.keys(values));
  const retained = previous.split(/\r?\n/).filter(line => !names.has(line.match(/^([A-Z0-9_]+)=/)?.[1]));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [...retained.filter(Boolean), ...Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`), ""].join("\n"));
}
const cloud = env.CONVEX_CLOUD_URL ?? env.EXPO_PUBLIC_CONVEX_URL;
const actions = env.CONVEX_ACTION_URL ?? env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!cloud || !actions) { console.error("Missing CONVEX_CLOUD_URL or CONVEX_ACTION_URL. No values were printed."); process.exit(1); }
for (const value of [cloud, actions]) if (new URL(value).protocol !== "https:") throw new Error("Convex URLs must use HTTPS.");
const native = { EXPO_PUBLIC_CONVEX_URL: cloud, EXPO_PUBLIC_CONVEX_SITE_URL: actions };
if (env.SITE_URL) native.EXPO_PUBLIC_APP_LINK_HOST = new URL(env.SITE_URL.includes("://") ? env.SITE_URL : `https://${env.SITE_URL}`).hostname;
for (const key of ["ANDROID_PACKAGE_ID", "EXPO_PUBLIC_EAS_PROJECT_ID"]) if (env[key]) native[key] = env[key];
writeConfig(path.join(root, "apps/native/.env.local"), native);
const backend = { CONVEX_URL: cloud };
if (env.CONVEX_DEPLOYMENT) backend.CONVEX_DEPLOYMENT = env.CONVEX_DEPLOYMENT;
if (env.CONVEX_DEPLOY_KEY) backend.CONVEX_DEPLOY_KEY = env.CONVEX_DEPLOY_KEY;
writeConfig(path.join(root, "packages/backend/.env.local"), backend);
console.log(JSON.stringify({ nativeConfiguration: "written", deploymentConfiguration: env.CONVEX_DEPLOYMENT || env.CONVEX_DEPLOY_KEY ? "written" : "needs authenticated Convex setup", senderConfigured: Boolean(env.RESEND_FROM), appLinkHostConfigured: Boolean(env.SITE_URL), keysPrinted: false }));
