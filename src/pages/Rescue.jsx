// #7 Alteration rescue
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { Status } from "../components/Ui.jsx";

const DIAG = { fit: "A fit problem", repair: "Needs a repair", styling: "A styling problem, not fit", "let-go": "Let it go" };

export default function Rescue() {
  const { byId, photo, refresh } = useStore();
  const [r, setR] = useState(null), [done, setDone] = useState({});
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const go = async () => { setErr(""); setR(null); setBusy("Reviewing…"); try { setR(await post("rescue")); } catch (e) { setErr(e.message); } setBusy(""); };
  const toTailor = async p => {
    const note = "Tailor: " + p.work.map(w => w.task).join("; ") + (p.totalCost ? ` (about ${p.totalCost})` : "");
    const { error } = await supabase.from("care_logs").insert({ item_id: p.itemId, kind: "reminder", note, due_on: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) });
    if (error) return setErr(error.message);
    setDone(d => ({ ...d, [p.itemId]: "Added to care reminders" })); refresh();
  };
  const retire = async id => { await supabase.from("items").update({ retired: true }).eq("id", id); setDone(d => ({ ...d, [id]: "Retired" })); refresh(); };
  return (
    <div className="page">
      <h2>Alteration rescue</h2>
      <p className="lede">Rarely worn or badly fitting pieces, and whether a tailor can save them.</p>
      <button className="btn" disabled={!!busy} onClick={go}>Review unworn pieces</button>
      <Status busy={busy} error={err} />
      {r && <div className="result">
        {!r.pieces.length && <p>{r.note || "Nothing to rescue. Everything is being worn."}</p>}
        {r.pieces.map(p => { const i = byId[p.itemId]; if (!i) return null; return (
          <div className="outfit" key={p.itemId} style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 16 }}>
            <Link to={`/item/${i.id}`} className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} aria-label={i.name} />
            <div>
              <div className="small muted">{DIAG[p.diagnosis] || p.diagnosis}</div>
              <p className="t" style={{ fontSize: 21 }}>{i.name}</p>
              <p style={{ margin: "4px 0 0" }}>{p.why}</p>
              {p.work?.length > 0 && <ul className="plain" style={{ marginTop: 8 }}>{p.work.map((w, k) => (
                <li key={k} className="between"><span>{w.task} <span className="small muted">{w.difficulty}</span></span><span className="small">{w.cost}</span></li>))}</ul>}
              <p className="small" style={{ marginTop: 8 }}>{p.worthIt ? "Worth doing." : "Not worth it."} {p.reasoning}</p>
              {done[p.itemId] ? <span className="small">{done[p.itemId]}</span> : <div className="row" style={{ marginTop: 10 }}>
                {p.work?.length > 0 && p.worthIt && <button className="btn sm" onClick={() => toTailor(p)}>Take to a tailor</button>}
                {p.diagnosis === "styling" && <Link className="btn sm ghost" to={`/style?anchor=${i.id}`}>Style it</Link>}
                {(p.diagnosis === "let-go" || !p.worthIt) && <button className="btn sm ghost" onClick={() => retire(i.id)}>Retire it</button>}
              </div>}
            </div>
          </div>); })}
      </div>}
    </div>
  );
}
