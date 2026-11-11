// In-app sheets, confirmations, action menus and undo toasts (replaces browser pop-ups).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const Ctx = createContext(null);
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }) {
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const close = useCallback(v => { setSheet(s => { s?.resolve?.(v); return null; }); }, []);
  const ask = useCallback(o => new Promise(resolve => setSheet({ kind: "ask", ...o, resolve })), []);
  const confirm = useCallback(o => new Promise(resolve => setSheet({ kind: "confirm", ...o, resolve })), []);
  const menu = useCallback(o => setSheet({ kind: "menu", ...o, resolve: () => {} }), []);
  const showToast = useCallback((msg, opts = {}) => {
    clearTimeout(timer.current);
    setToast({ msg, ...opts, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), opts.undo ? 6000 : 3000);
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const esc = e => e.key === "Escape" && close(sheet.kind === "confirm" ? false : null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [sheet, close]);

  return (
    <Ctx.Provider value={{ ask, confirm, menu, toast: showToast }}>
      {children}
      {sheet && <div className="sheet-bg" onClick={() => close(sheet.kind === "confirm" ? false : null)}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label={sheet.title} onClick={e => e.stopPropagation()}>
          <div className="grab" aria-hidden="true" />
          {sheet.title && <h2 className="sheet-title">{sheet.title}</h2>}
          {sheet.body && <p className="muted" style={{ marginTop: 0 }}>{sheet.body}</p>}
          {sheet.kind === "ask" && <AskForm s={sheet} close={close} />}
          {sheet.kind === "confirm" && <div className="row">
            <button className={"btn" + (sheet.danger ? " danger" : "")} onClick={() => close(true)} autoFocus>{sheet.okLabel || "Confirm"}</button>
            <button className="btn ghost" onClick={() => close(false)}>Cancel</button></div>}
          {sheet.kind === "menu" && <ul className="plain menu-list">{sheet.items.map(it => (
            <li key={it.label}><button className={"menu-item" + (it.danger ? " alert" : "")} onClick={() => { close(null); it.onSelect(); }}>{it.label}</button></li>))}
            <li><button className="menu-item muted" onClick={() => close(null)}>Cancel</button></li></ul>}
        </div>
      </div>}
      {toast && <div className="toast" role="status" key={toast.id}>
        <span>{toast.msg}</span>
        {toast.undo && <button className="toast-undo" onClick={() => { clearTimeout(timer.current); setToast(null); toast.undo(); }}>Undo</button>}
      </div>}
    </Ctx.Provider>
  );
}

function AskForm({ s, close }) {
  const [v, setV] = useState(s.value ?? "");
  return <form onSubmit={e => { e.preventDefault(); close(v); }}>
    <label className="f" htmlFor="ask-in">{s.label}</label>
    <input id="ask-in" autoFocus type={s.type || "text"} inputMode={s.type === "number" ? "decimal" : undefined} value={v} onChange={e => setV(e.target.value)} placeholder={s.placeholder} />
    <div className="row">
      <button type="submit" className="btn">{s.okLabel || "Save"}</button>
      {s.clearLabel && <button type="button" className="btn ghost" onClick={() => close("")}>{s.clearLabel}</button>}
      <button type="button" className="link quiet" style={{ marginTop: 28 }} onClick={() => close(null)}>Cancel</button>
    </div>
  </form>;
}
