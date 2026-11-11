// #6 Before you buy: duplicates, outfits unlocked, projected cost per wear
import { handler, loadWardrobe, itemLine, cleanIds } from "../_lib/http.js";
import { indexById, realId } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { TERMS } from "../_lib/style.js";

export default handler(async ({ description, price, image, fit }, { db }) => {
  if (!description && !image) throw httpError(400, "Describe the piece or add a photo");
  const items = await loadWardrobe(db);
  const byId = indexById(items);
  const { data: wears } = await db.from("wears").select("item_id");
  const counts = {};
  (wears || []).forEach(w => { counts[w.item_id] = (counts[w.item_id] || 0) + 1; });

  const { data } = await askJSON({
    system: `You are a candid personal shopper whose job is to stop unnecessary purchases. You are not a salesperson.
Default to scepticism: a purchase must earn a 'buy'. Near-duplicates are the most common mistake.
${TERMS}`,
    images: image ? [image] : [],
    prompt: `Considering: ${description || "see image"}${price ? ", £" + price : ""}
${fit ? "Fit check against the owner's reference measurements: " + fit + "\nTreat 'Unlikely to fit' as a strong reason to skip, and include alteration cost in value." : ""}
Current wardrobe (with how often each has been worn):
${items.map(i => itemLine(i) + ` | worn ${counts[i.id] || 0}x`).join("\n") || "(empty)"}
Return:
{"duplicates":[{"itemId":"id","why":"how it overlaps"}],
 "pairsWith":["ids it would genuinely work with"],
 "newOutfits":int (distinct sensible outfits it unlocks that aren't possible today),
 "fillsGap":"what gap it fills, or empty",
 "expectedWearsPerYear":int,
 "verdict":"buy" | "wait" | "skip",
 "reasoning":"two or three plain sentences",
 "ifBuying":"what to check on the actual garment before paying"}`,
    maxTokens: 1000,
  });
  data.duplicates = (data.duplicates || []).filter(d => byId[d.itemId]).map(d => ({ ...d, itemId: realId(d.itemId, byId) }));
  data.pairsWith = cleanIds(data.pairsWith, byId);
  const per = Number(data.expectedWearsPerYear) || 0;
  data.cpwOneYear = price && per ? Number(price) / per : null;
  data.cpwThreeYears = price && per ? Number(price) / (per * 3) : null;
  return data;
});
