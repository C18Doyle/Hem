// Research a brand or manufacturer's sustainability from public sources, with citations.
import { handler } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { brandKey } from "../src/lib/quality.js";
import { brandRequest, saveBrand } from "./_lib/brandlib.js";

const FRESH_DAYS = 180;

export default handler(async ({ name, refresh = false }, { db, user }) => {
  if (!String(name || "").trim()) throw httpError(400, "Enter a brand or manufacturer");
  const { clean, req } = brandRequest(name);
  const { data: cached } = await db.from("brand_ratings").select("*").eq("brand_key", brandKey(clean)).maybeSingle();
  if (cached && !refresh && Date.now() - new Date(cached.assessed_at) < FRESH_DAYS * 864e5) return cached;

  const { data, resp } = await askJSON(req);
  return saveBrand(db, user.id, clean, data, resp);
});
