// One serverless function for every /api/<name> endpoint (Vercel Hobby allows 12 functions).
// The endpoints live in api/_routes; folders starting with _ aren't deployed as functions.
import brand from "./_routes/brand.js";
import detect from "./_routes/detect.js";
import news from "./_routes/news.js";
import outfits from "./_routes/outfits.js";
import pairings from "./_routes/pairings.js";
import precheck from "./_routes/precheck.js";
import quality from "./_routes/quality.js";
import rescue from "./_routes/rescue.js";
import review from "./_routes/review.js";
import rrp from "./_routes/rrp.js";
import search from "./_routes/search.js";
import suggest from "./_routes/suggest.js";
import tag from "./_routes/tag.js";
import today from "./_routes/today.js";
import wishlist_check from "./_routes/wishlist-check.js";

const ROUTES = { "brand": brand, "detect": detect, "news": news, "outfits": outfits, "pairings": pairings, "precheck": precheck, "quality": quality, "rescue": rescue, "review": review, "rrp": rrp, "search": search, "suggest": suggest, "tag": tag, "today": today, "wishlist-check": wishlist_check };

export default async function handler(req, res) {
  const name = String(req.query.route || "");
  const fn = ROUTES[name];
  if (!fn) return res.status(404).json({ error: "Not found" });
  return fn(req, res);
}
