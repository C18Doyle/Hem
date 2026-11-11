// Automatic gap flags: rule-based, free, recalculated whenever your data changes.
// Each flag must rest on evidence in your own data. The stylist analysis (Wardrobe gaps) goes deeper.
import { goesWith } from "./pairs.js";

const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const seasonNow = () => { const m = new Date().getMonth(); return m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn"; };
const ROLE = { Outerwear: "Coats and jackets", Shoes: "Shoes", Trousers: "Trousers", Denim: "Trousers", Knitwear: "Knitwear" };

export function gapFlags({ items, wearLog, conditions, wears, rejects = {} }) {
  const live = items.filter(i => !i.retired);
  const flags = [];
  const s = seasonNow();
  const inSeason = i => !i.seasons?.length || i.seasons.includes(s);

  // Overworked: one piece carries most of a role's wear over the last 30 days
  const recent = wearLog.filter(w => w.worn_on >= daysAgo(30));
  const byRole = {};
  recent.forEach(w => { const i = live.find(x => x.id === w.item_id); const r = i && ROLE[i.category]; if (r) ((byRole[r] ||= {})[i.id] = (byRole[r][i.id] || 0) + 1); });
  Object.entries(byRole).forEach(([role, counts]) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const [topId, top] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const options = live.filter(i => ROLE[i.category] === role && inSeason(i)).length;
    if (total >= 10 && top / total >= 0.7 && options <= 2) {
      const it = live.find(x => x.id === topId);
      flags.push({ key: `over-${topId}`, type: "Overworked", itemId: topId, text: `${it.name}: ${Math.round(top / total * 100)}% of your ${role.toLowerCase()} wear this month, ${options === 1 ? "with no alternative" : "with one alternative"} in season.` });
    }
  });

  // Wearing out: well-worn and in poor condition
  live.forEach(i => {
    const c = conditions[i.id];
    if (c && c.rating <= 2 && (wears[i.id] || 0) >= 10)
      flags.push({ key: `worn-${i.id}-${c.noted_on}`, type: "Wearing out", itemId: i.id, text: `${i.name}: rated ${c.rating}/5 after ${wears[i.id]} wears${c.issues?.length ? ` (${c.issues.join(", ").toLowerCase()})` : ""}. Repair or replace.` });
  });

  // Can't dress for it
  if (["autumn", "winter"].includes(s) && live.length >= 8 && !live.some(i => i.category === "Outerwear" && (i.warmth || 0) >= 4))
    flags.push({ key: `cold-${s}`, type: "Can’t dress for it", text: "No warm coat recorded for " + s + "." });
  if (live.some(i => i.category === "Tailoring") && !live.some(i => i.category === "Shoes" && (i.formality || 0) >= 4))
    flags.push({ key: "formal-shoes", type: "Can’t dress for it", text: "Tailoring, but no shoes formal enough for it." });

  // Repeated rejections for the same reason
  Object.entries(rejects).forEach(([reason, n]) => {
    if (n >= 3 && ["Wrong for the weather", "Too formal", "Too casual"].includes(reason))
      flags.push({ key: `rej-${reason}`, type: "Repeated rejections", text: `${n} outfits rejected as “${reason.toLowerCase()}” in 60 days.` });
  });

  // Stranded: owned a month, a top with no bottom (or vice versa) that works with it
  const month = new Date(Date.now() - 30 * 864e5).toISOString();
  live.filter(i => (i.created_at || "") < month && ["Tops", "Shirts", "Knitwear", "Trousers", "Denim", "Skirts"].includes(i.category)).forEach(i => {
    const g = Object.fromEntries(goesWith(i, live));
    const need = ["Trousers", "Denim", "Skirts"].includes(i.category) ? "Tops" : "Bottoms";
    if (!g[need]?.length && !(wears[i.id] > 2))
      flags.push({ key: `strand-${i.id}`, type: "Stranded", itemId: i.id, text: `${i.name}: no ${need.toLowerCase()} you own go with it.` });
  });
  return flags;
}

// Dismissed flags stay hidden for 30 days
const KEY = "hem.dismissed";
export function dismissed() { try { const d = JSON.parse(localStorage.getItem(KEY) || "{}"); const now = Date.now(); return Object.fromEntries(Object.entries(d).filter(([, t]) => now - t < 30 * 864e5)); } catch { return {}; } }
export function dismiss(key) { try { const d = dismissed(); d[key] = Date.now(); localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }
export function undismiss(key) { try { const d = dismissed(); delete d[key]; localStorage.setItem(KEY, JSON.stringify(d)); } catch {} }
