import { useState, useEffect, useCallback, useRef } from 'react';
import Modal from '../ui/Modal';
import { FormField, Input } from '../ui/FormFields';
import {
  loadImageElement,
  drawCropToCanvas,
  getCropPanLimits,
  CROP_WIDTH,
  CROP_HEIGHT,
  CROP_RATIO_LABEL,
} from '../../utils/imageUtils';
import { todayISO } from '../../utils/helpers';

export default function ImageCropModal({
  open,
  imageSrc,
  sourceMeta = {},
  onClose,
  onConfirm,
}) {
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [framePreview, setFramePreview] = useState('');
  const [imgMeta, setImgMeta] = useState(null);
  const [panLimits, setPanLimits] = useState({ maxPanX: 0, maxPanY: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceDate, setSourceDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  const editorWrapRef = useRef(null);
  const editorCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const previewTimerRef = useRef(null);
  const cropParamsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  const cropOptions = useCallback(() => ({
    scale: cropParamsRef.current.scale,
    offsetX: cropParamsRef.current.offsetX,
    offsetY: cropParamsRef.current.offsetY,
    fit: 'contain',
    outputWidth: CROP_WIDTH,
    outputHeight: CROP_HEIGHT,
  }), []);

  const clampOffset = useCallback((x, y, limits = panLimits) => ({
    x: Math.max(-limits.maxPanX, Math.min(limits.maxPanX, x)),
    y: Math.max(-limits.maxPanY, Math.min(limits.maxPanY, y)),
  }), [panLimits]);

  const paintEditor = useCallback(() => {
    const img = imgRef.current;
    const canvas = editorCanvasRef.current;
    if (!img || !canvas) return;
    drawCropToCanvas(canvas, img, cropOptions());
  }, [cropOptions]);

  const scheduleFramePreview = useCallback((immediate = false) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    const run = () => {
      const canvas = editorCanvasRef.current;
      if (!canvas) return;
      try {
        setFramePreview(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        /* ignore */
      }
    };
    if (immediate) run();
    else previewTimerRef.current = setTimeout(run, dragging ? 200 : 60);
  }, [dragging]);

  useEffect(() => {
    if (!open || !imageSrc) return;
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    setError('');
    setFramePreview('');
    setImgMeta(null);
    setImageReady(false);
    imgRef.current = null;
    cropParamsRef.current = { scale: 1, offsetX: 0, offsetY: 0 };
    setSourceDate(sourceMeta.photoSourceDate || todayISO());
    setSourceUrl(sourceMeta.photoSourceUrl || '');

    loadImageElement(imageSrc)
      .then((img) => {
        imgRef.current = img;
        setImgMeta({ width: img.width, height: img.height });
        setPanLimits(getCropPanLimits(img, 1, { outputWidth: CROP_WIDTH, outputHeight: CROP_HEIGHT }));
        setImageReady(true);
      })
      .catch((e) => setError(e.message || '無法載入圖片'));
  }, [open, imageSrc, sourceMeta.photoSourceDate, sourceMeta.photoSourceUrl]);

  useEffect(() => {
    if (!imageReady || !imgRef.current) return;
    setPanLimits(getCropPanLimits(imgRef.current, scale, { outputWidth: CROP_WIDTH, outputHeight: CROP_HEIGHT }));
  }, [scale, imageReady]);

  useEffect(() => {
    cropParamsRef.current.scale = scale;
    const clamped = clampOffset(cropParamsRef.current.offsetX, cropParamsRef.current.offsetY);
    cropParamsRef.current.offsetX = clamped.x;
    cropParamsRef.current.offsetY = clamped.y;
    setOffsetX(clamped.x);
    setOffsetY(clamped.y);
    paintEditor();
    scheduleFramePreview();
  }, [panLimits.maxPanX, panLimits.maxPanY]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!imageReady) return;
    cropParamsRef.current = { scale, offsetX, offsetY };
    paintEditor();
    scheduleFramePreview();
  }, [imageReady, scale, offsetX, offsetY, paintEditor, scheduleFramePreview]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  }, []);

  const canPan = panLimits.maxPanX > 0 || panLimits.maxPanY > 0;

  const getDragFactors = () => {
    const w = editorWrapRef.current?.clientWidth || CROP_WIDTH;
    const h = editorWrapRef.current?.clientHeight || CROP_HEIGHT;
    return { factorX: CROP_WIDTH / w, factorY: CROP_HEIGHT / h };
  };

  const handlePointerDown = (e) => {
    if (!canPan) return;
    e.preventDefault();
    editorWrapRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: cropParamsRef.current.offsetX,
      startOffsetY: cropParamsRef.current.offsetY,
    };
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const { factorX, factorY } = getDragFactors();
    const dx = (e.clientX - dragRef.current.startX) * factorX;
    const dy = (e.clientY - dragRef.current.startY) * factorY;
    const next = clampOffset(
      dragRef.current.startOffsetX + dx,
      dragRef.current.startOffsetY - dy
    );
    cropParamsRef.current.offsetX = next.x;
    cropParamsRef.current.offsetY = next.y;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        paintEditor();
        rafRef.current = null;
      });
    }
  };

  const handlePointerUp = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setOffsetX(cropParamsRef.current.offsetX);
    setOffsetY(cropParamsRef.current.offsetY);
    paintEditor();
    scheduleFramePreview(true);
    try {
      editorWrapRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleConfirm = async () => {
    if (!sourceDate) {
      setError('請填寫來源日期');
      return;
    }
    setLoading(true);
    try {
      paintEditor();
      const dataUrl = editorCanvasRef.current?.toDataURL('image/jpeg', 0.88) || framePreview;
      if (!dataUrl) throw new Error('裁切失敗');
      onConfirm(dataUrl, {
        photoSourceUrl: sourceUrl.trim(),
        photoSourceDate: sourceDate,
      });
      onClose();
    } catch (e) {
      setError(e.message || '裁切失敗');
    } finally {
      setLoading(false);
    }
  };

  const aspectLabel = imgMeta
    ? `原圖 ${imgMeta.width}×${imgMeta.height}px`
    : '';

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="裁切相片" wide>
      <p className="text-sm text-secondary mb-1">
        調整縮放與位置，確認 {CROP_RATIO_LABEL} 預覽後儲存。
      </p>
      {imgMeta && (
        <p className="text-xs text-muted mb-4">
          {aspectLabel}
          {!canPan && scale <= 1 && ' · 預設完整顯示原圖，放大後可拖曳或平移'}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-6 mb-4">
        <div>
          <p className="text-xs text-muted mb-2">
            編輯區（所見即所得）
            {canPan && <span className="text-accent ml-1">· 可拖曳移動</span>}
          </p>
          <div
            ref={editorWrapRef}
            className={`relative mx-auto max-w-xs aspect-[3/4] bg-bg rounded-xl overflow-hidden border-2 border-accent select-none touch-none ${
              canPan ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <canvas
              ref={editorCanvasRef}
              width={CROP_WIDTH}
              height={CROP_HEIGHT}
              className="w-full h-full pointer-events-none"
            />
            {!imageReady && (
              <div className="absolute inset-0 flex items-center justify-center text-muted text-sm bg-bg">
                載入中…
              </div>
            )}
            {canPan && imageReady && (
              <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
                <span className="text-xs px-2 py-1 rounded-full bg-bg/80 text-muted">拖曳以調整位置</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-xs text-muted mb-2">相片預覽（{CROP_RATIO_LABEL}）</p>
          {framePreview ? (
            <img
              src={framePreview}
              alt="裁切預覽"
              className="w-36 aspect-[3/4] object-cover rounded-xl border-2 border-accent"
            />
          ) : (
            <div className="w-36 aspect-[3/4] rounded-xl bg-card border border-border flex items-center justify-center text-muted text-sm">
              載入中…
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-6 p-4 bg-card rounded-xl border border-border">
        <label className="block">
          <span className="text-sm text-secondary">縮放（1 = 完整顯示原圖）</span>
          <input type="range" min="1" max="3" step="0.05" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="w-full accent-accent mt-1" />
        </label>
        <label className="block">
          <span className="text-sm text-secondary">
            水平位移
            {panLimits.maxPanX === 0 && <span className="text-muted ml-1">（請先放大）</span>}
          </span>
          <input type="range" min={-panLimits.maxPanX} max={panLimits.maxPanX} step="1" value={offsetX} disabled={panLimits.maxPanX === 0} onChange={(e) => setOffsetX(parseInt(e.target.value, 10))} className="w-full accent-accent mt-1 disabled:opacity-40" />
        </label>
        <label className="block">
          <span className="text-sm text-secondary">
            垂直位移（向右 = 向上顯示，可露出頭髮）
            {panLimits.maxPanY === 0 && <span className="text-muted ml-1">（請先放大）</span>}
          </span>
          <input type="range" min={-panLimits.maxPanY} max={panLimits.maxPanY} step="1" value={offsetY} disabled={panLimits.maxPanY === 0} onChange={(e) => setOffsetY(parseInt(e.target.value, 10))} className="w-full accent-accent mt-1 disabled:opacity-40" />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6 p-4 bg-card rounded-xl border border-border">
        <FormField label="來源連結">
          <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
        </FormField>
        <FormField label="來源日期" required>
          <Input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} required />
        </FormField>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn-secondary">取消</button>
        <button type="button" onClick={handleConfirm} disabled={loading || !imageReady} className="btn-primary disabled:opacity-50">
          {loading ? '處理中…' : '確認使用'}
        </button>
      </div>
    </Modal>
  );
}
