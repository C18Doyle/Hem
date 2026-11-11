// #9 Wishlist price checks: record history, decide on an alert, email once per new low.
import { findPrices } from "./prices.js";

export async function checkWishlist(db, w, opts = {}) {
  const { results } = await findPrices(w.query, `Must be: ${w.name}`);
  return applyPriceResults(db, w, results, opts);
}

/** Records a price check's results and decides on an alert (used live and by overnight batches). */
export async function applyPriceResults(db, w, results, { email, settings } = {}) {
  const best = results.filter(r => typeof r.price === "number").sort((a, b) => a.price - b.price)[0];
  const patch = { last_checked: new Date().toISOString() };
  if (!best) { await db.from("wishlist").update(patch).eq("id", w.id); return { item: { ...w, ...patch }, results }; }

  await db.from("price_history").insert({ user_id: w.user_id, wishlist_id: w.id, price: best.price, retailer: best.retailer, url: best.url });
  const { data: first } = await db.from("price_history").select("price").eq("wishlist_id", w.id).order("checked_at").limit(1).maybeSingle();
  const baseline = Number(first?.price ?? w.last_price ?? best.price);
  const dropPct = baseline ? Math.round((1 - best.price / baseline) * 100) : 0;
  const pct = Number(settings?.alert_drop_pct ?? 15);

  const reasons = [];
  if (w.target_price && best.price <= Number(w.target_price)) reasons.push(`at or below your £${Number(w.target_price).toFixed(0)} target`);
  if (dropPct >= pct) reasons.push(`${dropPct}% below where it started`);
  Object.assign(patch, {
    last_price: best.price, last_url: best.url, last_retailer: best.retailer,
    lowest_price: Math.min(Number(w.lowest_price ?? Infinity), best.price),
    alert: reasons.length > 0, alert_reason: reasons.join(" and ") || null,
  });

  const newLow = reasons.length && (w.notified_price == null || best.price < Number(w.notified_price));
  if (newLow && email && settings?.email_alerts !== false && process.env.RESEND_API_KEY && process.env.ALERT_FROM) {
    const ok = await sendEmail(email, `Price drop: ${w.name}, now £${best.price.toFixed(2)}`,
      `<div style="font-family:Georgia,serif;max-width:520px">
        <p style="font-size:13px;color:#777;margin:0">Hem price alert</p>
        <h1 style="font-weight:400;font-size:26px;margin:8px 0">${esc(w.name)}</h1>
        <p style="font-size:18px">£${best.price.toFixed(2)} at ${esc(best.retailer || "a retailer")}, ${esc(patch.alert_reason)}.</p>
        <p><a href="${esc(best.url)}" style="color:#000">View the listing</a></p>
        <p style="font-size:13px;color:#777">Before buying, run it through “Before you buy” in Hem.</p></div>`);
    if (ok) patch.notified_price = best.price;
  }
  const { data: row } = await db.from("wishlist").update(patch).eq("id", w.id).select().single();
  return { item: row || { ...w, ...patch }, results };
}

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function sendEmail(to, subject, html) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.ALERT_FROM, to, subject, html }),
    });
    if (!r.ok) console.error("resend", r.status, await r.text());
    return r.ok;
  } catch (e) { console.error("resend", e.message); return false; }
}
