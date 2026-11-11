// Quality assessment: label + photos + guided inspection + price -> sub-scores.
// Consistency measures: fixed rubric anchors, temperature 0, and a "precise" mode that
// runs two assessments (a third if they disagree) and takes the median of each sub-score.
import { handler } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { TERMS } from "../_lib/style.js";
import { CHECKLIST, DIMENSIONS, combine } from "../../src/lib/quality.js";

// What each score level looks like. Anchoring stops scores drifting between runs.
const RUBRIC = `Scoring anchors (use these, not intuition):
FIBRE  2: low-grade virgin acrylic or polyester-heavy blend in a garment that should be natural. 4: short-staple conventional cotton, or blends that pill. 6: decent natural fibre, mid-grade. 8: long-staple cotton (Supima, Egyptian), extra-fine merino, good linen. 10: exceptional (Sea Island cotton, top-grade cashmere, vicuna-tier).
FABRIC 2: thin, see-through, poor recovery, fuzzes on a rub test. 4: lightweight, some show-through, slow recovery. 6: medium weight, opaque, recovers. 8: dense, substantial hand, crisp recovery, no fuzz. 10: exceptional density and finish for its type.
CONSTRUCTION 2: under 8 stitches per inch, raw or fraying seams, twisted side seams. 4: overlocked, 8-10 SPI, minimal allowance. 6: neat overlocking or flat-felled in places, 10-12 SPI. 8: flat-felled or French seams, 12+ SPI, generous allowance, bar tacks at stress points. 10: hand finishing, fully fashioned knitwear, canvassed tailoring.
FINISHING 2: glued hems, loose plastic buttons, mismatched pattern. 4: narrow machine hems, thin-thread buttons. 6: clean hems, firm buttons. 8: deep or blind hems, shanked horn or corozo buttons, pattern matched. 10: hand-sewn buttonholes, flawless matching, full quality lining.
VALUE  5 = price in line with what the evidence shows. Above 5 = more quality than the price suggests; below 5 = paying for the label.`;

