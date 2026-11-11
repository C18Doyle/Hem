// Live price search for a piece: the exact item (new and resale), plus cheaper equivalents.
import { handler } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { TERMS } from "./_lib/style.js";
import { findPricesMulti } from "./_lib/prices.js";

export default handler(async ({ description, price, image }) => {
  if (!description && !image) throw httpError(400, "Describe the piece or add a photo");
  const { data: plan } = await askJSON({
    system: "You are a fashion buyer who knows the UK market, new and resale.\n" + TERMS,
    images: image ? [image] : [],
    fast: true,
    prompt: `Piece: ${description || "see image"}${price ? ", seen at £" + price : ""}
Return {"keyFeatures":["3-4 things that make it what it is: fibre, cut, colour, construction"],
"fairPrice":{"new":"typical UK retail range, e.g. £120–£160","secondhand":"typical resale range"},
"queries":{"exact":"the exact piece, max 8 words","resale":"the exact piece for resale sites, max 8 words","alternative1":"a cheaper equivalent with the same key features","alternative2":"another cheaper equivalent"}}`,
    maxTokens: 600,
  });
  const q = plan.queries || {};
  const jobs = [["This piece", q.exact], ["Secondhand", q.resale ? q.resale + " pre-owned" : null], ["Alternatives", q.alternative1], ["Alternatives", q.alternative2]].filter(([, x]) => x);
  if (!jobs.length) throw httpError(502, "Couldn't work out what to search for");
  const runs = await findPricesMulti(jobs, `Must match: ${(plan.keyFeatures || []).join(", ")}`);
  const seen = new Set(), results = [];
  let source = "";
  runs.forEach((r, i) => {
    source = r.source;
    r.results.forEach(p => {
      if (seen.has(p.url)) return; seen.add(p.url);
      const group = jobs[i][0] === "Secondhand" || (jobs[i][0] === "This piece" && p.condition === "secondhand") ? "Secondhand" : jobs[i][0];
      results.push({ ...p, group });
    });
  });
  const ref = Number(price) || null;
  results.forEach(p => { p.saving = ref && p.price ? Math.round((ref - p.price) * 100) / 100 : null; });
  return { keyFeatures: plan.keyFeatures || [], fairPrice: plan.fairPrice || null, queries: jobs.map(j => j[1]), source, results, searchedAt: new Date().toISOString() };
});
