// #2 Structured tags from a photo
import { handler } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { TERMS } from "../_lib/style.js";

export const CATEGORIES = ["Tops","Knitwear","Shirts","Trousers","Denim","Skirts","Dresses","Outerwear","Tailoring","Shoes","Bags","Accessories"];

export default handler(async ({ image, name, notes }) => {
  if (!image) throw httpError(400, "Add a photo first");
  const { data } = await askJSON({
    system: "You catalogue clothing for a private wardrobe app. Be precise and plain. Never guess a brand unless a logo or label is visible.\n" + TERMS,
    images: [image],
    prompt: `Tag this garment. Owner's name for it: ${name || "none"}. Owner's notes: ${notes || "none"}.
Return:
{"name":"short precise name, e.g. Midnight merino crew-neck, 12-gauge",
 "category":one of ${JSON.stringify(CATEGORIES)},
 "brand":"visible brand or null",
 "colours":["main colour first, plain names like navy, oat, charcoal"],
 "pattern":"solid | stripe | check | herringbone | print | other",
 "material":"cloth or construction as it appears, e.g. 'heavyweight cotton twill' or 'fine-gauge merino jersey'",
 "fit":"cut, e.g. slim, regular, relaxed, boxy, oversized, cropped, high-rise tapered, n/a",
 "formality":1-5 (1 loungewear, 3 smart casual, 5 black tie),
 "warmth":1-5 (1 summer weight, 5 heavy winter),
 "seasons":subset of ["spring","summer","autumn","winter"],
 "description":"one sentence a tailor or editor would write: cloth, cut, notable construction details"}`,
    maxTokens: 600,
    fast: true,
  });
  if (!CATEGORIES.includes(data.category)) data.category = "Tops";
  return data;
});
