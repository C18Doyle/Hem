// #8 Suggestion for the day: weather + plans + what you've worn recently + taste
import { handler, loadWardrobe, loadFeedback, feedbackText, itemLine, cleanIds } from "./_lib/http.js";
import { indexById, realId } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { STYLIST } from "./_lib/style.js";

export default handler(async ({ weather, plans, exclude = [] }, { db }) => {
  const items = await loadWardrobe(db);
  if (items.length < 3) throw httpError(400, "Add at least three pieces to your wardrobe first");
  const byId = indexById(items);
  const since = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  const { data: wears } = await db.from("wears").select("item_id,worn_on").gte("worn_on", since);
  const recent = {};
  (wears || []).forEach(w => { recent[w.item_id] = (recent[w.item_id] || 0) + 1; });
  const fb = feedbackText(await loadFeedback(db), byId);

  const { data } = await askJSON({
    system: STYLIST,
    prompt: `Choose today's outfit.
Weather: ${weather ? `${weather.summary}; ${weather.min}°C to ${weather.max}°C; feels like ${weather.feels}°C; rain chance ${weather.rain}%; wind ${weather.wind} km/h` : "unknown, assume a mild UK day"}
Plans: ${plans || "an ordinary day"}
Wardrobe:
${items.map(i => itemLine(i) + (recent[i.id] ? ` | worn ${recent[i.id]}x in last 10 days` : "")).join("\n")}
${fb}
${exclude.length ? "Do not repeat this combination, it was just rejected: " + exclude.map(id => byId[id]?.name).filter(Boolean).join(" + ") : ""}
Rules: dress for the weather (warmth scores, rain), avoid pieces worn in the last 2-3 days unless they are shoes or outerwear, include shoes if the wardrobe has any, and outerwear when it's below about 14°C or wet.
Return {"title":"short title","itemIds":["ids"],"why":"two sentences: why this works today","weatherNote":"one practical note, e.g. umbrella, or empty"}`,
    maxTokens: 900,
    fast: true,
  });

  const ids = cleanIds(data.itemIds, byId);
  if (!ids.length) throw httpError(502, "No outfit came back. Try again.");
  const { data: row, error } = await db.from("outfits").insert({
    title: data.title, why: data.why, occasion: plans || "Today", item_ids: ids, source: "today",
  }).select().single();
  if (error) throw httpError(500, error.message);
  return { outfit: row, weatherNote: data.weatherNote || "" };
});
