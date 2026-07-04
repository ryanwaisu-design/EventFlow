import { longTableSeatLabel } from '../utils/rankOrder';
import { getTableDisplayNumber, MAIN_TABLE_KEY } from '../utils/tableNumber';

function deriveTableNo(plan, seat) {
  if (!seat) return '';
  if (seat.zone === 'main') return '主桌';
  if (seat.zone === 'stage') {
    return seat.row !== undefined ? `第 ${seat.row + 1} 排` : '台上';
  }
  if (seat.zone === 'floor' && seat.table !== undefined) {
    return String(getTableDisplayNumber(plan, seat.row ?? 0, seat.table));
  }
  if (plan.venueConfig.type === 'theater' && seat.row !== undefined) {
    return `第 ${seat.row + 1} 排`;
  }
  return '';
}

function deriveSeatNo(plan, seat) {
  if (!seat) return '';
  if (seat.side !== undefined) {
    return longTableSeatLabel(seat);
  }
  const n = seat.customNumber ?? seat.displayNumber;
  return n !== undefined && n !== null ? String(n) : '';
}

function primarySeatId(plan, guestId) {
  const p = plan.participations[guestId];
  if (!p) return null;
  return p.audienceSeat || p.stageSeat || null;
}

/**
 * 將排位結果寫回 EventFlow attendance.tableNo / seatNo
 * @returns {Array} 更新後的 attendance 陣列（新引用）
 */
export function writebackSeatingToAttendance(plan, attendance, { clearUnassigned = true } = {}) {
  const participantSet = new Set(plan.participantGuestIds);
  const seatById = new Map(plan.seats.map((s) => [s.id, s]));

  return attendance.map((record) => {
    if (record.eventId !== plan.eventId) return record;
    if (!participantSet.has(record.guestId)) {
      if (clearUnassigned) {
        return { ...record, tableNo: '', seatNo: '' };
      }
      return record;
    }

    const seatId = primarySeatId(plan, record.guestId);
    if (!seatId) {
      if (clearUnassigned) {
        return { ...record, tableNo: '', seatNo: '' };
      }
      return record;
    }

    const seat = seatById.get(seatId);
    return {
      ...record,
      tableNo: deriveTableNo(plan, seat),
      seatNo: deriveSeatNo(plan, seat),
    };
  });
}

export { deriveTableNo, deriveSeatNo, primarySeatId };
