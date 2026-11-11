// Brand directory: built-in profiles, your own brands, and sourced sustainability ratings.
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { BRAND_DIMS, brandScore, brandKey } from "../lib/quality.js";
import { DIRECTORY, TIERS, profileOf } from "../lib/brands.js";
import { Chips, Meter, Seg, Status } from "../components/Ui.jsx";

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const AESTHETICS = [...new Set(DIRECTORY.flatMap(b => b.aesthetic))].sort();

export default function Brands() {
  const { key } = useParams();
  const [params] = useSearchParams();
  const { brands, items, refresh } = useStore();
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");

  const rate = async (n, again = false) => {
    setBusy(`Researching ${n}…`); setErr("");
    try { await post("brand", { name: n, refresh: again }); await refresh(); } catch (e) { setErr(e.message); }
    setBusy("");
  };

  // Every brand Hem knows about: directory, your wardrobe, and anything you've researched
  const all = useMemo(() => {
    const m = {};
    DIRECTORY.forEach(p => { m[brandKey(p.name)] = { key: brandKey(p.name), name: p.name, profile: p }; });
    items.forEach(i => { if (!i.brand) return; const k = brandKey(i.brand); (m[k] ||= { key: k, name: profileOf(i.brand)?.name || i.brand.trim(), profile: profileOf(i.brand) }); });
    Object.values(brands).forEach(b => { (m[b.brand_key] ||= { key: b.brand_key, name: b.name, profile: profileOf(b.name) }); });
    Object.values(m).forEach(b => {
      b.pieces = items.filter(i => !i.retired && i.brand && brandKey(i.brand) === b.key);
      b.rating = brands[b.key] || null;
      b.score = b.rating ? brandScore(b.rating.rating) : null;
    });
    return m;
  }, [items, brands]);

  if (key) return <Detail b={all[key] || (params.get("rate") && { key, name: params.get("rate"), pieces: [] })} all={all} onRate={rate} busy={busy} err={err} />;
  return <Directory all={all} initial={params.get("rate")} onRate={rate} busy={busy} err={err} />;
}

function Directory({ all, initial, onRate, busy, err }) {
  const [q, setQ] = useState(initial || ""), [tier, setTier] = useState(null), [look, setLook] = useState(null), [show, setShow] = useState("all");
  const list = Object.values(all).filter(b => {
    const t = q.trim().toLowerCase();
    if (t && !(b.name.toLowerCase().includes(t) || b.profile?.aliases.some(a => a.includes(t)) || b.profile?.city?.toLowerCase().includes(t))) return false;
    if (tier && b.profile?.tier !== tier) return false;
    if (look && !b.profile?.aesthetic.includes(look)) return false;
    if (show === "mine" && !b.pieces.length) return false;
    if (show === "rated" && !b.score) return false;
    return true;
  }).sort((a, z) => z.pieces.length - a.pieces.length || (a.profile ? 0 : 1) - (z.profile ? 0 : 1) || a.name.localeCompare(z.name));
  const typed = q.trim();
  const unknown = typed && !Object.values(all).some(b => b.name.toLowerCase() === typed.toLowerCase());
  return (
    <div className="page">
      <h2>Brands</h2>
      <p className="lede">Makers in the directory and in your wardrobe.</p>
      <input type="text" className="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search brands or cities" aria-label="Search brands" />
      <div style={{ margin: "14px 0 8px" }}><Seg label="Show" value={show} onChange={setShow} options={[["all", "All"], ["mine", "In my wardrobe"], ["rated", "Rated"]]} /></div>
      <Chips values={Object.values(TIERS)} selected={TIERS[tier]} multi={false} onToggle={x => { const k = Number(Object.keys(TIERS).find(k => TIERS[k] === x)); setTier(tier === k ? null : k); }} />
      <div style={{ height: 8 }} />
      <Chips values={AESTHETICS} selected={look} multi={false} onToggle={x => setLook(look === x ? null : x)} />
      {unknown && <p style={{ marginTop: 18 }}>{typed} isn’t in the directory. <button className="link" disabled={!!busy} onClick={() => onRate(typed)}>Research it</button></p>}
      <Status busy={busy} error={err} />
      <ul className="plain" style={{ marginTop: 18 }}>{list.map(b => (
        <li key={b.key}>
          <Link to={`/brands/${b.key}`} className="brandrow">
            <div className="between"><span className="bn">{b.name}</span><span className="small muted">{b.score ? `${b.score.overall}/10` : ""}</span></div>
            <div className="small muted">{[b.profile && `${b.profile.city}, ${b.profile.country}`, b.profile && TIERS[b.profile.tier], b.pieces.length ? `${b.pieces.length} of yours` : ""].filter(Boolean).join(". ")}</div>
            {b.profile && <div className="small" style={{ marginTop: 4 }}>{b.profile.knownFor}</div>}
          </Link>
        </li>))}</ul>
      <p className="note">Profiles as of November 2026. Ratings come from live, sourced research.</p>
    </div>
  );
}

