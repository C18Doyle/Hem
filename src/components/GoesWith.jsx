// "Goes with" on the item page: instant rule-based list, plus Claude's reasons on request
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { goesWith } from "../lib/pairs.js";
import { Status } from "./Ui.jsx";
import PairResult from "./PairResult.jsx";

export default function GoesWith({ item }) {
  const { items, photo } = useStore();
  const groups = goesWith(item, items);
  const [r, setR] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const sig = items.length + ":" + items.reduce((m, i) => (i.created_at > m ? i.created_at : m), "");
  const key = `hem.pair.${item.id}`;
  useEffect(() => { try { const c = JSON.parse(localStorage.getItem(key) || "null"); setR(c && c.sig === sig ? c.r : null); } catch { setR(null); } }, [item.id, sig]);
  const ask = async () => {
    setBusy("Asking…"); setErr("");
    try { const out = await post("pairings", { itemId: item.id }); setR(out); try { localStorage.setItem(key, JSON.stringify({ sig, r: out })); } catch {} } catch (e) { setErr(e.message); }
    setBusy("");
  };
  return (
    <>
      <h3>Goes with</h3>
      {!groups.length ? <p className="muted">Nothing you own matches it.</p>
        : groups.map(([label, list]) => (
          <div key={label} style={{ marginBottom: 6 }}>
            <p className="small muted" style={{ margin: "14px 0 0" }}>{label}, {list.length}</p>
            <div className="strip">{list.map(i => (
              <Link key={i.id} to={`/item/${i.id}`} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div></Link>))}</div>
          </div>))}
      {!r && <button className="link" style={{ marginTop: 10 }} disabled={!!busy} onClick={ask}>Which work best?</button>}
      <Status busy={busy} error={err} />
      {r && <PairResult r={r} />}
    </>
  );
}
