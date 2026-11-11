// #6 Wardrobe gaps: only evidence-backed gaps. Returning none is a valid, good answer.
import { handler, loadWardrobe, itemLine, cleanIds } from "./_lib/http.js";
import { indexById, realId } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { STYLIST } from "./_lib/style.js";

export default handler(async ({ focus }, { db }) => {
  const items = await loadWardrobe(db);
  if (items.length < 5) throw httpError(400, "Add at least five pieces first, so gaps are based on what you own");
  const byId = indexById(items);
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const [{ data: wears }, { data: conds }, { data: rejected }, { data: retired }] = await Promise.all([
    db.from("wears").select("item_id,worn_on"),
    db.from("conditions").select("item_id,rating,issues,noted_on").order("noted_on", { ascending: false }),
    db.from("outfits").select("reject_reason,item_ids").eq("status", "rejected").order("created_at", { ascending: false }).limit(40),
    db.from("items").select("name,category").eq("retired", true),
  ]);
  const all = {}, recent = {};
  (wears || []).forEach(w => { all[w.item_id] = (all[w.item_id] || 0) + 1; if (w.worn_on >= since) recent[w.item_id] = (recent[w.item_id] || 0) + 1; });
  const latest = {}; (conds || []).forEach(c => { latest[c.item_id] ||= c; });
  const reasons = {}; (rejected || []).forEach(o => { if (o.reject_reason) reasons[o.reject_reason] = (reasons[o.reject_reason] || 0) + 1; });

  const lines = items.map(i => itemLine(i)
    + ` | worn ${all[i.id] || 0}x total, ${recent[i.id] || 0}x in 90 days`
    + (latest[i.id] ? ` | condition ${latest[i.id].rating}/5${latest[i.id].issues?.length ? " (" + latest[i.id].issues.join(", ") + ")" : ""}` : ""));

  const { data } = await askJSON({
    system: `${STYLIST}
You identify genuine wardrobe gaps. You are not a shopping assistant and you do not sell.
A gap is real ONLY if it rests on at least one of these kinds of evidence from the data:
- "overworked": one piece carries a role alone and is worn far more than its peers (e.g. the only coat, worn most days)
- "wearing-out": a heavily worn piece whose condition is 2/5 or below, so a replacement is needed soon
- "unfillable": a common situation the wardrobe cannot dress at all (no outerwear for winter, no shoes that suit tailoring)
- "rejections": outfit rejections that repeatedly cite the same missing thing (e.g. often rejected as 'wrong for the weather')
- "stranded": several pieces rarely worn because nothing they need to pair with exists
Wanting something new, a trend, or 'it would be nice' is NOT a gap. If there is no evidence, return no gaps. Zero is a good answer. Never more than 3.
Never propose something that duplicates an owned piece.`,
    prompt: `Wardrobe:
${lines.join("\n")}
Retired pieces: ${(retired || []).map(r => r.name).join(", ") || "none"}
Rejection reasons and counts: ${JSON.stringify(reasons)}
Upcoming need, if any: ${focus || "none stated"}
Return:
{"gaps":[{"name":"precise piece, e.g. Charcoal worsted flannel trousers, mid-rise",
 "category":"...",
 "evidenceType":"overworked" | "wearing-out" | "unfillable" | "rejections" | "stranded",
 "evidence":"the specific facts from the data, naming items and numbers",
 "relievesIds":["ids of owned pieces this takes pressure off or finally makes wearable"],
 "outfitsUnlocked":int,
 "route":"secondhand" | "new" | "either",
 "lookFor":"construction details that separate a good one from a poor one"}],
 "noGapReason":"if gaps is empty, one sentence on why the wardrobe is covered; else empty",
 "observation":"one sentence on the wardrobe as a whole"}`,
    maxTokens: 1800,
  });
  data.gaps = (data.gaps || []).slice(0, 3).map(g => ({ ...g, relievesIds: cleanIds(g.relievesIds, byId) }))
    .filter(g => g.evidence && ["overworked", "wearing-out", "unfillable", "rejections", "stranded"].includes(g.evidenceType));
  return data;
});