function Detail({ b, all, onRate, busy, err }) {
  const { photo } = useStore();
  if (!b) return <div className="page"><p>Brand not found.</p><Link to="/brands">Brands</Link></div>;
  const p = b.profile, r = b.rating?.rating, s = b.score;
  return (
    <div className="page">
      <Link to="/brands" className="small muted">Brands</Link>
      <h2 style={{ marginTop: 12 }}>{b.name}</h2>
      {p && <>
        <p className="muted" style={{ marginTop: 0 }}>{p.city}, {p.country}{p.founded ? `. Founded ${p.founded}` : ""}{p.founders ? `. ${p.founders}` : ""}.</p>
        <p style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.4 }}>{p.knownFor}</p>
        <div className="chips"><span className="chip" aria-pressed="true">{TIERS[p.tier]}</span>{p.aesthetic.map(a => <span key={a} className="chip">{a}</span>)}</div>
        <p className="small muted" style={{ marginTop: 12 }}>Strongest in: {p.categories.join(", ").toLowerCase()}.{p.madeIn ? ` Made in ${p.madeIn.join(", ")}.` : ""}</p>
      </>}

      {b.pieces.length > 0 && <><h3>Your pieces</h3><div className="strip">{b.pieces.map(i => (
        <Link key={i.id} to={`/item/${i.id}`} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div></Link>))}</div></>}

      {p?.similar?.length > 0 && <><h3>Similar labels</h3><div className="chips">{p.similar.map(n => { const k = brandKey(n); return <Link key={n} to={`/brands/${k}`} className="chip">{n}{all[k]?.pieces.length ? ` (${all[k].pieces.length})` : ""}</Link>; })}</div></>}

      <h3>Sustainability and labour</h3>
      {!s ? <>
        <p className="muted" style={{ marginTop: 0 }}>Not researched yet.</p>
        <button className="btn" disabled={!!busy} onClick={() => onRate(b.name)}>Research {b.name}</button>
      </> : <>
        <p className="small muted" style={{ marginTop: 0 }}>Researched {new Date(b.rating.assessed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
        <div className="figs">
          <div><div className="big">{s.overall}<small>/10</small></div><div className="sub">Sustainability and labour</div><Meter value={s.overall} /></div>
          <div><div className="big" style={{ fontSize: 30, paddingTop: 14 }}>{s.confidence}</div><div className="sub">{s.evidenced} of 5 areas evidenced, {s.raters} independent rating{s.raters === 1 ? "" : "s"}</div></div>
        </div>
        {r.summary && <p style={{ fontFamily: "var(--serif)", fontSize: 19, lineHeight: 1.4, marginTop: 20 }}>{r.summary}</p>}
        {BRAND_DIMS.map(d => { const x = r.dims[d.key]; const sc = x.verified ? x.score : 3; return (
          <div className="dim" key={d.key}><span>{d.label}</span>
            <div className="bar"><i className={x.verified ? "" : "est"} style={{ width: `${sc * 10}%` }} /></div>
            <span style={{ textAlign: "right" }}>{sc}</span>
            <span className="ev">{x.evidence}{x.sources?.map(u => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>{host(u)}</a>)}</span></div>); })}
        {s.penalty > 0 && <p className="note">Includes a deduction of {s.penalty} for recent verified controversies.</p>}
        {r.thirdParty?.length > 0 && <><h3>Independent ratings</h3><ul className="plain">{r.thirdParty.map((t, i) => (
          <li key={i} className="between"><span>{t.rater}{t.year ? `, ${t.year}` : ""}{!t.verified && <span className="small muted"> (unverified)</span>}</span>
            {t.url && t.verified ? <a href={t.url} target="_blank" rel="noopener noreferrer">{t.rating}</a> : <span>{t.rating}</span>}</li>))}</ul></>}
        {r.controversies?.length > 0 && <><h3>Controversies</h3><ul className="plain">{r.controversies.map((c, i) => (
          <li key={i}>{c.issue}{c.year ? ` (${c.year})` : ""} {c.verified ? <a href={c.url} target="_blank" rel="noopener noreferrer" className="small">{host(c.url)}</a> : <span className="small muted">unverified, not scored</span>}</li>))}</ul></>}
        {r.unsupportedClaims?.length > 0 && <><h3>Claims without evidence</h3><ul className="plain">{r.unsupportedClaims.map((c, i) => <li key={i}>{c}</li>)}</ul></>}
        {r.programmes?.length > 0 && <p className="note">Repair, resale or take-back: {r.programmes.join("; ")}.</p>}
        <button className="btn ghost" disabled={!!busy} onClick={() => onRate(b.name, true)}>Research again</button>
      </>}
      <Status busy={busy} error={err} />
    </div>
  );
}
