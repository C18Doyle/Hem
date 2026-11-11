// #4 Live prices, #6 Before you buy, #9 Wishlist with price alerts
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { useUi } from "../components/UiProvider.jsx";
import { PhotoPick, Seg, Status } from "../components/Ui.jsx";
import { gbp } from "../lib/quality.js";
import { GARMENT_FIELDS, GROUP, fitCheck, target } from "../lib/fit.js";
import { CATEGORIES } from "../components/ItemForm.jsx";
import Measures from "../components/Measures.jsx";
import FitResult from "../components/FitResult.jsx";

export default function Shop() {
  const { alerts } = useStore();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || (alerts ? "wish" : "check"));
  useEffect(() => {
    if (!params.get("shared") || !("caches" in window)) return;
    caches.open("hem-share").then(async c => {
      const t = await c.match("/shared-text"); if (t) { const s = (await t.text()).trim(); if (s) setDesc(s.slice(0, 200)); }
      const i = await c.match("/shared-image"); if (i) { const { shrink } = await import("../lib/image.js"); setImg(await shrink(await i.blob(), 1100)); }
      await caches.delete("hem-share");
    });
  }, []);
  const [desc, setDesc] = useState(params.get("q") || ""), [price, setPrice] = useState(""), [img, setImg] = useState(null);
  return (
    <div className="page">
      <h2>Shop</h2>
      <p className="lede">Check it against your wardrobe, then find the best price.</p>
      <Seg label="Section" value={tab} onChange={setTab} options={[["check", "Before you buy"], ["search", "Find it for less"], ["wish", alerts ? `Wishlist (${alerts})` : "Wishlist"]]} />
      {tab !== "wish" && <>
        <label className="f" htmlFor="sh-d">The piece</label>
        <input id="sh-d" type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Toteme cashmere-wool scarf, oat" />
        <label className="f" htmlFor="sh-p">Price, £</label>
        <input id="sh-p" type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
        <PhotoPick value={img} onChange={setImg} />
      </>}
      {tab === "check" && <Precheck desc={desc} price={price} img={img} onSearch={() => setTab("search")} />}
      {tab === "search" && <Search desc={desc} price={price} img={img} />}
      {tab === "wish" && <Wishlist />}
    </div>
  );
}

