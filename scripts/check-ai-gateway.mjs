import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";

const source = [".env", ".env.local", "starter-japanese/.env"].find(file => fs.existsSync(file));
if (!source) throw new Error("Private configuration is missing.");
process.loadEnvFile(source);
const required = ["CONVEX_CLOUD_URL", "CONVEX_DEPLOY_KEY", "OPENROUTER_API_KEY"];
if (required.some(name => !process.env[name])) throw new Error("Gateway probe configuration is incomplete.");
const client = new ConvexHttpClient(process.env.CONVEX_CLOUD_URL, { logger: false });
client.setAdminAuth(process.env.CONVEX_DEPLOY_KEY);
const routerModel = process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
const run = `gateway-check-${randomUUID()}`;
const record = { run, checkedAt: new Date().toISOString(), metadata: {}, probes: [], quotaDedupe: false };
const directory = ".android-runtime";
fs.mkdirSync(directory, { recursive: true });
const save = () => fs.writeFileSync(`${directory}/ai-gateway-check.json`, JSON.stringify(record, null, 2) + "\n");
save();

try {
  // Metadata inspection is not model inference. Every actual generation below
  // is a server action using the same Gateway adapter and atomic reservations.
  const [modelsResponse, keyResponse] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15_000) }),
    fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, signal: AbortSignal.timeout(15_000) }),
  ]);
  if (!modelsResponse.ok || !keyResponse.ok) throw new Error("OpenRouter metadata inspection failed.");
  const catalog = await modelsResponse.json(), key = await keyResponse.json();
  const selected = catalog.data?.find(model => model.id === routerModel);
  const free = selected && routerModel.endsWith(":free") && Number(selected.pricing?.prompt) === 0 && Number(selected.pricing?.completion) === 0;
  const remaining = key.data?.free_model_daily_requests?.remaining;
  record.metadata = { model: routerModel, modelFound: Boolean(selected), zeroTokenPrices: Boolean(free), supportedParameters: selected?.supported_parameters ?? [], freeRequestsRemaining: Number.isSafeInteger(remaining) ? remaining : null };
  save();
  console.log(JSON.stringify({ metadataChecked: true, ...record.metadata }));
  if (!free || remaining === 0) throw new Error("The configured free model is unavailable or its quota is exhausted.");
  const gemini = await client.action("aiProbe:check", { provider: "gemini", operationPrefix: `${run}.google` });
  record.probes.push(gemini); save();
  console.log(JSON.stringify({ provider: "gemini", passed: gemini.passed, status: gemini.status, nodeVersion: gemini.nodeVersion, inputTokens: gemini.inputTokens, outputTokens: gemini.outputTokens }));

  let router;
  const configuredPath = process.env.OPENROUTER_GATEWAY_PATH;
  if (configuredPath && configuredPath !== "/openrouter" && configuredPath !== "/openrouter/v1") throw new Error("Invalid configured OpenRouter Gateway route.");
  const paths = configuredPath ? [configuredPath] : ["/openrouter", "/openrouter/v1"];
  for (const [index, openRouterPath] of paths.entries()) {
    router = await client.action("aiProbe:check", { provider: "openrouter", operationPrefix: `${run}.router-${index}`, openRouterPath });
    record.probes.push({ ...router, openRouterPath }); save();
    console.log(JSON.stringify({ provider: "openrouter", route: openRouterPath, passed: router.passed, status: router.status, nodeVersion: router.nodeVersion, inputTokens: router.inputTokens, outputTokens: router.outputTokens }));
    if (router.passed) { record.verifiedRouterPath = openRouterPath; break; }
    // Only the documented route discrepancy permits another attempt. Quota,
    // transport timeouts and schema/quality errors are not silently retried.
    if (router.status !== 404) break;
  }
  const duplicate = await Promise.all([
    client.mutation("aiQuota:reserve", { operationId: `${run}.dedupe` }),
    client.mutation("aiQuota:reserve", { operationId: `${run}.dedupe` }),
  ]);
  record.quotaDedupe = duplicate.filter(result => result.start).length === 1;
  record.budget = await client.query("aiBudget:status", {});
  record.quota = await client.query("aiQuota:status", {});
  save();
  console.log(JSON.stringify({ quotaDedupe: record.quotaDedupe, budget: record.budget, quota: record.quota }));
  if (!gemini.passed || !router?.passed || !record.quotaDedupe) process.exitCode = 1;
} catch {
  save(); console.error("Gateway probe did not pass. Inspect its private evidence and retained reservations; no provider bypass or automatic paid fallback was used."); process.exitCode = 1;
}
