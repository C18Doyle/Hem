// AI spend and cap, price alert preferences, backup and restore, error log
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { useStore } from "../store.jsx";
import { exportAll, restore } from "../lib/backup.js";
import { gbp } from "../lib/quality.js";
import { Seg, Status } from "../components/Ui.jsx";
import { useUi } from "../components/UiProvider.jsx";
import { pref } from "../lib/prefs.js";

const NAMES = { tag: "Tagging", detect: "Batch detection", quality: "Quality", outfits: "Outfits", today: "Today", search: "Price search", precheck: "Before you buy", "wishlist-check": "Wishlist checks", "cron/prices": "Daily price checks", "batch/wishlist": "Overnight price checks (half price)", rrp: "Cost-new estimates", detect: "Batch detection", brand: "Brand research", suggest: "Wardrobe gaps", pairings: "Goes with", rescue: "Alteration rescue", review: "Year in review" };

export default function Settings() {
  const { user, refresh } = useStore();
  const [tab, setTab] = useState("spend");
  return (
    <div className="page">
      <h2>Settings</h2>
      <Seg label="Section" value={tab} onChange={setTab} options={[["spend", "AI spend"], ["alerts", "Alerts"], ["photos", "Photos"], ["backup", "Backup"], ["errors", "Errors"]]} />
      {tab === "spend" && <Spend user={user} />}
      {tab === "alerts" && <Alerts user={user} />}
      {tab === "photos" && <Photos />}
      {tab === "backup" && <Backup user={user} refresh={refresh} />}
      {tab === "errors" && <Errors />}
    </div>
  );
}

function useSettings(user) {
  const [s, setS] = useState(null);
  useEffect(() => { supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setS(data || { user_id: user.id, monthly_cap_gbp: 10, email_alerts: true, alert_drop_pct: 15 })); }, [user.id]);
  const save = async patch => { const next = { ...s, ...patch, updated_at: new Date().toISOString() }; setS(next); const { error } = await supabase.from("settings").upsert(next); return error; };
  return [s, save];
}

function Spend({ user }) {
  const [s, save] = useSettings(user);
  const [rows, setRows] = useState([]), [cap, setCap] = useState(""), [msg, setMsg] = useState("");
  useEffect(() => {
    supabase.from("api_usage").select("at,endpoint,cost_gbp,web_searches").gte("at", new Date(Date.now() - 62 * 864e5).toISOString()).order("at").then(({ data }) => setRows(data || []));
  }, []);
  useEffect(() => { if (s) setCap(s.monthly_cap_gbp); }, [s?.monthly_cap_gbp]);
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const month = rows.filter(r => new Date(r.at) >= start);
  const spent = month.reduce((t, r) => t + Number(r.cost_gbp), 0);
  const by = {}; month.forEach(r => { (by[r.endpoint] ||= { cost: 0, calls: 0 }); by[r.endpoint].cost += Number(r.cost_gbp); by[r.endpoint].calls++; });
  const days = Array.from({ length: 30 }, (_, k) => { const d = new Date(Date.now() - (29 - k) * 864e5).toISOString().slice(0, 10); return { d, v: rows.filter(r => r.at.slice(0, 10) === d).reduce((t, r) => t + Number(r.cost_gbp), 0) }; });
  const maxD = Math.max(0.01, ...days.map(x => x.v));
  const pct = s ? Math.min(100, spent / Number(s.monthly_cap_gbp) * 100) : 0;
  const money = n => n < 1 ? `${Math.round(n * 100)}p` : gbp(n);
  return <>
    <div className="figs" style={{ marginTop: 24 }}>
      <div><div className="big">{money(spent)}</div><div className="sub">Spent this month</div></div>
      <div><div className="big">{s ? gbp(Number(s.monthly_cap_gbp)) : "—"}</div><div className="sub">Monthly cap. AI features stop when it’s reached.</div></div>
    </div>
    <div className="hbar" style={{ marginTop: 16 }}><i style={{ width: pct + "%" }} /></div>
    <h3>Last 30 days</h3>
    <div className="dow" style={{ gridTemplateColumns: "repeat(30,1fr)", gap: 2, height: 90 }}>{days.map(x => <div key={x.d} title={`${x.d}: ${money(x.v)}`}><div className="col"><i style={{ height: x.v / maxD * 100 + "%" }} /></div></div>)}</div>
    <h3>By feature, this month</h3>
    {Object.keys(by).length ? <ul className="plain">{Object.entries(by).sort((a, b) => b[1].cost - a[1].cost).map(([k, v]) => (
      <li key={k} className="between"><span>{NAMES[k] || k} <span className="small muted">{v.calls} call{v.calls === 1 ? "" : "s"}</span></span><span>{money(v.cost)}</span></li>))}</ul> : <p className="muted">No AI calls yet this month.</p>}
    <label className="f" htmlFor="cap">Monthly cap, £</label>
    <input id="cap" type="number" min="0" step="1" value={cap} onChange={e => setCap(e.target.value)} />
    <button className="btn sm" style={{ marginTop: 14 }} onClick={async () => { const e = await save({ monthly_cap_gbp: Number(cap) || 0 }); setMsg(e ? e.message : "Saved."); }}>Save cap</button>
    <Status busy={msg} />
    <p className="note">Estimates. Compare with the Claude Console in your first month.</p>
  </>;
}

