import { createClient } from "@supabase/supabase-js";
import { httpError, meter, costGbp } from "./claude.js";

/** Verifies the caller's Supabase session and returns a client that acts as them (RLS applies). */
export async function requireUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpError(401, "Sign in first");
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw httpError(401, "Session expired. Sign in again.");
  return { user: data.user, db };
}

const NO_AI = new Set(["news"]);

/** Spend so far this calendar month, and the cap. */
export async function budget(db, userId) {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const [{ data: rows }, { data: st }] = await Promise.all([
    db.from("api_usage").select("cost_gbp").eq("user_id", userId).gte("at", start.toISOString()),
    db.from("settings").select("monthly_cap_gbp").eq("user_id", userId).maybeSingle(),
  ]);
  const spent = (rows || []).reduce((t, r) => t + Number(r.cost_gbp || 0), 0);
  return { spent, cap: Number(st?.monthly_cap_gbp ?? process.env.DEFAULT_MONTHLY_CAP_GBP ?? 10) };
}

/** Writes metered usage rows. Works with a user-scoped client or the service role (pass userId). */
export async function recordUsage(db, userId, endpoint, usage) {
  if (!usage?.length) return;
  const rows = usage.map(u => ({ user_id: userId, endpoint, model: u.model, input_tokens: u.input_tokens, output_tokens: u.output_tokens, web_searches: u.web_searches, cost_gbp: costGbp(u.model, u) }));
  const { error } = await db.from("api_usage").insert(rows);
  if (error) console.error("usage", error.message);
}

export async function logError(db, userId, source, message, detail) {
  try { await db.from("error_log").insert({ user_id: userId, source, message: String(message).slice(0, 1000), detail: detail || null }); } catch {}
}

export function handler(fn) {
  return async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const endpoint = (req.url || "").split("?")[0].replace(/^\/api\//, "") || "unknown";
    let ctx = null;
    const usage = [];
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      ctx = await requireUser(req);
      if (!NO_AI.has(endpoint)) {
        const { spent, cap } = await budget(ctx.db, ctx.user.id);
        if (spent >= cap) throw httpError(402, `This month’s AI budget of £${cap.toFixed(2)} is used up. Raise it in Settings, or wait until the 1st.`);
      }
      usage.endpoint = endpoint;
      const out = await meter.run(usage, () => fn(body, ctx, req));
      res.status(200).json(out);
    } catch (e) {
      console.error(endpoint, e);
      if (ctx && e.status !== 402) await logError(ctx.db, ctx.user.id, "api:" + endpoint, e.message, { status: e.status || 500 });
      res.status(e.status || 500).json({ error: e.status ? e.message : "Something went wrong. It’s been logged in Settings." });
    } finally {
      if (ctx) await recordUsage(ctx.db, ctx.user.id, endpoint, usage);
    }
  };
}

/** Compact one-line summaries of the wardrobe for prompts. */
export function itemLine(i) {
  return [
    i.sid || i.id, i.name, i.category,
    i.colours?.length ? "colours: " + i.colours.join("/") : "",
    i.material ? "material: " + i.material : "",
    i.formality ? "formality " + i.formality + "/5" : "",
    i.warmth ? "warmth " + i.warmth + "/5" : "",
    i.seasons?.length ? "seasons: " + i.seasons.join("/") : "",
    i.description || "",
  ].filter(Boolean).join(" | ");
}

export async function loadWardrobe(db) {
  const { data, error } = await db.from("items").select("*").eq("retired", false).order("created_at");
  if (error) throw httpError(500, error.message);
  // Short ids (p1, p2…) in prompts instead of 36-character UUIDs: ~20 fewer tokens per piece per call
  return (data || []).map((i, k) => ({ ...i, sid: "p" + (k + 1) }));
}

/** Lookup by real id and by short id. */
export const indexById = items => Object.fromEntries(items.flatMap(i => [[i.id, i], ...(i.sid ? [[i.sid, i]] : [])]));
export const realId = (x, byId) => byId[x]?.id || null;

/** Recent outfit feedback so suggestions learn taste. */
export async function loadFeedback(db) {
  const { data } = await db.from("outfits").select("title,item_ids,status,reject_reason,why")
    .in("status", ["saved", "rejected", "worn"]).order("created_at", { ascending: false }).limit(40);
  const liked = (data || []).filter(o => o.status !== "rejected");
  const disliked = (data || []).filter(o => o.status === "rejected");
  return { liked, disliked };
}

export function feedbackText({ liked, disliked }, byId) {
  const names = ids => (ids || []).map(id => byId[id]?.name).filter(Boolean).join(" + ");
  const l = liked.slice(0, 15).map(o => `- liked (${o.status}): ${names(o.item_ids)}`).join("\n");
  const d = disliked.slice(0, 15).map(o => `- rejected${o.reject_reason ? " because " + o.reject_reason : ""}: ${names(o.item_ids)}`).join("\n");
  return (l || d) ? `Taste so far:\n${l}\n${d}` : "No feedback yet.";
}

/** Keep only ids that really exist in the wardrobe. */
export function cleanIds(ids, byId) { return [...new Set((ids || []).map(id => byId[id]?.id).filter(Boolean))]; }
