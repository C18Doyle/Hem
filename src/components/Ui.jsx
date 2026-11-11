import { useRef } from "react";
import { shrink } from "../lib/image.js";

export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, t]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>)}
    </div>
  );
}

export function Chips({ values, selected, onToggle, multi = true }) {
  return (
    <div className="chips">
      {values.map(v => {
        const on = multi ? selected?.includes(v) : selected === v;
        return <button key={v} type="button" className="chip" aria-pressed={on} onClick={() => onToggle(v)}>{v}</button>;
      })}
    </div>
  );
}

/** Photo picker that hands back {blob, dataUrl} already downscaled. */
export function PhotoPick({ value, onChange, label = "Add photo", max = 900 }) {
  const ref = useRef();
  return (
    <div className="photo">
      <div className="thumb" style={{ backgroundImage: value ? `url(${value.dataUrl})` : "" }} />
      <div>
        <button type="button" className="link" onClick={() => ref.current.click()}>{value ? "Change photo" : label}</button>
        {value && <><br /><button type="button" className="link quiet" onClick={() => onChange(null)}>Remove</button></>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={async e => {
          const f = e.target.files[0]; e.target.value = "";
          if (f) try { onChange(await shrink(f, max)); } catch (err) { alert(err.message); }
        }} />
      </div>
    </div>
  );
}

export function Status({ busy, error, children }) {
  return <div className={"status" + (error ? " err" : "")} role="status">{error || busy || children}</div>;
}

export function Meter({ value, of = 10 }) {
  const n = Math.round(value || 0);
  return <div className="meter" aria-hidden="true">{Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? "f" : ""} />)}</div>;
}
