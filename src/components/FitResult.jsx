import { describe } from "../lib/fit.js";

export default function FitResult({ r, tgt }) {
  if (!r) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 24, margin: "0 0 4px" }}>{r.verdict}</p>
      {tgt && <p className="small muted" style={{ marginTop: 0 }}>{tgt.source === "item" ? `Compared with your ${tgt.ref.name}, which fits well.` : "Compared with your body measurements plus standard ease. Less reliable than comparing with a piece that fits; mark one under Fit."}</p>}
      <ul className="plain">{r.rows.map(x => (
        <li key={x.key} className="between">
          <span>{x.label}{x.fix && x.level !== "good" ? <span className="small muted"><br />{x.fix[0]}, {x.fix[2]}{x.fix[1] === "check" ? " (only if there’s spare cloth)" : ""}</span> : x.level === "off" ? <span className="small alert"><br />Can’t be altered</span> : null}</span>
          <span className={"small " + (x.level === "off" ? "alert" : x.level === "slight" ? "" : "muted")}>{describe(x)}</span>
        </li>))}</ul>
    </div>
  );
}
