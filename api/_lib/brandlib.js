// Brand research request and result handling, shared by live research and overnight batches.
import { searchedUrls } from "./claude.js";
import { BRAND_DIMS, brandKey } from "../../src/lib/quality.js";
import { profileOf, TIERS } from "../../src/lib/brands.js";

export function brandRequest(name) {
  const profile = profileOf(name);
  const clean = profile?.name || String(name || "").trim();
  const year = new Date().getFullYear();
  return { clean, profile, req: {
    system: `You are an analyst rating clothing brands and manufacturers on sustainability and labour practice, in the tradition of the Fashion Transparency Index, Remake and KnowTheChain.
Rules:
- Use web search. Prefer primary disclosures (the company's own supplier list, impact report, annual report) and independent raters (Fashion Transparency Index, Good On You, Remake, KnowTheChain, Fair Wear Foundation, Science Based Targets initiative, B Lab, Open Supply Hub), and reputable press for controversies.
- A marketing claim is not evidence. Vague claims ("conscious", "eco", "responsibly made") with no data go in unsupportedClaims.
- Disclosure is not performance: a long report with weak targets scores on what it commits to and achieves, not on its length.
- Score each dimension 1-10 (5 = typical mid-market brand). If you find no evidence for a dimension, set score null.
- Only cite URLs that appeared in your search results.
- Today is ${year}. Note the year of each fact; prefer the last three years.`,
    prompt: `Rate: ${clean}
${profile ? `Already known (do not spend searches confirming): ${profile.country}, ${profile.city}${profile.founded ? ", founded " + profile.founded : ""}; ${profile.founders}; ${TIERS[profile.tier]} tier; ${profile.knownFor}${profile.madeIn ? " Production includes: " + profile.madeIn.join(", ") + "." : ""}
Spend your searches on sustainability and labour evidence only.` : ""}
If this is a manufacturer or mill rather than a retail brand, rate it as such and say so.
Return:
{"name":"properly capitalised name","type":"brand" | "manufacturer" | "both",
 "summary":"two sentences: the honest headline",
 "dims":{${BRAND_DIMS.map(d => `"${d.key}":{"score":1-10 or null,"evidence":"specific facts with years (${d.hint})","sources":["urls"]}`).join(",")}},
 "thirdParty":[{"rater":"e.g. Fashion Transparency Index","rating":"e.g. 41%","year":2025,"url":"..."}],
 "controversies":[{"issue":"...","year":2024,"url":"..."}],
 "unsupportedClaims":["claims made without data"],
 "madeIn":["countries where production is disclosed"],
 "programmes":["repair, resale or take-back schemes, if any"]}`,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: profile ? 4 : 6 }],
    maxTokens: 4000,
  } };
}

/** Verifies sources against what the search returned, then saves the rating. */
export async function saveBrand(db, userId, clean, data, resp) {
  const seen = searchedUrls(resp);
  const ok = u => typeof u === "string" && seen.has(u);
  const dims = {};
  BRAND_DIMS.forEach(d => {
    const x = data.dims?.[d.key] || {};
    const sources = (x.sources || []).filter(ok);
    const verified = Number.isFinite(Number(x.score)) && x.score !== null && sources.length > 0;
    dims[d.key] = { score: verified ? Number(x.score) : null, evidence: verified ? x.evidence : (x.evidence ? x.evidence + " (no verifiable source)" : "No verifiable public evidence found."), sources, verified };
  });
  const rating = { ...data, dims,
    thirdParty: (data.thirdParty || []).map(t => ({ ...t, verified: ok(t.url) })),
    controversies: (data.controversies || []).map(c => ({ ...c, verified: ok(c.url) })),
    searchedCount: seen.size };
  const row = { user_id: userId, brand_key: brandKey(clean), name: profileOf(clean)?.name || data.name || clean, rating, assessed_at: new Date().toISOString() };
  const { data: saved, error } = await db.from("brand_ratings").upsert(row, { onConflict: "user_id,brand_key" }).select().single();
  if (error) throw new Error(error.message);
  return saved;
}
