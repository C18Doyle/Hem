// #1 Calendar: log what you wore, plan ahead, copy a day and paste it onto others.
// Past days and today-once-worn are real wears. Future days are plans and never count as wears.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { useStore } from "../store.jsx";
import { iso, todayIso, parse, monthGrid } from "../lib/dates.js";
import { Status } from "../components/Ui.jsx";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_TAGS = ["Office", "Working from home", "Holiday", "Travel", "Weekend away", "Wedding", "Event", "Dinner", "Gym", "Sick"];

export default function Calendar() {
  const { user, items, byId, photo, wearLog, refresh, ui } = useStore();
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()]);
  const [plans, setPlans] = useState({});        // day -> plan row
  const [open, setOpen] = useState(null);        // day string
  const [clip, setClip] = useState(null);        // {ids, from}
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState([]);
  const [tags, setTags] = useState({});          // day -> {tags, note}
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const dlg = useRef();
  const today = todayIso();

  const cells = useMemo(() => monthGrid(ym[0], ym[1]), [ym]);
  const loadPlans = async () => {
    const { data } = await supabase.from("plans").select("*").gte("day", iso(cells[0])).lte("day", iso(cells[41]));
    setPlans(Object.fromEntries((data || []).map(p => [p.day, p])));
  };
  const loadTags = async () => {
    const { data } = await supabase.from("day_tags").select("*").gte("day", iso(cells[0])).lte("day", iso(cells[41]));
    setTags(Object.fromEntries((data || []).map(t => [t.day, t])));
  };
  useEffect(() => { loadPlans(); loadTags(); }, [cells]);
  const saveTags = async (from, to, t, note) => {
    const days = []; for (let d = parse(from); iso(d) <= (to || from); d.setDate(d.getDate() + 1)) days.push(iso(d));
    if (days.length > 62) throw new Error("Tag up to two months at a time");
    if (!t.length && !note) { await supabase.from("day_tags").delete().in("day", days); }
    else { const { error } = await supabase.from("day_tags").upsert(days.map(day => ({ user_id: user.id, day, tags: t, note: note || null })), { onConflict: "user_id,day" }); if (error) throw error; }
    await loadTags();
  };
  useEffect(() => { supabase.from("outfits").select("id,title,item_ids").eq("status", "saved").order("created_at", { ascending: false }).limit(20).then(({ data }) => setSaved(data || [])); }, []);
  useEffect(() => { open ? dlg.current?.showModal() : dlg.current?.close(); }, [open]);

  const wornOn = useMemo(() => {
    const m = {};
    wearLog.forEach(w => { (m[w.worn_on] ||= []).push(w.item_id); });
    return m;
  }, [wearLog]);

  const dayInfo = d => {
    const worn = wornOn[d] || [];
    const mode = d < today || (d === today && worn.length) ? "worn" : "plan";
    return { mode, ids: mode === "worn" ? worn : (plans[d]?.item_ids || []).filter(id => byId[id]) };
  };

  const setDay = async (d, ids) => {
    const { mode } = dayInfo(d);
    ids = [...new Set(ids)].filter(id => byId[id]);
    if (mode === "worn") {
      const { error: e1 } = await supabase.from("wears").delete().eq("worn_on", d); if (e1) throw e1;
      if (ids.length) { const { error } = await supabase.from("wears").insert(ids.map(item_id => ({ item_id, worn_on: d }))); if (error) throw error; }
      await refresh();
    } else if (ids.length) {
      const { error } = await supabase.from("plans").upsert({ user_id: user.id, day: d, item_ids: ids }, { onConflict: "user_id,day" }); if (error) throw error;
      await loadPlans();
    } else {
      await supabase.from("plans").delete().eq("day", d); await loadPlans();
    }
  };
  const run = async (msg, fn) => { setBusy(msg); setErr(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(""); };

  const tap = d => {
    if (!clip) return setOpen(d);
    const before = dayInfo(d).ids;
    run("Pasting…", async () => { await setDay(d, clip.ids); ui.toast("Pasted", { undo: () => run("", () => setDay(d, before)) }); });
  };
  const markWorn = d => run("Logging…", async () => {
    const ids = plans[d]?.item_ids || [];
    await supabase.from("wears").insert(ids.map(item_id => ({ item_id, worn_on: d })));
    await supabase.from("plans").delete().eq("day", d);
    await loadPlans(); await refresh();
  });

  const cur = open ? dayInfo(open) : null;
  const label = d => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="page">
      <div className="between">
        <h2>{new Date(ym[0], ym[1]).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>
        <div className="row">
          <button className="link quiet" aria-label="Previous month" onClick={() => setYm(([y, m]) => m ? [y, m - 1] : [y - 1, 11])}>Prev</button>
          <button className="link quiet" aria-label="Next month" onClick={() => setYm(([y, m]) => m === 11 ? [y + 1, 0] : [y, m + 1])}>Next</button>
        </div>
      </div>
      <p className="lede">Tap a day to log, plan or tag it.</p>

      <div className="cal" role="grid">
        {DOW.map(d => <div key={d} className="cal-h" role="columnheader">{d.slice(0, 1)}</div>)}
        {cells.map(c => {
          const d = iso(c), info = dayInfo(d), out = c.getMonth() !== ym[1];
          return (
            <button key={d} role="gridcell" className={"cal-d" + (out ? " out" : "") + (d === today ? " now" : "") + (info.mode === "plan" && info.ids.length ? " plan" : "") + (clip ? " pasting" : "")}
              onClick={() => tap(d)} aria-label={`${label(d)}${info.ids.length ? `, ${info.ids.length} pieces ${info.mode === "plan" ? "planned" : "worn"}` : ""}`}>
              <span className="n">{c.getDate()}</span>
              <span className="th">{info.ids.slice(0, 4).map(id => <i key={id} style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} />)}</span>
              {tags[d]?.tags?.length > 0 && <span className="tg">{tags[d].tags[0]}{tags[d].tags.length > 1 ? " +" : ""}</span>}
            </button>);
        })}
      </div>
      <p className="note">Faded days are plans, not wears.</p>
      <Status busy={busy} error={err} />

      {clip && <div className="clipbar" role="status">
        <span>Pasting {clip.ids.length} piece{clip.ids.length === 1 ? "" : "s"} from {parse(clip.from).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Tap days to paste.</span>
        <button className="btn sm" style={{ background: "var(--paper)", color: "var(--ink)" }} onClick={() => setClip(null)}>Done</button>
      </div>}

      <dialog ref={dlg} onClose={() => { setOpen(null); setPicking(false); }}>
        {open && <div className="dlg">
          <p className="small muted" style={{ margin: 0 }}>{cur.mode === "plan" ? "Planned" : "Worn"}</p>
          <h2>{label(open)}</h2>
          {!picking && <>
            {cur.ids.length ? <div className="strip">{cur.ids.map(id => (
              <div className="piece" key={id}>
                <div className="im" style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} />
                <div className="lb">{byId[id].name}</div>
                <button className="link quiet small" onClick={() => { const before = cur.ids, d = open; run("", async () => { await setDay(d, before.filter(x => x !== id)); ui.toast("Removed", { undo: () => run("", () => setDay(d, before)) }); }); }}>Remove</button>
              </div>))}</div>
              : <p className="muted">Nothing {cur.mode === "plan" ? "planned" : "logged"} yet.</p>}
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn sm" onClick={() => setPicking(true)}>Add pieces</button>
              {cur.ids.length > 0 && <button className="btn sm ghost" onClick={() => { setClip({ ids: cur.ids, from: open }); setOpen(null); }}>Copy this day</button>}
              {open === today && cur.mode === "plan" && cur.ids.length > 0 && <button className="btn sm ghost" onClick={() => markWorn(open)}>Mark as worn</button>}
            </div>
            {saved.length > 0 && <><label className="f">Use a saved outfit</label>
              <div className="chips">{saved.map(o => <button key={o.id} className="chip" onClick={() => run("Adding…", () => setDay(open, [...cur.ids, ...o.item_ids]))}>{o.title}</button>)}</div></>}
            {cur.ids.length > 0 && <button className="link quiet small" style={{ marginTop: 24 }} onClick={() => run("Clearing…", () => setDay(open, []))}>Clear day</button>}
          </>}
          {!picking && <DayTags day={open} cur={tags[open]} onSave={(to, t, note) => run("Saving…", () => saveTags(open, to, t, note))} />}
          {picking && <Picker items={items.filter(i => !i.retired)} photo={photo} initial={cur.ids}
            onDone={ids => run("Saving…", async () => { await setDay(open, ids); setPicking(false); })} onCancel={() => setPicking(false)} />}
          <div><button className="btn ghost" onClick={() => setOpen(null)}>Close</button></div>
          <Status busy={busy} error={err} />
        </div>}
      </dialog>
    </div>
  );
}

