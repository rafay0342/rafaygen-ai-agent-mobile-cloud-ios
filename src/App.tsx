import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import type { TouchEvent } from "react";

type Screen = "dashboard" | "auth" | "agent" | "pricing" | "payment" | "settings";
type ThemeMode = "light" | "dark" | "light-skin";
type Plan = "starter" | "pro" | "enterprise";

type AppSettings = {
  apiBaseUrl: string;
  webAppUrl: string;
  paymentBaseUrl: string;
  apiKey: string;
  theme: ThemeMode;
};

type ModelProfileMeta = {
  id: string;
  label: string;
  note: string;
  description: string;
  provider: string;
  model: string;
};

type ModelsResponse = {
  models?: string[];
  profiles?: Record<string, string>;
  profileMeta?: Record<string, ModelProfileMeta>;
  warning?: string;
  error?: string;
};

type RequestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
  headers: Record<string, string>;
};

const SETTINGS_KEY = "rafaygen.android.settings.v2";
const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: "http://72.62.1.63:3000",
  webAppUrl: "http://72.62.1.63:3000",
  paymentBaseUrl: "https://buy.stripe.com/test_8wM8z6aVY4mQ8M8aEE",
  apiKey: "",
  theme: "dark",
};

const PLAN_DATA: Record<Plan, { name: string; price: string; points: string[] }> = {
  starter: {
    name: "Starter",
    price: "$9/mo",
    points: ["Basic AI chat", "10GB storage", "Email support"],
  },
  pro: {
    name: "Pro",
    price: "$29/mo",
    points: ["Advanced AI tools", "100GB storage", "Priority support"],
  },
  enterprise: {
    name: "Enterprise",
    price: "$99/mo",
    points: ["Team dashboard", "Unlimited usage", "Dedicated support"],
  },
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      apiBaseUrl: parsed.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl,
      webAppUrl: parsed.webAppUrl || DEFAULT_SETTINGS.webAppUrl,
      paymentBaseUrl: parsed.paymentBaseUrl || DEFAULT_SETTINGS.paymentBaseUrl,
      apiKey: parsed.apiKey || DEFAULT_SETTINGS.apiKey,
      theme: parsed.theme || DEFAULT_SETTINGS.theme,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function buildApiUrl(base: string, path: string) {
  return `${normalizeBaseUrl(base)}${path}`;
}

function dedupeModels(values: string[]) {
  const out: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    if (!out.includes(clean)) out.push(clean);
  }
  return out;
}

function knownIncompatibleReason(model: string) {
  const id = model.toLowerCase();
  if (id.includes("orpheus")) return "Model family is not chat-completions compatible.";
  if (id === "allam-2-7b") return "Blocked at provider project level.";
  return "";
}

function headersWithAuth(apiKey: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey.trim()) {
    headers.Authorization = `grok ${apiKey.trim()}`;
  }
  return headers;
}

async function requestJson(params: {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<RequestResult> {
  const method = params.method || "GET";
  const headers = params.headers || {};

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: params.url,
      method,
      headers,
      data: params.body,
      connectTimeout: 15000,
      readTimeout: 45000,
    });

    let parsed: unknown = response.data;
    let rawText = "";

    if (typeof response.data === "string") {
      rawText = response.data;
      try {
        parsed = JSON.parse(response.data);
      } catch {
        parsed = response.data;
      }
    } else {
      try {
        rawText = JSON.stringify(response.data);
      } catch {
        rawText = String(response.data);
      }
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data: parsed,
      rawText,
      headers: Object.fromEntries(
        Object.entries((response.headers || {}) as Record<string, unknown>).map(([key, value]) => [
          key.toLowerCase(),
          String(value),
        ])
      ),
    };
  }

  const response = await fetch(params.url, {
    method,
    headers,
    body: method === "POST" && params.body !== undefined ? JSON.stringify(params.body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data: parsed,
    rawText: text,
    headers: Object.fromEntries(Array.from(response.headers.entries()).map(([k, v]) => [k.toLowerCase(), v])),
  };
}

function prettyOutput(data: unknown, fallback: string) {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return fallback;
  }
}

