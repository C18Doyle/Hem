import { supabase } from "./supabase.js";

export async function post(path, body) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/" + path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + (data.session?.access_token || "") },
    body: JSON.stringify(body || {}),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "Request failed (" + res.status + ")");
  return j;
}
