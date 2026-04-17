/**
 * Reduz data URL de imagem antes de POST /groups/updatePicture.
 * Proxies (nginx) costumam limitar ~1 MB; JSON com base64 de foto HD estoura fácil.
 */
export function compressImageDataUrlForGroupPicture(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image')) {
    return Promise.resolve(dataUrl);
  }

  const maxEdge = 960;
  const maxApproxChars = 700_000;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w < 1 || h < 1) {
          resolve(dataUrl);
          return;
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        let q = 0.85;
        let out = canvas.toDataURL('image/jpeg', q);
        let guard = 0;
        while (out.length > maxApproxChars && q > 0.48 && guard < 14) {
          q -= 0.06;
          out = canvas.toDataURL('image/jpeg', q);
          guard += 1;
        }
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
