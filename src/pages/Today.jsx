// #8 A suggestion for the day
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";
import { post } from "../api.js";
import { useStore } from "../store.jsx";
import Outfit from "../components/Outfit.jsx";
import Flags from "../components/Flags.jsx";
import Welcome, { onboarded } from "../components/Welcome.jsx";
import { Status } from "../components/Ui.jsx";
import { todayIso } from "../lib/dates.js";

const CODES = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorms" };
const PLACES = { "Leamington Spa": [52.2852, -1.5200], London: [51.5072, -0.1276], Edinburgh: [55.9533, -3.1883] };

async function getWeather([lat, lon]) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,weather_code,wind_speed_10m_max&timezone=Europe%2FLondon&forecast_days=1`;
  const d = (await (await fetch(u)).json()).daily;
  return { summary: CODES[d.weather_code[0]] || "Mixed", min: Math.round(d.temperature_2m_min[0]), max: Math.round(d.temperature_2m_max[0]), feels: Math.round(d.apparent_temperature_max[0]), rain: d.precipitation_probability_max[0], wind: Math.round(d.wind_speed_10m_max[0]) };
}

export default function Today() {
  const { items, due, byId, photo, refresh, logWear, wearLog, loading } = useStore();
  const [plan, setPlan] = useState(null), [dayTag, setDayTag] = useState(null);
  const [skipIntro, setSkipIntro] = useState(onboarded);
  const [opts, setOpts] = useState(false);
  useEffect(() => {
    supabase.from("plans").select("*").eq("day", todayIso()).maybeSingle().then(({ data }) => setPlan(data));
    supabase.from("day_tags").select("*").eq("day", todayIso()).maybeSingle().then(({ data }) => setDayTag(data));
  }, []);
  const wornToday = wearLog.some(w => w.worn_on === todayIso());
  const [place, setPlace] = useState(() => localStorage.getItem("hem.place") || "Leamington Spa");
  const [wx, setWx] = useState(null);
  const [plans, setPlans] = useState("");
  const [outfit, setOutfit] = useState(null), [note, setNote] = useState("");
  const [busy, setBusy] = useState(""), [err, setErr] = useState("");

  useEffect(() => {
    try { localStorage.setItem("hem.place", place); } catch {}
    setWx(null);
    const go = coords => getWeather(coords).then(setWx).catch(() => setErr("Weather unavailable. Suggestions will assume a mild day."));
    if (place === "Here") navigator.geolocation?.getCurrentPosition(p => go([p.coords.latitude, p.coords.longitude]), () => setErr("Location blocked. Pick a city instead."));
    else go(PLACES[place]);
  }, [place]);

  // Show today's existing suggestion rather than paying for a new one
  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    supabase.from("outfits").select("*").eq("source", "today").gte("created_at", start.toISOString()).neq("status", "rejected")
      .order("created_at", { ascending: false }).limit(1).then(({ data }) => data?.[0] && setOutfit(data[0]));
  }, []);

  const suggest = async (exclude = []) => {
    setBusy("Choosing…"); setErr("");
    const context = [dayTag?.tags?.join(", "), dayTag?.note, plans].filter(Boolean).join(". ");
    try { const r = await post("today", { weather: wx, plans: context, exclude }); setOutfit(r.outfit); setNote(r.weatherNote); }
    catch (e) { setErr(e.message); }
    setBusy("");
  };

  const doneReminder = async r => {
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("care_logs").update({ done_on: today }).eq("id", r.id);
    if (r.repeat_days) await supabase.from("care_logs").insert({ item_id: r.item_id, kind: "reminder", note: r.note, repeat_days: r.repeat_days, due_on: new Date(Date.now() + r.repeat_days * 864e5).toISOString().slice(0, 10) });
    refresh();
  };

  if (!skipIntro && !loading && (items.filter(i => !i.retired).length < 5 || wearLog.length === 0)) return <Welcome onDone={() => setSkipIntro(true)} />;
  return (
    <div className="page hero-today">
      <div className="between" style={{ alignItems: "baseline" }}>
        <h2 className="today-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h2>
        <button className="link quiet small" onClick={() => setOpts(o => !o)}>{opts ? "Done" : "Change"}</button>
      </div>
      <p className="today-wx">{wx ? `${wx.max}°, ${wx.summary.toLowerCase()}, rain ${wx.rain}%. ` : "Fetching weather. "}{place === "Here" ? "Your location" : place}.{plans ? ` ${plans}.` : ""}</p>
      {dayTag?.tags?.length > 0 && <div className="chips" style={{ marginBottom: 6 }}>{dayTag.tags.map(t => <span key={t} className="chip" aria-pressed="true">{t}</span>)}{dayTag.note && <span className="small muted" style={{ alignSelf: "center" }}>{dayTag.note}</span>}</div>}
      {opts && <div className="today-opts">
        <label className="f" htmlFor="t-place">Where</label>
        <select id="t-place" value={place} onChange={e => setPlace(e.target.value)}>
          {[...Object.keys(PLACES), "Here"].map(p => <option key={p} value={p}>{p === "Here" ? "My location" : p}</option>)}
        </select>
        <label className="f" htmlFor="t-plans">Plans</label>
        <input id="t-plans" type="text" value={plans} onChange={e => setPlans(e.target.value)} placeholder="e.g. Office, then dinner" />
      </div>}

      {plan?.item_ids?.length > 0 && !wornToday && <div className="hero-outfit">
        <p className="small muted" style={{ margin: 0 }}>Planned</p>
        <div className="strip large">{plan.item_ids.map(id => byId[id] && (
          <div className="piece" key={id}><div className="im" style={{ backgroundImage: photo(byId[id]) ? `url(${photo(byId[id])})` : "" }} /><div className="lb">{byId[id].name}</div></div>))}</div>
        <button className="btn" onClick={async () => { await logWear(plan.item_ids); await supabase.from("plans").delete().eq("id", plan.id); setPlan(null); }}>Wear as planned</button>
      </div>}

      {items.length < 3 ? <div className="empty" style={{ marginTop: 32 }}>Add three pieces to your <Link to="/wardrobe">wardrobe</Link> first.</div>
        : busy ? <div className="hero-outfit"><div className="sk sk-line" style={{ width: "50%" }} /><div className="strip large">{[0, 1, 2].map(k => <div key={k} className="piece"><div className="im sk" /></div>)}</div></div>
        : outfit ? <div className="hero-outfit">
            <p className="hero-title">{outfit.title}</p>
            <Outfit outfit={outfit} compact large onReject={o => suggest(o.item_ids)} />
            {note && <p className="note">{note}</p>}
            <button className="link quiet small" style={{ marginTop: 16 }} onClick={() => suggest()}>Suggest another</button>
          </div>
        : <button className="btn hero-btn" onClick={() => suggest()}>Suggest today’s outfit</button>}
      <Status error={err} />

      <Flags limit={2} title="Flags" />

      {due.length > 0 && <>
        <h3>Care due this week</h3>
        <ul className="plain">{due.map(r => (
          <li key={r.id} className="between">
            <span><Link to={`/item/${r.item_id}`}>{byId[r.item_id]?.name || "Item"}</Link>: {r.note}{r.due_on < new Date().toISOString().slice(0, 10) && <span className="alert small"> overdue</span>}</span>
            <button className="link quiet small" onClick={() => doneReminder(r)}>Done</button>
          </li>))}
        </ul>
      </>}
    </div>
  );
}
