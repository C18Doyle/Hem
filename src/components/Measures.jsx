// Measurement inputs with how-to-measure hints
export default function Measures({ fields, value = {}, onChange }) {
  return (
    <div className="two">
      {fields.map(f => (
        <div key={f.key}>
          <label className="f" htmlFor={"m-" + f.key}>{f.label}{f.key === "uk" ? "" : ", cm"}</label>
          <input id={"m-" + f.key} type="number" inputMode="decimal" step="0.5" value={value[f.key] ?? ""}
            onChange={e => onChange({ ...value, [f.key]: e.target.value === "" ? "" : Number(e.target.value) })} />
          {f.how && <div className="small muted" style={{ marginTop: 4 }}>{f.how}</div>}
        </div>))}
    </div>
  );
}