function median(xs) { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

export default handler(async (body, { db }) => {
  const { itemId, garment, labelText, pricePaid, brand, origin, acquired, certifications, checklist = {}, photos = [], precise: preciseIn } = body;
  const precise = preciseIn ?? !!itemId; // owned pieces get the stored, precise score; quick checks run once
  if (!labelText && !photos.length) throw httpError(400, "Add the label text or at least one photo");
  const answered = CHECKLIST.filter(c => checklist[c.key]).map(c => `- ${c.q} ${checklist[c.key]}`);
  const kinds = photos.map(p => p.kind);
  const photoNote = photos.map((p, i) => `Image ${i + 1}: ${p.kind === "label" ? "care/composition label" : p.kind === "inside" ? "inside of the garment showing seams" : "the garment"}`).join("\n");

  const once = () => askJSON({
    system: `You are a textile technologist and quality-control inspector for a luxury retailer in the UK. You score garments on evidence.
Rules:
- Score each dimension 1-10 using the anchors below. 5 is high-street average.
- 'observed' is true ONLY if the score rests on something visible in a photo, typed on the label, or answered in the inspection. Otherwise score cautiously toward 5 and set observed false.
- Fibre content alone is weak evidence. Never inflate a score because of brand name or price.
${RUBRIC}
${TERMS}`,
    images: photos.map(p => p.data),
    temperature: 0,
    prompt: `Garment: ${garment || "not stated"}
Brand: ${brand || "not stated"}  Made in: ${origin || "not stated"}  Price paid: ${pricePaid ? "£" + pricePaid : "not stated"}
Acquired: ${acquired || "new"}  Certifications on label: ${certifications || "none stated"}
Label text: ${labelText || "none typed"}
${photoNote || "No photos."}
Owner's inspection:
${answered.join("\n") || "Not done."}

Return:
{"fibres":[{"name":"Wool","percent":70}],
 "sub":{${DIMENSIONS.map(d => `"${d.key}":{"score":1-10,"observed":true|false,"evidence":"one short sentence citing the anchor it matches"}`).join(",")}},
 "lifetimeWears":{"low":int,"high":int},
 "lifetimeBasis":"one sentence: what wear and care the estimate assumes",
 "strengths":["..."], "weaknesses":["..."], "watchFor":["early signs of wear"],
 "care":{"wash":"...","dry":"...","iron":"...","store":"...","extra":"one tip that most extends its life"},
 "reminders":[{"note":"e.g. De-pill with a fabric comb","repeatDays":90}],
 "symbols":"plain-English reading of care symbols, or empty",
 "toImprove":"the single extra check or photo that would most improve confidence",
 "sustain":{
   "materials":{"score":1-10,"evidence":"recycled or certified content (GOTS, RWS, GRS, FSC, OEKO-TEX), virgin synthetics, conventional cotton"},
   "circularity":{"score":1-10,"evidence":"mono-fibre is recyclable, blends mostly are not; repairability; resale value"},
   "care":{"score":1-10,"evidence":"dry-clean only, tumble drying, microfibre shedding, wash frequency"}
 },
 "sustainNotes":"one or two sentences on the owner's biggest lever to reduce this garment's impact"}
Sustainability scores are relative (5 = typical high-street garment). Do not estimate CO2 or water figures.`,
    maxTokens: 1800,
  }).then(r => r.data);

  // Precise mode: two runs in parallel; a third only if any dimension disagrees by more than 1.5.
  let runs = [await (precise ? Promise.all([once(), once()]) : once().then(x => [x]))].flat();
  const spread = rs => Math.max(0, ...DIMENSIONS.map(d => { const v = rs.map(r => Number(r.sub?.[d.key]?.score)).filter(Number.isFinite); return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0; }));
  if (precise && spread(runs) > 1.5) runs.push(await once());

  const data = runs[0];
  if (runs.length > 1) {
    DIMENSIONS.forEach(d => {
      const v = runs.map(r => Number(r.sub?.[d.key]?.score)).filter(Number.isFinite);
      if (v.length && data.sub?.[d.key]) data.sub[d.key].score = Math.round(median(v) * 10) / 10;
    });
    ["materials", "circularity", "care"].forEach(k => {
      const v = runs.map(r => Number(r.sustain?.[k]?.score)).filter(Number.isFinite);
      if (v.length && data.sustain?.[k]) data.sustain[k].score = Math.round(median(v) * 10) / 10;
    });
    const lows = runs.map(r => Number(r.lifetimeWears?.low)).filter(Number.isFinite), highs = runs.map(r => Number(r.lifetimeWears?.high)).filter(Number.isFinite);
    if (lows.length && highs.length) data.lifetimeWears = { low: Math.round(median(lows)), high: Math.round(median(highs)) };
  }

  const scored = combine(data.sub, answered.length, kinds);
  // If even the median rests on runs that disagreed widely, say so.
  if (runs.length > 2 && spread(runs) > 2.5) scored.confidence = scored.confidence === "High" ? "Medium" : "Low";
  const assessment = { ...data, ...scored, runs: runs.length, spread: runs.length > 1 ? Math.round(spread(runs) * 10) / 10 : null,
    assessedAt: new Date().toISOString(), inputs: { garment, brand, origin, pricePaid, acquired, certifications, checklist, photoKinds: kinds, labelText } };

  if (itemId) {
    const patch = { quality: assessment, care: data.care || null };
    if (pricePaid) patch.price_paid = pricePaid;
    if (brand) patch.brand = brand;
    if (acquired) patch.acquired = acquired;
    if (certifications) patch.certifications = String(certifications).split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await db.from("items").update(patch).eq("id", itemId);
    if (error) throw httpError(500, error.message);
  }
  return assessment;
});
