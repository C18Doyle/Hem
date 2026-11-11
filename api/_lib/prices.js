// Live product search. SerpAPI (Google Shopping, UK) when a key is set; otherwise Claude's web search.
import { askJSON, searchedUrls } from "./claude.js";

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const RESALE = /(vinted|ebay|vestiairecollective|depop|grailed|thredup|therealreal|hardlyeverwornit|oxfam|reskinned)/i;
export const conditionOf = p => RESALE.test(host(p.url) + " " + (p.retailer || "")) || /pre-?owned|used|second-?hand|vintage/i.test(p.title || "") ? "secondhand" : "new";

async function viaSerp(query) {
  const u = new URL("https://serpapi.com/search.json");
  Object.entries({ engine: "google_shopping", q: query, gl: "uk", hl: "en", location: "United Kingdom", api_key: process.env.SERPAPI_KEY })
    .forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u);
  if (!r.ok) throw new Error("SerpAPI " + r.status);
  const j = await r.json();
  return (j.shopping_results || []).slice(0, 20).map(p => ({
    title: p.title, retailer: p.source, price: p.extracted_price ?? null, url: p.link || p.product_link, image: p.thumbnail || null,
  })).filter(p => p.url);
}

/** The web-search price request, shared by live calls and overnight batches. */
export function priceRequest(query, context) {
  return {
    system: "You find clothing for sale online for a UK shopper. Report only what the search results show. Never invent a URL or a price.",
    prompt: `Find current UK listings for: ${query}
${context || ""}
Search retailer sites and resale (Vinted, Vestiaire Collective, eBay UK) where relevant.
Return up to 8: [{"title":"...","retailer":"...","price":number in GBP or null if not shown,"url":"the exact product page URL from the results","note":"one short line on how close a match it is"}]`,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, user_location: { type: "approximate", country: "GB", timezone: "Europe/London" } }],
    maxTokens: 2000,
  };
}
/** Keeps only listings whose links came from the search itself. */
export function parsePriceResponse(data, resp) {
  const seen = searchedUrls(resp);
  const seenHosts = new Set([...seen].map(host));
  return (Array.isArray(data) ? data : data.results || [])
    .filter(p => p.url && (seen.has(p.url) || seenHosts.has(host(p.url))))
    .map(p => ({ ...p, price: typeof p.price === "number" ? p.price : null, image: null, condition: conditionOf(p) }));
}
async function viaWebSearch(query, context) {
  const { data, resp } = await askJSON(priceRequest(query, context));
  return parsePriceResponse(data, resp);
}

export async function findPrices(query, context) {
  let out;
  if (process.env.SERPAPI_KEY) {
    try { out = { source: "Google Shopping", results: await viaSerp(query) }; } catch (e) { console.error(e); }
  }
  out ||= { source: "Web search", results: await viaWebSearch(query, context) };
  out.results.forEach(p => { p.condition = conditionOf(p); });
  return out;
}

/** Several searches in ONE Claude call (web-search path), instead of one call per query. */
export async function findPricesMulti(jobs, context) {
  if (process.env.SERPAPI_KEY) {
    const runs = await Promise.allSettled(jobs.map(([, q]) => findPrices(q, context)));
    return runs.map((r, i) => ({ group: jobs[i][0], ...(r.status === "fulfilled" ? r.value : { source: "Google Shopping", results: [] }) }));
  }
  const { data, resp } = await askJSON({
    system: "You find clothing for sale online for a UK shopper. Report only what the search results show. Never invent a URL or a price.",
    prompt: `Run these searches for UK listings (combine where sensible, at most 5 searches in total):
${jobs.map(([g, q], i) => `${i + 1}. [${g}] ${q}`).join("\n")}
${context || ""}
Return up to 5 listings per numbered search: {"results":[{"search":1,"title":"...","retailer":"...","price":number in GBP or null,"url":"exact product page URL from the results","note":"how close a match"}]}`,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "GB", timezone: "Europe/London" } }],
    maxTokens: 2500,
  });
  const seen = searchedUrls(resp), seenHosts = new Set([...seen].map(host));
  const out = jobs.map(([g]) => ({ group: g, source: "Web search", results: [] }));
  (data.results || []).forEach(p => {
    const k = Number(p.search) - 1;
    if (!out[k] || !p.url || !(seen.has(p.url) || seenHosts.has(host(p.url)))) return;
    out[k].results.push({ ...p, price: typeof p.price === "number" ? p.price : null, image: null, condition: conditionOf(p) });
  });
  return out;
}
