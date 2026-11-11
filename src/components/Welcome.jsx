// First run: three steps, then out of the way.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store.jsx";

export const onboarded = () => { try { return localStorage.getItem("hem.onboarded") === "1"; } catch { return true; } };
export const finishOnboarding = () => { try { localStorage.setItem("hem.onboarded", "1"); } catch {} };

export default function Welcome({ onDone }) {
  const { items, photo, wearLog, logWear } = useStore();
  const [sel, setSel] = useState([]);
  const live = items.filter(i => !i.retired);
  const step = live.length < 5 ? 1 : wearLog.length === 0 ? 2 : 3;
  const done = () => { finishOnboarding(); onDone(); };
  return (
    <div className="page welcome">
      <p className="small muted">Step {step} of 3</p>
      <div className="steps">{[1, 2, 3].map(n => <i key={n} className={n <= step ? "on" : ""} />)}</div>
      {step === 1 && <>
        <h2>Add five pieces</h2>
        <p className="lede">Start with what you wear most. {live.length ? `${live.length} so far.` : ""}</p>
        <div className="row"><Link className="btn" to="/add">Add pieces</Link></div>
      </>}
      {step === 2 && <>
        <h2>What are you wearing today?</h2>
        <div className="grid small-grid" style={{ marginTop: 18 }}>{live.map(i => (
          <button key={i.id} className={"item" + (sel.includes(i.id) ? " sel" : "")} aria-pressed={sel.includes(i.id)} onClick={() => setSel(s => s.includes(i.id) ? s.filter(x => x !== i.id) : [...s, i.id])}>
            <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="nm small">{i.name}</div></button>))}</div>
        <button className="btn" disabled={!sel.length} onClick={() => logWear(sel)}>Log {sel.length || ""} {sel.length === 1 ? "piece" : "pieces"}</button>
      </>}
      {step === 3 && <>
        <h2>That’s it</h2>
        <p className="lede">Log what you wear each day and Hem fills in the rest.</p>
        <button className="btn" onClick={done}>Go to Today</button>
      </>}
      {step < 3 && <div><button className="link quiet small" style={{ marginTop: 32 }} onClick={done}>Skip</button></div>}
    </div>
  );
}
