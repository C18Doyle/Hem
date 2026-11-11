import { useEffect, useState } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { supabase } from "./supabase.js";
import { StoreProvider, useStore } from "./store.jsx";
import Login from "./pages/Login.jsx";
import Today from "./pages/Today.jsx";
import Wardrobe from "./pages/Wardrobe.jsx";
import Item from "./pages/Item.jsx";
import Style from "./pages/Style.jsx";
import Quality from "./pages/Quality.jsx";
import Shop from "./pages/Shop.jsx";
import Calendar from "./pages/Calendar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import News from "./pages/News.jsx";
import Suggest from "./pages/Suggest.jsx";
import Brands from "./pages/Brands.jsx";
import Fit from "./pages/Fit.jsx";
import Rescue from "./pages/Rescue.jsx";
import Review from "./pages/Review.jsx";
import Pair from "./pages/Pair.jsx";
import AddBatch from "./pages/AddBatch.jsx";
import Settings from "./pages/Settings.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import Menu from "./components/Menu.jsx";
import { UiProvider } from "./components/UiProvider.jsx";
import { applyTheme, getTheme } from "./lib/theme.js";

applyTheme(getTheme());

function Shell() {
  const { alerts, due } = useStore();
  const loc = useLocation();
  return (
    <>
      <div className="wrap">
        <header className="mast">
          <Link to="/" className="mark">Hem</Link>
          <Menu />
        </header>
        <ErrorBoundary key={loc.pathname}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/item/:id" element={<Item />} />
          <Route path="/style" element={<Style />} />
          <Route path="/quality" element={<Quality />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/suggest" element={<Suggest />} />
          <Route path="/news" element={<News />} />
          <Route path="/brands" element={<Brands />} />
          <Route path="/brands/:key" element={<Brands />} />
          <Route path="/fit" element={<Fit />} />
          <Route path="/rescue" element={<Rescue />} />
          <Route path="/review" element={<Review />} />
          <Route path="/pair" element={<Pair />} />
          <Route path="*" element={<p className="page">Page not found. <Link to="/">Go to Today</Link></p>} />
          <Route path="/add" element={<AddBatch />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        </ErrorBoundary>
      </div>
      <nav className="tabs" aria-label="Sections"><div className="in">
        <NavLink to="/" end>Today{due.length > 0 && <span className="dot" aria-label="care due" />}</NavLink>
        <NavLink to="/wardrobe">Wardrobe</NavLink>
        <NavLink to="/calendar">Calendar</NavLink>
        <NavLink to="/style">Style</NavLink>
        <NavLink to="/shop">Shop{alerts > 0 && <span className="dot" aria-label="price alert" />}</NavLink>
      </div></nav>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <Login />;
  return <BrowserRouter><UiProvider><StoreProvider user={session.user}><Shell /></StoreProvider></UiProvider></BrowserRouter>;
}
