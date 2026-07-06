import {
  memo,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignStartVertical,
  Armchair,
  Circle,
  Plus,
  Trash2,
  Wine,
} from 'lucide-react';
import SeatCell from './SeatCell';
import type { Guest, Seat, SeatAssignment, VipLoungeItem } from '../../types';
import { buildGuestMap, getGuestFromMap } from '../../utils/guestLookup';
import {
  VIP_CANVAS_HEIGHT,
  VIP_CANVAS_WIDTH,
  VIP_TABLE_COFFEE_H,
  VIP_TABLE_COFFEE_W,
  VIP_TABLE_ROUND_SIZE,
} from '../../utils/vipLounge';
import {
  getVipItemSize,
  snapVipDragPosition,
  type VipAlignMode,
  type VipSnapGuides,
} from '../../utils/vipLoungeLayout';
import type { SeatingToolbarMode } from './SeatingChart';

interface VipLoungeCanvasProps {
  items: VipLoungeItem[];
  seats: Seat[];
  assignments: Record<string, SeatAssignment>;
  guests: Guest[];
  showTooltip: boolean;
  layoutMode: boolean;
  toolbarMode: SeatingToolbarMode;
  selectedSeatId: string | null;
  highlightGuestIds: string[];
  guestQuotaByGuestId?: Map<string, string>;
  dragDisabled?: boolean;
  dndEnabled?: boolean;
  onSeatClick: (seatId: string) => void;
  onRemoveGuest?: (seatId: string, e: React.MouseEvent) => void;
  onMoveItem: (itemId: string, x: number, y: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAddSeat: () => void;
  onAddTable: (shape: 'coffee' | 'round') => void;
  onAddChair: () => void;
  onAlignItems: (itemIds: string[], mode: VipAlignMode) => void;
}

const ALIGN_ACTIONS: { mode: VipAlignMode; label: string; Icon: typeof AlignStartVertical }[] = [
  { mode: 'left', label: '左對齊', Icon: AlignHorizontalJustifyStart },
  { mode: 'centerX', label: '水平居中', Icon: AlignCenterHorizontal },
  { mode: 'right', label: '右對齊', Icon: AlignHorizontalJustifyEnd },
  { mode: 'top', label: '上對齊', Icon: AlignStartVertical },
  { mode: 'centerY', label: '垂直居中', Icon: AlignCenterVertical },
  { mode: 'bottom', label: '下對齊', Icon: AlignEndVertical },
];

export default memo(function VipLoungeCanvas({
  items,
  seats,
  assignments,
  guests,
  showTooltip,
  layoutMode,
  toolbarMode,
  selectedSeatId,
  highlightGuestIds,
  guestQuotaByGuestId,
  dragDisabled = false,
  dndEnabled = false,
  onSeatClick,
  onRemoveGuest,
  onMoveItem,
  onRemoveItem,
  onAddSeat,
  onAddTable,
  onAddChair,
  onAlignItems,
}: VipLoungeCanvasProps) {
  const guestMap = buildGuestMap(guests);
  const highlightSet = new Set(highlightGuestIds);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [guides, setGuides] = useState<VipSnapGuides>({ vertical: null, horizontal: null });

  const seatById = useCallback(
    (id: string) => seats.find((s) => s.id === id),
    [seats],
  );

  const selectItem = (itemId: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      }
      return new Set([itemId]);
    });
  };

  const handleCanvasPointerDown = () => {
    if (!layoutMode) return;
    setSelectedIds(new Set());
  };

  const handleItemPointerDown = (e: ReactPointerEvent, item: VipLoungeItem) => {
    if (!layoutMode) return;
    e.stopPropagation();
    e.preventDefault();
    selectItem(item.id, e.shiftKey);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      id: item.id,
      offsetX: e.clientX - rect.left - item.x,
      offsetY: e.clientY - rect.top - item.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleItemPointerMove = (e: ReactPointerEvent) => {
    if (!layoutMode || !dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const moving = items.find((i) => i.id === dragRef.current!.id);
    if (!moving) return;
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left - dragRef.current.offsetX;
    const rawY = e.clientY - rect.top - dragRef.current.offsetY;
    const snapped = snapVipDragPosition(moving, items, rawX, rawY);
    setGuides(snapped.guides);
    onMoveItem(dragRef.current.id, snapped.x, snapped.y);
  };

  const handleItemPointerUp = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setGuides({ vertical: null, horizontal: null });
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const selectedList = [...selectedIds];

  const renderDecorRemove = (itemId: string) =>
    layoutMode && (
      <button
        type="button"
        className="vip-lounge-item-remove no-print"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveItem(itemId);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        }}
        title="刪除"
      >
        <Trash2 size={12} />
      </button>
    );

  const selectionClass = (itemId: string) =>
    layoutMode && selectedIds.has(itemId) ? ' vip-lounge-item--selected' : '';

  return (
    <div className="vip-lounge-panel">
      {layoutMode && (
        <div className="vip-lounge-toolbar no-print">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddSeat}>
            <Plus size={14} />
            <span>新增座位</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddTable('coffee')}>
            <Wine size={14} />
            <span>茶几</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAddTable('round')}>
            <Circle size={14} />
            <span>圓几</span>
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAddChair}>
            <Armchair size={14} />
            <span>椅子</span>
          </button>
          {selectedList.length >= 2 && (
            <div className="vip-lounge-align-group">
              {ALIGN_ACTIONS.map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  className="btn btn-secondary btn-sm vip-lounge-align-btn"
                  title={label}
                  onClick={() => onAlignItems(selectedList, mode)}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-muted">
            拖曳會吸附網格與其他物件；Shift+點選多選後可對齊
          </span>
        </div>
      )}

      <div
        ref={canvasRef}
        className="vip-lounge-canvas"
        style={{ width: VIP_CANVAS_WIDTH, height: VIP_CANVAS_HEIGHT }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleItemPointerMove}
        onPointerUp={handleItemPointerUp}
        onPointerLeave={handleItemPointerUp}
      >
        {guides.vertical != null && (
          <div
            className="vip-lounge-guide vip-lounge-guide--v"
            style={{ left: guides.vertical }}
          />
        )}
        {guides.horizontal != null && (
          <div
            className="vip-lounge-guide vip-lounge-guide--h"
            style={{ top: guides.horizontal }}
          />
        )}

        {items.length === 0 && (
          <p className="vip-lounge-empty-hint">
            {layoutMode ? '按「新增座位」、「茶几」或「椅子」開始布置 VIP 休息室' : '尚未布置 VIP 休息室座位'}
          </p>
        )}

        {items.map((item) => {
          if (item.kind === 'chair') {
            const { w, h } = getVipItemSize(item);
            return (
              <div
                key={item.id}
                className={`vip-lounge-chair${layoutMode ? ' vip-lounge-item--layout' : ''}${selectionClass(item.id)}`}
                style={{ left: item.x, top: item.y, width: w, height: h }}
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                title="椅子（裝飾）"
              >
                <Armchair size={Math.min(w, h) * 0.55} strokeWidth={1.5} />
                {renderDecorRemove(item.id)}
              </div>
            );
          }

          if (item.kind === 'table') {
            const w = item.width ?? (item.shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_W);
            const h = item.height ?? (item.shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_H);
            return (
              <div
                key={item.id}
                className={`vip-lounge-table vip-lounge-table--${item.shape}${layoutMode ? ' vip-lounge-item--layout' : ''}${selectionClass(item.id)}`}
                style={{ left: item.x, top: item.y, width: w, height: h }}
                onPointerDown={(e) => handleItemPointerDown(e, item)}
                title={item.label ?? (item.shape === 'round' ? '圓几' : '茶几')}
              >
                <span className="vip-lounge-table-label">{item.shape === 'round' ? '圓几' : '茶几'}</span>
                {renderDecorRemove(item.id)}
              </div>
            );
          }

          const seat = seatById(item.id);
          if (!seat) return null;
          const assignment = assignments[seat.id];
          if (!assignment) return null;
          const guest = getGuestFromMap(guestMap, assignment.guestId);
          const quotaLabel = guest ? guestQuotaByGuestId?.get(guest.id) : undefined;

          return (
            <div
              key={item.id}
              className={`vip-lounge-seat-wrap${layoutMode ? ' vip-lounge-item--layout' : ''}${selectionClass(item.id)}`}
              style={{ left: item.x, top: item.y }}
              onPointerDown={layoutMode ? (e) => handleItemPointerDown(e, item) : undefined}
            >
              <SeatCell
                seat={seat}
                assignment={assignment}
                guest={guest}
                showTooltip={showTooltip && !layoutMode}
                quotaLabel={quotaLabel}
                selected={selectedSeatId === seat.id}
                highlighted={!!guest && highlightSet.has(guest.id)}
                locked={assignment.locked}
                toolbarMode={toolbarMode}
                dragDisabled={dragDisabled || layoutMode}
                dndEnabled={dndEnabled && !layoutMode}
                onClick={() => {
                  if (!layoutMode) onSeatClick(seat.id);
                }}
                onRemove={onRemoveGuest ? (e) => onRemoveGuest(seat.id, e) : undefined}
              />
              {renderDecorRemove(item.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
});
