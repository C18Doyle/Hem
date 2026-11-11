// Fit and garment measurements, on the item page
import { useEffect, useState } from "react";
import { supabase } from "../supabase.js";
import { GARMENT_FIELDS, GROUP } from "../lib/fit.js";
import Measures from "./Measures.jsx";
import { Chips, Seg, Status } from "./Ui.jsx";

export const FIT_ISSUES = ["Too long", "Too short", "Sleeves too long", "Sleeves too short", "Loose at the waist", "Tight at the waist", "Too boxy", "Too tight across the chest", "Shoulders wrong", "Rise wrong", "Legs too wide", "Missing button", "Broken zip", "Hem down"];

export default function FitSection({ item, onSaved }) {
  const g = GROUP(item.category);
  const [fit, setFit] = useState(item.fit || null), [issues, setIssues] = useState(item.fit_issues || []), [m, setM] = useState(item.measures || {});
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");
  useEffect(() => { setFit(item.fit || null); setIssues(item.fit_issues || []); setM(item.measures || {}); }, [item.id]);
  if (!g) return null;
  const save = async () => {
    setBusy("Saving…"); setErr("");
    const { error } = await supabase.from("items").update({ fit, fit_issues: fit === "well" ? [] : issues, measures: m }).eq("id", item.id);
    if (error) { setErr(error.message); setBusy(""); return; }
    await onSaved(); setBusy("Saved.");
  };
  return (
    <>
      <h3>Fit</h3>
      <Seg label="Fit" value={fit} onChange={setFit} options={[["well", "Fits well"], ["ok", "Fits OK"], ["poor", "Doesn’t fit"]]} />
      {fit && fit !== "well" && <><label className="f">What’s wrong</label>
        <Chips values={FIT_ISSUES} selected={issues} onToggle={x => setIssues(s => s.includes(x) ? s.filter(y => y !== x) : [...s, x])} /></>}
      <details style={{ marginTop: 20 }} open={fit === "well"}>
        <summary className="small" style={{ cursor: "pointer" }}>Garment measurements{fit === "well" ? ", so this can be your reference" : ""}</summary>
        <Measures fields={GARMENT_FIELDS[g]} value={m} onChange={setM} />
      </details>
      <button className="btn sm" style={{ marginTop: 18 }} onClick={save}>Save fit</button>
      <Status busy={busy} error={err} />
    </>
  );
}
