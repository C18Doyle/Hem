// Quality assessment: label + three photos + guided inspection + price
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { CHECKLIST, ACQUIRED } from "../lib/quality.js";
import QualityResult from "../components/QualityResult.jsx";
import { Chips, PhotoPick, Seg, Status } from "../components/Ui.jsx";

export default function Quality() {
  const [params] = useSearchParams();
  const { byId, refresh, brandFor } = useStore();
  const item = byId[params.get("item")];
  const [f, setF] = useState({ garment: "", brand: "", origin: "", pricePaid: "", labelText: "", acquired: "new", certifications: "" });
  const [ph, setPh] = useState({ label: null, garment: null, inside: null });
  const [check, setCheck] = useState({});
  const [inspect, setInspect] = useState(false), [precise, setPrecise] = useState(null);
  const [q, setQ] = useState(null);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");

  useEffect(() => {
    if (!item) return;
    const prev = item.quality?.inputs || {};
    setF({ garment: item.name, brand: item.brand || "", origin: prev.origin || "", pricePaid: item.price_paid ?? "", labelText: prev.labelText || "", acquired: item.acquired || "new", certifications: (item.certifications || []).join(", ") });
    if (prev.checklist) setCheck(prev.checklist);
  }, [item?.id]);

  const answered = Object.values(check).filter(Boolean).length;
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const go = async () => {
    setErr(""); setQ(null); setBusy("Assessing…");
    try {
      const photos = Object.entries(ph).filter(([, v]) => v).map(([kind, v]) => ({ kind, data: v.dataUrl }));
      const r = await post("quality", { itemId: item?.id, ...f, pricePaid: f.pricePaid ? Number(f.pricePaid) : null, checklist: check, photos, precise: precise ?? !!item });
      setQ(r); if (item) refresh();
    } catch (e) { setErr(e.message); }
    setBusy("");
  };

  return (
    <div className="page">
      <h2>{item ? `Assess ${item.name}` : "Assess quality"}</h2>
      <p className="lede">How well it’s made, and its footprint. More photos and checks mean a firmer score.</p>

      <label className="f" htmlFor="q-g">Garment</label>
      <input id="q-g" type="text" value={f.garment} onChange={set("garment")} placeholder="e.g. Oxford cloth shirt" />
      <div className="two">
        <div><label className="f" htmlFor="q-b">Brand</label><input id="q-b" type="text" value={f.brand} onChange={set("brand")} /></div>
        <div><label className="f" htmlFor="q-p">Price, £</label><input id="q-p" type="number" inputMode="decimal" value={f.pricePaid} onChange={set("pricePaid")} /></div>
      </div>
      <label className="f" htmlFor="q-o">Made in, from the label</label>
      <input id="q-o" type="text" value={f.origin} onChange={set("origin")} />
      <label className="f">Acquired</label>
      <Seg label="Acquired" value={f.acquired} onChange={a => setF({ ...f, acquired: a })} options={ACQUIRED} />
      <label className="f" htmlFor="q-c">Certifications on the label, optional</label>
      <input id="q-c" type="text" value={f.certifications} onChange={set("certifications")} placeholder="e.g. GOTS, RWS, recycled polyester" />
      <label className="f" htmlFor="q-l">Label text</label>
      <textarea id="q-l" value={f.labelText} onChange={set("labelText")} placeholder="e.g. 70% wool, 30% polyamide. Dry clean only." />

      <PhotoPick value={ph.label} onChange={v => setPh({ ...ph, label: v })} label="Add label photo" max={1200} />
      <PhotoPick value={ph.garment} onChange={v => setPh({ ...ph, garment: v })} label="Add photo of the whole piece" />
      <PhotoPick value={ph.inside} onChange={v => setPh({ ...ph, inside: v })} label="Add photo inside, showing a seam" max={1200} />

      <h3>Inspect it</h3>
      <p className="muted" style={{ marginTop: 0 }}>{answered ? `${answered} of ${CHECKLIST.length} answered.` : "Twelve quick checks, garment in hand."}</p>
      <button className="link" onClick={() => setInspect(i => !i)}>{inspect ? "Hide checks" : answered ? "Review checks" : "Start the checks"}</button>
      {inspect && <div style={{ marginTop: 8 }}>{CHECKLIST.map(c => (
        <div className="q" key={c.key}><p>{c.q}</p>
          <Chips values={c.a} selected={check[c.key]} multi={false} onToggle={x => setCheck({ ...check, [c.key]: check[c.key] === x ? undefined : x })} /></div>))}</div>}

      <p className="small" style={{ marginTop: 22 }}><label><input type="checkbox" checked={precise ?? !!item} onChange={e => setPrecise(e.target.checked)} /> Precise score (two or three runs, costs more)</label></p>
      <div><button className="btn" style={{ marginTop: 8 }} disabled={!!busy} onClick={go}>Assess</button></div>
      <Status busy={busy} error={err} />
      {q && <div className="result">
        <QualityResult q={q} price={f.pricePaid} acquired={f.acquired} brand={brandFor(f.brand)} />
        {item ? <Link className="btn ghost" to={`/item/${item.id}`}>Back to {item.name}</Link>
          : <p className="note">To keep the score, assess it from the piece’s page.</p>}
      </div>}
    </div>
  );
}
