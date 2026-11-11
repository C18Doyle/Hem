// #5 Fashion news: server-side RSS/Atom fetch (browsers can't read most feeds directly because of CORS)
import { handler } from "./_lib/http.js";
import { FEEDS, SHOPPING } from "./_lib/feeds.js";

let cache = { at: 0, data: null };
const TTL = 30 * 60e3;

const decode = s => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();
const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block); return m ? m[1] : ""; };
const attr = (block, name, a) => { const m = new RegExp(`<${name}[^>]*\\s${a}=["']([^"']+)["']`, "i").exec(block); return m ? m[1] : ""; };

function parse(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.slice(0, 15).map(b => {
    const link = decode(tag(b, "link")) || attr(b, "link", "href");
    const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const image = attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || attr(b, "enclosure", "url") || (/<img[^>]+src=["']([^"']+)/i.exec(tag(b, "content:encoded") + tag(b, "description")) || [])[1] || "";
    const summary = decode(tag(b, "description") || tag(b, "summary")).slice(0, 220);
    return { title: decode(tag(b, "title")), link, date: date ? new Date(decode(date)).toISOString() : null, image: /^https:/.test(image) ? image : "", summary, source: feed.name, tag: feed.tag };
  }).filter(a => a.title && /^https?:/.test(a.link) && !SHOPPING.test(a.title) && !/\/(shopping|deals|gift-guide|the-filter)\//i.test(a.link));
}

async function load() {
  const runs = await Promise.allSettled(FEEDS.map(async f => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(f.url, { signal: ctl.signal, headers: { "user-agent": "Hem/1.0 (personal reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
      if (!r.ok) throw new Error(String(r.status));
      return parse(await r.text(), f);
    } finally { clearTimeout(t); }
  }));
  const articles = [], failed = [];
  runs.forEach((r, i) => r.status === "fulfilled" && r.value.length ? articles.push(...r.value) : failed.push(FEEDS[i].name));
  articles.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { articles: articles.slice(0, 80), failed, sources: FEEDS.map(f => ({ name: f.name, tag: f.tag })) };
}

export default handler(async ({ refresh }) => {
  if (!cache.data || refresh || Date.now() - cache.at > TTL) cache = { at: Date.now(), data: await load() };
  return { ...cache.data, fetchedAt: new Date(cache.at).toISOString() };
});
export { parse as _parse };
