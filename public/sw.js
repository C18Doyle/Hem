// Hem service worker: offline app shell, and share-target handling (Android).
// API calls and Supabase are never cached.
const SHELL = "hem-shell-v1";
const SHARE = "hem-share";

self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png"]))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== SHARE).map(k => caches.delete(k))))); self.clients.claim(); });

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Shared screenshot or link from another app: stash it, then open Before you buy
  if (e.request.method === "POST" && url.pathname === "/share") {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const cache = await caches.open(SHARE);
      const file = form.get("image");
      const text = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join(" ");
      if (file) await cache.put("/shared-image", new Response(file, { headers: { "content-type": file.type } }));
      await cache.put("/shared-text", new Response(text));
      return Response.redirect("/shop?tab=check&shared=1", 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Pages: network first, fall back to the cached shell when offline
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { caches.open(SHELL).then(c => c.put("/", r.clone())); return r; }).catch(() => caches.match("/")));
    return;
  }
  // Built assets are content-hashed, so cache first is safe
  if (url.pathname.startsWith("/assets/") || /\.(png|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); return r; })));
  }
});
