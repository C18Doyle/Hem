import { Chips, Seg } from "./Ui.jsx";
import { ACQUIRED } from "../lib/quality.js";
import { DIRECTORY, canonical } from "../lib/brands.js";
import { useStore } from "../store.jsx";
import { useState } from "react";
import { post } from "../api.js";

export const CATEGORIES = ["Tops","Knitwear","Shirts","Trousers","Denim","Skirts","Dresses","Outerwear","Tailoring","Shoes","Bags","Accessories"];
export const SEASONS = ["spring","summer","autumn","winter"];
const FORMALITY = ["Lounge","Casual","Smart casual","Smart","Formal"];
const WARMTH = ["Summer","Light","Mid","Warm","Heavy"];

/** #2 Structured tags, editable. `v` is the item fields object. */
export default function ItemForm({ v, set }) {
  const { items } = useStore();
  const known = [...new Set([...items.map(i => (i.brand || "").trim()).filter(Boolean), ...DIRECTORY.map(b => b.name)])].sort();
  const f = k => e => set({ ...v, [k]: e.target.value });
  const toggle = (k, x) => set({ ...v, [k]: v[k]?.includes(x) ? v[k].filter(y => y !== x) : [...(v[k] || []), x] });
  return (
    <>
      <label className="f" htmlFor="i-name">Name</label>
      <input id="i-name" type="text" value={v.name || ""} onChange={f("name")} placeholder="e.g. Navy merino crew-neck" />
      <div className="two">
        <div><label className="f" htmlFor="i-cat">Category</label>
          <select id="i-cat" value={v.category || "Tops"} onChange={f("category")}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><label className="f" htmlFor="i-brand">Brand</label>
          <input id="i-brand" type="text" list="known-brands" value={v.brand || ""} onChange={f("brand")} onBlur={() => v.brand && set({ ...v, brand: canonical(v.brand) })} placeholder="e.g. Studio Nicholson" />
          <datalist id="known-brands">{known.map(b => <option key={b} value={b} />)}</datalist></div>
      </div>
      <label className="f" htmlFor="i-col">Colours, main first</label>
      <input id="i-col" type="text" value={(v.colours || []).join(", ")} onChange={e => set({ ...v, colours: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="navy, cream" />
      <div className="two">
        <div><label className="f" htmlFor="i-mat">Cloth</label><input id="i-mat" type="text" value={v.material || ""} onChange={f("material")} /></div>
        <div><label className="f" htmlFor="i-fit">Cut</label><input id="i-fit" type="text" value={v.fit || ""} onChange={f("fit")} /></div>
      </div>
      <label className="f">Acquired</label>
      <Seg label="Acquired" value={v.acquired || "new"} onChange={a => set({ ...v, acquired: a })} options={ACQUIRED} />
      <label className="f">Formality</label>
      <Chips values={FORMALITY} selected={FORMALITY[(v.formality || 0) - 1]} multi={false} onToggle={x => set({ ...v, formality: FORMALITY.indexOf(x) + 1 })} />
      <label className="f">Warmth</label>
      <Chips values={WARMTH} selected={WARMTH[(v.warmth || 0) - 1]} multi={false} onToggle={x => set({ ...v, warmth: WARMTH.indexOf(x) + 1 })} />
      <label className="f">Seasons</label>
      <Chips values={SEASONS} selected={v.seasons || []} onToggle={x => toggle("seasons", x)} />
      <div className="two">
        <div><label className="f" htmlFor="i-price">Bought for, £</label><input id="i-price" type="number" inputMode="decimal" value={v.price_paid ?? ""} onChange={f("price_paid")} /></div>
        <div><label className="f" htmlFor="i-rrp">Cost new, £{v.rrp_estimated ? " (estimate)" : ""}</label>
          <input id="i-rrp" type="number" inputMode="decimal" value={v.rrp ?? ""} onChange={e => set({ ...v, rrp: e.target.value, rrp_estimated: false })} />
          <RrpEstimate v={v} set={set} /></div>
      </div>
      <label className="f" htmlFor="i-date">Bought on</label>
      <input id="i-date" type="date" value={v.purchased_on || ""} onChange={f("purchased_on")} />
    </>
  );
}

function RrpEstimate({ v, set }) {
  const [busy, setBusy] = useState(false), [note, setNote] = useState("");
  if (v.rrp && !v.rrp_estimated) return <div className="small muted" style={{ marginTop: 4 }}>Full price new, today</div>;
  const go = async () => {
    setBusy(true); setNote("");
    try { const r = await post("rrp", { name: v.name, brand: v.brand, category: v.category, material: v.material });
      if (r.typical) { set({ ...v, rrp: r.typical, rrp_estimated: true }); setNote(`${r.low && r.high ? `£${r.low}–£${r.high}, ` : ""}${r.confidence} confidence. ${r.basis}`); }
      else setNote("Couldn’t estimate this one.");
    } catch (e) { setNote(e.message); }
    setBusy(false);
  };
  return <div className="small" style={{ marginTop: 4 }}>
    <button type="button" className="link quiet small" disabled={busy || (!v.name && !v.brand)} onClick={go}>{busy ? "Estimating…" : "Estimate it"}</button>
    {note && <div className="muted">{note}</div>}
  </div>;
}

export function cleanItem(v) {
  const n = x => (x === "" || x == null ? null : Number(x));
  return {
    name: (v.name || "").trim() || "Untitled piece", category: v.category || "Tops", brand: v.brand ? canonical(v.brand) : null,
    colours: v.colours || [], pattern: v.pattern || null, material: v.material || null, fit: v.fit || null,
    formality: n(v.formality), warmth: n(v.warmth), seasons: v.seasons || [], description: v.description || null,
    price_paid: n(v.price_paid), rrp: n(v.rrp), rrp_estimated: !!v.rrp_estimated && n(v.rrp) != null, purchased_on: v.purchased_on || null, acquired: v.acquired || "new",
  };
}
