import { grupoCampaignAPI } from '../services/api';

const DEFAULT_MAX_SIDE = 640;
const DEFAULT_JPEG_QUALITY = 0.88;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = src;
  });
}

/**
 * Recorta o centro para quadrado, redimensiona para maxSide e exporta JPEG (adequado a foto de grupo WhatsApp).
 */
export async function prepareGroupFlowImageDataUrl(
  sourceDataUrl: string,
  opts?: { maxSide?: number; quality?: number }
): Promise<string> {
  const maxSide = opts?.maxSide ?? DEFAULT_MAX_SIDE;
  const quality = opts?.quality ?? DEFAULT_JPEG_QUALITY;
  const img = await loadImage(sourceDataUrl);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Dimensões da imagem inválidas.');
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = maxSide;
  canvas.height = maxSide;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não disponível.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maxSide, maxSide);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSide, maxSide);
  return canvas.toDataURL('image/jpeg', quality);
}

/** URL http(s) passa direto; data URL é otimizada e enviada ao MidiaService → URL pública para a Evolution. */
export async function resolveGroupPictureForEvolution(image: string | undefined): Promise<string | undefined> {
  if (!image?.trim()) return undefined;
  const t = image.trim();
  if (/^https?:\/\//i.test(t)) return t;
  const processed = await prepareGroupFlowImageDataUrl(t);
  const res = await grupoCampaignAPI.uploadGroupFlowImage(processed);
  return res.fullUrl;
}
