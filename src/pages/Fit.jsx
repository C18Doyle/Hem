// #2 Your measurements and reference pieces
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";
import { useStore } from "../store.jsx";
import { BODY_FIELDS } from "../lib/fit.js";
import Measures from "../components/Measures.jsx";
import { Status } from "../components/Ui.jsx";

export default function Fit() {
  const { body, items, photo, user, refresh } = useStore();
  const [b, setB] = useState(body);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => setB(body), [body]);
  const refs = items.filter(i => i.fit === "well" && i.measures && Object.values(i.measures).some(v => v !== "" && v != null));
  const save = async () => {
    setBusy("Saving…"); setErr("");
    const { error } = await supabase.from("body_measurements").upsert({ user_id: user.id, data: b, updated_at: new Date().toISOString() });
    error ? setErr(error.message) : await refresh();
    setBusy(error ? "" : "Saved.");
  };
  return (
    <div className="page">
      <h2>Fit</h2>
      <p className="lede">Listings are compared with pieces you own that fit well.</p>

      <h3>Reference pieces</h3>
      {refs.length ? <div className="strip">{refs.map(i => (
        <Link to={`/item/${i.id}`} key={i.id} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="lb">{i.name}</div><div className="tag">{i.category}</div></Link>))}</div>
        : <p className="muted">None yet. On a piece that fits well, set “Fits well” and add its measurements.</p>}

      <h3>Body measurements</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Soft tape, over a thin layer.</p>
      <Measures fields={BODY_FIELDS} value={b} onChange={setB} />
      <button className="btn" onClick={save}>Save measurements</button>
      <Status busy={busy} error={err} />
    </div>
  );
}
