import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Crown, Lock, Minus, Plus, X } from 'lucide-react';
import { memo, useMemo } from 'react';
import type { Guest, Seat, SeatAssignment } from '../../types';
import type { LongTableAdjustSide } from '../../store/seatingWorkspaceStore';
import { roundTableRadius, roundTableSize } from '../../utils/guestSeats';
import { getGuestFromMap } from '../../utils/guestLookup';
import { longTableSeatLabel, roundTableSeatLabel } from '../../utils/rankOrder';
import SeatGuestName from './SeatGuestName';

interface BanquetSeatNodeProps {
  seat: Seat;
  assignment: SeatAssignment;
  guest: Guest | null;
  showTooltip: boolean;
  quotaLabel?: string;
  selected: boolean;
  highlighted: boolean;
  variant: 'round' | 'long';
  tableNumber?: string | number;
  toolbarMode: 'normal' | 'lock' | 'renumber' | 'aisle' | 'layout';
  dragDisabled: boolean;
  dndEnabled?: boolean;
  onClick: () => void;
  onRemove?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const BanquetSeatNode = memo(function BanquetSeatNode({
  seat,
  assignment,
  guest,
  showTooltip,
  quotaLabel,
  selected,
  highlighted,
  variant,
  tableNumber,
  toolbarMode,
  dragDisabled,
  dndEnabled = false,
  onClick,
  onRemove,
  style,
}: BanquetSeatNodeProps) {
  if (dndEnabled) {
    return (
      <BanquetSeatNodeWithDnd
        seat={seat}
        assignment={assignment}
        guest={guest}
        showTooltip={showTooltip}
        quotaLabel={quotaLabel}
        selected={selected}
        highlighted={highlighted}
        variant={variant}
        tableNumber={tableNumber}
        toolbarMode={toolbarMode}
        dragDisabled={dragDisabled}
        onClick={onClick}
        onRemove={onRemove}
        style={style}
      />
    );
  }
  return (
    <BanquetSeatNodeCore
      seat={seat}
      assignment={assignment}
      guest={guest}
      showTooltip={showTooltip}
      quotaLabel={quotaLabel}
      selected={selected}
      highlighted={highlighted}
      variant={variant}
      tableNumber={tableNumber}
      toolbarMode={toolbarMode}
      onClick={onClick}
      onRemove={onRemove}
      style={style}
    />
  );
});

function BanquetSeatNodeCore({
  seat,
  assignment,
  guest,
  showTooltip,
  quotaLabel,
  selected,
  highlighted,
  variant,
  tableNumber,
  toolbarMode,
  onClick,
  onRemove,
  style,
  setRef,
  isOver,
  isDragging,
  dragProps,
}: Omit<BanquetSeatNodeProps, 'dndEnabled' | 'dragDisabled'> & {
  setRef?: (node: HTMLDivElement | null) => void;
  isOver?: boolean;
  isDragging?: boolean;
  dragProps?: Record<string, unknown>;
}) {
  const displayNum =
    variant === 'long' && seat.side !== undefined
      ? longTableSeatLabel(seat)
      : variant === 'round' && tableNumber != null
        ? roundTableSeatLabel(tableNumber, seat)
        : String(seat.customNumber ?? seat.displayNumber);

  return (
    <div
      ref={setRef}
      data-seat-id={seat.id}
      className={[
        'banquet-seat-node',
        `banquet-seat-node--${variant}`,
        assignment.guestId ? 'occupied' : 'empty',
        assignment.locked ? 'locked' : '',
        selected ? 'selected' : '',
        highlighted ? 'highlighted' : '',
        isOver ? 'drop-target' : '',
        isDragging ? 'dragging' : '',
        seat.side === 0 ? 'banquet-seat-top'
          : seat.side === 1 ? 'banquet-seat-bottom'
            : seat.side === 2 ? 'banquet-seat-left'
              : seat.side === 3 ? 'banquet-seat-right' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onClick={onClick}
      {...dragProps}
    >
      <span className="banquet-seat-badge">{displayNum}</span>
      <div className="banquet-seat-body">
        {guest ? (
          <SeatGuestName name={guest.name} className="banquet-seat-name" />
        ) : (
          <span className="banquet-seat-empty">{variant === 'long' || variant === 'round' ? '空' : '空位'}</span>
        )}
      </div>
      {assignment.locked && (
        <span className="banquet-seat-lock">
          <Lock size={9} />
        </span>
      )}
      {guest && !assignment.locked && onRemove && toolbarMode === 'normal' && (
        <button
          type="button"
          className="banquet-seat-remove no-print"
          title="移除嘉賓"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={9} />
        </button>
      )}
      {showTooltip && guest && (
        <div className="seat-tooltip">
          <span>{guest.organization || '—'}</span>
          <span>{guest.title || '—'}</span>
          {quotaLabel && <span className="seat-tooltip-quota">{quotaLabel}</span>}
        </div>
      )}
    </div>
  );
}

const BanquetSeatNodeWithDnd = memo(function BanquetSeatNodeWithDnd(props: BanquetSeatNodeProps) {
  const canDrag =
    !props.dragDisabled &&
    !!props.assignment.guestId &&
    !props.assignment.locked &&
    props.toolbarMode === 'normal';

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${props.seat.id}`,
    data: { seatId: props.seat.id, guestId: props.assignment.guestId },
    disabled: !canDrag,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${props.seat.id}`,
    data: { seatId: props.seat.id },
  });

  const setRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <BanquetSeatNodeCore
      {...props}
      setRef={setRef}
      isOver={isOver}
      isDragging={isDragging}
      dragProps={canDrag ? { ...listeners, ...attributes } : undefined}
    />
  );
});

