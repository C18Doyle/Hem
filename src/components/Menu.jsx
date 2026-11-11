// Top menu: secondary tools, grouped, plus appearance
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { supabase } from "../supabase.js";
import { applyTheme, getTheme } from "../lib/theme.js";
import { Seg } from "./Ui.jsx";

const GROUPS = [
  ["Wardrobe", [["/pair", "What goes with this"], ["/suggest", "Gaps"], ["/rescue", "Alterations"], ["/fit", "Fit"], ["/quality", "Quality check"]]],
  ["Insight", [["/dashboard", "Dashboard"], ["/review", "Year in review"]]],
  ["Reading", [["/brands", "Brands"], ["/news", "Industry news"]]],
];

export default function Menu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(getTheme());
  const ref = useRef();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = t => { setTheme(t); applyTheme(t); };
  return (
    <div className="menu" ref={ref}>
      <button className="menu-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}>{open ? "Close" : "More"}</button>
      {open && <div className="menu-panel">
        {GROUPS.map(([label, links]) => (
          <div key={label} className="menu-group">
            <span className="menu-label">{label}</span>
            {links.map(([to, t]) => <NavLink key={to} to={to}>{t}</NavLink>)}
          </div>))}
        <div className="menu-sep" />
        <Seg label="Appearance" value={theme} onChange={pick} options={[["light", "Light"], ["dark", "Dark"], ["system", "Auto"]]} />
        <div className="between" style={{ marginTop: 6 }}>
          <NavLink to="/settings" className="small">Settings</NavLink>
          <button className="link quiet small" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>}
    </div>
  );
}
