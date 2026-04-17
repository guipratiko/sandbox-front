/**
 * Reduz arquivo de imagem antes de multipart (binário ≈ menor que base64 em JSON no proxy).
 */
export function compressImageFileForGroupPicture(file: File): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) {
    return Promise.resolve(file);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const maxEdge = 720;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w < 1 || h < 1) {
          resolve(file);
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
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const base = (file.name || 'group').replace(/\.[^.]+$/i, '');
            resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.82
        );
      } catch {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/**
 * Reduz data URL de imagem antes de POST /groups/updatePicture (JSON).
 * Proxies (nginx) costumam limitar ~1 MB; JSON com base64 de foto HD estoura fácil.
 */
export function compressImageDataUrlForGroupPicture(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || !dataUrl.startsWith('data:image')) {
    return Promise.resolve(dataUrl);
  }

  const maxEdge = 720;
  const maxApproxChars = 280_000;

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
