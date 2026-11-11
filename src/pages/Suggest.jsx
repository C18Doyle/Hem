// #6 Wardrobe gaps: evidence only. No gaps is a good result.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { Status } from "../components/Ui.jsx";
import Flags from "../components/Flags.jsx";

const EVIDENCE = { overworked: "Overworked piece", "wearing-out": "Wearing out", unfillable: "Can’t dress for it", rejections: "Repeated rejections", stranded: "Stranded pieces" };

export default function Suggest() {
  const { byId, photo, items } = useStore();
  const nav = useNavigate();
  const [focus, setFocus] = useState("");
  const [r, setR] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState(""), [added, setAdded] = useState({});

  const go = async () => {
    setErr(""); setR(null); setBusy("Looking for gaps…");
    try { setR(await post("suggest", { focus })); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  const wish = async g => {
    const { error } = await supabase.from("wishlist").insert({ name: g.name, query: g.name });
    error ? setErr(error.message) : setAdded(a => ({ ...a, [g.name]: true }));
  };

  return (
    <div className="page">
      <h2>Wardrobe gaps</h2>
      <p className="lede">Gaps backed by your own wear and condition data.</p>
      {items.filter(i => !i.retired).length < 5 && <p className="muted">Add at least five pieces to your <Link to="/wardrobe">wardrobe</Link> first. Gaps get sharper the more wears and condition checks you log.</p>}
      <Flags title="Flagged automatically" />
      <label className="f" htmlFor="sg-f">Something coming up, optional</label>
      <input id="sg-f" type="text" value={focus} onChange={e => setFocus(e.target.value)} placeholder="e.g. A wedding in April, a week in Edinburgh in January" />
      <div><button className="btn" disabled={!!busy} onClick={go}>Find gaps</button></div>
      <Status busy={busy} error={err} />
      {r && <div className="result">
        {!r.gaps.length && <p style={{ fontFamily: "var(--serif)", fontSize: 24, lineHeight: 1.3, marginTop: 0 }}>No real gaps. {r.noGapReason}</p>}
        {r.observation && <p className="muted">{r.observation}</p>}
        {r.gaps.map((g, i) => (
          <div className="outfit" key={i}>
            <div className="small muted">{EVIDENCE[g.evidenceType]}</div>
            <p className="t">{g.name}</p>
            <p style={{ margin: "8px 0 0" }}>{g.evidence}</p>
            {g.relievesIds?.length > 0 && <div className="strip">{g.relievesIds.map(id => byId[id] && (
              <div className="piece" key={id}><div className="im" style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} /><div className="lb">{byId[id].name}</div></div>))}</div>}
            <div className="small muted" style={{ marginTop: 10 }}>Unlocks about {g.outfitsUnlocked} outfits. {g.route === "secondhand" ? "Look secondhand first." : g.route === "either" ? "New or secondhand." : ""}</div>
            {g.lookFor && <p className="note" style={{ marginTop: 8 }}>Look for: {g.lookFor}</p>}
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn sm ghost" onClick={() => nav(`/shop?tab=check&q=${encodeURIComponent(g.name)}`)}>Check before buying</button>
              {added[g.name] ? <span className="small">On wishlist</span> : <button className="link quiet small" onClick={() => wish(g)}>Add to wishlist</button>}
            </div>
          </div>))}
      </div>}
    </div>
  );
}