function resolveRoutedModel(result: RequestResult, requestedModel: string) {
  const headerModel = result.headers["x-routed-model"]?.trim();
  if (headerModel) return headerModel;
  if (result.data && typeof result.data === "object") {
    const rec = result.data as Record<string, unknown>;
    const routedBody = typeof rec.routedModel === "string" ? rec.routedModel.trim() : "";
    if (routedBody) return routedBody;
    const plainModel = typeof rec.model === "string" ? rec.model.trim() : "";
    if (plainModel) return plainModel;
  }
  return requestedModel;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(() => loadSettings());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [selectedPlan, setSelectedPlan] = useState<Plan>("pro");
  const [models, setModels] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [profileMeta, setProfileMeta] = useState<Record<string, ModelProfileMeta>>({});
  const [failedModelReasons, setFailedModelReasons] = useState<Record<string, string>>({});
  const [showFailedModels, setShowFailedModels] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [authStatus, setAuthStatus] = useState("API key not verified");
  const [prompt, setPrompt] = useState("Give me a production-grade Android roadmap for my startup app.");
  const [chatOutput, setChatOutput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    document.body.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const plan = useMemo(() => PLAN_DATA[selectedPlan], [selectedPlan]);

  const filteredModels = useMemo(() => {
    const compatibleOnly = showFailedModels
      ? models
      : models.filter((model) => !failedModelReasons[model]);
    if (!modelSearch.trim()) return compatibleOnly;
    const needle = modelSearch.trim().toLowerCase();
    return compatibleOnly.filter((entry) => entry.toLowerCase().includes(needle));
  }, [models, modelSearch, failedModelReasons, showFailedModels]);

  async function loadModels() {
    setIsBusy(true);
    setStatus("Fetching models...");
    try {
      const response = await requestJson({
        url: buildApiUrl(settings.apiBaseUrl, "/api/models"),
        method: "GET",
        headers: headersWithAuth(settings.apiKey),
      });

      if (!response.ok) {
        const message =
          typeof response.data === "object" && response.data && "error" in response.data
            ? String((response.data as { error?: string }).error || "Unauthorized")
            : response.rawText;
        setStatus(`Models fetch failed (${response.status}): ${message.slice(0, 140)}`);
        setAuthStatus("Auth failed - verify API key");
        return;
      }

      const payload = (response.data || {}) as ModelsResponse;
      const allModels = dedupeModels(
        (payload.models && payload.models.length ? payload.models : Object.values(payload.profiles || {})) || []
      );
      const knownFailures: Record<string, string> = {};
      for (const model of allModels) {
        const reason = knownIncompatibleReason(model);
        if (reason) knownFailures[model] = reason;
      }

      setModels(allModels);
      setProfiles(payload.profiles || {});
      setProfileMeta(payload.profileMeta || {});
      setFailedModelReasons((prev) => ({ ...knownFailures, ...prev }));
      setSelectedModel((prev) => {
        if (prev && allModels.includes(prev) && !knownFailures[prev] && !failedModelReasons[prev]) return prev;
        const working = allModels.find((model) => !knownFailures[model] && !failedModelReasons[model]);
        return working || allModels[0] || "";
      });
      setStatus(`Models loaded: ${allModels.length}${payload.warning ? ` | ${payload.warning}` : ""}`);
      setAuthStatus("Auth verified");
    } catch {
      setStatus("Models fetch error. Check API URL/network/API key.");
      setAuthStatus("Auth check failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function verifySession() {
    if (!settings.apiKey.trim()) {
      setAuthStatus("Enter API key first");
      return;
    }
    await loadModels();
  }

  async function runChatTest() {
    if (!settings.apiKey.trim()) {
      setStatus("API key required before chat requests.");
      setScreen("auth");
      return;
    }

    const model = selectedModel || models[0] || "gpt-5.2-mini";
    setIsBusy(true);
    setStatus(`Running chat on ${model} ...`);
    setChatOutput("");

    try {
      const response = await requestJson({
        url: buildApiUrl(settings.apiBaseUrl, "/api/chat"),
        method: "POST",
        headers: headersWithAuth(settings.apiKey),
        body: {
          model,
          stream: false,
          strictModel: true,
          messages: [{ role: "user", content: prompt }],
          options: { strict_model: true },
        },
      });

      if (!response.ok) {
        const reason = `HTTP ${response.status}`;
        setFailedModelReasons((prev) => ({ ...prev, [model]: reason }));
        setChatOutput(prettyOutput(response.data, response.rawText));
        setStatus(`Chat failed (${response.status}).`);
        return;
      }

      const routedModel = resolveRoutedModel(response, model);
      if (routedModel !== model) {
        const reason = `Routed as ${routedModel}`;
        setFailedModelReasons((prev) => ({ ...prev, [model]: reason }));
        setChatOutput(prettyOutput(response.data, response.rawText));
        setStatus(`Strict mismatch: requested ${model} but routed ${routedModel}`);
        return;
      }

      setChatOutput(prettyOutput(response.data, response.rawText));
      setStatus(`Chat success on model: ${model}`);
    } catch {
      setStatus("Chat request failed. Verify endpoint/API key/network.");
    } finally {
      setIsBusy(false);
    }
  }

  async function runAllModelsSmokeTest() {
    if (!settings.apiKey.trim()) {
      setStatus("API key required before model test.");
      setScreen("auth");
      return;
    }
    if (models.length === 0) {
      setStatus("No models loaded. Load models first.");
      return;
    }

    setIsBusy(true);
    setStatus(`Testing ${models.length} models...`);
    const okModels: string[] = [];
    const failedModels: string[] = [];
    const failures: Record<string, string> = {};

    try {
      for (const model of models) {
        const response = await requestJson({
          url: buildApiUrl(settings.apiBaseUrl, "/api/chat"),
          method: "POST",
          headers: headersWithAuth(settings.apiKey),
          body: {
            model,
            stream: false,
            strictModel: true,
            messages: [{ role: "user", content: "Reply with: OK" }],
            options: { strict_model: true },
          },
        });

        if (response.ok) {
          const routedModel = resolveRoutedModel(response, model);
          if (routedModel === model) {
            okModels.push(model);
          } else {
            const reason = `Strict mismatch routed as ${routedModel}`;
            failures[model] = reason;
            failedModels.push(`${model} (mismatch)`);
          }
        } else {
          const snippet = response.rawText.replace(/\s+/g, " ").slice(0, 120);
          failures[model] = `HTTP ${response.status}${snippet ? `: ${snippet}` : ""}`;
          failedModels.push(`${model} (${response.status})`);
        }
      }

      setFailedModelReasons((prev) => {
        const next: Record<string, string> = { ...prev };
        for (const model of okModels) {
          delete next[model];
        }
        for (const [model, reason] of Object.entries(failures)) {
          next[model] = reason;
        }
        return next;
      });

      const preferredModel = okModels[0] || models[0] || "";
      if (preferredModel) {
        setSelectedModel(preferredModel);
      }

      setChatOutput(
        [
          `Smoke Test Complete`,
          `Passed: ${okModels.length}`,
          `Failed: ${failedModels.length}`,
          "",
          `Passed Models:`,
          ...(okModels.length ? okModels : ["none"]),
          "",
          `Failed Models:`,
          ...(failedModels.length ? failedModels : ["none"]),
        ].join("\n")
      );
      setStatus(`Model test complete: ${okModels.length}/${models.length} passed`);
    } catch {
      setStatus("Model smoke test interrupted by network/auth error.");
    } finally {
      setIsBusy(false);
    }
  }

  function saveSettings() {
    const normalized: AppSettings = {
      ...settingsDraft,
      apiBaseUrl: normalizeBaseUrl(settingsDraft.apiBaseUrl),
      webAppUrl: normalizeBaseUrl(settingsDraft.webAppUrl),
      paymentBaseUrl: settingsDraft.paymentBaseUrl.trim(),
      apiKey: settingsDraft.apiKey.trim(),
    };
    setSettings(normalized);
    setSettingsDraft(normalized);
    setStatus("Settings + session saved.");
  }

  function clearSession() {
    const next = { ...settings, apiKey: "" };
    setSettings(next);
    setSettingsDraft(next);
    setAuthStatus("Session cleared");
  }

  function openPayment() {
    const url = `${settings.paymentBaseUrl}?plan=${selectedPlan}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openWebApp() {
    window.open(settings.webAppUrl, "_blank", "noopener,noreferrer");
  }

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStartX(event.changedTouches[0].clientX);
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) return;
    const endX = event.changedTouches[0].clientX;
    const diff = endX - touchStartX;
    if (!drawerOpen && touchStartX < 24 && diff > 56) {
      setDrawerOpen(true);
    }
    if (drawerOpen && diff < -56) {
      setDrawerOpen(false);
    }
    setTouchStartX(null);
  }

  return (
    <div className="app-shell" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <aside className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-header">RafayGen Mobile</div>
        <button onClick={() => { setScreen("dashboard"); setDrawerOpen(false); }}>Dashboard</button>
        <button onClick={() => { setScreen("auth"); setDrawerOpen(false); }}>Auth Session</button>
        <button onClick={() => { setScreen("agent"); setDrawerOpen(false); }}>AI Agent</button>
        <button onClick={() => { setScreen("pricing"); setDrawerOpen(false); }}>Pricing</button>
        <button onClick={() => { setScreen("payment"); setDrawerOpen(false); }}>Payment</button>
        <button onClick={() => { setScreen("settings"); setDrawerOpen(false); }}>Settings</button>
      </aside>

      {drawerOpen ? <div className="backdrop" onClick={() => setDrawerOpen(false)} /> : null}

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setDrawerOpen((v) => !v)}>☰</button>
          <div>
            <h1>RafayGen AI Android</h1>
            <p>{status}</p>
          </div>
          <button className="ghost" onClick={loadModels} disabled={isBusy}>Refresh Models</button>
        </header>

        {screen === "dashboard" && (
          <section className="card-grid">
            <article className="card">
              <h2>Backend</h2>
              <p>{settings.apiBaseUrl}</p>
              <p>Auth: {settings.apiKey ? "Configured" : "Missing"}</p>
              <button onClick={verifySession} disabled={isBusy}>Verify Session</button>
            </article>
            <article className="card">
              <h2>Models</h2>
              <p>Total loaded: {models.length}</p>
              <p>Selected: {selectedModel || "None"}</p>
              <button onClick={loadModels} disabled={isBusy}>Load All Models</button>
            </article>
            <article className="card">
              <h2>Plans & Theme</h2>
              <p>Current plan: {plan.name}</p>
              <p>Theme: {settings.theme}</p>
              <button onClick={() => setScreen("pricing")}>Manage Plan</button>
            </article>
          </section>
        )}

        {screen === "auth" && (
          <section className="card">
            <h2>Auth Session (API Key)</h2>
            <p>{authStatus}</p>
            <label>API Key (grok key)
              <input
                type="password"
                value={settingsDraft.apiKey}
                onChange={(e) => setSettingsDraft((v) => ({ ...v, apiKey: e.target.value }))}
                placeholder="Paste key here"
              />
            </label>
            <div className="row">
              <button onClick={saveSettings}>Save Key</button>
              <button className="ghost" onClick={verifySession} disabled={isBusy}>Verify + Load Models</button>
              <button className="ghost" onClick={clearSession}>Clear</button>
            </div>
            <p className="hint">Backend supports `Authorization: grok &lt;key&gt;`, so mobile session stays stable without browser cookie issues.</p>
          </section>
        )}

        {screen === "agent" && (
          <section className="card">
            <h2>AI Agent Console</h2>
            <p>Loaded models: {models.length}</p>
            <p>Working models: {models.filter((model) => !failedModelReasons[model]).length}</p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={showFailedModels}
                onChange={(e) => setShowFailedModels(e.target.checked)}
              />
              Show failed models too
            </label>
            <label>Search model
              <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder="e.g. gpt, claude, groq" />
            </label>
            <label>Select model
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                {filteredModels.length === 0 ? <option value="">No models loaded</option> : null}
                {filteredModels.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>
            <label>Prompt
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
            </label>
            <div className="row">
              <button onClick={runChatTest} disabled={isBusy}>Run /api/chat</button>
              <button className="ghost" onClick={runAllModelsSmokeTest} disabled={isBusy}>Test All Models</button>
              <button className="ghost" onClick={loadModels} disabled={isBusy}>Reload Models</button>
              <button className="ghost" onClick={openWebApp}>Open Web App</button>
            </div>
            <pre className="output">{chatOutput || "No response yet."}</pre>
            {Object.keys(failedModelReasons).length > 0 ? (
              <div className="hint">
                Failed/unsupported models hidden by default:{" "}
                {Object.entries(failedModelReasons)
                  .map(([name, reason]) => `${name} -> ${reason}`)
                  .join(" | ")}
              </div>
            ) : null}
            {Object.keys(profiles).length > 0 ? (
              <div className="hint">
                Profiles: {Object.entries(profiles).map(([id, model]) => {
                  const label = profileMeta[id]?.label || id;
                  return `${label} -> ${model}`;
                }).join(" | ")}
              </div>
            ) : null}
          </section>
        )}

        {screen === "pricing" && (
          <section className="card-grid">
            {(Object.keys(PLAN_DATA) as Plan[]).map((key) => {
              const item = PLAN_DATA[key];
              const active = key === selectedPlan;
              return (
                <article key={key} className={`card ${active ? "active" : ""}`}>
                  <h2>{item.name}</h2>
                  <p>{item.price}</p>
                  <ul>
                    {item.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                  <button onClick={() => setSelectedPlan(key)}>{active ? "Selected" : "Choose"}</button>
                </article>
              );
            })}
            <article className="card span-2">
              <h2>Next Step</h2>
              <p>Selected plan: {plan.name} {plan.price}</p>
              <button onClick={() => setScreen("payment")}>Continue to Payment</button>
            </article>
          </section>
        )}

        {screen === "payment" && (
          <section className="card">
            <h2>Payment</h2>
            <p>Plan: {plan.name} ({plan.price})</p>
            <p>Gateway URL: {settings.paymentBaseUrl}</p>
            <button onClick={openPayment}>Open Payment Gateway</button>
            <p className="hint">Production me Stripe/PayPal/Local gateway final URL set karein.</p>
          </section>
        )}

        {screen === "settings" && (
          <section className="card">
            <h2>Settings</h2>
            <label>API Base URL
              <input
                value={settingsDraft.apiBaseUrl}
                onChange={(e) => setSettingsDraft((v) => ({ ...v, apiBaseUrl: e.target.value }))}
              />
            </label>
            <label>Web App URL
              <input
                value={settingsDraft.webAppUrl}
                onChange={(e) => setSettingsDraft((v) => ({ ...v, webAppUrl: e.target.value }))}
              />
            </label>
            <label>Payment Base URL
              <input
                value={settingsDraft.paymentBaseUrl}
                onChange={(e) => setSettingsDraft((v) => ({ ...v, paymentBaseUrl: e.target.value }))}
              />
            </label>
            <label>Theme
              <select
                value={settingsDraft.theme}
                onChange={(e) => setSettingsDraft((v) => ({ ...v, theme: e.target.value as ThemeMode }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="light-skin">Light-Skin</option>
              </select>
            </label>
            <div className="row">
              <button onClick={saveSettings}>Save Settings</button>
              <button className="ghost" onClick={verifySession} disabled={isBusy}>Test Auth + Models</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
