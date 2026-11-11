import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { shrink, removeBg } from "../lib/image.js";
import { cutBgDefault } from "../lib/prefs.js";
import ItemForm, { cleanItem } from "./ItemForm.jsx";
import { Status, Seg } from "./Ui.jsx";
import { CONDITION } from "../lib/condition.js";

export default function AddItem({ open, onClose }) {
  const { user, refresh } = useStore();
  const dlg = useRef(), file = useRef();
  const [orig, setOrig] = useState(null);     // jpeg original
  const [cut, setCut] = useState(null);       // background removed png
  const [useCut, setUseCut] = useState(cutBgDefault());
  const [v, setV] = useState({}), [cond, setCond] = useState(null);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");

  useEffect(() => { if (open) { reset(); dlg.current.showModal(); } else dlg.current?.close(); }, [open]);
  const reset = () => { setOrig(null); setCut(null); setV({}); setCond(null); setErr(""); setBusy(""); };

  const pick = async f => {
    setErr("");
    try {
      const o = await shrink(f, 1100); setOrig(o); setCut(null);
      setBusy("Reading the piece…");
      const small = await shrink(f, 768, "image/jpeg", 0.8); // tagging doesn't need full resolution
      const tagging = post("tag", { image: small.dataUrl, name: v.name, notes: v.material })
        .then(t => setV(cur => ({ ...t, ...Object.fromEntries(Object.entries(cur).filter(([, x]) => x)) })))
        .catch(e => setErr("Tagging failed: " + e.message + ". Fill in the details yourself."));
      const cutting = useCut ? removeBg(o.blob, m => setBusy(m)).then(setCut).catch(() => setUseCut(false)) : null;
      await Promise.all([tagging, cutting]);
    } catch (e) { setErr(e.message); }
    setBusy("");
  };

  const save = async () => {
    if (!orig && !v.name) return setErr("Add a photo or a name.");
    setBusy("Saving…"); setErr("");
    try {
      let photo_path = null;
      const img = useCut && cut ? cut : orig;
      if (img) {
        const ext = img.blob.type === "image/png" ? "png" : "jpg";
        photo_path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("wardrobe").upload(photo_path, img.blob, { contentType: img.blob.type });
        if (error) throw error;
      }
      const { data: row, error } = await supabase.from("items").insert({ ...cleanItem(v), photo_path }).select("id").single();
      if (error) throw error;
      if (cond) await supabase.from("conditions").insert({ item_id: row.id, rating: cond });
      await refresh(); onClose();
    } catch (e) { setErr(e.message); setBusy(""); }
  };

  const shown = useCut && cut ? cut : orig;
  return (
    <dialog ref={dlg} onClose={onClose} onCancel={onClose}>
      <div className="dlg">
        <h2>Add a piece</h2>
        <div className="photo">
          <div className="im" style={{ width: 120, aspectRatio: "3/4", backgroundImage: shown ? `url(${shown.dataUrl})` : "" }} />
          <div>
            <button className="link" onClick={() => file.current.click()}>{orig ? "Change photo" : "Choose photo"}</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files[0]; e.target.value = ""; f && pick(f); }} />
            <p className="small muted" style={{ margin: "10px 0 0" }}>
              <label><input type="checkbox" checked={useCut} onChange={e => setUseCut(e.target.checked)} /> Remove background</label>
            </p>
            {useCut && orig && !cut && !busy && <button className="link quiet small" onClick={() => { setBusy("Removing background…"); removeBg(orig.blob, setBusy).then(setCut).catch(e => setErr(e.message)).finally(() => setBusy("")); }}>Remove now</button>}
          </div>
        </div>
        <ItemForm v={v} set={setV} />
        <label className="f">Condition, optional</label>
        <Seg label="Condition" value={cond} onChange={x => setCond(cond === x ? null : x)} options={CONDITION.map(c => [c.rating, c.label])} />
        <div className="row">
          <button className="btn" disabled={!!busy} onClick={save}>Save piece</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
        <Status busy={busy} error={err} />
      </div>
    </dialog>
  );
}
