import { useCallback, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface PanZoomCanvasProps {
  children: ReactNode;
  className?: string;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

export default function PanZoomCanvas({ children, className = '' }: PanZoomCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.seat-cell, .banquet-seat-node, button, input, select, a, .adjust-btns, .row-controls, .table-seat-controls, .vip-lounge-item--layout, .vip-lounge-toolbar',
      )
    ) {
      return;
    }
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const resetCenter = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  return (
    <div className={`pan-zoom-wrapper ${className}`}>
      <div className="pan-zoom-controls">
        <button type="button" title="縮小" onClick={() => setZoom((z) => clampZoom(z - 0.1))}>
          <ZoomOut size={16} />
        </button>
        <span className="pan-zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" title="放大" onClick={() => setZoom((z) => clampZoom(z + 0.1))}>
          <ZoomIn size={16} />
        </button>
        <button type="button" title="置中" onClick={resetCenter}>
          <Maximize2 size={16} />
        </button>
      </div>
      <div
        ref={containerRef}
        className="pan-zoom-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          className="pan-zoom-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** 將第一個符合條件的元素捲動至視窗中央 */
export function scrollHighlightIntoView(selector: string) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}
