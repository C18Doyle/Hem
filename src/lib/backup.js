// Export and restore: one zip with data.json, CSVs and every photo.
import JSZip from "jszip";
import { supabase } from "../supabase.js";

// Order matters for restore: parents before children.
export const TABLES = ["items", "wears", "conditions", "outfits", "care_logs", "plans", "day_tags", "wishlist", "price_history", "brand_ratings", "body_measurements", "settings"];

const csv = rows => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = v => { const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n");
};

async function all(table) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data); if (data.length < 1000) return out; from += 1000;
  }
}

export async function exportAll(onProgress = () => {}) {
  const zip = new JSZip(), data = {};
  for (const t of TABLES) { onProgress(`Reading ${t.replace("_", " ")}…`); data[t] = await all(t); }
  zip.file("data.json", JSON.stringify({ app: "hem", version: 1, exportedAt: new Date().toISOString(), data }, null, 1));
  zip.file("items.csv", csv(data.items.map(({ quality, care, measures, ...r }) => ({ ...r, quality_score: quality?.overall ?? "" }))));
  zip.file("wears.csv", csv(data.wears));
  const photos = data.items.filter(i => i.photo_path);
  for (let k = 0; k < photos.length; k++) {
    onProgress(`Photos ${k + 1} of ${photos.length}…`);
    const { data: blob } = await supabase.storage.from("wardrobe").download(photos[k].photo_path);
    if (blob) zip.file("photos/" + photos[k].photo_path.split("/").pop(), blob);
  }
  onProgress("Compressing…");
  const out = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(out);
  a.download = `hem-backup-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return { items: data.items.length, photos: photos.length };
}

/** Restores a backup into the signed-in account. Rows with the same id are overwritten. */
export async function restore(file, userId, onProgress = () => {}) {
  const zip = await JSZip.loadAsync(file);
  const meta = JSON.parse(await zip.file("data.json").async("string"));
  if (meta.app !== "hem") throw new Error("That isn’t a Hem backup");
  const { data } = meta;
  // Photos first, so item rows can point at the new paths
  const pathMap = {};
  const photoFiles = Object.keys(zip.files).filter(n => n.startsWith("photos/") && !zip.files[n].dir);
  for (let k = 0; k < photoFiles.length; k++) {
    onProgress(`Uploading photos ${k + 1} of ${photoFiles.length}…`);
    const name = photoFiles[k].slice(7), blob = await zip.file(photoFiles[k]).async("blob");
    const path = `${userId}/${name}`;
    await supabase.storage.from("wardrobe").upload(path, blob, { upsert: true, contentType: name.endsWith(".png") ? "image/png" : "image/jpeg" });
    pathMap[name] = path;
  }
  let rows = 0;
  for (const t of TABLES) {
    const list = (data[t] || []).map(r => {
      const x = { ...r, user_id: userId };
      if (t === "items" && r.photo_path) x.photo_path = pathMap[r.photo_path.split("/").pop()] || null;
      return x;
    });
    for (let i = 0; i < list.length; i += 500) {
      onProgress(`Restoring ${t.replace("_", " ")}…`);
      const { error } = await supabase.from(t).upsert(list.slice(i, i + 500), { onConflict: ["body_measurements", "settings"].includes(t) ? "user_id" : "id" });
      if (error) throw new Error(`${t}: ${error.message}`);
      rows += Math.min(500, list.length - i);
    }
  }
  return { rows, photos: photoFiles.length };
}
