// #2 Dashboard: where the money went, what actually gets worn
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store.jsx";
import { Seg } from "../components/Ui.jsx";
import { FigsSkeleton, GridSkeleton } from "../components/Skeleton.jsx";
import { CONDITION } from "../lib/condition.js";
import Flags from "../components/Flags.jsx";
import { gbp, sustainScore, saving } from "../lib/quality.js";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cssColour = name => { const n = String(name || "").toLowerCase().replace(/\s+/g, ""); return typeof CSS !== "undefined" && CSS.supports("color", n) ? n : null; };

export default function Dashboard() {
  const { items, wearLog, byId, photo, brandFor, vers, conditions, loading } = useStore();
  const [range, setRange] = useState("all");

  const s = useMemo(() => {
    const since = range === "all" ? "0000" : range === "year" ? `${new Date().getFullYear()}-01-01` : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const owned = items.filter(i => !i.retired);
    const bought = items.filter(i => (i.purchased_on || i.created_at?.slice(0, 10) || "") >= since);
    const log = wearLog.filter(w => w.worn_on >= since && byId[w.item_id]);
    const wears = {}; log.forEach(w => { wears[w.item_id] = (wears[w.item_id] || 0) + 1; });
    const allWears = {}; wearLog.forEach(w => { allWears[w.item_id] = (allWears[w.item_id] || 0) + 1; });

    const spend = bought.reduce((t, i) => t + (Number(i.price_paid) || 0), 0);
    const cats = {};
    bought.forEach(i => { (cats[i.category] ||= { spend: 0, wears: 0 }).spend += Number(i.price_paid) || 0; });
    log.forEach(w => { const c = byId[w.item_id].category; (cats[c] ||= { spend: 0, wears: 0 }).wears++; });
    const catRows = Object.entries(cats).sort((a, b) => b[1].spend - a[1].spend);

    const acq = {}; bought.forEach(i => { const k = i.acquired === "vintage" ? "secondhand" : (i.acquired || "new"); (acq[k] ||= { n: 0, spend: 0 }); acq[k].n++; acq[k].spend += Number(i.price_paid) || 0; });
    const pre = (acq.secondhand?.n || 0) / (bought.length || 1);

    const ninety = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const active = new Set(wearLog.filter(w => w.worn_on >= ninety).map(w => w.item_id));
    const util = owned.length ? Math.round(owned.filter(i => active.has(i.id)).length / owned.length * 100) : 0;

    const cpw = owned.filter(i => i.price_paid && allWears[i.id]).map(i => ({ i, v: Number(i.price_paid) / allWears[i.id] })).sort((a, b) => a.v - b.v);
    const top = owned.filter(i => wears[i.id]).sort((a, b) => wears[b.id] - wears[a.id]).slice(0, 3);
    const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
    const sleeping = owned.filter(i => !allWears[i.id] && (i.created_at || "") < monthAgo);
    const sleepingValue = sleeping.reduce((t, i) => t + (Number(i.price_paid) || 0), 0);

    const dow = Array(7).fill(0);
    log.forEach(w => { const [y, m, d] = w.worn_on.split("-").map(Number); dow[(new Date(y, m - 1, d).getDay() + 6) % 7]++; });

    const pal = {};
    log.forEach(w => { const c = byId[w.item_id].colours?.[0]; if (c) pal[c] = (pal[c] || 0) + 1; });
    const palette = Object.entries(pal).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const assessed = owned.filter(i => i.quality?.overall);
    const avgQ = assessed.length ? assessed.reduce((t, i) => t + i.quality.overall, 0) / assessed.length : null;
    const sus = assessed.map(i => sustainScore(i.quality, i.acquired, brandFor(i.brand))?.overall).filter(x => x != null);
    const avgS = sus.length ? sus.reduce((a, b) => a + b, 0) / sus.length : null;

    const days = new Set(log.map(w => w.worn_on)).size;
    const priced = bought.map(saving).filter(Boolean);
    const sav = { n: priced.length, paid: priced.reduce((t, x) => t + x.paid, 0), rrp: priced.reduce((t, x) => t + x.rrp, 0), est: priced.filter(x => x.estimated).length };
    const byAcq = {};
    bought.forEach(i => { const x = saving(i); if (!x) return; const k = ["secondhand", "vintage"].includes(i.acquired) ? "Secondhand and vintage" : i.acquired === "new" ? "New" : "Gifted and rented"; (byAcq[k] ||= { paid: 0, rrp: 0 }); byAcq[k].paid += x.paid; byAcq[k].rrp += x.rrp; });
    return { sav, byAcq, owned, bought, spend, catRows, acq, pre, util, cpw, top, sleeping, sleepingValue, dow, palette, avgQ, avgS, assessed, log, wears, days };
  }, [items, wearLog, byId, range, brandFor]);

  if (loading) return <div className="page"><h2>Dashboard</h2><FigsSkeleton /><GridSkeleton n={3} /></div>;
  if (!items.length) return <div className="page"><h2>Dashboard</h2><div className="empty">Add pieces and log some wears to see your stats. <Link to="/wardrobe">Go to wardrobe</Link></div></div>;
  const maxSpend = Math.max(1, ...s.catRows.map(([, v]) => v.spend));
  const totalW = s.log.length || 1;
  const maxDow = Math.max(1, ...s.dow);

  return (
    <div className="page">
      <div className="between"><h2>Dashboard</h2></div>
      <Seg label="Period" value={range} onChange={setRange} options={[["all", "All time"], ["year", "This year"], ["90", "90 days"]]} />

      <div className="figs" style={{ marginTop: 28 }}>
        <div><div className="big">{gbp(s.spend)}</div><div className="sub">Spent on {s.bought.length} pieces</div></div>
        <div><div className="big">{s.log.length}</div><div className="sub">Wears over {s.days} days</div></div>
        <div><div className="big">{s.util}<small>%</small></div><div className="sub">Of your wardrobe worn in the last 90 days</div></div>
      </div>

      <Flags title="Flags" />

      <h3>Spend against wear, by category</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Spend (thick) against wears (thin).</p>
      {s.catRows.map(([c, v]) => (
        <div key={c} className="stat">
          <div className="between"><span>{c}</span><span className="small muted">{gbp(v.spend)}, {Math.round(v.wears / totalW * 100)}% of wears</span></div>
          <div className="hbar"><i style={{ width: `${v.spend / maxSpend * 100}%` }} /></div>
          <div className="hbar thin"><i style={{ width: `${v.wears / totalW * 100}%` }} /></div>
        </div>))}

      {s.sav.n > 0 && <><h3>Cost new against what you paid</h3>
        <div className="figs">
          <div><div className="big">{gbp(s.sav.rrp)}</div><div className="sub">Full price new, {s.sav.n} pieces</div></div>
          <div><div className="big">{gbp(s.sav.paid)}</div><div className="sub">What you paid</div></div>
          <div><div className="big">{s.sav.rrp ? Math.round((1 - s.sav.paid / s.sav.rrp) * 100) : 0}<small>%</small></div><div className="sub">Saved, {gbp(Math.max(0, s.sav.rrp - s.sav.paid))}</div></div>
        </div>
        {Object.entries(s.byAcq).map(([k, v]) => <div key={k} className="stat"><div className="between"><span>{k}</span><span className="small muted">{gbp(v.paid)} of {gbp(v.rrp)}, {Math.round((1 - v.paid / v.rrp) * 100)}% off</span></div>
          <div className="hbar"><i style={{ width: `${Math.min(100, v.paid / v.rrp * 100)}%` }} /></div></div>)}
        <p className="note">Only pieces with both prices are counted{s.sav.est ? `; ${s.sav.est} use an estimated cost new` : ""}. Bars show what you paid as a share of full price.</p></>}

      {(() => { const live = items.filter(i => !i.retired), checked = live.filter(i => conditions[i.id]); if (checked.length < 3) return null; return <>
        <h3>Condition</h3>
        <div className="condbar">{CONDITION.map(c => { const n = checked.filter(i => conditions[i.id].rating === c.rating).length; return n ? <div key={c.rating} style={{ flex: n }} className={"r" + c.rating} title={`${c.label}: ${n}`}><span>{c.label} {n}</span></div> : null; })}</div>
        <p className="note">{checked.length} of {live.length} pieces checked.{live.length - checked.length ? ` ${live.length - checked.length} still to rate.` : ""}</p></>; })()}

      <h3>New and secondhand</h3>
      <div className="figs">
        <div><div className="big">{Math.round(s.pre * 100)}<small>%</small></div><div className="sub">Of pieces bought secondhand or vintage</div></div>
        <div><div className="big">{gbp(s.acq.secondhand?.spend || 0)}</div><div className="sub">Spent secondhand, against {gbp(s.acq.new?.spend || 0)} new</div></div>
      </div>

      {s.top.length > 0 && <><h3>Hardest working</h3>
        <div className="strip">{s.top.map(i => (
          <Link to={`/item/${i.id}`} key={i.id} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div><div className="tag">{s.wears[i.id]} wears</div></Link>))}</div></>}

      {s.cpw.length > 1 && <><h3>Cost per wear</h3><ul className="plain">
        <li className="between"><span>Best value: <Link to={`/item/${s.cpw[0].i.id}`}>{s.cpw[0].i.name}</Link></span><span>{gbp(s.cpw[0].v)}</span></li>
        <li className="between"><span>Most expensive: <Link to={`/item/${s.cpw.at(-1).i.id}`}>{s.cpw.at(-1).i.name}</Link></span><span>{gbp(s.cpw.at(-1).v)}</span></li>
      </ul></>}

      {s.sleeping.length > 0 && <><h3>Never worn</h3>
        <p className="muted" style={{ marginTop: 0 }}>{s.sleeping.length} piece{s.sleeping.length === 1 ? "" : "s"} owned over a month and not yet worn{s.sleepingValue ? `, ${gbp(s.sleepingValue)} in total` : ""}. Style one, or sell it on.</p>
        <div className="strip">{s.sleeping.slice(0, 8).map(i => (
          <Link to={`/item/${i.id}`} key={i.id} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div></Link>))}</div></>}

      {(() => { const ranked = s.owned.filter(i => vers[i.id] && !["Bags", "Accessories"].includes(i.category)).sort((a, b) => vers[a.id].outfits - vers[b.id].outfits); if (ranked.length < 4) return null; return <>
        <h3>Most and least versatile</h3>
        <p className="muted small" style={{ marginTop: 0 }}>Outfits each piece can make.</p>
        <ul className="plain">
          {[...ranked.slice(-3).reverse(), ...ranked.slice(0, 3)].map((i, k) => (
            <li key={i.id} className="between"><span>{k === 3 && <span className="small muted">Least: </span>}{k === 0 && <span className="small muted">Most: </span>}<Link to={`/item/${i.id}`}>{i.name}</Link></span><span className="small">{vers[i.id].outfits} outfits</span></li>))}
        </ul></>; })()}

      {s.palette.length > 0 && <><h3>What you actually wear</h3>
        <div className="palette">{s.palette.map(([c, n]) => (
          <div key={c} style={{ flex: n }}><i style={{ background: cssColour(c) || "var(--stone)" }} /><span>{c}</span></div>))}</div></>}

      <h3>Wears by day</h3>
      <div className="dow">{s.dow.map((n, i) => (
        <div key={i}><div className="col"><i style={{ height: `${n / maxDow * 100}%` }} /></div><span>{DOW[i].slice(0, 1)}</span></div>))}</div>

      {s.assessed.length > 0 && <><h3>Quality and footprint</h3>
        <div className="figs">
          <div><div className="big">{s.avgQ.toFixed(1)}<small>/10</small></div><div className="sub">Average quality, {s.assessed.length} assessed</div></div>
          {s.avgS != null && <div><div className="big">{s.avgS.toFixed(1)}<small>/10</small></div><div className="sub">Average sustainability</div></div>}
        </div></>}
    </div>
  );
}
