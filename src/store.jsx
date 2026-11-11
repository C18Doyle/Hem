import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { versatility } from "./lib/versatility.js";
import { gapFlags } from "./lib/gaps.js";
import { supabase } from "./supabase.js";
import { todayIso } from "./lib/dates.js";
import { brandKey } from "./lib/quality.js";
import { useUi } from "./components/UiProvider.jsx";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ user, children }) {
  const [state, setState] = useState({ items: [], urls: {}, wears: {}, lastWorn: {}, conditions: {}, wearLog: [], brands: {}, body: {}, rejects: {}, alerts: 0, due: [], loading: true, error: "" });

  const refresh = useCallback(async () => {
    const [it, we, co, wl, br, bm, rj, cl] = await Promise.all([
      supabase.from("items").select("*").order("created_at", { ascending: false }),
      supabase.from("wears").select("id,item_id,worn_on"),
      supabase.from("conditions").select("*").order("noted_on", { ascending: false }),
      supabase.from("wishlist").select("id").eq("alert", true),
      supabase.from("brand_ratings").select("*"),
      supabase.from("body_measurements").select("data").maybeSingle(),
      supabase.from("outfits").select("reject_reason").eq("status", "rejected").gte("created_at", new Date(Date.now() - 60 * 864e5).toISOString()),
      supabase.from("care_logs").select("*").eq("kind", "reminder").is("done_on", null).lte("due_on", new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)),
    ]);
    if (it.error) return setState(s => ({ ...s, loading: false, error: it.error.message }));
    const items = it.data || [];
    const paths = items.map(i => i.photo_path).filter(Boolean);
    const urls = {};
    if (paths.length) {
      const { data } = await supabase.storage.from("wardrobe").createSignedUrls(paths, 3600 * 12);
      (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; });
    }
    const wears = {}, lastWorn = {};
    (we.data || []).forEach(w => {
      wears[w.item_id] = (wears[w.item_id] || 0) + 1;
      if (!lastWorn[w.item_id] || w.worn_on > lastWorn[w.item_id]) lastWorn[w.item_id] = w.worn_on;
    });
    const conditions = {};
    (co.data || []).forEach(c => { conditions[c.item_id] ||= c; });
    setState({ items, urls, wears, lastWorn, conditions, wearLog: we.data || [], brands: Object.fromEntries((br.data || []).map(b => [b.brand_key, b])), body: bm.data?.data || {}, rejects: (rj.data || []).reduce((m, o) => { if (o.reject_reason) m[o.reject_reason] = (m[o.reject_reason] || 0) + 1; return m; }, {}), alerts: (wl.data || []).length, due: cl.data || [], loading: false, error: "" });
  }, []);

  useEffect(() => { refresh(); }, [refresh, user?.id]);

  const brandFor = useCallback(name => (name ? state.brands[brandKey(name)] || null : null), [state.brands]);
  const vers = useMemo(() => versatility(state.items, state.wearLog), [state.items, state.wearLog]);
  const flags = useMemo(() => state.loading ? [] : gapFlags({ items: state.items, wearLog: state.wearLog, conditions: state.conditions, wears: state.wears, rejects: state.rejects }), [state]);
  const photo = useCallback(i => (i?.photo_path ? state.urls[i.photo_path] : null), [state.urls]);
  const byId = Object.fromEntries(state.items.map(i => [i.id, i]));

  /** Log a wear for several items at once (e.g. an outfit). */
  const ui = useUi();
  /** Logs wears instantly (optimistic), then saves; offers Undo. */
  const logWear = useCallback(async (itemIds, outfitId = null, { day, quiet } = {}) => {
    const d = day || todayIso();
    const temp = itemIds.map(item_id => ({ id: "tmp-" + item_id + d, item_id, worn_on: d }));
    setState(s => {
      const wears = { ...s.wears }, lastWorn = { ...s.lastWorn };
      itemIds.forEach(id => { wears[id] = (wears[id] || 0) + 1; if (!lastWorn[id] || d > lastWorn[id]) lastWorn[id] = d; });
      return { ...s, wears, lastWorn, wearLog: [...s.wearLog, ...temp] };
    });
    const { data, error } = await supabase.from("wears").insert(itemIds.map(item_id => ({ item_id, worn_on: d, outfit_id: outfitId }))).select("id");
    if (error) { await refresh(); ui?.toast("Couldn’t log that. Try again."); throw error; }
    if (outfitId) await supabase.from("outfits").update({ status: "worn" }).eq("id", outfitId);
    refresh();
    if (!quiet) ui?.toast(itemIds.length === 1 ? "Logged as worn" : `Logged ${itemIds.length} pieces as worn`, {
      undo: async () => {
        await supabase.from("wears").delete().in("id", data.map(r => r.id));
        if (outfitId) await supabase.from("outfits").update({ status: "suggested" }).eq("id", outfitId);
        await refresh();
      },
    });
    return data;
  }, [refresh, ui]);

  return <Ctx.Provider value={{ ...state, user, byId, photo, brandFor, vers, flags, refresh, logWear, ui }}>{children}</Ctx.Provider>;
}
