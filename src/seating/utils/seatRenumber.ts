import type { Seat, SeatingPlan } from '../types';
import { longTableSeatLabel, roundTableSeatLabel } from './rankOrder';
import { getTableDisplayNumber } from './tableNumber';

export function getRenumberGroup(seat: Seat): string {
  if (seat.zone === 'stage') return `stage-r${seat.row ?? 0}`;
  if (seat.zone === 'main') return 'main';
  if (seat.zone === 'floor') {
    if (seat.table !== undefined) return `floor-r${seat.row ?? 0}-t${seat.table}`;
    return `floor-r${seat.row ?? 0}`;
  }
  return seat.id;
}

export function seatDisplayNumber(seat: Seat, sub?: SeatingPlan): string {
  if (seat.side !== undefined) {
    return longTableSeatLabel(seat);
  }
  if (
    sub?.venueConfig.type === 'banquet' &&
    sub.venueConfig.guestTableShape === 'round' &&
    seat.zone === 'floor' &&
    seat.table !== undefined
  ) {
    const tableNum = getTableDisplayNumber(sub, seat.row ?? 0, seat.table);
    return roundTableSeatLabel(tableNum, seat);
  }
  return String(seat.customNumber ?? seat.displayNumber);
}

export function getSeatsInRenumberGroup(sub: SeatingPlan, group: string): Seat[] {
  return sub.seats.filter((s) => getRenumberGroup(s) === group);
}

export function isDuplicateNumberInGroup(
  sub: SeatingPlan,
  group: string,
  value: string,
  excludeSeatId?: string,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return getSeatsInRenumberGroup(sub, group).some((s) => {
    if (s.id === excludeSeatId) return false;
    return seatDisplayNumber(s, sub) === trimmed;
  });
}

export function validateRenumber(
  sub: SeatingPlan,
  seatId: string,
  value: string,
): string | null {
  const seat = sub.seats.find((s) => s.id === seatId);
  if (!seat) return '找不到座位';
  const trimmed = value.trim();
  if (!trimmed) return null;
  const group = getRenumberGroup(seat);
  if (isDuplicateNumberInGroup(sub, group, trimmed, seatId)) {
    return '此編號在同一桌／同一排中已存在，不可重複';
  }
  return null;
}

export function validateRenumberSwap(
  sub: SeatingPlan,
  seatIdA: string,
  seatIdB: string,
): string | null {
  const a = sub.seats.find((s) => s.id === seatIdA);
  const b = sub.seats.find((s) => s.id === seatIdB);
  if (!a || !b) return '找不到座位';
  if (getRenumberGroup(a) !== getRenumberGroup(b)) {
    return '不可跨桌或跨排互換編號';
  }
  return null;
}
