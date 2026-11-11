import { Link } from "react-router-dom";
import { useStore } from "../store.jsx";

export default function PairResult({ r }) {
  const { byId, photo } = useStore();
  const Thumb = ({ id, children }) => byId[id] ? (
    <Link to={`/item/${id}`} className="piece" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="im" style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} /><div className="lb">{byId[id].name}</div>{children}</Link>) : null;
  return (
    <div className="result" style={{ marginTop: 20 }}>
      {r.verdict && <p style={{ fontFamily: "var(--serif)", fontSize: 21, lineHeight: 1.35, marginTop: 0 }}>{r.verdict}</p>}
      {r.bestLook?.itemIds?.length > 0 && <><p className="small muted">The best look</p>
        <div className="strip">{r.bestLook.itemIds.map(id => <Thumb key={id} id={id} />)}</div>
        <p style={{ marginTop: 10 }}>{r.bestLook.why}</p></>}
      {r.pairs?.length > 0 && <><h3>Works with</h3><ul className="plain">{r.pairs.map(p => byId[p.itemId] && (
        <li key={p.itemId} className="between"><span><Link to={`/item/${p.itemId}`}>{byId[p.itemId].name}</Link><br /><span className="small muted">{p.reason}</span></span>
          <span className="small">{p.strength === "strong" ? "Strong" : "Good"}</span></li>))}</ul></>}
      {r.avoid?.length > 0 && <><h3>Avoid</h3><ul className="plain">{r.avoid.map(p => byId[p.itemId] && (
        <li key={p.itemId}><Link to={`/item/${p.itemId}`}>{byId[p.itemId].name}</Link><br /><span className="small muted">{p.reason}</span></li>))}</ul></>}
    </div>
  );
}