function Precheck({ desc, price, img, onSearch }) {
  const { byId, photo, items, body } = useStore();
  const [r, setR] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [cat, setCat] = useState("Shirts"), [lm, setLm] = useState({});
  const g = GROUP(cat);
  const tgt = g ? target(cat, items, body) : null;
  const fit = Object.values(lm).some(v => v !== "" && v != null) ? fitCheck(cat, lm, tgt) : null;
  const go = async () => {
    setErr(""); setR(null); setBusy("Checking…");
    const fitText = fit?.rows?.length ? `${fit.verdict}. ` + fit.rows.map(x => `${x.label} ${x.level === "good" ? "matches" : x.diff + " cm"}${x.fix && x.level !== "good" ? " (" + x.fix[0] + ")" : ""}`).join("; ") : "";
    try { setR(await post("precheck", { description: desc, price: price ? Number(price) : null, image: img?.dataUrl, fit: fitText })); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const verdict = { buy: "Buy it", wait: "Wait", skip: "Skip it" };
  return <>
    <details style={{ marginTop: 24 }}>
      <summary style={{ cursor: "pointer" }}>Will it fit? Add the listing’s measurements</summary>
      <label className="f" htmlFor="pc-cat">Type</label>
      <select id="pc-cat" value={cat} onChange={e => { setCat(e.target.value); setLm({}); }}>{CATEGORIES.filter(c => GROUP(c)).map(c => <option key={c}>{c}</option>)}</select>
      {g && <Measures fields={GARMENT_FIELDS[g]} value={lm} onChange={setLm} />}
      {!tgt && <p className="note">Nothing to compare with yet. Mark a well-fitting {cat.toLowerCase()} piece and add its measurements, or add body measurements under Fit.</p>}
      <FitResult r={fit} tgt={tgt} />
    </details>
    <div><button className="btn" disabled={!!busy || (!desc && !img)} onClick={go}>Check it</button></div>
    <Status busy={busy} error={err} />
    {r && <div className="result">
      <div className="figs">
        <div><div className="big">{verdict[r.verdict] || "—"}</div><div className="sub">Verdict</div></div>
        <div><div className="big">{r.newOutfits ?? "—"}</div><div className="sub">New outfits it unlocks</div></div>
        {r.cpwOneYear && <div><div className="big">{gbp(r.cpwOneYear)}</div><div className="sub">A wear after one year ({r.expectedWearsPerYear} wears)</div></div>}
      </div>
      <p style={{ marginTop: 20 }}>{r.reasoning}</p>
      {r.duplicates?.length > 0 && <><h3>You already own</h3><ul className="plain">{r.duplicates.map(d => (
        <li key={d.itemId}><Link to={`/item/${d.itemId}`}>{byId[d.itemId]?.name}</Link><br /><span className="small muted">{d.why}</span></li>))}</ul></>}
      {r.pairsWith?.length > 0 && <><h3>It would work with</h3><div className="strip">{r.pairsWith.map(id => byId[id] && (
        <div className="piece" key={id}><div className="im" style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} /><div className="lb">{byId[id].name}</div></div>))}</div></>}
      {r.fillsGap && <p className="note">Fills a gap: {r.fillsGap}</p>}
      {r.ifBuying && <p className="note">Before paying: {r.ifBuying}</p>}
      {r.verdict !== "skip" && <button className="btn ghost" onClick={onSearch}>Find the best price</button>}
    </div>}
  </>;
}

function Search({ desc, price, img }) {
  const ui = useUi();
  const [r, setR] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState(""), [added, setAdded] = useState({});
  const [cond, setCond] = useState("all"), [sort, setSort] = useState("price"), [max, setMax] = useState("");
  const cacheKey = "hem.search." + (desc || "").toLowerCase().trim();
  const go = async (fresh = false) => {
    setErr(""); setR(null);
    // Re-use a search from the last six hours rather than paying for it again
    if (!fresh && !img) { try { const c = JSON.parse(sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey) || "null"); if (c && Date.now() - new Date(c.searchedAt) < 6 * 3600e3) return setR(c); } catch {} }
    setBusy("Searching…");
    try { const out = await post("search", { description: desc, price: price ? Number(price) : null, image: img?.dataUrl }); setR(out); try { localStorage.setItem(cacheKey, JSON.stringify(out)); } catch {} }
    catch (e) { setErr(e.message); }
    setBusy("");
  };
  const watch = async p => {
    const target = await ui.ask({ title: "Watch this price", body: `${p.retailer || ""}${p.price != null ? `, now ${gbp(p.price)}` : ""}`, label: "Alert me at or below, £", type: "number", value: p.price ? Math.floor(p.price * 0.85) : "", okLabel: "Watch" });
    if (target === null) return;
    const { data, error } = await supabase.from("wishlist").insert({ name: p.title, query: p.title, target_price: target ? Number(target) : null, last_price: p.price, lowest_price: p.price, last_url: p.url, last_retailer: p.retailer, last_checked: new Date().toISOString() }).select().single();
    if (error) return setErr(error.message);
    if (p.price != null) await supabase.from("price_history").insert({ wishlist_id: data.id, price: p.price, retailer: p.retailer, url: p.url });
    setAdded(a => ({ ...a, [p.url]: true }));
    ui.toast("Added to wishlist");
  };
  const list = r ? r.results.filter(p => (cond === "all" || p.condition === cond) && (!max || (p.price != null && p.price <= Number(max)))) : [];
  const sorted = [...list].sort((a, b) => sort === "price" ? (a.price ?? 1e9) - (b.price ?? 1e9) : 0);
  const groups = ["This piece", "Secondhand", "Alternatives"].map(g => [g, sorted.filter(p => p.group === g)]).filter(([, l]) => l.length);
  const cheapest = list.filter(p => p.price != null).sort((a, b) => a.price - b.price)[0];
  return <>
    <div className="row"><button className="btn" disabled={!!busy || (!desc && !img)} onClick={() => go()}>Search prices</button>
      {r && <button className="link quiet small" style={{ marginTop: 28 }} onClick={() => go(true)}>Search again</button>}</div>
    <Status busy={busy} error={err} />
    {r && <div className="result">
      <div className="figs">
        {cheapest && <div><div className="big">{gbp(cheapest.price)}</div><div className="sub">Lowest found, {cheapest.retailer}{cheapest.saving > 0 ? `; saves ${gbp(cheapest.saving)}` : ""}</div></div>}
        {r.fairPrice && <div><div className="big" style={{ fontSize: 26, paddingTop: 12 }}>{r.fairPrice.new || "—"}</div><div className="sub">Typical new. Secondhand {r.fairPrice.secondhand || "—"}</div></div>}
      </div>
      {r.keyFeatures?.length > 0 && <><h3>What to match</h3><div className="chips">{r.keyFeatures.map(k => <span key={k} className="chip">{k}</span>)}</div></>}
      <div className="between" style={{ marginTop: 22, flexWrap: "wrap", gap: 10 }}>
        <Seg label="Condition" value={cond} onChange={setCond} options={[["all", "All"], ["new", "New"], ["secondhand", "Secondhand"]]} />
        <select className="sortsel" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="price">Sort: Lowest price</option><option value="relevance">Sort: Best match</option></select>
      </div>
      <label className="f" htmlFor="s-max">Up to, £</label>
      <input id="s-max" type="number" value={max} onChange={e => setMax(e.target.value)} style={{ maxWidth: 160 }} />
      {!sorted.length && <p>No listings match. Widen the filters or try a plainer description.</p>}
      {groups.map(([g, l]) => <div key={g}><h3>{g}</h3><ul className="plain">{l.map(p => (
        <li key={p.url} style={{ display: "flex", gap: 14 }}>
          {p.image && <img src={p.image} alt="" width="64" height="64" style={{ objectFit: "contain", background: "var(--stone)", flex: "none" }} />}
          <div style={{ flex: 1 }}>
            <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}</a>
            <div className="small muted">{p.retailer}{p.price != null ? `, ${gbp(p.price)}` : ", price not shown"}{p.condition === "secondhand" ? ", secondhand" : ""}{p.saving > 0 ? `, saves ${gbp(p.saving)}` : ""}</div>
            {p.note && <div className="small muted">{p.note}</div>}
            {added[p.url] ? <span className="small">Watching</span> : <button className="link quiet small" onClick={() => watch(p)}>Watch price</button>}
          </div>
        </li>))}</ul></div>)}
      <p className="note">Source: {r.source}, searched {new Date(r.searchedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Results are reused for six hours to save cost. Confirm the price on the retailer’s page before buying.</p>
    </div>}
  </>;
}

function Spark({ points }) {
  if (points.length < 2) return null;
  const ys = points.map(p => Number(p.price)), lo = Math.min(...ys), hi = Math.max(...ys), w = 120, h = 28;
  const d = ys.map((y, i) => `${i ? "L" : "M"}${(i / (ys.length - 1)) * w},${hi === lo ? h / 2 : h - ((y - lo) / (hi - lo)) * h}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Price from ${gbp(ys[0])} to ${gbp(ys.at(-1))}`} style={{ overflow: "visible" }}><path d={d} fill="none" stroke="currentColor" strokeWidth="1" /></svg>;
}

function Wishlist() {
  const { refresh } = useStore();
  const ui = useUi();
  const [rows, setRows] = useState([]), [hist, setHist] = useState({}), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const [name, setName] = useState(""), [target, setTarget] = useState("");
  const load = async () => {
    const { data } = await supabase.from("wishlist").select("*").order("alert", { ascending: false }).order("created_at", { ascending: false });
    setRows(data || []);
    const { data: h } = await supabase.from("price_history").select("wishlist_id,price,checked_at").order("checked_at");
    const m = {}; (h || []).forEach(p => (m[p.wishlist_id] ||= []).push(p)); setHist(m);
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("wishlist").insert({ name: name.trim(), query: name.trim(), target_price: target ? Number(target) : null });
    if (error) return setErr(error.message);
    setName(""); setTarget(""); load();
  };
  const check = async w => { setBusy("Checking " + w.name + "…"); setErr(""); try { await post("wishlist-check", { id: w.id }); await load(); refresh(); } catch (e) { setErr(e.message); } setBusy(""); };
  const seen = async w => { await supabase.from("wishlist").update({ alert: false }).eq("id", w.id); load(); refresh(); };
  const setT = async w => {
    const t = await ui.ask({ title: w.name, label: "Alert me at or below, £", type: "number", value: w.target_price ?? "", okLabel: "Save", clearLabel: w.target_price ? "Remove target" : null });
    if (t === null) return;
    await supabase.from("wishlist").update({ target_price: t ? Number(t) : null }).eq("id", w.id); load();
  };
  const del = async w => {
    setRows(rs => rs.filter(r => r.id !== w.id));
    const { id, ...row } = w; let gone = true;
    ui.toast("Removed from wishlist", { undo: () => { gone = false; load(); } });
    setTimeout(async () => { if (gone) { await supabase.from("wishlist").delete().eq("id", id); refresh(); } }, 6200);
  };
  return <>
    <p className="muted" style={{ marginTop: 22 }}>Checked automatically. Alert settings are in Settings.</p>
    <div className="two">
      <div><label className="f" htmlFor="w-n">Piece</label><input id="w-n" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arket wool trousers, grey" /></div>
      <div><label className="f" htmlFor="w-t">Alert at, £</label><input id="w-t" type="number" value={target} onChange={e => setTarget(e.target.value)} /></div>
    </div>
    <button className="btn sm" style={{ marginTop: 16 }} onClick={add}>Add to wishlist</button>
    <Status busy={busy} error={err} />
    {rows.length > 0 && <ul className="plain" style={{ marginTop: 20 }}>{rows.map(w => {
      const h = hist[w.id] || [], first = h[0]?.price;
      const change = first && w.last_price ? Math.round((1 - Number(w.last_price) / Number(first)) * 100) : 0;
      return (
      <li key={w.id}>
        <div className="between"><span className={w.alert ? "alert" : ""}>{w.name}</span><span>{w.last_price != null ? gbp(Number(w.last_price)) : "—"}</span></div>
        {w.alert && w.alert_reason && <div className="small alert">Price drop: {w.alert_reason}.</div>}
        <div className="between" style={{ alignItems: "center", marginTop: 6 }}>
          <div className="small muted">{w.target_price ? `Target ${gbp(Number(w.target_price))}. ` : ""}{w.lowest_price ? `Lowest ${gbp(Number(w.lowest_price))}. ` : ""}{change > 0 ? `Down ${change}%. ` : change < 0 ? `Up ${-change}%. ` : ""}{w.last_retailer ? `At ${w.last_retailer}. ` : ""}{w.last_checked ? `Checked ${new Date(w.last_checked).toLocaleDateString("en-GB")}.` : "Not checked yet."}</div>
          <Spark points={h} />
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          {w.last_url && <a className="small" href={w.last_url} target="_blank" rel="noopener noreferrer">View</a>}
          <button className="link quiet small" onClick={() => check(w)}>Check now</button>
          <button className="link quiet small" onClick={() => setT(w)}>Set target</button>
          {w.alert && <button className="link quiet small" onClick={() => seen(w)}>Dismiss alert</button>}
          <button className="link quiet small" onClick={() => del(w)}>Remove</button>
        </div>
      </li>); })}</ul>}
  </>;
}
