// #10 Year in review
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { gbp, sustainScore, saving } from "../lib/quality.js";
import { Status } from "../components/Ui.jsx";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const cssColour = c => { const k = String(c || "").toLowerCase().replace(/\s+/g, ""); return typeof CSS !== "undefined" && CSS.supports("color", k) ? k : null; };

export default function Review() {
  const { items, wearLog, byId, photo, brandFor } = useStore();
  const years = useMemo(() => [...new Set([new Date().getFullYear(), ...wearLog.map(w => Number(w.worn_on.slice(0, 4)))])].sort((a, b) => b - a), [wearLog]);
  const [year, setYear] = useState(years[0]);
  const [extra, setExtra] = useState({ repairs: 0, repairSpend: 0, care: 0, saved: 0 });
  const [note, setNote] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");

  useEffect(() => {
    setNote(null);
    const a = `${year}-01-01`, z = `${year}-12-31`;
    Promise.all([
      supabase.from("care_logs").select("kind,cost").gte("done_on", a).lte("done_on", z),
      supabase.from("outfits").select("id", { count: "exact", head: true }).in("status", ["saved", "worn"]).gte("created_at", a).lte("created_at", z + "T23:59:59"),
    ]).then(([c, o]) => {
      const logs = c.data || [];
      setExtra({ repairs: logs.filter(l => l.kind === "repair").length, repairSpend: logs.reduce((t, l) => t + (Number(l.cost) || 0), 0), care: logs.length, saved: o.count || 0 });
    });
  }, [year]);

  const s = useMemo(() => {
    const y = String(year);
    const log = wearLog.filter(w => w.worn_on.startsWith(y) && byId[w.item_id]);
    const per = {}; log.forEach(w => { per[w.item_id] = (per[w.item_id] || 0) + 1; });
    const days = [...new Set(log.map(w => w.worn_on))].sort();
    let streak = 0, run = 0, prev = null;
    days.forEach(d => { const t = new Date(d + "T12:00:00").getTime(); run = prev && t - prev === 864e5 ? run + 1 : 1; streak = Math.max(streak, run); prev = t; });
    const months = Array(12).fill(0); log.forEach(w => months[Number(w.worn_on.slice(5, 7)) - 1]++);
    const ranked = Object.entries(per).sort((a, b) => b[1] - a[1]);
    const star = ranked[0] ? byId[ranked[0][0]] : null;
    const allW = {}; wearLog.forEach(w => { allW[w.item_id] = (allW[w.item_id] || 0) + 1; });
    const cpw = Object.keys(per).map(id => byId[id]).filter(i => i.price_paid && allW[i.id]).map(i => ({ i, v: Number(i.price_paid) / allW[i.id] })).sort((a, b) => a.v - b.v);
    const added = items.filter(i => (i.purchased_on || i.created_at || "").startsWith(y));
    const spent = added.reduce((t, i) => t + (Number(i.price_paid) || 0), 0);
    const sv = added.map(saving).filter(Boolean), saved = Math.max(0, sv.reduce((t, x) => t + x.amount, 0));
    const used = added.filter(i => ["secondhand", "vintage"].includes(i.acquired)).length;
    const col = {}; log.forEach(w => { const c = byId[w.item_id].colours?.[0]; if (c) col[c] = (col[c] || 0) + 1; });
    const colour = Object.entries(col).sort((a, b) => b[1] - a[1])[0]?.[0];
    const byDay = {}; log.forEach(w => (byDay[w.worn_on] ||= new Set()).add(w.item_id));
    const pairs = {};
    Object.values(byDay).forEach(set => { const a = [...set].sort(); a.forEach((x, i) => a.slice(i + 1).forEach(y => { const k = x + "|" + y; pairs[k] = (pairs[k] || 0) + 1; })); });
    const topPair = Object.entries(pairs).filter(([k]) => { const [a, b] = k.split("|"); return byId[a].category !== byId[b].category; }).sort((a, b) => b[1] - a[1])[0];
    const owned = items.filter(i => !i.retired && (i.created_at || "") < `${y}-12-31`);
    const unworn = owned.filter(i => !per[i.id]);
    const retired = items.filter(i => i.retired).length;
    const sus = added.map(i => i.quality ? sustainScore(i.quality, i.acquired, brandFor(i.brand))?.overall : null).filter(x => x != null);
    return { log, days, streak, months, star, starWears: ranked[0]?.[1] || 0, top3: ranked.slice(0, 5).map(([id, n]) => ({ i: byId[id], n })),
      cpw, added, spent, saved, savedN: sv.length, used, colour, topPair: topPair ? { a: byId[topPair[0].split("|")[0]], b: byId[topPair[0].split("|")[1]], n: topPair[1] } : null,
      unworn, unwornValue: unworn.reduce((t, i) => t + (Number(i.price_paid) || 0), 0), retired, avgSus: sus.length ? sus.reduce((a, b) => a + b, 0) / sus.length : null };
  }, [year, wearLog, items, byId, brandFor]);

  const writeNote = async () => {
    setBusy("Writing…"); setErr("");
    const stats = { wears: s.log.length, daysLogged: s.days.length, longestStreak: s.streak, pieceOfTheYear: s.star && { name: s.star.name, wears: s.starWears },
      mostWorn: s.top3.map(x => ({ name: x.i.name, wears: x.n })), bestValue: s.cpw[0] && { name: s.cpw[0].i.name, costPerWear: s.cpw[0].v.toFixed(2) },
      added: s.added.length, secondhandAdded: s.used, spent: Math.round(s.spent), colourOfTheYear: s.colour,
      signaturePairing: s.topPair && `${s.topPair.a.name} with ${s.topPair.b.name}, ${s.topPair.n} times`, unwornPieces: s.unworn.length,
      repairs: extra.repairs, careTasks: extra.care, retired: s.retired, wearsByMonth: s.months };
    try { setNote(await post("review", { year, stats })); } catch (e) { setErr(e.message); }
    setBusy("");
  };

  const maxM = Math.max(1, ...s.months);
  if (!s.log.length) return <div className="page"><h2>{year}</h2><p className="muted">No wears logged in {year} yet. Log what you wear in the <Link to="/calendar">calendar</Link> and your year will appear here.</p></div>;

  return (
    <div className="page review">
      {years.length > 1 && <div className="chips" style={{ marginBottom: 16 }}>{years.map(y => <button key={y} className="chip" aria-pressed={y === year} onClick={() => setYear(y)}>{y}</button>)}</div>}
      <div className="rv-year">{year}</div>
      <p className="rv-sub">{note?.headline || "The year in clothes"}</p>

      <div className="figs" style={{ marginTop: 32 }}>
        <div><div className="big">{s.log.length}</div><div className="sub">Wears logged</div></div>
        <div><div className="big">{s.days.length}</div><div className="sub">Days dressed and recorded</div></div>
        <div><div className="big">{s.streak}</div><div className="sub">Longest run of days logged</div></div>
      </div>

      {s.star && <section className="rv-sec">
        <p className="small muted">Piece of the year</p>
        <div className="im" style={{ maxWidth: 420, backgroundImage: photo(s.star) ? `url(${photo(s.star)})` : "" }} />
        <h2 style={{ marginTop: 20 }}>{s.star.name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>Worn {s.starWears} times{s.star.price_paid ? `, now ${gbp(Number(s.star.price_paid) / (s.starWears || 1))} a wear this year` : ""}.</p>
      </section>}

      {s.top3.length > 1 && <section className="rv-sec"><p className="small muted">Most worn</p>
        <ol className="rv-list">{s.top3.map(({ i, n }) => <li key={i.id}><Link to={`/item/${i.id}`}>{i.name}</Link><span>{n}</span></li>)}</ol></section>}

      {s.topPair && <section className="rv-sec"><p className="small muted">Signature pairing</p>
        <div className="row" style={{ gap: 10 }}>{[s.topPair.a, s.topPair.b].map(i => <div key={i.id} className="piece"><div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div></div>)}</div>
        <p>Worn together {s.topPair.n} times.</p></section>}

      {s.colour && <section className="rv-sec"><p className="small muted">Colour of the year</p>
        <div className="rv-swatch" style={{ background: cssColour(s.colour) || "var(--stone)" }} /><h2 style={{ marginTop: 16 }}>{s.colour}</h2></section>}

      <section className="rv-sec"><p className="small muted">Wears by month</p>
        <div className="dow" style={{ gridTemplateColumns: "repeat(12,1fr)", gap: 6 }}>{s.months.map((n, k) => (
          <div key={k}><div className="col"><i style={{ height: `${n / maxM * 100}%` }} /></div><span>{MONTHS[k]}</span></div>))}</div></section>

      <section className="rv-sec"><p className="small muted">Buying</p>
        <div className="figs">
          <div><div className="big">{s.added.length}</div><div className="sub">Pieces added, {s.used} secondhand</div></div>
          <div><div className="big">{gbp(s.spent)}</div><div className="sub">Spent</div></div>
          {s.saved > 0 && <div><div className="big">{gbp(s.saved)}</div><div className="sub">Saved against full price, across {s.savedN} pieces</div></div>}
          {s.avgSus != null && <div><div className="big">{s.avgSus.toFixed(1)}<small>/10</small></div><div className="sub">Average sustainability of what you added</div></div>}
        </div>
        {s.cpw.length > 0 && <p style={{ marginTop: 18 }}>Best value: <Link to={`/item/${s.cpw[0].i.id}`}>{s.cpw[0].i.name}</Link>, at {gbp(s.cpw[0].v)} a wear.</p>}
      </section>

      <section className="rv-sec"><p className="small muted">Care</p>
        <p>{extra.care} care and repair tasks done{extra.repairs ? `, including ${extra.repairs} repair${extra.repairs === 1 ? "" : "s"}${extra.repairSpend ? ` costing ${gbp(extra.repairSpend)}` : ""}` : ""}. {s.retired} piece{s.retired === 1 ? "" : "s"} retired. {extra.saved} outfits saved or worn from suggestions.</p>
        {s.unworn.length > 0 && <p className="muted">{s.unworn.length} piece{s.unworn.length === 1 ? "" : "s"} weren’t worn at all this year{s.unwornValue ? `, ${gbp(s.unwornValue)} in total` : ""}. <Link to="/rescue">See what could be rescued</Link>.</p>}
      </section>

      <section className="rv-sec">
        {note ? <>
          <p className="small muted">Editor’s letter</p>
          {note.letter.split(/\n+/).map((p, k) => <p key={k} className="rv-letter">{p}</p>)}
          <p className="small" style={{ marginTop: 20 }}>For {year + 1}: {note.resolution}</p>
        </> : <button className="btn" disabled={!!busy} onClick={writeNote}>Write my editor’s letter</button>}
        <Status busy={busy} error={err} />
      </section>
    </div>
  );
}
