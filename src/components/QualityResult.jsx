import { DIMENSIONS, SUSTAIN, sustainScore, gbp } from "../lib/quality.js";
import { Meter } from "./Ui.jsx";

export default function QualityResult({ q, price, wears = 0, practice, acquired, brand }) {
  if (!q) return null;
  const sus = sustainScore(q, acquired || q.inputs?.acquired || "new", brand);
  const lw = q.lifetimeWears;
  const mid = lw ? Math.round((Number(lw.low) + Number(lw.high)) / 2) : null;
  return (
    <>
      <div className="figs">
        <div><div className="big">{q.overall ?? "—"}<small>/10</small></div><div className="sub">Quality</div><Meter value={q.overall} /></div>
        <div><div className="big">{lw ? `${lw.low}–${lw.high}` : "—"}</div><div className="sub">Wears it should last</div></div>
        {sus?.overall != null && <div><div className="big">{sus.overall}<small>/10</small></div><div className="sub">Sustainability</div><Meter value={sus.overall} /></div>}
        <div><div className="big" style={{ fontSize: 30, paddingTop: 14 }}>{q.confidence}</div><div className="sub">Confidence</div></div>
      </div>
      {q.fibres?.length > 0 && <div className="chips" style={{ marginTop: 18 }}>{q.fibres.map((f, i) => <span key={i} className="chip">{f.percent}% {f.name}</span>)}</div>}
      <p className="note">{q.lifetimeBasis}</p>

      <h3>How it scores</h3>
      {DIMENSIONS.map(d => {
        const s = q.sub?.[d.key];
        if (!s) return null;
        return (
          <div className="dim" key={d.key}>
            <span>{d.label}</span>
            <div className="bar" title={s.observed ? "Based on evidence" : "Estimated"}><i className={s.observed ? "" : "est"} style={{ width: `${s.score * 10}%` }} /></div>
            <span style={{ textAlign: "right" }}>{s.score}</span>
            <span className="ev">{s.evidence}{s.observed ? "" : " Estimated, not observed."}</span>
          </div>);
      })}
      <p className="note">Dashed bars are estimates.</p>

      {sus && <><h3>Sustainability</h3>
        {SUSTAIN.map(d => { const s = sus.sub[d.key]; if (!s || s.score == null) return null; return (
          <div className="dim" key={d.key}><span>{d.label}</span>
            <div className="bar"><i style={{ width: `${s.score * 10}%` }} /></div>
            <span style={{ textAlign: "right" }}>{s.score}</span><span className="ev">{s.evidence}</span></div>); })}
        {q.sustainNotes && <p style={{ marginTop: 16 }}>{q.sustainNotes}</p>}
        {!brand && (q.inputs?.brand) && <p className="note">Rate {q.inputs.brand} under Brand ratings to add the maker to this score.</p>}
        <p className="note">Relative to a typical high-street garment (5). Factory and transport impact aren’t measurable from a label.</p>
      </>}

      {practice && <><h3>In practice</h3>
        <p>{practice.verdict}. After {wears} wears you rated it {practice.actual}/5; the assessment expected about {practice.expected}/5. Revised lifespan: around {practice.revisedLifetime} wears.</p></>}

      {price && mid ? <p className="note">At {gbp(Number(price))}, that’s about {gbp(Number(price) / mid)} a wear over its life.</p> : null}
      {q.strengths?.length > 0 && <><h3>Strengths</h3><ul className="plain">{q.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {q.weaknesses?.length > 0 && <><h3>Weaknesses</h3><ul className="plain">{q.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {q.watchFor?.length > 0 && <><h3>Watch for</h3><ul className="plain">{q.watchFor.map((s, i) => <li key={i}>{s}</li>)}</ul></>}
      {q.care && <><h3>Care</h3><ul className="plain">
        {[["Wash", q.care.wash], ["Dry", q.care.dry], ["Iron", q.care.iron], ["Store", q.care.store]].filter(x => x[1]).map(([k, v]) => <li key={k}>{k}. {v}</li>)}
      </ul>{q.care.extra && <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", marginTop: 14 }}>{q.care.extra}</p>}</>}
      {q.symbols && <><h3>Symbols</h3><p>{q.symbols}</p></>}
      {q.toImprove && <p className="note">To sharpen this score: {q.toImprove}</p>}
    </>
  );
}
