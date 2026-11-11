// What goes with this? For a piece you don't own yet (or a photo of one you do)
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { post } from "../api.js";
import { PhotoPick, Status } from "../components/Ui.jsx";
import PairResult from "../components/PairResult.jsx";

export default function Pair() {
  const [params] = useSearchParams();
  const [desc, setDesc] = useState(params.get("q") || ""), [img, setImg] = useState(null);
  const [r, setR] = useState(null), [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const go = async () => { setErr(""); setR(null); setBusy("Matching…"); try { setR(await post("pairings", { anchorText: desc, anchorImage: img?.dataUrl })); } catch (e) { setErr(e.message); } setBusy(""); };
  return (
    <div className="page">
      <h2>What goes with this?</h2>
      <p className="lede">What you already own that works with it.</p>
      <label className="f" htmlFor="p-d">The piece</label>
      <input id="p-d" type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Rust corduroy overshirt, 8-wale" />
      <PhotoPick value={img} onChange={setImg} />
      <div><button className="btn" disabled={!!busy || (!desc && !img)} onClick={go}>Find matches</button></div>
      <Status busy={busy} error={err} />
      {r && <PairResult r={r} />}
    </div>
  );
}
