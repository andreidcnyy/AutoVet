/**
 * Resize and compress an image File before uploading.
 * Returns a JPEG/WebP File (smaller than the input) and a data URL.
 *
 * maxDim: longest edge in px (logos: 512, pet photos: 1024 are good defaults).
 * quality: 0..1 (0.82 keeps photos visibly clean).
 */
export async function optimizeImage(file, { maxDim = 1024, quality = 0.82, mime = 'image/webp' } = {}) {
  if (!file || !(file instanceof Blob)) return { file, dataUrl: null };

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { file, dataUrl: null };

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) return { file, dataUrl: null };

  const ext = mime === 'image/webp' ? 'webp' : 'jpg';
  const out = new File([blob], (file.name || 'upload').replace(/\.[^.]+$/, '') + '.' + ext, { type: mime });
  const dataUrl = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(out);
  });
  return { file: out, dataUrl };
}
