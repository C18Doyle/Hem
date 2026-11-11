// Check one wishlist item now (the same logic as the daily job, on demand)
import { handler } from "./_lib/http.js";
import { httpError } from "./_lib/claude.js";
import { checkWishlist } from "./_lib/alerts.js";

export default handler(async ({ id }, { db, user }) => {
  const { data: w } = await db.from("wishlist").select("*").eq("id", id).single();
  if (!w) throw httpError(404, "Not found");
  const { data: settings } = await db.from("settings").select("*").eq("user_id", user.id).maybeSingle();
  const { item, results } = await checkWishlist(db, w, { email: user.email, settings });
  return { item, results: results.slice(0, 6) };
});
