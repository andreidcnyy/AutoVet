/**
 * Resize and compress an image File before uploading.
 * Cuts upload time from ~10s to ~1s on phone-camera photos.
 */
export interface OptimizeResult { file: File; dataUrl: string | null; }

export async function optimizeImage(
  file: File,
  { maxDim = 1024, quality = 0.82, mime = 'image/webp' as 'image/webp' | 'image/jpeg' } = {},
): Promise<OptimizeResult> {
  if (!file) return { file, dataUrl: null };

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return { file, dataUrl: null };

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  (bitmap as any).close?.();

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) return { file, dataUrl: null };

  const ext = mime === 'image/webp' ? 'webp' : 'jpg';
  const out = new File([blob], (file.name || 'upload').replace(/\.[^.]+$/, '') + '.' + ext, { type: mime });
  const dataUrl = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(out);
  });
  return { file: out, dataUrl };
}
