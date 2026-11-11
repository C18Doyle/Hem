import { profileOf } from "./brands.js";
// Shared by the browser and the API. Pure functions only.

// The overall score is computed here, deterministically, from Claude's sub-scores.
// Claude judges each dimension; it does not get to pick the final number.
export const DIMENSIONS = [
  { key: "fibre",        label: "Fibre",        weight: 0.20, hint: "What it is made of, and the grade of that fibre" },
  { key: "fabric",       label: "Fabric",       weight: 0.25, hint: "Weight, density, recovery, surface" },
  { key: "construction", label: "Construction", weight: 0.30, hint: "Seams, stitch density, how it is put together" },
  { key: "finishing",    label: "Finishing",    weight: 0.15, hint: "Hems, buttons, lining, pattern matching" },
  { key: "value",        label: "Value",        weight: 0.10, hint: "What you paid against what you got" },
];

// Guided inspection. Each answer is real evidence Claude cannot see on a label.
export const CHECKLIST = [
  { key: "weight",   q: "How does the fabric feel in the hand?", a: ["Thin", "Medium", "Substantial"] },
  { key: "light",    q: "Held up to a light, can you see through it?", a: ["Clearly", "A little", "Not at all"] },
  { key: "stretch",  q: "Stretch a small area and let go.", a: ["Snaps back", "Slowly recovers", "Stays stretched", "Doesn’t stretch"] },
  { key: "spi",      q: "Count stitches along one inch of a main seam.", a: ["Under 8", "8 to 11", "12 or more", "Can’t tell"] },
  { key: "seams",    q: "Look inside. How are the seam edges finished?", a: ["Raw or fraying", "Overlocked", "French or bound", "Can’t tell"] },
  { key: "allowance",q: "How much fabric is left beyond the seams?", a: ["Barely any", "About 1 cm", "Generous, could be let out"] },
  { key: "pattern",  q: "Do stripes or checks line up across seams?", a: ["No pattern", "Yes", "No"] },
  { key: "buttons",  q: "How are the buttons attached?", a: ["No buttons", "Loose or thin thread", "Firm", "Firm, with a shank or spare"] },
  { key: "hem",      q: "What does the hem look like?", a: ["Glued or fused", "Narrow machine hem", "Deep or blind-stitched"] },
  { key: "lining",   q: "Is it lined?", a: ["Not relevant", "No", "Partly", "Fully"] },
  { key: "rub",      q: "Rub two areas together for ten seconds. Any fuzz?", a: ["None", "A little", "Noticeable"] },
  { key: "twist",    q: "Do the side seams twist round the body?", a: ["No", "Slightly", "Yes", "No side seams"] },
];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/** sub: { fibre: {score, evidence, observed}, ... } -> { overall, confidence, band } */
export function combine(sub, checklistAnswered = 0, photoKinds = []) {
  let total = 0, w = 0, observedW = 0;
  for (const d of DIMENSIONS) {
    const s = Number(sub?.[d.key]?.score);
    if (!Number.isFinite(s)) continue;
    total += clamp(s, 1, 10) * d.weight; w += d.weight;
    if (sub[d.key].observed) observedW += d.weight;
  }
  const overall = w ? Math.round((total / w) * 10) / 10 : null;
  // Confidence: how much of the score rests on things actually seen or checked.
  const evidence = observedW / (w || 1);
  const checklist = Math.min(1, checklistAnswered / 8);
  const photos = Math.min(1, new Set(photoKinds).size / 3);
  const c = 0.5 * evidence + 0.3 * checklist + 0.2 * photos;
  const confidence = c >= 0.7 ? "High" : c >= 0.4 ? "Medium" : "Low";
  return { overall, confidence, confidenceValue: Math.round(c * 100) / 100 };
}

/** Expected condition (5 like new .. 1 worn out) after n wears, given lifetime wears. */
export function expectedCondition(wears, lifetimeWears) {
  if (!lifetimeWears) return null;
  return clamp(5 - 4 * (wears / lifetimeWears), 1, 5);
}

/**
 * Real-world durability: compares the latest condition check against what the
 * assessment predicted at this many wears. Returns null until there's a check-in.
 */
export function inPractice(quality, wears, latestCondition) {
  const lw = quality?.lifetimeWears;
  const mid = lw ? (Number(lw.low) + Number(lw.high)) / 2 : null;
  if (!mid || !latestCondition || wears < 5) return null;
  const expected = expectedCondition(wears, mid);
  const delta = latestCondition.rating - expected;           // + better than expected
  const ratio = clamp(1 + delta / 4, 0.4, 1.8);
  const revisedLifetime = Math.round(mid * ratio);
  const verdict = delta > 0.5 ? "Holding up better than expected"
    : delta < -0.5 ? "Wearing faster than expected" : "Ageing as expected";
  return { expected: Math.round(expected * 10) / 10, actual: latestCondition.rating, verdict, revisedLifetime };
}

export function costPerWear(price, wears, lifetimeWears) {
  const p = Number(price);
  if (!p) return null;
  const now = wears ? p / wears : null;
  const mid = lifetimeWears ? (Number(lifetimeWears.low) + Number(lifetimeWears.high)) / 2 : null;
  return { now, projected: mid ? p / mid : null };
}

export const gbp = n => n == null ? "—" : "£" + (n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString("en-GB"));

