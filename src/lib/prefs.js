// Small per-device preferences
const get = (k, d) => { try { const v = localStorage.getItem("hem." + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem("hem." + k, JSON.stringify(v)); } catch {} };
export const pref = { get, set };
export const cutBgDefault = () => get("cutbg", true);
