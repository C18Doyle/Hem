// Client error logging: uncaught errors and failed promises go to the error_log table (your rows only).
import { supabase } from "../supabase.js";

let sent = 0; const seen = new Set();
export async function logClientError(message, detail) {
  const key = String(message).slice(0, 200);
  if (sent >= 15 || seen.has(key)) return;
  seen.add(key); sent++;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await supabase.from("error_log").insert({ source: "client", message: String(message).slice(0, 1000), detail: { ...detail, path: location.pathname, ua: navigator.userAgent.slice(0, 160) } });
  } catch {}
}
export function installErrorLogging() {
  window.addEventListener("error", e => logClientError(e.message || "Script error", { stack: e.error?.stack?.slice(0, 1500), file: e.filename, line: e.lineno }));
  window.addEventListener("unhandledrejection", e => logClientError(e.reason?.message || String(e.reason), { stack: e.reason?.stack?.slice(0, 1500), kind: "promise" }));
}
