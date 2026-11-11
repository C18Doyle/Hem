// Batch wardrobe entry: many photos at once, or one photo of several pieces.
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import { shrink, removeBg } from "../lib/image.js";
import { cutBgDefault } from "../lib/prefs.js";
import { CATEGORIES, cleanItem } from "../components/ItemForm.jsx";
import { ACQUIRED } from "../lib/quality.js";
import { CONDITION } from "../lib/condition.js";
import { DIRECTORY } from "../lib/brands.js";
import { Seg, Status } from "../components/Ui.jsx";

const uid = () => Math.random().toString(36).slice(2, 9);
async function pool(tasks, n) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k]().catch(e => e); } })); return out; }

function crop(img, [x, y, w, h]) {
  const c = document.createElement("canvas");
  c.width = Math.round(w * img.width); c.height = Math.round(h * img.height);
  c.getContext("2d").drawImage(img, x * img.width, y * img.height, c.width, c.height, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
}
const loadImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

export default function AddBatch() {
  const { user, items, refresh } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState("many");
  const [cutBg, setCutBg] = useState(cutBgDefault());
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  const many = useRef(), one = useRef();
  const known = [...new Set([...items.map(i => (i.brand || "").trim()).filter(Boolean), ...DIRECTORY.map(b => b.name)])].sort();
  const upd = (key, patch) => setCards(cs => cs.map(c => c.key === key ? { ...c, ...patch, v: patch.v ? { ...c.v, ...patch.v } : c.v } : c));

  const removeBackgrounds = async list => {
    for (const c of list) {
      upd(c.key, { status: "cutting" });
      try { const cut = await removeBg(c.orig.blob); upd(c.key, { cut, status: "ready" }); } catch { upd(c.key, { status: "ready" }); }
    }
  };

  const addMany = async files => {
    setErr("");
    const fresh = [];
    for (const f of files) { try { fresh.push({ key: uid(), orig: await shrink(f, 1100), v: { acquired: "new" }, status: "tagging", include: true }); } catch {} }
    setCards(cs => [...cs, ...fresh]);
    setBusy(`Tagging ${fresh.length} piece${fresh.length === 1 ? "" : "s"}…`);
    await pool(fresh.map(c => async () => {
      try { const small = await shrink(c.orig.blob, 768, "image/jpeg", 0.8); const t = await post("tag", { image: small.dataUrl }); upd(c.key, { v: t, status: "ready" }); }
      catch (e) { upd(c.key, { status: "ready", note: "Couldn’t tag: fill in yourself" }); }
    }), 3);
    setBusy("");
    if (cutBg) removeBackgrounds(fresh);
  };

  const addOne = async f => {
    setErr(""); setBusy("Finding each piece in the photo…");
    try {
      const big = await shrink(f, 1400, "image/jpeg", 0.85);
      const { items: found } = await post("detect", { image: big.dataUrl });
      if (!found.length) throw new Error("No separate pieces found. Try a photo with garments laid out apart, on a plain background.");
      const img = await loadImg(big.dataUrl);
      const fresh = [];
      for (const d of found) { const { box, ...v } = d; fresh.push({ key: uid(), orig: await shrink(await crop(img, box), 1100), v: { acquired: "new", ...v }, status: "ready", include: true }); }
      setCards(cs => [...cs, ...fresh]);
      setBusy("");
      if (cutBg) removeBackgrounds(fresh);
    } catch (e) { setErr(e.message); setBusy(""); }
  };

  const saveAll = async () => {
    const list = cards.filter(c => c.include && c.status !== "saved");
    if (!list.length) return;
    setErr("");
    try {
      const rows = [];
      for (let k = 0; k < list.length; k++) {
        const c = list[k];
        setBusy(`Uploading ${k + 1} of ${list.length}…`);
        const img = c.cut || c.orig;
        const ext = img.blob.type === "image/png" ? "png" : "jpg";
        const photo_path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("wardrobe").upload(photo_path, img.blob, { contentType: img.blob.type });
        if (error) throw error;
        rows.push({ ...cleanItem(c.v), photo_path, _cond: c.cond });
      }
      setBusy("Saving…");
      const { data: saved, error } = await supabase.from("items").insert(rows.map(({ _cond, ...r }) => r)).select("id");
      if (error) throw error;
      const conds = saved.map((s, k) => rows[k]._cond ? { item_id: s.id, rating: rows[k]._cond } : null).filter(Boolean);
      if (conds.length) await supabase.from("conditions").insert(conds);
      await refresh();
      setCards(cs => cs.filter(c => !list.includes(c)));
      setBusy(`Saved ${rows.length} piece${rows.length === 1 ? "" : "s"}.`);
    } catch (e) { setErr(e.message); setBusy(""); }
  };

  const pending = cards.filter(c => c.include).length;
  const working = cards.some(c => c.status === "tagging" || c.status === "cutting");
  return (
    <div className="page">
      <h2>Add pieces</h2>
      <p className="lede">Photograph several pieces, check the details, save.</p>
      <Seg label="Method" value={mode} onChange={setMode} options={[["many", "Several photos"], ["one", "One photo of several"]]} />
      <p className="small muted" style={{ marginTop: 12 }}>{mode === "many" ? "One piece per photo." : "Up to 12 pieces, laid out apart on a plain surface."}</p>
      <p className="small" style={{ margin: "10px 0 0" }}><label><input type="checkbox" checked={cutBg} onChange={e => setCutBg(e.target.checked)} /> Remove backgrounds (slower)</label></p>
      <div className="row">
        <button className="btn" disabled={!!busy && !busy.startsWith("Saved")} onClick={() => (mode === "many" ? many : one).current.click()}>{mode === "many" ? "Choose photos" : "Take or choose a photo"}</button>
      </div>
      <input ref={many} type="file" accept="image/*" multiple hidden onChange={e => { const f = [...e.target.files]; e.target.value = ""; f.length && addMany(f); }} />
      <input ref={one} type="file" accept="image/*" hidden {...(params.get("camera") ? { capture: "environment" } : {})} onChange={e => { const f = e.target.files[0]; e.target.value = ""; f && addOne(f); }} />
      <Status busy={busy} error={err} />

      {cards.length > 0 && <>
        <div className="batch">{cards.map(c => (
          <div key={c.key} className={"bcard" + (c.include ? "" : " off")}>
            <div className="im" style={{ backgroundImage: `url(${(c.cut || c.orig).dataUrl})` }}>{c.status !== "ready" && <span className="badge">{c.status === "tagging" ? "Tagging…" : "Cutting out…"}</span>}</div>
            <div className="bf">
              <input type="text" aria-label="Name" value={c.v.name || ""} placeholder="Name" onChange={e => upd(c.key, { v: { name: e.target.value } })} />
              <div className="two" style={{ gap: "0 12px" }}>
                <select aria-label="Category" value={c.v.category || "Tops"} onChange={e => upd(c.key, { v: { category: e.target.value } })}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select>
                <input type="text" aria-label="Brand" list="batch-brands" value={c.v.brand || ""} placeholder="Brand" onChange={e => upd(c.key, { v: { brand: e.target.value } })} />
                <input type="number" aria-label="Bought for" inputMode="decimal" value={c.v.price_paid ?? ""} placeholder="Bought for, £" onChange={e => upd(c.key, { v: { price_paid: e.target.value } })} />
                <input type="number" aria-label="Cost new" inputMode="decimal" value={c.v.rrp ?? ""} placeholder="Cost new, £" onChange={e => upd(c.key, { v: { rrp: e.target.value, rrp_estimated: false } })} />
                <select aria-label="Acquired" value={c.v.acquired || "new"} onChange={e => upd(c.key, { v: { acquired: e.target.value } })}>{ACQUIRED.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
                <select aria-label="Condition" value={c.cond ?? ""} onChange={e => upd(c.key, { cond: e.target.value ? Number(e.target.value) : null })}><option value="">Condition</option>{CONDITION.map(x => <option key={x.rating} value={x.rating}>{x.label}</option>)}</select>
              </div>
              {c.note && <div className="small muted">{c.note}</div>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="link quiet small" onClick={() => upd(c.key, { include: !c.include })}>{c.include ? "Skip this one" : "Include"}</button>
                {!c.cut && c.status === "ready" && <button className="link quiet small" onClick={() => removeBackgrounds([c])}>Remove background</button>}
              </div>
            </div>
          </div>))}</div>
        <datalist id="batch-brands">{known.map(b => <option key={b} value={b} />)}</datalist>
        <div className="row">
          <button className="btn" disabled={!pending || working || (!!busy && !busy.startsWith("Saved"))} onClick={saveAll}>Save {pending} piece{pending === 1 ? "" : "s"}</button>
          <button className="btn ghost" onClick={() => nav("/wardrobe")}>Done</button>
        </div>
        <p className="note">Other details are filled in from the photo.</p>
      </>}
    </div>
  );
}
