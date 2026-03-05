#!/usr/bin/env node

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function dedupe(items) {
  const out = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value) continue;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

async function readJsonSafe(response) {
  const text = await response.text();
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
}

const baseArg = process.argv[2] || process.env.API_BASE_URL || "";
const keyArg = process.argv[3] || process.env.API_KEY || "";
const prompt =
  process.argv[4] || process.env.SMOKE_PROMPT || "Reply with exactly: OK";

const baseUrl = normalizeBaseUrl(baseArg);
const apiKey = String(keyArg).trim();

if (!baseUrl || !apiKey) {
  console.error("Usage: node scripts/model_smoke_test.mjs <API_BASE_URL> <API_KEY> [PROMPT]");
  console.error("Example: node scripts/model_smoke_test.mjs http://72.62.1.63:3000 gk_...\n");
  process.exit(1);
}

const headers = {
  Authorization: `grok ${apiKey}`,
  "Content-Type": "application/json",
};

console.log(`Base URL: ${baseUrl}`);
console.log("Loading models...");

const modelsRes = await fetch(`${baseUrl}/api/models`, {
  method: "GET",
  headers,
});

const modelsPayload = await readJsonSafe(modelsRes);
if (!modelsRes.ok) {
  console.error(`Model fetch failed (${modelsRes.status})`);
  console.error(modelsPayload.text.slice(0, 500));
  process.exit(1);
}

const profileModels = Object.values(modelsPayload.data?.profiles || {});
const models = dedupe([...(modelsPayload.data?.models || []), ...profileModels]);

if (!models.length) {
  console.error("No models returned from /api/models");
  process.exit(1);
}

console.log(`Total models: ${models.length}`);

const passed = [];
const failed = [];

for (const model of models) {
  process.stdout.write(`Testing: ${model} ... `);

  try {
    const chatRes = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        stream: false,
        strictModel: true,
        options: { strict_model: true },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const chatPayload = await readJsonSafe(chatRes);
    if (chatRes.ok) {
      const routedHeader = (chatRes.headers.get("x-routed-model") || "").trim();
      const requestedHeader = (chatRes.headers.get("x-requested-model") || "").trim();
      const strictHeader = (chatRes.headers.get("x-strict-model") || "").trim();

      let routedBody = "";
      if (chatPayload.data && typeof chatPayload.data === "object") {
        const maybeRouted = chatPayload.data.routedModel || chatPayload.data.model;
        if (typeof maybeRouted === "string") routedBody = maybeRouted.trim();
      }

      const routed = routedHeader || routedBody || model;
      if (routed !== model) {
        failed.push(`${model} (routed as ${routed})`);
        process.stdout.write(`FAIL routed=${routed} requestedHeader=${requestedHeader} strict=${strictHeader}\n`);
      } else {
        passed.push(model);
        process.stdout.write("PASS\n");
      }
    } else {
      failed.push(`${model} (${chatRes.status})`);
      const snippet = chatPayload.text.replace(/\s+/g, " ").slice(0, 140);
      process.stdout.write(`FAIL ${snippet}\n`);
    }
  } catch (error) {
    failed.push(`${model} (network error)`);
    process.stdout.write(`FAIL ${String(error)}\n`);
  }
}

console.log("\n=== Summary ===");
console.log(`Passed: ${passed.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length) {
  console.log("Failed models:");
  for (const item of failed) {
    console.log(`- ${item}`);
  }
  process.exit(2);
}

process.exit(0);
