// #3 Versatility: how many plausible outfits each piece makes. Rule-based: free, instant, repeatable.
const NEUTRAL = /\b(black|white|ecru|cream|off-?white|ivory|oat|oatmeal|beige|camel|tan|stone|sand|taupe|grey|gray|charcoal|navy|midnight|denim|indigo|brown|chocolate|khaki|olive|bone|ink)\b/i;
const ROLE = c => ({ Tops: "top", Knitwear: "top", Shirts: "top", Dresses: "dress", Trousers: "bottom", Denim: "bottom", Skirts: "bottom", Shoes: "shoes", Outerwear: "layer", Tailoring: "layer" }[c] || "extra");

const colourOk = (a, b) => {
  const ca = (a.colours?.[0] || "").toLowerCase(), cb = (b.colours?.[0] || "").toLowerCase();
  if (!ca || !cb) return true;
  if (NEUTRAL.test(ca) || NEUTRAL.test(cb)) return true;
  return ca === cb; // two statement colours only pair tonally
};
const formalOk = (a, b) => !a.formality || !b.formality || Math.abs(a.formality - b.formality) <= 1;
const seasonOk = (a, b) => !a.seasons?.length || !b.seasons?.length || a.seasons.some(s => b.seasons.includes(s));
export const compatible = (a, b) => a.id !== b.id && colourOk(a, b) && formalOk(a, b) && seasonOk(a, b);

/** Returns { [itemId]: { outfits, wornWith, score } } */
export function versatility(items, wearLog = []) {
  const live = items.filter(i => !i.retired);
  const by = r => live.filter(i => ROLE(i.category) === r);
  const tops = by("top"), bottoms = by("bottom"), dresses = by("dress"), shoes = by("shoes"), layers = by("layer"), extras = by("extra");
  const allOk = arr => arr.every((x, i) => arr.every((y, j) => i === j || compatible(x, y)));

  // Base outfits: top + bottom (+ shoes if you own any), or dress (+ shoes)
  const bases = [];
  const withShoes = combo => shoes.length ? shoes.filter(s => allOk([...combo, s])).map(s => [...combo, s]) : [combo];
  tops.forEach(t => bottoms.forEach(b => { if (compatible(t, b)) bases.push(...withShoes([t, b])); }));
  dresses.forEach(d => bases.push(...withShoes([d])));

  const count = {};
  live.forEach(i => (count[i.id] = 0));
  bases.forEach(o => o.forEach(i => count[i.id]++));
  // Layers and extras: how many base outfits they sit well with
  [...layers, ...extras].forEach(l => { count[l.id] = bases.filter(o => allOk([...o, l])).length; });

  // Real pairings from the wear log: distinct pieces worn on the same day
  const days = {};
  wearLog.forEach(w => (days[w.worn_on] ||= new Set()).add(w.item_id));
  const pairs = {};
  Object.values(days).forEach(set => set.forEach(a => set.forEach(b => { if (a !== b) (pairs[a] ||= new Set()).add(b); })));

  const max = Math.max(1, ...Object.values(count));
  const out = {};
  live.forEach(i => {
    out[i.id] = { outfits: count[i.id], wornWith: pairs[i.id]?.size || 0, score: Math.round((count[i.id] / max) * 100) / 10 };
  });
  return out;
}