interface BanquetTableViewProps {
  tableLabel: string;
  coreLabel: string;
  isHeadTable?: boolean;
  tableKey?: string;
  tableNumber?: string | number;
  tableShape: 'round' | 'long';
  seats: Seat[];
  guestMap: Map<string, Guest>;
  assignments: Record<string, SeatAssignment>;
  showTooltip: boolean;
  guestQuotaByGuestId?: Map<string, string>;
  selectedSeatId: string | null;
  highlightGuestIds: string[];
  toolbarMode: 'normal' | 'lock' | 'renumber' | 'aisle' | 'layout';
  dragDisabled: boolean;
  dndEnabled?: boolean;
  onSeatClick: (seatId: string) => void;
  onTableClick?: (tableKey: string) => void;
  onRemoveGuest?: (seatId: string, e: React.MouseEvent) => void;
  onAdjustSeats?: (delta: number, side?: LongTableAdjustSide) => void;
}

function LongSideControls({
  label,
  count,
  side,
  vertical,
  show,
  onAdjustSeats,
}: {
  label: string;
  count: number;
  side: LongTableAdjustSide;
  vertical?: boolean;
  show: boolean;
  onAdjustSeats?: (delta: number, side?: LongTableAdjustSide) => void;
}) {
  if (!show || !onAdjustSeats) return null;
  return (
    <div className={`long-side-controls adjust-btns no-print${vertical ? ' long-side-controls--vertical' : ''}`}>
      <span className="long-side-controls-label">{label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdjustSeats(-1, side);
        }}
        title={`減少${label}座位`}
        aria-label={`減少${label}座位`}
      >
        <Minus size={12} />
      </button>
      <span className="table-seat-count">{count}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdjustSeats(1, side);
        }}
        title={`增加${label}座位`}
        aria-label={`增加${label}座位`}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}

function getGuest(guests: Map<string, Guest>, id: string | null): Guest | null {
  return getGuestFromMap(guests, id);
}

/** side 0 = 上排、1 = 下排、2 = 左側、3 = 右側 */
function longTableSide(seat: Seat): 0 | 1 | 2 | 3 | null {
  if (seat.side === 0 || seat.side === 1 || seat.side === 2 || seat.side === 3) return seat.side;
  if (seat.id.includes('-side0-') || seat.id.includes('-top-')) return 0;
  if (seat.id.includes('-side1-') || seat.id.includes('-bottom-')) return 1;
  if (seat.id.includes('-left-')) return 2;
  if (seat.id.includes('-right-')) return 3;
  return null;
}

