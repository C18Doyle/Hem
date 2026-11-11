import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase.js";
import { pref } from "../lib/prefs.js";
import { GridSkeleton } from "../components/Skeleton.jsx";
import { Link } from "react-router-dom";
import { useStore } from "../store.jsx";
import AddItem from "../components/AddItem.jsx";
import { Chips, Seg } from "../components/Ui.jsx";
import { CATEGORIES, SEASONS } from "../components/ItemForm.jsx";
import { costPerWear, gbp, brandScore, ACQUIRED, saving, brandKey } from "../lib/quality.js";
import { CONDITION, conditionOf } from "../lib/condition.js";
import { canonical } from "../lib/brands.js";

const SORTS = [["new", "Newest"], ["worn", "Most worn"], ["least", "Least worn"], ["cpw", "Best value"], ["vers", "Most versatile"], ["saving", "Biggest saving"], ["condition", "Worst condition"], ["brand", "Brand"]];

export default function Wardrobe() {
  const { items, photo, wears, loading, error, vers, brandFor, conditions, wearLog, logWear, refresh, ui } = useStore();
  const nav = useNavigate();
  const [cols, setCols] = useState(() => pref.get("cols", 2));
  const pickCols = c => { setCols(c); pref.set("cols", c); };
  const press = useRef({ t: null, fired: false });
  const quick = i => ui.menu({ title: i.name, items: [
    { label: "Wore it today", onSelect: () => logWear([i.id]).catch(() => {}) },
    { label: "Set condition", onSelect: () => ui.menu({ title: "Condition", items: CONDITION.map(c => ({ label: c.label, onSelect: async () => { await supabase.from("conditions").insert({ item_id: i.id, rating: c.rating }); await refresh(); ui.toast(`Marked ${c.label.toLowerCase()}`); } })) }) },
    { label: "Open and edit", onSelect: () => nav(`/item/${i.id}`) },
    { label: i.retired ? "Return to wardrobe" : "Retire", onSelect: async () => {
      const to = !i.retired; await supabase.from("items").update({ retired: to }).eq("id", i.id); await refresh();
      ui.toast(to ? "Retired" : "Back in the wardrobe", { undo: async () => { await supabase.from("items").update({ retired: !to }).eq("id", i.id); await refresh(); } });
    } },
  ] });
  const lp = i => ({
    onPointerDown: () => { press.current.fired = false; clearTimeout(press.current.t); press.current.t = setTimeout(() => { press.current.fired = true; navigator.vibrate?.(10); quick(i); }, 480); },
    onPointerUp: () => clearTimeout(press.current.t), onPointerLeave: () => clearTimeout(press.current.t), onPointerMove: e => { if (Math.abs(e.movementY) + Math.abs(e.movementX) > 6) clearTimeout(press.current.t); },
    onContextMenu: e => { e.preventDefault(); clearTimeout(press.current.t); press.current.fired = true; quick(i); },
    onClick: e => { if (press.current.fired) { e.preventDefault(); press.current.fired = false; } },
  });
  const [adding, setAdding] = useState(false);
  const [cond, setCond] = useState(null);
  const [q, setQ] = useState(""), [cat, setCat] = useState(null), [brand, setBrand] = useState(""), [season, setSeason] = useState(null), [acq, setAcq] = useState(null);
  const [sort, setSort] = useState(() => { try { return localStorage.getItem("hem.sort") || "new"; } catch { return "new"; } });
  const [view, setView] = useState("grid"), [filters, setFilters] = useState(false), [retired, setRetired] = useState(false);
  const pickSort = s => { setSort(s); try { localStorage.setItem("hem.sort", s); } catch {} };

  const pool = items.filter(i => retired ? i.retired : !i.retired);
  const brands = useMemo(() => {
    const m = {};
    pool.forEach(i => { const b = canonical(i.brand) || "No brand"; (m[b] ||= { name: b, items: [], spend: 0 }); m[b].items.push(i); m[b].spend += Number(i.price_paid) || 0; });
    return Object.values(m).sort((a, z) => z.items.length - a.items.length || a.name.localeCompare(z.name));
  }, [pool]);
  const catCounts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c, pool.filter(i => i.category === c).length])), [pool]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let l = pool.filter(i =>
      (!t || [i.name, i.brand, i.material, i.category, ...(i.colours || [])].filter(Boolean).join(" ").toLowerCase().includes(t)) &&
      (!cat || i.category === cat) && (!brand || (canonical(i.brand) || "No brand") === brand) &&
      (!season || i.seasons?.includes(season)) && (!acq || (i.acquired || "new") === acq) &&
      (!cond || conditionOf(i, conditions, wearLog, wears).label === cond));
    const cpw = i => costPerWear(i.price_paid, wears[i.id] || 0)?.now ?? 1e9;
    const by = {
      worn: (a, b) => (wears[b.id] || 0) - (wears[a.id] || 0),
      least: (a, b) => (wears[a.id] || 0) - (wears[b.id] || 0),
      cpw: (a, b) => cpw(a) - cpw(b),
      vers: (a, b) => (vers[b.id]?.outfits || 0) - (vers[a.id]?.outfits || 0),
      condition: (a, b) => (conditions[a.id]?.rating ?? 9) - (conditions[b.id]?.rating ?? 9),
      saving: (a, b) => (saving(b)?.amount ?? -1e9) - (saving(a)?.amount ?? -1e9),
      brand: (a, b) => (a.brand || "~").localeCompare(b.brand || "~") || a.name.localeCompare(b.name),
    }[sort];
    return by ? [...l].sort(by) : l;
  }, [pool, q, cat, brand, season, acq, cond, sort, wears, vers, conditions, wearLog]);

  const active = [cat, brand, season, acq, cond].filter(Boolean).length;
  const clear = () => { setCat(null); setBrand(""); setSeason(null); setAcq(null); setCond(null); setQ(""); };
  const money = i => {
    const sv = saving(i);
    if (sv) return `${gbp(sv.paid)}, ${gbp(sv.rrp)} new${sv.amount > 0 ? ` (${sv.pct}% off)` : ""}`;
    if (i.price_paid != null) return gbp(Number(i.price_paid));
    return "";
  };
  const meta = i => {
    if (sort === "vers") return `${vers[i.id]?.outfits || 0} outfits`;
    const c = costPerWear(i.price_paid, wears[i.id] || 0);
    if (sort === "cpw" && c?.now) return `${gbp(c.now)} a wear`;
    if (sort === "saving") { const sv = saving(i); return sv ? (sv.amount > 0 ? `Saved ${gbp(sv.amount)}` : "No saving") : "Add cost new to compare"; }
    return `${wears[i.id] || 0} wear${wears[i.id] === 1 ? "" : "s"}${c?.now ? `, ${gbp(c.now)} a wear` : ""}`;
  };
  const Card = ({ i }) => (
    <Link to={`/item/${i.id}`} className="item" {...lp(i)}>
      <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }}>
        {i.acquired && i.acquired !== "new" && <span className="badge">{ACQUIRED.find(a => a[0] === i.acquired)?.[1]}</span>}
      </div>
      {(() => { const co = conditionOf(i, conditions, wearLog, wears); return co.rating != null && <span className={"ctag" + (co.rating <= 2 ? " low" : "")}>{co.label}{co.due ? ", re-check" : ""}</span>; })()}
      {i.brand && <div className="br">{i.brand}</div>}
      <div className="nm">{i.name}</div>
      {money(i) && <div className="ct">{money(i)}</div>}
      <div className="ct">{meta(i)}</div>
    </Link>);

  return (
    <div className="page">
      <div className="between"><h2>{retired ? "Retired" : "Wardrobe"}</h2><div className="row"><button className="link" onClick={() => setAdding(true)}>Add one</button><Link to="/add">Add several</Link></div></div>
      <p className="lede" style={{ marginBottom: 18 }}>{pool.length} pieces{brands.length > 1 ? `, ${brands.filter(b => b.name !== "No brand").length} brands` : ""}.</p>

      {items.length > 0 && <>
        <div className="wtools">
        <input type="text" className="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, brand, colour or cloth" aria-label="Search wardrobe" />
        <div className="chips" style={{ marginTop: 14 }}>
          {CATEGORIES.filter(c => catCounts[c]).map(c => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? null : c)}>{c} <span className="muted">{catCounts[c]}</span></button>)}
        </div>
        <div className="between" style={{ margin: "16px 0 0" }}>
          <button className="link quiet small" onClick={() => setFilters(f => !f)}>{filters ? "Hide filters" : "More filters"}{active > (cat ? 1 : 0) ? ` (${active - (cat ? 1 : 0)})` : ""}</button>
          {(active > 0 || q) && <button className="link quiet small" onClick={clear}>Clear all</button>}
        </div>
        {filters && <div className="filters">
          <label className="f" htmlFor="w-brand">Brand</label>
          <select id="w-brand" value={brand} onChange={e => setBrand(e.target.value)}>
            <option value="">All brands</option>{brands.map(b => <option key={b.name} value={b.name}>{b.name} ({b.items.length})</option>)}
          </select>
          <label className="f">Season</label>
          <Chips values={SEASONS} selected={season} multi={false} onToggle={x => setSeason(season === x ? null : x)} />
          <label className="f">Acquired</label>
          <Chips values={ACQUIRED.map(a => a[1])} selected={ACQUIRED.find(a => a[0] === acq)?.[1]} multi={false} onToggle={x => { const k = ACQUIRED.find(a => a[1] === x)[0]; setAcq(acq === k ? null : k); }} />
          <label className="f">Condition</label>
          <Chips values={[...CONDITION.map(c => c.label), "Not checked", "Unworn"]} selected={cond} multi={false} onToggle={x => setCond(cond === x ? null : x)} />
          <div style={{ marginTop: 18 }}><button className="link quiet small" onClick={() => setRetired(r => !r)}>{retired ? "Show current pieces" : "Show retired pieces"}</button></div>
        </div>}
        <div className="between" style={{ margin: "20px 0 24px", alignItems: "center" }}>
          <select className="sortsel" value={sort} onChange={e => pickSort(e.target.value)} aria-label="Sort">{SORTS.map(([v, t]) => <option key={v} value={v}>Sort: {t}</option>)}</select>
          <div className="row" style={{ gap: 8 }}>
            {view === "grid" && <Seg label="Columns" value={cols} onChange={pickCols} options={[[2, "2"], [3, "3"]]} />}
            <Seg label="View" value={view} onChange={setView} options={[["grid", "Grid"], ["brands", "Brands"]]} />
          </div>
        </div>
        </div>
      </>}

      {error && <p className="alert">{error}</p>}
      {loading ? <GridSkeleton cols={cols} />
        : !items.length ? <div className="empty"><button className="link" onClick={() => setAdding(true)}>Add your first piece</button></div>
        : !list.length ? <div className="empty">Nothing matches. <button className="link" onClick={clear}>Clear filters</button></div>
        : view === "grid" ? <div className={"grid cols" + cols}>{list.map(i => <Card key={i.id} i={i} />)}</div>
        : brands.map(b => {
            const mine = list.filter(i => (canonical(i.brand) || "No brand") === b.name);
            if (!mine.length) return null;
            const rated = b.name !== "No brand" && brandFor(b.name), s = rated && brandScore(rated.rating);
            return (
              <section key={b.name} className="brandgroup">
                <div className="between">
                  <h3 style={{ margin: 0 }}>{b.name}</h3>
                  <span className="small muted">{mine.length} piece{mine.length === 1 ? "" : "s"}{b.spend ? `, ${gbp(b.spend)}` : ""}</span>
                </div>
                {b.name !== "No brand" && <p className="small" style={{ margin: "4px 0 12px" }}>
                  {s ? <Link to={`/brands/${rated.brand_key}`}>Maker rating {s.overall}/10</Link> : <Link to={`/brands/${brandKey(b.name)}`} className="muted">About this brand</Link>}
                </p>}
                <div className="strip">{mine.map(i => (
                  <Link key={i.id} to={`/item/${i.id}`} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
                    <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div><div className="tag">{meta(i)}</div></Link>))}</div>
              </section>);
          })}
      <AddItem open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
