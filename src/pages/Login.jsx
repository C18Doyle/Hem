import { useState } from "react";
import { supabase } from "../supabase.js";
import { Status } from "../components/Ui.jsx";

export default function Login() {
  const [email, setEmail] = useState(""), [sent, setSent] = useState(false), [err, setErr] = useState("");
  const send = async () => {
    setErr("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    error ? setErr(error.message) : setSent(true);
  };
  return (
    <div className="wrap"><div className="page" style={{ paddingTop: "18vh" }}>
      <h1 className="mark" style={{ fontSize: 64 }}>Hem</h1>
      <p className="lede" style={{ marginTop: 16 }}>A quieter way to own clothes.</p>
      {sent ? <p>Check {email} for a sign-in link.</p> : <>
        <label className="f" htmlFor="l-e">Email</label>
        <input id="l-e" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button className="btn" disabled={!email} onClick={send}>Send sign-in link</button>
        <Status error={err} />
      </>}
    </div></div>
  );
}
