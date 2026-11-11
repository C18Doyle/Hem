// #5 Outfits that learn from feedback
import { handler, loadWardrobe, loadFeedback, feedbackText, itemLine, cleanIds } from "../_lib/http.js";
import { indexById, realId } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { STYLIST } from "../_lib/style.js";

export default handler(async ({ anchorId, anchorText, anchorImage, occasion, mix = "mine" }, { db }) => {
  const items = await loadWardrobe(db);
  const byId = indexById(items);
  const anchor = anchorId ? byId[anchorId] : null;
  if (!anchor && !anchorText && !anchorImage) throw httpError(400, "Choose a piece or describe one");
  if (mix === "mine" && items.length < 3) throw httpError(400, "Add at least three pieces, or allow new ideas");
  const fb = feedbackText(await loadFeedback(db), byId);

  const { data } = await askJSON({
    system: STYLIST,
    images: anchorImage ? [anchorImage] : [],
    prompt: `Build 4 distinct outfits around the anchor.
Anchor: ${anchor ? "wardrobe item " + itemLine(anchor) : "a new piece: " + (anchorText || "see image")}
Occasion: ${occasion || "a range: work, evening, weekend, travel"}
Wardrobe:
${items.map(itemLine).join("\n") || "(empty)"}
${fb}
Lean toward combinations like those liked, and away from the reasons given for rejections.
${mix === "mine" ? "Use only wardrobe items. If the wardrobe can't make a sensible outfit, say so in 'gap'." : "Prefer wardrobe items; you may add up to 2 new pieces per outfit, described generically."}
Return:
{"outfits":[{"title":"short title","occasion":"...","itemIds":["wardrobe ids, excluding the anchor"],"suggested":[{"label":"generic new piece"}],"why":"one or two sentences"}],
 "gap":"the single purchase that would unlock most new outfits, or empty"}`,
    maxTokens: 1800,
  });

  const rows = (data.outfits || []).map(o => ({
    title: o.title, occasion: o.occasion, why: o.why, source: "style",
    item_ids: [...(anchor ? [anchor.id] : []), ...cleanIds(o.itemIds, byId).filter(id => id !== anchor?.id)],
    suggested: [...(anchor ? [] : [{ label: anchorText || "Your new piece", anchor: true }]), ...(mix === "mine" ? [] : (o.suggested || []).slice(0, 2))],
  }));
  const { data: saved, error } = await db.from("outfits").insert(rows).select();
  if (error) throw httpError(500, error.message);
  return { outfits: saved, gap: data.gap || "" };
});
