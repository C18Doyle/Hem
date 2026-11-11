// Batch entry: find each garment in one photo (a rail, a bed, a flat lay) and return crop boxes + tags.
import { handler } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { TERMS } from "../_lib/style.js";
import { CATEGORIES } from "./tag.js";

export default handler(async ({ image }) => {
  if (!image) throw httpError(400, "Add a photo");
  const { data } = await askJSON({
    system: `You catalogue clothing from photos for a private wardrobe app. Never guess a brand unless a label or logo is visible.\n${TERMS}`,
    images: [image],
    temperature: 0,
    prompt: `This photo shows several garments. Find each separate garment (ignore hangers, furniture, people's faces).
For each, give a bounding box as fractions of the image width and height: x and y of the top-left corner, then width and height, all between 0 and 1. Make boxes generous rather than tight.
Return {"items":[{"box":[x,y,w,h],
 "name":"short precise name", "category":one of ${JSON.stringify(CATEGORIES)},
 "brand":"visible brand or null", "colours":["main first"], "material":"cloth as it appears",
 "fit":"cut", "formality":1-5, "warmth":1-5, "seasons":["..."], "description":"one sentence"}]}
Maximum 12 items. If you are unsure something is a separate garment, leave it out.`,
    maxTokens: 2500,
  });
  const ok = b => Array.isArray(b) && b.length === 4 && b.every(n => Number.isFinite(Number(n)));
  const items = (data.items || []).filter(i => ok(i.box)).map(i => {
    let [x, y, w, h] = i.box.map(Number);
    // Clamp and pad by 4% so a slightly-off box still contains the garment
    const pad = 0.04;
    x = Math.max(0, x - pad); y = Math.max(0, y - pad);
    w = Math.min(1 - x, w + pad * 2); h = Math.min(1 - y, h + pad * 2);
    return { ...i, box: [x, y, w, h], category: CATEGORIES.includes(i.category) ? i.category : "Tops" };
  }).filter(i => i.box[2] > 0.05 && i.box[3] > 0.05);
  return { items };
});