// ---------- Sustainability (#8) ----------
// Kept separate from quality: a well-made garment can still be high-impact.
// Durability and how it was acquired are computed here; Claude judges the rest.
export const SUSTAIN = [
  { key: "durability",  label: "Durability",  weight: 0.25 },
  { key: "materials",   label: "Materials",   weight: 0.20 },
  { key: "maker",       label: "Maker",       weight: 0.20 },
  { key: "acquisition", label: "Acquisition", weight: 0.15 },
  { key: "circularity", label: "End of life", weight: 0.12 },
  { key: "care",        label: "Care impact", weight: 0.08 },
];
export const ACQUIRED = [["new", "New"], ["secondhand", "Secondhand"], ["vintage", "Vintage"], ["gifted", "Gifted"], ["rented", "Rented"]];
const ACQ_SCORE = { new: 4, gifted: 5, rented: 8, secondhand: 9.5, vintage: 10 };
const ACQ_NOTE = {
  new: "Bought new, so its full production footprint sits with you.",
  gifted: "A gift; the production footprint still exists, but it wasn’t your purchase decision.",
  rented: "Rented, so its footprint is shared across many wears by many people.",
  secondhand: "Secondhand: no new production, and it extends an existing garment’s life.",
  vintage: "Vintage: no new production, and it has already proved its durability.",
};

function durabilityScore(lw) {
  const mid = lw ? (Number(lw.low) + Number(lw.high)) / 2 : null;
  if (!mid) return null;
  if (mid < 30) return 2; if (mid < 60) return 4; if (mid < 120) return 6; if (mid < 200) return 7.5; if (mid < 300) return 8.5; return 10;
}

/** Combines Claude's sustain sub-scores with computed durability and acquisition. */
export function sustainScore(q, acquired = "new", brand = null) {
  if (!q?.sustain) return null;
  const mid = q.lifetimeWears ? Math.round((Number(q.lifetimeWears.low) + Number(q.lifetimeWears.high)) / 2) : null;
  const sub = {
    durability: { score: durabilityScore(q.lifetimeWears), evidence: mid ? `Expected to last around ${mid} wears. The more wears, the lower the impact of each one.` : "" },
    acquisition: { score: ACQ_SCORE[acquired] ?? 4, evidence: ACQ_NOTE[acquired] || ACQ_NOTE.new },
    materials: q.sustain.materials, circularity: q.sustain.circularity, care: q.sustain.care,
  };
  // Maker rating counts only when the brand has been researched. Secondhand softens it:
  // buying used doesn't send money to the maker.
  const b = brand ? brandScore(brand.rating) : null;
  if (b) {
    const used = ["secondhand", "vintage"].includes(acquired);
    sub.maker = { score: used ? Math.round(((b.overall + 10) / 2) * 10) / 10 : b.overall,
      evidence: `${brand.name} rates ${b.overall}/10 (${b.confidence.toLowerCase()} confidence).${used ? " Bought used, so less weight on the maker." : ""}` };
  }
  let t = 0, w = 0;
  SUSTAIN.forEach(d => { const s = Number(sub[d.key]?.score); if (Number.isFinite(s)) { t += Math.max(1, Math.min(10, s)) * d.weight; w += d.weight; } });
  return { overall: w ? Math.round((t / w) * 10) / 10 : null, sub };
}

// ---------- Brand / manufacturer ratings ----------
// Researched from public disclosures and third-party raters. Silence is not neutral:
// a dimension with no verifiable evidence scores 3 ("undisclosed"), so opacity can't score well.
export const BRAND_DIMS = [
  { key: "transparency", label: "Transparency", weight: 0.20, hint: "Published supplier lists, by tier; traceability" },
  { key: "labour",       label: "Labour",       weight: 0.25, hint: "Living wages, Fair Wear or ETI membership, grievance routes" },
  { key: "climate",      label: "Climate",      weight: 0.20, hint: "Validated targets, supply-chain emissions, renewable energy" },
  { key: "materials",    label: "Materials",    weight: 0.15, hint: "Share of recycled, organic or certified fibre" },
  { key: "model",        label: "Business model", weight: 0.20, hint: "Volume and pace of new lines; repair, resale, take-back" },
];
export const UNDISCLOSED = 3;
export const brandKey = s => { const p = profileOf(s); return String(p ? p.name : s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""); };

export function brandScore(r) {
  if (!r?.dims) return null;
  let t = 0, w = 0, evidenced = 0;
  BRAND_DIMS.forEach(d => {
    const x = r.dims[d.key];
    const s = x?.verified ? Number(x.score) : UNDISCLOSED;
    if (x?.verified) evidenced++;
    t += Math.max(1, Math.min(10, Number.isFinite(s) ? s : UNDISCLOSED)) * d.weight; w += d.weight;
  });
  const recent = (r.controversies || []).filter(c => c.verified && (!c.year || Number(c.year) >= new Date().getFullYear() - 3)).length;
  const penalty = Math.min(2, recent * 0.5);
  const overall = Math.max(1, Math.round((t / w - penalty) * 10) / 10);
  const raters = (r.thirdParty || []).filter(x => x.verified).length;
  const confidence = evidenced >= 4 && raters >= 1 ? "High" : evidenced >= 2 ? "Medium" : "Low";
  return { overall, penalty, evidenced, raters, confidence };
}

// ---------- Cost new vs bought for ----------
export function saving(item) {
  const paid = Number(item?.price_paid), rrp = Number(item?.rrp);
  if (!rrp || !Number.isFinite(paid) || item?.price_paid == null) return null;
  return { paid, rrp, amount: rrp - paid, pct: Math.round((1 - paid / rrp) * 100), estimated: !!item.rrp_estimated };
}
