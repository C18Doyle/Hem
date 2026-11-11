// #7 Alteration rescue: why are these pieces sitting unworn, and can a tailor fix it?
import { handler, loadWardrobe, itemLine, indexById, realId } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { TERMS } from "./_lib/style.js";
import { fitCheck, target, GROUP } from "../src/lib/fit.js";
import { versatility } from "../src/lib/versatility.js";

export default handler(async (_, { db }) => {
  const items = await loadWardrobe(db);
  const [{ data: wears }, { data: conds }, { data: bm }] = await Promise.all([
    db.from("wears").select("item_id,worn_on"),
    db.from("conditions").select("item_id,rating,issues,noted_on").order("noted_on", { ascending: false }),
    db.from("body_measurements").select("data").maybeSingle(),
  ]);
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const oldEnough = new Date(Date.now() - 60 * 864e5).toISOString();
  const recent = {}; (wears || []).forEach(w => { if (w.worn_on >= since) recent[w.item_id] = (recent[w.item_id] || 0) + 1; });
  const cond = {}; (conds || []).forEach(c => { cond[c.item_id] ||= c; });
  const vers = versatility(items, wears || []);

  const candidates = items.filter(i => GROUP(i.category) && (
    i.fit === "poor" || (i.fit_issues?.length > 0) ||
    ((recent[i.id] || 0) <= 1 && (i.created_at || "") < oldEnough)
  )).slice(0, 15);
  if (!candidates.length) return { pieces: [], note: "Nothing is sitting unworn or flagged as fitting badly." };

  const lines = candidates.map(i => {
    const others = items.filter(x => x.id !== i.id);
    const fc = i.measures && Object.keys(i.measures).length ? fitCheck(i.category, i.measures, target(i.category, others, bm?.data)) : null;
    return [itemLine(i),
      `worn ${recent[i.id] || 0}x in 90 days`,
      `fit: ${i.fit || "not recorded"}${i.fit_issues?.length ? " (" + i.fit_issues.join(", ") + ")" : ""}`,
      fc?.rows?.length ? "measured vs reference: " + fc.rows.map(r => `${r.label} ${r.diff > 0 ? "+" : ""}${r.diff} cm`).join(", ") : "",
      cond[i.id] ? `condition ${cond[i.id].rating}/5 ${cond[i.id].issues?.join(", ") || ""}` : "",
      `could make ${vers[i.id]?.outfits ?? 0} outfits`,
      i.price_paid ? `paid £${i.price_paid}` : ""].filter(Boolean).join(" | ");
  });

  const { data } = await askJSON({
    system: `You are an experienced alterations tailor in the UK, honest about what is and isn't worth doing.
Facts you work by:
- Shoulders and rise cannot practically be altered. A garment wrong there is a 'let-go' unless it's minor.
- Easy: hemming trousers, shortening sleeves on shirts and knitwear, taking in a waist at the centre-back seam, replacing buttons, re-hemming.
- Moderate: tapering legs, taking in shirt side seams, shortening jacket sleeves from the cuff (harder with working cuffs).
- Specialist: re-cutting a jacket, shortening a coat with a lining and vents, altering knitwear body length.
- Letting out needs spare cloth; say "only if there's seam allowance".
- Typical UK high-street tailor prices. Never spend more than the piece is worth to the owner.
Diagnose honestly: many pieces go unworn because of styling or no pairings, not fit; say so.
${TERMS}`,
    prompt: `Pieces rarely worn or flagged as fitting badly:
${lines.join("\n")}
Return:
{"pieces":[{"itemId":"id",
 "diagnosis":"fit" | "repair" | "styling" | "let-go",
 "why":"one sentence: the most likely reason it isn't worn",
 "work":[{"task":"precise tailoring task","difficulty":"easy" | "moderate" | "specialist","cost":"£15–£25"}],
 "totalCost":"£ range or empty",
 "worthIt":true | false,
 "reasoning":"one or two sentences, weighing cost against the piece's value and how much it would be worn"}]}
Order by best rescue first.`,
    maxTokens: 2400,
  });
  const byId = indexById(candidates);
  return { pieces: (data.pieces || []).filter(p => byId[p.itemId]).map(p => ({ ...p, itemId: realId(p.itemId, byId) })) };
});
