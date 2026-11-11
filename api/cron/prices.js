// Daily background work (Vercel Cron). Service role, so it must verify CRON_SECRET.
//   default run (07:00): collect finished batches, then submit today's work
//   ?mode=collect (09:00): collect only, so overnight results land the same morning
// With SERPAPI_KEY, wishlist prices come from SerpAPI directly (no Claude cost).
// Without it, wishlist checks go through the Message Batches API automatically:
// half-price tokens, same search fee. Nothing here is a user-facing choice.
import { createClient } from "@supabase/supabase-js";
import { checkWishlist, applyPriceResults } from "../_lib/alerts.js";
import { priceRequest, parsePriceResponse } from "../_lib/prices.js";
import { brandRequest, saveBrand } from "../_lib/brandlib.js";
import { meter, batchParams, submitBatch, batchStatus, batchResults, finalText, parseJSON, usageOf } from "../_lib/claude.js";
import { recordUsage, logError, budget } from "../_lib/http.js";

const MAX_PER_RUN = 40;

/** Base interval, stretched when the price hasn't moved: x2 after 3 identical checks, x4 after 5, max 14 days. */
export function isDue(w, hist, baseHours) {
  if (!w.last_checked) return true;
  const ps = (hist || []).map(h => Number(h.price));
  let same = 0; for (let i = ps.length - 1; i > 0 && ps[i] === ps[i - 1]; i--) same++;
  const factor = same >= 4 ? 4 : same >= 2 ? 2 : 1;
  const hours = Math.min(14 * 24, baseHours * factor);
  return Date.now() - new Date(w.last_checked).getTime() >= hours * 3600e3;
}

export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "unauthorised" });
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const mode = new URL(req.url, "http://x").searchParams.get("mode");
  const users = {};
  const userCtx = async id => {
    if (!users[id]) {
      const [{ data: u }, { data: s }, b] = await Promise.all([db.auth.admin.getUserById(id), db.from("settings").select("*").eq("user_id", id).maybeSingle(), budget(db, id)]);
      users[id] = { email: u?.user?.email, settings: s, overBudget: b.spent >= b.cap };
    }
    return users[id];
  };
  const out = { collected: 0, failed: 0, submitted: 0, serpChecked: 0 };
  try { await collect(db, userCtx, out); } catch (e) { console.error("collect", e); }
  if (mode !== "collect") { try { await submit(db, userCtx, out); } catch (e) { console.error("submit", e); await logError(db, null, "cron", e.message); } }
  res.status(200).json(out);
}

async function collect(db, userCtx, out) {
  const { data: jobs } = await db.from("batch_jobs").select("*").eq("status", "submitted");
  const byBatch = {};
  (jobs || []).forEach(j => (byBatch[j.anthropic_batch_id] ||= []).push(j));
  for (const [batchId, list] of Object.entries(byBatch)) {
    const st = await batchStatus(batchId);
    if (st.processing_status !== "ended") continue;
    const results = Object.fromEntries((await batchResults(st.results_url)).map(r => [r.custom_id, r]));
    for (const job of list) {
      const r = results[job.id];
      const fail = async msg => { await db.from("batch_jobs").update({ status: "failed", error: msg, finished_at: new Date().toISOString() }).eq("id", job.id); out.failed++; };
      if (r?.result?.type !== "succeeded") { await fail(r?.result?.type || "missing"); continue; }
      const msg = r.result.message;
      await recordUsage(db, job.user_id, "batch/" + job.kind, [usageOf(msg, msg.model, true)]);
      try {
        const data = parseJSON(finalText(msg));
        if (job.kind === "wishlist") {
          const { data: w } = await db.from("wishlist").select("*").eq("id", job.ref).maybeSingle();
          if (w) await applyPriceResults(db, w, parsePriceResponse(data, msg), await userCtx(job.user_id));
        } else {
          await saveBrand(db, job.user_id, job.ref, data, msg);
        }
        await db.from("batch_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
        out.collected++;
      } catch (e) { await fail(e.message); await logError(db, job.user_id, "cron", `batch ${job.kind}: ${e.message}`); }
    }
  }
}

async function submit(db, userCtx, out) {
  const serp = !!process.env.SERPAPI_KEY;
  const base = Number(process.env.WISHLIST_CHECK_HOURS || (serp ? 20 : 68));
  const { data: wl } = await db.from("wishlist").select("*").order("last_checked", { ascending: true, nullsFirst: true }).limit(200);
  const ids = (wl || []).map(w => w.id);
  const { data: hist } = ids.length ? await db.from("price_history").select("wishlist_id,price,checked_at").in("wishlist_id", ids).order("checked_at") : { data: [] };
  const h = {}; (hist || []).forEach(p => (h[p.wishlist_id] ||= []).push(p));
  const { data: open } = await db.from("batch_jobs").select("kind,ref,status").in("status", ["queued", "submitted"]);
  const pending = new Set((open || []).map(j => j.kind + ":" + j.ref));
  const due = (wl || []).filter(w => isDue(w, h[w.id], base) && !pending.has("wishlist:" + w.id)).slice(0, MAX_PER_RUN);

  if (serp) {
    // SerpAPI path: cheap and immediate, no batch needed
    for (const w of due) {
      const u = await userCtx(w.user_id);
      const usage = [];
      try { await meter.run(usage, () => checkWishlist(db, w, u)); out.serpChecked++; }
      catch (e) { await logError(db, w.user_id, "cron", e.message, { wishlist: w.id }); }
      finally { await recordUsage(db, w.user_id, "cron/prices", usage); }
    }
  } else if (due.length) {
    await db.from("batch_jobs").insert(due.map(w => ({ user_id: w.user_id, kind: "wishlist", ref: w.id })));
  }

  // All queued wishlist checks go into one batch
  const { data: queued } = await db.from("batch_jobs").select("*").eq("status", "queued").limit(MAX_PER_RUN * 2);
  const requests = [], sent = [];
  const wById = Object.fromEntries((wl || []).map(w => [w.id, w]));
  for (const j of queued || []) {
    if ((await userCtx(j.user_id)).overBudget) continue;
    let params;
    if (j.kind === "wishlist") {
      const w = wById[j.ref]; if (!w) { await db.from("batch_jobs").update({ status: "failed", error: "wishlist item gone" }).eq("id", j.id); continue; }
      params = batchParams(priceRequest(w.query, `Must be: ${w.name}`));
    } else params = batchParams(brandRequest(j.ref).req);
    requests.push({ custom_id: j.id, params }); sent.push(j.id);
  }
  if (!requests.length) return;
  const batch = await submitBatch(requests);
  await db.from("batch_jobs").update({ status: "submitted", anthropic_batch_id: batch.id }).in("id", sent);
  out.submitted = sent.length;
}
