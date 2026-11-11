// Minimal Claude Messages API client (no SDK). Server-side only.
// Every call's token and search usage is recorded against the current request (see http.js).
import { AsyncLocalStorage } from "node:async_hooks";

const API = "https://api.anthropic.com/v1/messages";
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";
export const meter = new AsyncLocalStorage();

// Prices in USD per million tokens / per 1,000 searches. Check current pricing and override via env.
const num = (k, d) => Number(process.env[k] ?? d);
const PRICES = {
  [MODEL]: { in: num("PRICE_IN_USD_MTOK", 3), out: num("PRICE_OUT_USD_MTOK", 15) },
  [FAST_MODEL]: { in: num("PRICE_FAST_IN_USD_MTOK", 1), out: num("PRICE_FAST_OUT_USD_MTOK", 5) },
};
const SEARCH_USD = num("PRICE_WEB_SEARCH_USD_1K", 10) / 1000;
const USD_GBP = num("USD_TO_GBP", 0.79);

export function costGbp(model, u) {
  const p = PRICES[model] || PRICES[MODEL];
  const tokenFactor = u.batch ? 0.5 : 1; // Message Batches: tokens at half price; search fees unchanged
  const usd = tokenFactor * ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out) / 1e6 + (u.web_searches || 0) * SEARCH_USD;
  return Math.round(usd * USD_GBP * 10000) / 10000;
}

export function imageBlock(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(dataUrl || "");
  if (!m) return null;
  return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
}

/** Calls Claude, continuing through `pause_turn` (long web-search turns). */
export async function callClaude({ system, content, tools, maxTokens = 2000, fast = false, temperature }) {
  if (!process.env.ANTHROPIC_API_KEY) throw httpError(500, "ANTHROPIC_API_KEY is not set");
  const ep = meter.getStore()?.endpoint;
  const forceFast = ep && (process.env.FAST_ENDPOINTS || "").split(",").map(s => s.trim()).includes(ep);
  const model = fast || forceFast ? FAST_MODEL : MODEL;
  const messages = [{ role: "user", content }];
  let last;
  for (let round = 0; round < 4; round++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages, ...(tools ? { tools } : {}), ...(temperature != null ? { temperature } : {}) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw httpError(502, `Claude API ${res.status}: ${text.slice(0, 300)}`);
    }
    last = await res.json();
    const u = last.usage || {};
    meter.getStore()?.push({ model, input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output_tokens: u.output_tokens || 0, web_searches: u.server_tool_use?.web_search_requests || 0 });
    if (last.stop_reason !== "pause_turn") return last;
    messages.push({ role: "assistant", content: last.content });
  }
  return last;
}

/** Final text of a response (text blocks after the last tool activity). */
export function finalText(resp) {
  const blocks = resp?.content || [];
  let lastTool = -1;
  blocks.forEach((b, i) => { if (b.type !== "text") lastTool = i; });
  const tail = blocks.slice(lastTool + 1).filter(b => b.type === "text").map(b => b.text).join("");
  return tail || blocks.filter(b => b.type === "text").map(b => b.text).join("");
}

/** Tolerant JSON extraction: whole text, a fenced block, or first {..} / [..] span. */
export function parseJSON(text) {
  const tries = [text];
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) tries.push(fence[1]);
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1));
  const c = text.indexOf("["), d = text.lastIndexOf("]");
  if (c >= 0 && d > c) tries.push(text.slice(c, d + 1));
  for (const t of tries) { try { return JSON.parse(t.trim()); } catch {} }
  throw httpError(502, "Claude returned malformed JSON");
}

export async function askJSON({ system, prompt, images = [], tools, maxTokens, fast, temperature }) {
  const content = [...images.map(imageBlock).filter(Boolean), { type: "text", text: prompt }];
  const resp = await callClaude({ system: (system || "") + "\nReply with only valid JSON, no prose and no code fences.", content, tools, maxTokens, fast, temperature });
  return { data: parseJSON(finalText(resp)), resp };
}

/** Every URL the web search tool actually returned in this response. */
export function searchedUrls(resp) {
  const urls = new Set();
  for (const b of resp?.content || []) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach(r => r.url && urls.add(r.url));
    if (b.type === "text" && Array.isArray(b.citations)) b.citations.forEach(c => c.url && urls.add(c.url));
  }
  return urls;
}

export function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

export const usageOf = (resp, model, batch = false) => {
  const u = resp?.usage || {};
  return { model, batch, input_tokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output_tokens: u.output_tokens || 0, web_searches: u.server_tool_use?.web_search_requests || 0 };
};

/** Message Batches API: half-price tokens, results usually within the hour. */
const H = () => ({ "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" });
export function batchParams({ system, prompt, tools, maxTokens = 2000, fast = false }) {
  return { model: fast ? FAST_MODEL : MODEL, max_tokens: maxTokens, system: (system || "") + "\nReply with only valid JSON, no prose and no code fences.", messages: [{ role: "user", content: [{ type: "text", text: prompt }] }], ...(tools ? { tools } : {}) };
}
export async function submitBatch(requests) {
  const r = await fetch(API + "/batches", { method: "POST", headers: H(), body: JSON.stringify({ requests }) });
  if (!r.ok) throw httpError(502, `Batch submit ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
export async function batchStatus(id) {
  const r = await fetch(`${API}/batches/${id}`, { headers: H() });
  if (!r.ok) throw httpError(502, `Batch status ${r.status}`);
  return r.json();
}
export async function batchResults(url) {
  const r = await fetch(url, { headers: H() });
  if (!r.ok) throw httpError(502, `Batch results ${r.status}`);
  return (await r.text()).split("\n").filter(Boolean).map(l => JSON.parse(l));
}