function Alerts({ user }) {
  const [s, save] = useSettings(user);
  const [msg, setMsg] = useState("");
  if (!s) return <p className="muted">Loading…</p>;
  return <>
    <p className="muted" style={{ marginTop: 24 }}>Alerts fire at your target price, or on a drop of this size.</p>
    <label className="f">Email alerts to {user.email}</label>
    <Seg label="Email alerts" value={s.email_alerts ? "on" : "off"} onChange={v => save({ email_alerts: v === "on" }).then(e => setMsg(e ? e.message : "Saved."))} options={[["on", "On"], ["off", "Off"]]} />
    <label className="f" htmlFor="drop">Alert on a drop of, %</label>
    <input id="drop" type="number" min="5" max="80" value={s.alert_drop_pct} onChange={e => save({ alert_drop_pct: Number(e.target.value) || 15 })} />
    <Status busy={msg} />
    <p className="note">One email per new low. Needs RESEND_API_KEY and ALERT_FROM in Vercel.</p>
  </>;
}

function Backup({ user, refresh }) {
  const ui = useUi();
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [done, setDone] = useState("");
  const file = useRef();
  const run = async (fn, ok) => { setErr(""); setDone(""); try { const r = await fn(); setDone(ok(r)); } catch (e) { setErr(e.message); } setBusy(""); };
  return <>
    <h3>Export</h3>
    <p className="muted" style={{ marginTop: 0 }}>Data, spreadsheets and photos in one zip.</p>
    <button className="btn" disabled={!!busy} onClick={() => run(() => exportAll(setBusy), r => `Exported ${r.items} pieces and ${r.photos} photos.`)}>Download backup</button>
    <h3>Restore</h3>
    <p className="muted" style={{ marginTop: 0 }}>Loads a Hem backup into this account. Matching records are overwritten.</p>
    <button className="btn ghost" disabled={!!busy} onClick={() => file.current.click()}>Choose backup file</button>
    <input ref={file} type="file" accept=".zip" hidden onChange={e => {
      const f = e.target.files[0]; e.target.value = "";
      if (f) ui.confirm({ title: "Restore this backup?", body: `${f.name}. Matching records in this account will be overwritten.`, okLabel: "Restore", danger: true }).then(ok => ok && run(async () => { const r = await restore(f, user.id, setBusy); await refresh(); return r; }, r => `Restored ${r.rows} records and ${r.photos} photos.`));
    }} />
    <Status busy={busy} error={err}>{done}</Status>
  </>;
}

function Errors() {
  const [rows, setRows] = useState(null), [copied, setCopied] = useState(false);
  const load = () => supabase.from("error_log").select("*").order("at", { ascending: false }).limit(50).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);
  const text = (rows || []).map(r => `${r.at} [${r.source}] ${r.message}${r.detail ? "\n" + JSON.stringify(r.detail) : ""}`).join("\n\n");
  return <>
    <p className="muted" style={{ marginTop: 24 }}>Newest first.</p>
    {rows && rows.length > 0 && <div className="row"><button className="btn sm" style={{ marginTop: 0 }} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}>{copied ? "Copied" : "Copy all"}</button>
      <button className="link quiet small" onClick={async () => { await supabase.from("error_log").delete().gte("at", "1970-01-01"); load(); }}>Clear</button></div>}
    {rows == null ? <p className="muted">Loading…</p> : !rows.length ? <p>No errors logged.</p> :
      <ul className="plain" style={{ marginTop: 16 }}>{rows.map(r => (
        <li key={r.id}><div className="small muted">{new Date(r.at).toLocaleString("en-GB")}, {r.source}</div><div style={{ wordBreak: "break-word" }}>{r.message}</div></li>))}</ul>}
  </>;
}

function Photos() {
  const [cut, setCut] = useState(pref.get("cutbg", true));
  return <>
    <label className="f">Remove backgrounds when adding pieces</label>
    <Seg label="Remove backgrounds" value={cut ? "on" : "off"} onChange={v => { setCut(v === "on"); pref.set("cutbg", v === "on"); }} options={[["on", "On"], ["off", "Off"]]} />
    <p className="note">Applies to single and batch adding. Keeps the wardrobe grid consistent. Slower on older phones.</p>
  </>;
}
