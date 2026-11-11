// #2 Fit check. All measurements in cm, garment laid flat unless stated.
export const GROUP = c => ["Trousers", "Denim", "Skirts"].includes(c) ? "bottom" : c === "Shoes" ? "shoes" : ["Bags", "Accessories"].includes(c) ? null : "top";

export const GARMENT_FIELDS = {
  top: [
    { key: "pit", label: "Pit to pit", how: "Laid flat, straight across from armpit seam to armpit seam" },
    { key: "shoulder", label: "Shoulder", how: "Shoulder seam to shoulder seam, across the back" },
    { key: "length", label: "Back length", how: "Base of the collar to the hem, down the back" },
    { key: "sleeve", label: "Sleeve", how: "Shoulder seam to cuff edge" },
  ],
  bottom: [
    { key: "waist", label: "Waist, flat", how: "Across the top of the waistband, laid flat" },
    { key: "rise", label: "Front rise", how: "Crotch seam to top of the waistband, at the front" },
    { key: "inseam", label: "Inseam", how: "Crotch seam to hem, along the inside leg" },
    { key: "thigh", label: "Thigh, flat", how: "Across the leg, 2.5 cm below the crotch" },
    { key: "opening", label: "Leg opening", how: "Across the hem, laid flat" },
  ],
  shoes: [{ key: "uk", label: "UK size", how: "As labelled" }, { key: "insole", label: "Insole length", how: "Heel to toe, inside" }],
};

export const BODY_FIELDS = [
  { key: "chest", label: "Chest", how: "Around the fullest part, under the arms, tape level" },
  { key: "waist", label: "Waist", how: "Where you wear your trousers, not your natural waist" },
  { key: "hips", label: "Seat", how: "Around the fullest part of the seat" },
  { key: "shoulder", label: "Shoulder width", how: "Across the back, shoulder point to shoulder point" },
  { key: "arm", label: "Arm length", how: "Shoulder point to wrist bone, arm slightly bent" },
  { key: "inseam", label: "Inside leg", how: "Crotch to where you want the hem, shoes on" },
  { key: "neck", label: "Neck", how: "Around the base of the neck, one finger inside the tape" },
  { key: "uk", label: "UK shoe size", how: "" },
];

// Tolerance: [good, slight] in cm. Beyond 'slight' is a real problem.
const TOL = { pit: [1.5, 3], shoulder: [1, 2], length: [2, 4], sleeve: [1.5, 3], waist: [1, 2], rise: [1, 2.5], inseam: [2, 5], thigh: [1.5, 3], opening: [1.5, 3], uk: [0, 0.5], insole: [0.3, 0.6] };

// Can a tailor fix it? Direction is "big" (garment larger than target) or "small".
const FIX = {
  pit: { big: ["Take in the side seams", "moderate", "£20–£45"], small: null },
  shoulder: { big: null, small: null },
  length: { big: ["Shorten the hem", "moderate", "£15–£35"], small: null },
  sleeve: { big: ["Shorten the sleeves", "easy", "£15–£40"], small: ["Let down the sleeves, if there’s cloth turned up inside", "check", "£15–£40"] },
  waist: { big: ["Take in the waist at the centre-back seam", "easy", "£15–£30"], small: ["Let out the centre-back seam, if there’s allowance", "check", "£15–£30"] },
  rise: { big: null, small: null },
  inseam: { big: ["Hem the trousers", "easy", "£10–£25"], small: ["Let down the hem, if there’s cloth turned up", "check", "£10–£25"] },
  thigh: { big: ["Taper the legs", "moderate", "£20–£40"], small: null },
  opening: { big: ["Taper the legs to the hem", "moderate", "£20–£40"], small: null },
  uk: { big: null, small: null }, insole: { big: null, small: null },
};

const n = v => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Target measurements: a well-fitting owned piece, else derived from the body. */
export function target(category, items, body) {
  const g = GROUP(category);
  const ref = items.filter(i => GROUP(i.category) === g && i.fit === "well" && i.measures && Object.values(i.measures).some(v => n(v)))
    .sort((a, b) => (a.category === category ? -1 : 0) - (b.category === category ? -1 : 0))[0];
  if (ref) return { source: "item", ref, m: ref.measures };
  const b = body || {}, m = {};
  if (g === "top" && n(b.chest)) {
    const ease = { Shirts: 12, Knitwear: 10, Tops: 10, Outerwear: 20, Tailoring: 12, Dresses: 8 }[category] ?? 10;
    m.pit = (n(b.chest) + ease) / 2;
    if (n(b.shoulder)) m.shoulder = n(b.shoulder);
    if (n(b.arm)) m.sleeve = n(b.arm);
  }
  if (g === "bottom") { if (n(b.waist)) m.waist = (n(b.waist) + 2) / 2; if (n(b.inseam)) m.inseam = n(b.inseam); }
  if (g === "shoes" && n(b.uk)) m.uk = n(b.uk);
  return Object.keys(m).length ? { source: "body", m } : null;
}

/** Compare a listing's measurements with the target. */
export function fitCheck(category, listing, tgt) {
  const g = GROUP(category);
  if (!g || !tgt) return null;
  const rows = [];
  for (const f of GARMENT_FIELDS[g]) {
    const a = n(listing?.[f.key]), t = n(tgt.m?.[f.key]);
    if (a == null || t == null) continue;
    const d = Math.round((a - t) * 10) / 10, [good, slight] = TOL[f.key];
    const dir = d > 0 ? "big" : "small";
    const level = Math.abs(d) <= good ? "good" : Math.abs(d) <= slight ? "slight" : "off";
    const fix = level === "good" ? null : FIX[f.key]?.[dir] || null;
    rows.push({ key: f.key, label: f.label, diff: d, level, dir, fix });
  }
  if (!rows.length) return { rows, verdict: "Not enough measurements to compare" };
  const breaks = rows.filter(r => r.level === "off" && (!r.fix || r.fix[1] === "check"));
  const fixes = rows.filter(r => r.level !== "good" && r.fix);
  const verdict = breaks.length ? "Unlikely to fit" : fixes.some(r => r.level === "off") ? "Fits with alterations" : rows.some(r => r.level === "slight") ? "Close fit" : "Likely fits";
  return { rows, verdict, fixes, breaks };
}

export const describe = r => r.level === "good" ? "Matches" : `${Math.abs(r.diff)} cm ${r.dir === "big" ? "larger" : "smaller"}`;