function DayTags({ day, cur, onSave }) {
  const [t, setT] = useState(cur?.tags || []), [note, setNote] = useState(cur?.note || ""), [to, setTo] = useState(""), [custom, setCustom] = useState("");
  useEffect(() => { setT(cur?.tags || []); setNote(cur?.note || ""); setTo(""); }, [day, cur?.id]);
  const all = [...new Set([...DAY_TAGS, ...t])];
  return <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
    <p className="small muted" style={{ margin: "0 0 10px" }}>Tag the day</p>
    <div className="chips">{all.map(x => <button key={x} className="chip" aria-pressed={t.includes(x)} onClick={() => setT(s => s.includes(x) ? s.filter(y => y !== x) : [...s, x])}>{x}</button>)}</div>
    <div className="row" style={{ marginTop: 10 }}>
      <input type="text" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Your own tag" style={{ flex: 1 }} aria-label="Custom tag" />
      <button className="link quiet small" onClick={() => { const c = custom.trim(); if (c) { setT(s => [...new Set([...s, c])]); setCustom(""); } }}>Add</button>
    </div>
    <label className="f" htmlFor="dt-note">Note</label>
    <input id="dt-note" type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Flight to Edinburgh, dinner at 8" />
    <label className="f" htmlFor="dt-to">Apply to every day until, optional</label>
    <input id="dt-to" type="date" min={day} value={to} onChange={e => setTo(e.target.value)} />
    <button className="btn sm" style={{ marginTop: 14 }} onClick={() => onSave(to || day, t, note)}>Save tags{to ? " for the range" : ""}</button>
  </div>;
}

function Picker({ items, photo, initial, onDone, onCancel }) {
  const [sel, setSel] = useState(initial);
  const [cat, setCat] = useState("All");
  const cats = ["All", ...new Set(items.map(i => i.category))];
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  return <>
    <div className="chips" style={{ margin: "8px 0 18px" }}>{cats.map(c => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: "18px 10px" }}>
      {items.filter(i => cat === "All" || i.category === cat).map(i => (
        <button key={i.id} className={"item" + (sel.includes(i.id) ? " sel" : "")} aria-pressed={sel.includes(i.id)} onClick={() => toggle(i.id)}>
          <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="nm small">{i.name}</div></button>))}
    </div>
    <div className="row"><button className="btn sm" style={{ marginTop: 20 }} onClick={() => onDone(sel)}>Save {sel.length} piece{sel.length === 1 ? "" : "s"}</button>
      <button className="link quiet" style={{ marginTop: 20 }} onClick={onCancel}>Cancel</button></div>
  </>;
}
