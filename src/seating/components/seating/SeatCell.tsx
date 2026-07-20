import { memo } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Lock, X } from 'lucide-react';
import type { Guest, Seat, SeatAssignment } from '../../types';
import SeatGuestName from './SeatGuestName';

interface SeatCellProps {
  seat: Seat;
  assignment: SeatAssignment;
  guest: Guest | null;
  showTooltip: boolean;
  quotaLabel?: string;
  selected: boolean;
  highlighted: boolean;
  locked: boolean;
  toolbarMode: 'normal' | 'lock' | 'renumber' | 'aisle' | 'layout';
  dragDisabled: boolean;
  dndEnabled?: boolean;
  aislePick?: boolean;
  aisleBreakAfter?: boolean;
  onClick: () => void;
  onRemove?: (e: React.MouseEvent) => void;
}

function SeatCellCore({
  seat,
  assignment,
  guest,
  showTooltip,
  quotaLabel,
  selected,
  highlighted,
  locked,
  toolbarMode,
  onClick,
  onRemove,
  aislePick,
  aisleBreakAfter,
  setRef,
  isOver,
  isDragging,
  dragProps,
}: SeatCellProps & {
  setRef?: (node: HTMLDivElement | null) => void;
  isOver?: boolean;
  isDragging?: boolean;
  dragProps?: Record<string, unknown>;
}) {
  const displayNum = seat.customNumber ?? seat.displayNumber;
  const zoneClass =
    seat.zone === 'stage'
      ? 'seat-stage'
      : seat.zone === 'vip'
        ? 'seat-vip'
        : seat.zone === 'main'
          ? 'seat-main'
          : 'seat-floor';

  return (
    <div
      ref={setRef}
      data-seat-id={seat.id}
      className={[
        'seat-cell',
        zoneClass,
        assignment.guestId ? 'occupied' : 'empty',
        locked ? 'locked' : '',
        selected ? 'selected' : '',
        highlighted ? 'highlighted' : '',
        isOver ? 'drop-target' : '',
        isDragging ? 'dragging' : '',
        toolbarMode === 'lock' ? 'lock-mode' : '',
        toolbarMode === 'renumber' ? 'renumber-mode' : '',
        toolbarMode === 'aisle' ? 'aisle-mode' : '',
        aislePick ? 'aisle-pick' : '',
        aisleBreakAfter ? 'aisle-break-after' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      {...dragProps}
    >
      <span className="seat-number">{displayNum}</span>
      {guest && <SeatGuestName name={guest.name} />}
      {locked && (
        <span className="seat-lock">
          <Lock size={10} />
        </span>
      )}
      {guest && !locked && onRemove && toolbarMode === 'normal' && (
        <button
          type="button"
          className="seat-remove no-print"
          title="移除嘉賓"
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={10} />
        </button>
      )}
      {showTooltip && guest && (
        <div className="seat-tooltip">
          <span>{guest.organization || '—'}</span>
          <span>{guest.title || '—'}</span>
          {guest.jobLevel ? <span>{guest.jobLevel}</span> : null}
          {quotaLabel && <span className="seat-tooltip-quota">{quotaLabel}</span>}
        </div>
      )}
    </div>
  );
}

const SeatCellWithDnd = memo(function SeatCellWithDnd(props: SeatCellProps) {
  const canDrag =
    !props.dragDisabled &&
    !!props.assignment.guestId &&
    !props.locked &&
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
    <SeatCellCore
      {...props}
      setRef={setRef}
      isOver={isOver}
      isDragging={isDragging}
      dragProps={canDrag ? { ...listeners, ...attributes } : undefined}
    />
  );
});

export default memo(function SeatCell(props: SeatCellProps) {
  if (props.dndEnabled) {
    return <SeatCellWithDnd {...props} />;
  }
  return <SeatCellCore {...props} />;
});
