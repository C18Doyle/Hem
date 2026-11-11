// Condition tags, in the grading language resale sites use. Stored as 1-5 check-ins (conditions table).
export const CONDITION = [
  { rating: 5, label: "Like new", hint: "No visible wear; could pass as unworn" },
  { rating: 4, label: "Very good", hint: "Light signs of wear only up close" },
  { rating: 3, label: "Good", hint: "Some wear: light pilling, softening, slight fading" },
  { rating: 2, label: "Fair", hint: "Obvious wear or a flaw that needs repair" },
  { rating: 1, label: "Worn out", hint: "Past repair, or not worth repairing" },
];
export const labelOf = r => CONDITION.find(c => c.rating === Number(r))?.label || "";

/** Current condition of a piece, and whether it's due a re-check (90 days or 20 wears since). */
export function conditionOf(item, conditions, wearLog, wears) {
  const c = conditions[item.id];
  if (!c) return { label: (wears[item.id] || 0) === 0 ? "Unworn" : "Not checked", rating: null, due: (wears[item.id] || 0) >= 10 };
  const since = wearLog.filter(w => w.item_id === item.id && w.worn_on > c.noted_on).length;
  const days = (Date.now() - new Date(c.noted_on).getTime()) / 864e5;
  return { label: labelOf(c.rating), rating: c.rating, issues: c.issues || [], noted: c.noted_on, since, due: since >= 20 || days > 90 };
}
