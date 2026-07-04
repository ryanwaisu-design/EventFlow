/** 裁切輸出比例：高 4 : 闊 3 */
export const CROP_WIDTH = 300;
export const CROP_HEIGHT = 400;
export const CROP_RATIO_LABEL = '4:3（高:闊）';

export function isImageUrl(str) {
  if (!str) return false;
  return /\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(str) || str.startsWith('data:image/');
}

export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('無法載入圖片，請改用手動上傳或另存後上傳'));
    img.src = src;
  });
}

function getOutputSize(options) {
  return {
    outW: options.outputWidth ?? options.size ?? CROP_WIDTH,
    outH: options.outputHeight ?? Math.round((options.outputWidth ?? options.size ?? CROP_WIDTH) * (4 / 3)),
  };
}

/**
 * 計算裁切繪製參數（裁切框 4:3 高:闊）
 */
export function computeCropDraw(img, options = {}) {
  const { scale = 1, offsetX = 0, offsetY = 0, fit = 'contain' } = options;
  const { outW, outH } = getOutputSize(options);

  const baseScale = fit === 'cover'
    ? Math.max(outW / img.width, outH / img.height)
    : Math.min(outW / img.width, outH / img.height);

  const finalScale = baseScale * Math.max(0.5, scale);
  const drawW = img.width * finalScale;
  const drawH = img.height * finalScale;

  const maxPanX = Math.max(0, (drawW - outW) / 2);
  const maxPanY = Math.max(0, (drawH - outH) / 2);

  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, offsetX));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, offsetY));

  const x = (outW - drawW) / 2 + clampedX;
  const y = (outH - drawH) / 2 - clampedY;

  return {
    x, y, drawW, drawH, outW, outH,
    clampedX, clampedY,
    maxPanX, maxPanY,
    baseScale, finalScale,
  };
}

export function getCropPanLimits(img, scale = 1, options = {}) {
  if (!img?.width || !img?.height) {
    return { maxPanX: 0, maxPanY: 0 };
  }
  const { maxPanX, maxPanY } = computeCropDraw(img, { ...options, scale, offsetX: 0, offsetY: 0 });
  return {
    maxPanX: Math.ceil(maxPanX),
    maxPanY: Math.ceil(maxPanY),
  };
}

export function drawCropToCanvas(canvas, img, options = {}) {
  if (!canvas || !img) return null;
  const { outW, outH } = getOutputSize(options);
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW;
    canvas.height = outH;
  }
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a2235';
  ctx.fillRect(0, 0, outW, outH);
  const { x, y, drawW, drawH } = computeCropDraw(img, { ...options, outputWidth: outW, outputHeight: outH });
  ctx.drawImage(img, x, y, drawW, drawH);
  return canvas;
}

export async function renderCropCanvas(src, options = {}) {
  const img = typeof src === 'string' ? await loadImageElement(src) : src;
  const canvas = document.createElement('canvas');
  drawCropToCanvas(canvas, img, options);
  return { canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.88), img };
}

export async function imageToDataUrl(src, options = {}) {
  const { dataUrl } = await renderCropCanvas(src, options);
  return dataUrl;
}

export async function readClipboardImage() {
  if (!navigator.clipboard?.read) {
    throw new Error('此瀏覽器不支援剪貼簿讀取圖片');
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) {
      const blob = await item.getType(type);
      return URL.createObjectURL(blob);
    }
  }
  throw new Error('剪貼簿中沒有圖片');
}

export function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
