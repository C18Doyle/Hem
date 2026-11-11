// Estimate what a piece costs new at full price today (UK). Cheap model, no web search.
import { handler } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";

export default handler(async ({ name, brand, category, material }) => {
  if (!name && !brand) throw httpError(400, "Add a name or brand first");
  const { data } = await askJSON({
    system: "You are a UK fashion buyer who knows current full retail prices across high street, premium and luxury brands. Be honest when unsure; never invent precision.",
    fast: true, temperature: 0,
    prompt: `Estimate the full UK retail price, new, today, for:
${[brand && "Brand: " + brand, "Piece: " + (name || "not given"), category && "Category: " + category, material && "Cloth: " + material].filter(Boolean).join("\n")}
If the brand no longer sells this or it is vintage, estimate the closest current equivalent from the same brand, or a comparable maker if the brand is gone.
Return {"typical":number,"low":number,"high":number,"confidence":"high"|"medium"|"low","basis":"one short sentence"}`,
    maxTokens: 300,
  });
  const n = x => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : null);
  return { typical: n(data.typical), low: n(data.low), high: n(data.high), confidence: data.confidence || "low", basis: data.basis || "" };
});
