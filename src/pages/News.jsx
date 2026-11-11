// #5 Fashion reading, from sources you choose (edit api/_lib/feeds.js)
import { useEffect, useState } from "react";
import { post } from "../api.js";
import { Status } from "../components/Ui.jsx";

export default function News() {
  const [d, setD] = useState(null), [tag, setTag] = useState("All"), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const load = async (refresh = false) => {
    setBusy("Loading…"); setErr("");
    try { setD(await post("news", { refresh })); } catch (e) { setErr(e.message); }
    setBusy("");
  };
  useEffect(() => { load(); }, []);
  const tags = d ? ["All", ...new Set(d.sources.map(s => s.tag))] : [];
  const list = d ? d.articles.filter(a => tag === "All" || a.tag === tag) : [];
  return (
    <div className="page">
      <div className="between"><h2>Industry</h2><button className="link quiet small" onClick={() => load(true)}>Refresh</button></div>
      <p className="lede">Supply chains, retail, regulation, sustainability.</p>
      {d && <div className="chips" style={{ marginBottom: 12 }}>{tags.map(t => <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(t)}>{t}</button>)}</div>}
      <Status busy={busy} error={err} />
      {list.map((a, i) => (
        <a key={a.link} href={a.link} target="_blank" rel="noopener noreferrer" className={"news" + (i === 0 && a.image ? " lead" : "")}>
          {a.image && <img src={a.image} alt="" loading="lazy" />}
          <div>
            <div className="small muted">{a.source}{a.date ? `, ${new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</div>
            <div className="hl">{a.title}</div>
            {a.summary && <p className="small muted">{a.summary}</p>}
          </div>
        </a>))}
      {d?.failed?.length > 0 && <p className="note">Couldn’t load: {d.failed.join(", ")}. Check those feed addresses in api/_lib/feeds.js.</p>}
    </div>
  );
}
