// What goes with this piece? Owned items, grouped by role, with reasons. Never suggests buying.
import { handler, loadWardrobe, itemLine, cleanIds } from "../_lib/http.js";
import { indexById, realId } from "../_lib/http.js";
import { askJSON, httpError } from "../_lib/claude.js";
import { STYLIST } from "../_lib/style.js";

export default handler(async ({ itemId, anchorText, anchorImage }, { db }) => {
  const items = await loadWardrobe(db);
  const byId = indexById(items);
  const anchor = itemId ? byId[itemId] : null;
  if (!anchor && !anchorText && !anchorImage) throw httpError(400, "Choose a piece or describe one");
  const others = items.filter(i => i.id !== anchor?.id);
  if (others.length < 2) throw httpError(400, "Add a few more pieces first");

  const { data } = await askJSON({
    system: `${STYLIST}
Answer one question: which pieces the owner ALREADY has go with this one. Do not suggest buying anything.
Be selective: a piece that merely 'works' is not a pairing. Name the reason (tone, texture, proportion, formality).
If almost nothing they own suits it, say so plainly; that is useful to know before buying.`,
    images: anchorImage ? [anchorImage] : [],
    prompt: `The piece: ${anchor ? itemLine(anchor) : anchorText || "see image"}
Their wardrobe:
${others.map(itemLine).join("\n")}
Return:
{"pairs":[{"itemId":"id","reason":"short reason in technical terms","strength":"strong" | "good"}],
 "bestLook":{"itemIds":["3-4 ids that make the single best outfit with it"],"why":"one sentence"},
 "avoid":[{"itemId":"id","reason":"why it clashes"}],
 "verdict":"one sentence: how well it fits this wardrobe overall"}`,
    maxTokens: 1500,
    fast: true,
  });
  data.pairs = (data.pairs || []).filter(p => byId[p.itemId]).map(p => ({ ...p, itemId: realId(p.itemId, byId) })).filter(p => p.itemId !== anchor?.id);
  data.avoid = (data.avoid || []).filter(p => byId[p.itemId]).map(p => ({ ...p, itemId: realId(p.itemId, byId) }));
  if (data.bestLook) data.bestLook.itemIds = cleanIds(data.bestLook.itemIds, byId);
  return data;
});
