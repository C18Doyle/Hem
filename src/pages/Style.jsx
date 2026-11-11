// #5 Outfits around a piece, learning from feedback
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import Outfit from "../components/Outfit.jsx";
import { PhotoPick, Seg, Status } from "../components/Ui.jsx";

export default function Style() {
  const { items, photo } = useStore();
  const [view, setView] = useState("build");
  const [params] = useSearchParams();
  const [src, setSrc] = useState("ward"), [sel, setSel] = useState(params.get("anchor"));
  const [desc, setDesc] = useState(""), [img, setImg] = useState(null);
  const [occasion, setOccasion] = useState(""), [mix, setMix] = useState("mine");
  const [outs, setOuts] = useState([]), [gap, setGap] = useState("");
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const live = items.filter(i => !i.retired);

  useEffect(() => {
    if (view === "saved") supabase.from("outfits").select("*").eq("status", "saved").order("created_at", { ascending: false }).then(({ data }) => setSaved(data || []));
  }, [view]);

  const go = async () => {
    setErr(""); setOuts([]); setGap(""); setBusy("Building outfits…");
    try {
      const r = await post("outfits", src === "ward" ? { anchorId: sel, occasion, mix } : { anchorText: desc, anchorImage: img?.dataUrl, occasion, mix });
      setOuts(r.outfits); setGap(r.gap);
    } catch (e) { setErr(e.message); }
    setBusy("");
  };

  return (
    <div className="page">
      <div className="between"><h2>Style</h2>
        <Seg label="View" value={view} onChange={setView} options={[["build", "Build"], ["saved", "Saved"]]} /></div>
      {view === "saved" ? (saved.length ? saved.map(o => <Outfit key={o.id} outfit={o} />) : <p className="muted">Outfits you save appear here.</p>) : <>
        <p className="lede">Outfits built around one piece.</p>
        <Seg label="Source" value={src} onChange={setSrc} options={[["ward", "From wardrobe"], ["new", "Something new"]]} />
        {src === "ward" ? (live.length
          ? <div className="grid" style={{ marginTop: 22 }}>{live.map(i => (
              <button key={i.id} className={"item" + (sel === i.id ? " sel" : "")} aria-pressed={sel === i.id} onClick={() => setSel(i.id)}>
                <div className="im" style={{ backgroundImage: photo(i) ? `url(${photo(i)})` : "" }} /><div className="nm">{i.name}</div></button>))}</div>
          : <p className="muted">Your wardrobe is empty. Describe something new instead.</p>)
          : <><label className="f" htmlFor="s-d">Describe the piece</label>
              <input id="s-d" type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Camel double-breasted overcoat" />
              <PhotoPick value={img} onChange={setImg} /></>}
        <label className="f" htmlFor="s-o">Occasion, optional</label>
        <input id="s-o" type="text" value={occasion} onChange={e => setOccasion(e.target.value)} placeholder="e.g. Meetings in London" />
        <label className="f">Pieces to use</label>
        <Seg label="Pieces to use" value={mix} onChange={setMix} options={[["mine", "My wardrobe only"], ["both", "Plus new ideas"]]} />
        <div><button className="btn" disabled={!!busy || (src === "ward" ? !sel : !desc && !img)} onClick={go}>Build outfits</button></div>
        <Status busy={busy} error={err} />
        {outs.length > 0 && <div className="result">{outs.map(o => <Outfit key={o.id} outfit={o} />)}{gap && <p className="note">Biggest gap: {gap}</p>}</div>}
      </>}
    </div>
  );
}
