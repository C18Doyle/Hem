// Downscale for upload and for sending to Claude (keeps request bodies well under Vercel's limit).
export function shrink(fileOrBlob, max = 1100, type = "image/jpeg", q = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => b ? resolve({ blob: b, dataUrl: c.toDataURL(type, q) }) : reject(new Error("Couldn’t read image")), type, q);
    };
    img.onerror = () => reject(new Error("That file isn’t an image we can read"));
    img.src = URL.createObjectURL(fileOrBlob);
  });
}

// #7 Background removal, in the browser. The model (~40 MB) downloads once, then is cached.
let removerPromise;
export async function removeBg(blob, onProgress) {
  removerPromise ||= import("@imgly/background-removal");
  const { removeBackground } = await removerPromise;
  const out = await removeBackground(blob, {
    output: { format: "image/png", quality: 0.9 },
    progress: (key, cur, total) => onProgress?.(key.includes("fetch") ? `Downloading model ${Math.round((cur / total) * 100)}%` : "Removing background…"),
  });
  return shrink(out, 1100, "image/png", 0.9);
}

export const blobToDataUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