function splitLongTableSeats(seats: Seat[]): {
  top: Seat[];
  bottom: Seat[];
  left: Seat[];
  right: Seat[];
} {
  const top: Seat[] = [];
  const bottom: Seat[] = [];
  const left: Seat[] = [];
  const right: Seat[] = [];
  seats.forEach((seat) => {
    const side = longTableSide(seat);
    if (side === 0) top.push(seat);
    else if (side === 1) bottom.push(seat);
    else if (side === 2) left.push(seat);
    else if (side === 3) right.push(seat);
  });
  top.sort((a, b) => a.index - b.index);
  bottom.sort((a, b) => a.index - b.index);
  left.sort((a, b) => a.index - b.index);
  right.sort((a, b) => a.index - b.index);
  return { top, bottom, left, right };
}

export default memo(function BanquetTableView({
  tableLabel,
  coreLabel,
  isHeadTable,
  tableKey,
  tableNumber,
  tableShape,
  seats,
  guestMap,
  assignments,
  showTooltip,
  guestQuotaByGuestId,
  selectedSeatId,
  highlightGuestIds,
  toolbarMode,
  dragDisabled,
  dndEnabled = false,
  onSeatClick,
  onTableClick,
  onRemoveGuest,
  onAdjustSeats,
}: BanquetTableViewProps) {
  const highlightSet = useMemo(() => new Set(highlightGuestIds), [highlightGuestIds]);
  const canRenumberTable =
    toolbarMode === 'renumber' && !isHeadTable && tableKey && onTableClick;
  const canAdjustSeats = toolbarMode === 'normal' && !!onAdjustSeats;

  const roundSeatControls = canAdjustSeats && tableShape === 'round' ? (
    <div className="table-seat-controls adjust-btns no-print">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdjustSeats!(-1);
        }}
        title="減少座位"
        aria-label="減少座位"
      >
        <Minus size={12} />
      </button>
      <span className="table-seat-count">{seats.length}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdjustSeats!(1);
        }}
        title="增加座位"
        aria-label="增加座位"
      >
        <Plus size={12} />
      </button>
    </div>
  ) : null;

  const handleTableRenumberClick = (e: React.MouseEvent) => {
    if (!canRenumberTable) return;
    e.stopPropagation();
    onTableClick!(tableKey!);
  };

  const tableRenumberClass = canRenumberTable ? ' renumber-mode' : '';
  const renderSeat = (seat: Seat, style?: React.CSSProperties) => {
    const assignment = assignments[seat.id];
    const guest = getGuest(guestMap, assignment?.guestId ?? null);
    const quotaLabel = guest ? guestQuotaByGuestId?.get(guest.id) : undefined;
    return (
      <BanquetSeatNode
        key={seat.id}
        seat={seat}
        assignment={assignment}
        guest={guest}
        showTooltip={showTooltip}
        quotaLabel={quotaLabel}
        selected={selectedSeatId === seat.id}
        highlighted={!!guest && highlightSet.has(guest.id)}
        variant={tableShape}
        tableNumber={tableNumber}
        toolbarMode={toolbarMode}
        dragDisabled={dragDisabled}
        dndEnabled={dndEnabled}
        onClick={() => onSeatClick(seat.id)}
        onRemove={onRemoveGuest ? (e) => onRemoveGuest(seat.id, e) : undefined}
        style={style}
      />
    );
  };

  if (tableShape === 'round') {
    const sorted = [...seats].sort((a, b) => a.index - b.index);
    const total = sorted.length;
    const radius = roundTableRadius(total);
    const size = roundTableSize(radius);

    return (
      <div
        className={`banquet-table-wrap ${isHeadTable ? 'head-table' : 'banquet-guest-table'}`}
        style={{
          width: size,
          maxWidth: size,
          flex: '0 0 auto',
          flexShrink: 0,
          margin: 0,
        }}
      >
        <div
          className={`banquet-table-title${tableRenumberClass}`}
          onClick={handleTableRenumberClick}
          title={canRenumberTable ? '點擊修改桌號' : undefined}
        >
          {tableLabel}
        </div>
        {roundSeatControls}
        <div
          className="banquet-table-round"
          style={{ width: size, height: size, minWidth: size, minHeight: size }}
        >
          <div
            className={`banquet-table-core ${isHeadTable ? 'head' : ''}${tableRenumberClass}`}
            onClick={handleTableRenumberClick}
            title={canRenumberTable ? '點擊修改桌號' : undefined}
          >
            {isHeadTable && <Crown size={14} />}
            {coreLabel}
          </div>
          {sorted.map((seat, i) => {
            const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return renderSeat(seat, {
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
            });
          })}
        </div>
      </div>
    );
  }

  const { top, bottom, left, right } = splitLongTableSeats(seats);
  const horizontalCount = Math.max(top.length, bottom.length, 1);
  const verticalCount = Math.max(left.length, right.length, 1);
  const hasSideColumns = left.length > 0 || right.length > 0;

  const longTableCore = (
    <div
      className={`banquet-table-core long ${isHeadTable ? 'head' : ''}${tableRenumberClass}`}
      onClick={handleTableRenumberClick}
      title={canRenumberTable ? '點擊修改桌號' : undefined}
    >
      {isHeadTable && <Crown size={14} />}
      {coreLabel}
    </div>
  );

  return (
    <div className={`banquet-table-wrap ${isHeadTable ? 'head-table' : 'banquet-guest-table'}`}>
      <div
        className={`banquet-table-title${tableRenumberClass}`}
        onClick={handleTableRenumberClick}
        title={canRenumberTable ? '點擊修改桌號' : undefined}
      >
        {tableLabel}
      </div>
      {roundSeatControls}
      <div
        className={`banquet-table-long${hasSideColumns ? ' banquet-table-long--four-side' : ' banquet-table-long--stacked'}`}
        style={{
          '--long-seat-count': horizontalCount,
          '--long-side-count': verticalCount,
        } as React.CSSProperties}
      >
        {top.length > 0 && (
          <div className="banquet-long-side-block">
            <LongSideControls
              label="上排"
              count={top.length}
              side="top"
              show={canAdjustSeats}
              onAdjustSeats={onAdjustSeats}
            />
            <div className="banquet-long-row banquet-long-top">{top.map((s) => renderSeat(s))}</div>
          </div>
        )}
        {hasSideColumns ? (
          <div className="banquet-long-middle">
            {left.length > 0 && (
              <div className="banquet-long-side-block banquet-long-side-block--col">
                <LongSideControls
                  label="左側"
                  count={left.length}
                  side="sideLeft"
                  vertical
                  show={canAdjustSeats}
                  onAdjustSeats={onAdjustSeats}
                />
                <div className="banquet-long-col banquet-long-left">{left.map((s) => renderSeat(s))}</div>
              </div>
            )}
            {longTableCore}
            {right.length > 0 && (
              <div className="banquet-long-side-block banquet-long-side-block--col">
                <LongSideControls
                  label="右側"
                  count={right.length}
                  side="sideRight"
                  vertical
                  show={canAdjustSeats}
                  onAdjustSeats={onAdjustSeats}
                />
                <div className="banquet-long-col banquet-long-right">{right.map((s) => renderSeat(s))}</div>
              </div>
            )}
          </div>
        ) : (
          longTableCore
        )}
        {bottom.length > 0 && (
          <div className="banquet-long-side-block">
            <LongSideControls
              label="下排"
              count={bottom.length}
              side="bottom"
              show={canAdjustSeats}
              onAdjustSeats={onAdjustSeats}
            />
            <div className="banquet-long-row banquet-long-bottom">
              {bottom.map((s) => renderSeat(s))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
