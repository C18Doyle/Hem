// #4 Light / dark / system. Stored per device.
export function getTheme() { try { return localStorage.getItem("hem.theme") || "system"; } catch { return "system"; } }
export function applyTheme(t) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", t);
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", dark ? "#000000" : "#ffffff"));
  try { localStorage.setItem("hem.theme", t); } catch {}
}
