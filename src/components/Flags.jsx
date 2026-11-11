import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../store.jsx";
import { dismissed, dismiss, undismiss } from "../lib/gaps.js";
import { useUi } from "./UiProvider.jsx";

export default function Flags({ limit, title = "Flags" }) {
  const { flags } = useStore();
  const [hidden, setHidden] = useState(dismissed());
  const ui = useUi();
  const shown = flags.filter(f => !hidden[f.key]);
  if (!shown.length) return null;
  const list = limit ? shown.slice(0, limit) : shown;
  return (
    <section className="flags">
      <div className="between"><h3 style={{ margin: 0 }}>{title}</h3>{limit && shown.length > limit && <Link to="/suggest" className="small muted">All {shown.length}</Link>}</div>
      <ul className="plain">{list.map(f => (
        <li key={f.key}>
          <div className="small muted">{f.type}</div>
          <p style={{ margin: "2px 0 6px" }}>{f.text}</p>
          <div className="row">
            {f.itemId && <Link className="small" to={`/item/${f.itemId}`}>Open</Link>}
            <button className="link quiet small" onClick={() => { dismiss(f.key); setHidden(dismissed()); ui.toast("Dismissed for 30 days", { undo: () => { undismiss(f.key); setHidden(dismissed()); } }); }}>Dismiss</button>
          </div>
        </li>))}</ul>
    </section>
  );
}
