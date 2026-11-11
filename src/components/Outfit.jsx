import { useState } from "react";
import { supabase } from "../supabase.js";
import { useStore } from "../store.jsx";

const REASONS = ["Not me", "Colours clash", "Too formal", "Too casual", "Wrong for the weather", "Worn it too recently"];

export default function Outfit({ outfit, onChange, onReject, compact, large }) {
  const { byId, photo, logWear } = useStore();
  const [status, setStatus] = useState(outfit.status);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = async (patch) => {
    await supabase.from("outfits").update(patch).eq("id", outfit.id);
    setStatus(patch.status); onChange?.({ ...outfit, ...patch });
  };
  const wear = async () => { setStatus("worn"); try { await logWear(outfit.item_ids, outfit.id); } catch { setStatus(outfit.status); } };
  const reject = async (reason) => { setAsking(false); await set({ status: "rejected", reject_reason: reason }); onReject?.(outfit, reason); };

  const pieces = [
    ...(outfit.suggested || []).filter(s => s.anchor).map(s => ({ label: s.label, tag: "Anchor" })),
    ...outfit.item_ids.map(id => byId[id]).filter(Boolean).map(i => ({ label: i.name, img: photo(i), tag: "Yours" })),
    ...(outfit.suggested || []).filter(s => !s.anchor).map(s => ({ label: s.label, tag: "To buy" })),
  ];

  return (
    <div className="outfit">
      {!compact && <p className="t">{outfit.title}</p>}
      {outfit.occasion && !compact && <div className="small muted">{outfit.occasion}</div>}
      <div className={"strip" + (large ? " large" : "")}>
        {pieces.map((p, i) => (
          <div className="piece" key={i}>
            <div className="im" style={p.img ? { backgroundImage: `url(${p.img})` } : {}}>{p.img ? "" : p.label}</div>
            <div className="lb">{p.label}</div><div className="tag">{p.tag}</div>
          </div>
        ))}
      </div>
      {outfit.why && <p style={{ margin: "14px 0 0", maxWidth: "60ch" }}>{outfit.why}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        {status === "worn" ? <span className="small">Worn today. Logged against each piece.</span>
          : status === "rejected" ? <span className="small muted">Noted: {outfit.reject_reason || "not for you"}.</span>
          : <>
            <button className="btn sm" disabled={busy || !outfit.item_ids.length} onClick={wear}>Wear this</button>
            <button className="btn sm ghost" onClick={() => set({ status: status === "saved" ? "suggested" : "saved" })}>{status === "saved" ? "Saved" : "Save"}</button>
            <button className="link quiet" onClick={() => setAsking(a => !a)}>Not this</button>
          </>}
      </div>
      {asking && <div className="chips" style={{ marginTop: 14 }}>{REASONS.map(r => <button key={r} className="chip" onClick={() => reject(r)}>{r}</button>)}</div>}
    </div>
  );
}
