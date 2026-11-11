// #3 Cost per wear, condition tracking, #10 care and repair log
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase.js";
import { useStore } from "../store.jsx";
import ItemForm, { cleanItem } from "../components/ItemForm.jsx";
import QualityResult from "../components/QualityResult.jsx";
import FitSection from "../components/FitSection.jsx";
import GoesWith from "../components/GoesWith.jsx";
import { FigsSkeleton } from "../components/Skeleton.jsx";
import { removeBg } from "../lib/image.js";
import { Chips, Seg, Status } from "../components/Ui.jsx";
import { costPerWear, inPractice, gbp, brandScore, saving, brandKey } from "../lib/quality.js";
import { CONDITION, conditionOf } from "../lib/condition.js";

const ISSUES = ["Pilling", "Fading", "Stretched", "Shrunk", "Holes", "Loose seams", "Lost buttons", "Bobbling", "Shine"];
const RATING = ["Worn out", "Fair", "Good", "Very good", "Like new"];
const today = () => new Date().toISOString().slice(0, 10);

export default function Item() {
  const { id } = useParams();
  const nav = useNavigate();
  const { byId, photo, wears, lastWorn, conditions, logWear, refresh, loading, brandFor, vers, wearLog, ui } = useStore();
  const item = byId[id];
  const [edit, setEdit] = useState(false), [v, setV] = useState({});
  const [tab, setTab] = useState("overview");
  const [logs, setLogs] = useState([]);
  const [newLog, setNewLog] = useState({ kind: "care", note: "", due_on: "", repeat_days: "", cost: "" });
  const [cond, setCond] = useState(null), [issues, setIssues] = useState([]);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");

  const loadLogs = () => supabase.from("care_logs").select("*").eq("item_id", id).order("created_at", { ascending: false }).then(({ data }) => setLogs(data || []));
  useEffect(() => { loadLogs(); }, [id]);
  useEffect(() => { if (item) setV(item); }, [item]);

  if (loading) return <div className="page"><div className="im sk" style={{ maxWidth: 360 }} /><div className="sk sk-line" style={{ width: "60%", height: 26, marginTop: 24 }} /><FigsSkeleton /></div>;
  if (!item) return <div className="page"><p>That piece isn’t in your wardrobe.</p><Link to="/wardrobe">Back to wardrobe</Link></div>;

  const n = wears[id] || 0;
  const cpw = costPerWear(item.price_paid, n, item.quality?.lifetimeWears);
  const practice = inPractice(item.quality, n, conditions[id]);
  const run = async (msg, fn) => { setBusy(msg); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(""); };

  const save = () => run("Saving…", async () => {
    const { error } = await supabase.from("items").update(cleanItem(v)).eq("id", id); if (error) throw error;
    await refresh(); setEdit(false);
  });
  const saveCondition = () => run("Saving…", async () => {
    const { error } = await supabase.from("conditions").insert({ item_id: id, rating: cond, issues }); if (error) throw error;
    setCond(null); setIssues([]); await refresh();
  });
  const addLog = () => run("Adding…", async () => {
    if (!newLog.note.trim()) throw new Error("Write what was done or what’s due");
    const row = { item_id: id, kind: newLog.kind, note: newLog.note.trim(),
      due_on: newLog.kind === "reminder" ? (newLog.due_on || today()) : null,
      repeat_days: newLog.kind === "reminder" && newLog.repeat_days ? Number(newLog.repeat_days) : null,
      done_on: newLog.kind === "reminder" ? null : today(), cost: newLog.cost ? Number(newLog.cost) : null };
    const { error } = await supabase.from("care_logs").insert(row); if (error) throw error;
    setNewLog({ kind: newLog.kind, note: "", due_on: "", repeat_days: "", cost: "" }); loadLogs(); refresh();
  });
  const addSuggested = () => run("Adding reminders…", async () => {
    const rows = (item.quality?.reminders || []).map(r => ({ item_id: id, kind: "reminder", note: r.note, repeat_days: r.repeatDays || null, due_on: new Date(Date.now() + (r.repeatDays || 30) * 864e5).toISOString().slice(0, 10) }));
    if (rows.length) await supabase.from("care_logs").insert(rows);
    loadLogs(); refresh();
  });
  const complete = r => run("", async () => {
    await supabase.from("care_logs").update({ done_on: today() }).eq("id", r.id);
    if (r.repeat_days) await supabase.from("care_logs").insert({ item_id: id, kind: "reminder", note: r.note, repeat_days: r.repeat_days, due_on: new Date(Date.now() + r.repeat_days * 864e5).toISOString().slice(0, 10) });
    loadLogs(); refresh();
  });
  const cutPhoto = () => run("Removing background…", async () => {
    const blob = await (await fetch(photo(item))).blob();
    const cut = await removeBg(blob);
    const path = `${item.user_id}/${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage.from("wardrobe").upload(path, cut.blob, { contentType: "image/png" });
    if (error) throw error;
    await supabase.from("items").update({ photo_path: path }).eq("id", id);
    await supabase.storage.from("wardrobe").remove([item.photo_path]);
    await refresh(); ui.toast("Background removed");
  });
  const retire = () => run("", async () => {
    const to = !item.retired;
    await supabase.from("items").update({ retired: to }).eq("id", id); await refresh();
    ui.toast(to ? "Retired" : "Back in the wardrobe", { undo: async () => { await supabase.from("items").update({ retired: !to }).eq("id", id); await refresh(); } });
  });
  const remove = async () => (await ui.confirm({ title: `Delete ${item.name}?`, body: "Its photo, wears and history go too. Retiring keeps the history.", okLabel: "Delete", danger: true })) && run("Deleting…", async () => {
    if (item.photo_path) await supabase.storage.from("wardrobe").remove([item.photo_path]);
    await supabase.from("items").delete().eq("id", id); await refresh(); nav("/wardrobe");
  });

  const spent = logs.reduce((s, l) => s + (Number(l.cost) || 0), 0);
  const reminders = logs.filter(l => l.kind === "reminder" && !l.done_on);
  const history = logs.filter(l => l.done_on);

  return (
    <div className="page item-page">
      <Link to="/wardrobe" className="small muted">Wardrobe</Link>
      <div className="im" style={{ marginTop: 16, maxWidth: 360, backgroundImage: photo(item) ? `url(${photo(item)})` : "" }} />
      {item.photo_path && !item.photo_path.endsWith(".png") && <button className="link quiet small" style={{ marginTop: 10 }} disabled={!!busy} onClick={cutPhoto}>Remove background</button>}
      <h2 style={{ marginTop: 24 }}>{item.name}</h2>
      <p className="muted" style={{ marginTop: 0 }}>{[item.brand, item.category, item.acquired && item.acquired !== "new" ? item.acquired : "", item.colours?.join(", ")].filter(Boolean).join(", ")}{item.retired ? ". Retired." : ""}</p>

      {item.brand && (() => { const b = brandFor(item.brand); const s = b && brandScore(b.rating); return (
        <p className="small" style={{ marginTop: 0 }}>{s ? <>Maker rating: <Link to={`/brands/${b.brand_key}`}>{b.name} {s.overall}/10</Link></> : <Link to={`/brands/${brandKey(item.brand)}`}>About {item.brand}, and its sustainability</Link>}</p>); })()}


      <Status busy={busy} error={err} />
      <div className="tabs-top" role="tablist">
        {[["overview", "Overview"], ["fit", "Fit and condition"], ["quality", "Quality"], ["care", "Care"]].map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t}</button>))}
      </div>

      {tab === "overview" && <>
      {(() => { const sv = saving(item); return (item.price_paid != null || item.rrp) ? (
        <div className="figs" style={{ marginTop: 24 }}>
          <div><div className="big">{item.price_paid != null ? gbp(Number(item.price_paid)) : "—"}</div><div className="sub">Bought for</div></div>
          <div><div className="big">{item.rrp ? gbp(Number(item.rrp)) : "—"}</div><div className="sub">Cost new{item.rrp_estimated ? ", estimated" : ""}</div></div>
          {sv && <div><div className="big">{sv.amount > 0 ? `${sv.pct}%` : sv.amount < 0 ? `+${-sv.pct}%` : "0%"}</div><div className="sub">{sv.amount > 0 ? `Saved ${gbp(sv.amount)}` : sv.amount < 0 ? `Paid ${gbp(-sv.amount)} over full price` : "Paid full price"}</div></div>}
        </div>) : null; })()}

      {/* #3 Cost per wear */}
      <div className="figs" style={{ marginTop: 28 }}>
        <div><div className="big">{n}</div><div className="sub">Wears{lastWorn[id] ? `, last ${new Date(lastWorn[id]).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</div></div>
        <div><div className="big">{cpw?.now ? gbp(cpw.now) : "—"}</div><div className="sub">{item.price_paid ? `Cost per wear of ${gbp(Number(item.price_paid))}` : "Add the price to see cost per wear"}</div></div>
        {cpw?.projected && <div><div className="big">{gbp(cpw.projected)}</div><div className="sub">Over its expected life</div></div>}
        {vers[id] && <div><div className="big">{vers[id].outfits}</div><div className="sub">Outfits it can make; actually worn with {vers[id].wornWith} piece{vers[id].wornWith === 1 ? "" : "s"}</div></div>}
      </div>
      {edit && <div><ItemForm v={v} set={setV} /><button className="btn" onClick={save}>Save changes</button></div>}

        <GoesWith item={item} />
      </>}

      {tab === "fit" && <>
        <FitSection item={item} onSaved={refresh} />
      <h3>Condition</h3>
      {(() => { const co = conditionOf(item, conditions, wearLog, wears); return <>
        <p style={{ margin: "0 0 6px" }}><span className="ctag big-tag">{co.label}</span>{co.issues?.length ? <span className="muted">{co.issues.join(", ").toLowerCase()}</span> : null}</p>
        {co.noted && <p className="muted small" style={{ marginTop: 0 }}>Checked {new Date(co.noted).toLocaleDateString("en-GB")}{co.since ? `, ${co.since} wears ago` : ""}.{co.due ? " Due a re-check." : ""}</p>}
        {!co.noted && co.due && <p className="small" style={{ marginTop: 0 }}>Worn {n} times and never checked. Rate it below.</p>}
      </>; })()}
      <Seg label="Condition" value={cond} onChange={setCond} options={RATING.map((r, i) => [i + 1, r]).reverse()} />
      {cond && <p className="small muted" style={{ margin: "8px 0 0" }}>{CONDITION.find(c => c.rating === cond)?.hint}</p>}
      {cond && <><div style={{ height: 12 }} /><Chips values={ISSUES} selected={issues} onToggle={x => setIssues(s => s.includes(x) ? s.filter(y => y !== x) : [...s, x])} />
        <button className="btn sm" style={{ marginTop: 16 }} onClick={saveCondition}>Save check</button></>}
      <p className="note">Re-rate every ten or so wears.</p>

      </>}

      {tab === "quality" && <>
      <h3 style={{ marginTop: 28 }}>Quality</h3>
      {item.quality
        ? <><QualityResult q={item.quality} price={item.price_paid} wears={n} practice={practice} acquired={item.acquired} brand={brandFor(item.brand)} />
            <Link className="btn ghost" to={`/quality?item=${id}`}>Reassess</Link></>
        : <><p className="muted">Not assessed.</p><Link className="btn" to={`/quality?item=${id}`}>Assess quality</Link></>}

      </>}

      {tab === "care" && <>
      <h3 style={{ marginTop: 28 }}>Care and repairs</h3>
      {reminders.length > 0 && <ul className="plain">{reminders.map(r => (
        <li key={r.id} className="between"><span>{r.note} <span className={"small " + (r.due_on <= today() ? "alert" : "muted")}>due {new Date(r.due_on).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{r.repeat_days ? `, every ${r.repeat_days} days` : ""}</span></span>
          <button className="link quiet small" onClick={() => complete(r)}>Done</button></li>))}</ul>}
      {item.quality?.reminders?.length > 0 && !reminders.length && <button className="link" style={{ marginTop: 8 }} onClick={addSuggested}>Add suggested reminders ({item.quality.reminders.map(r => r.note).join("; ")})</button>}

      <div style={{ marginTop: 20 }}>
        <Seg label="Entry type" value={newLog.kind} onChange={k => setNewLog({ ...newLog, kind: k })} options={[["care", "Care done"], ["repair", "Repair"], ["reminder", "Reminder"]]} />
        <label className="f" htmlFor="c-note">{newLog.kind === "reminder" ? "What needs doing" : "What was done"}</label>
        <input id="c-note" type="text" value={newLog.note} onChange={e => setNewLog({ ...newLog, note: e.target.value })}
          placeholder={newLog.kind === "repair" ? "e.g. Resoled at the cobbler" : newLog.kind === "reminder" ? "e.g. Re-proof with wax" : "e.g. Hand washed, dried flat"} />
        {newLog.kind === "reminder"
          ? <div className="two"><div><label className="f" htmlFor="c-due">Due</label><input id="c-due" type="date" value={newLog.due_on} onChange={e => setNewLog({ ...newLog, due_on: e.target.value })} /></div>
              <div><label className="f" htmlFor="c-rep">Repeat every (days)</label><input id="c-rep" type="number" value={newLog.repeat_days} onChange={e => setNewLog({ ...newLog, repeat_days: e.target.value })} /></div></div>
          : newLog.kind === "repair" && <><label className="f" htmlFor="c-cost">Cost, £</label><input id="c-cost" type="number" value={newLog.cost} onChange={e => setNewLog({ ...newLog, cost: e.target.value })} /></>}
        <button className="btn sm" style={{ marginTop: 16 }} onClick={addLog}>Add</button>
      </div>
      {history.length > 0 && <ul className="plain" style={{ marginTop: 20 }}>{history.map(l => (
        <li key={l.id}><span className="small muted">{new Date(l.done_on).toLocaleDateString("en-GB")} {l.kind === "repair" ? "repair" : l.kind === "reminder" ? "done" : "care"}</span><br />{l.note}{l.cost ? `, ${gbp(Number(l.cost))}` : ""}</li>))}</ul>}
      {spent > 0 && <p className="note">Spent on repairs: {gbp(spent)}. Cost per wear including repairs: {n ? gbp((Number(item.price_paid || 0) + spent) / n) : "—"}.</p>}

      <div className="row" style={{ marginTop: 48 }}>
        <button className="link quiet" onClick={retire}>{item.retired ? "Return to wardrobe" : "Retire this piece"}</button>
        <button className="link quiet" onClick={remove}>Delete</button>
      </div>
      </>}

      <div className="stickybar">
        <button className="btn" onClick={() => logWear([id]).catch(() => {})}>Wore it today</button>
        <button className="btn ghost" onClick={() => { setTab("overview"); setEdit(e => !e); }}>{edit ? "Close" : "Edit"}</button>
      </div>
    </div>
  );
}
