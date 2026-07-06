import { generateId } from '../../utils/helpers';
import type {
  Seat,
  SubEvent,
  VipLoungeChairItem,
  VipLoungeConfig,
  VipLoungeItem,
  VipLoungeSeatItem,
  VipLoungeTableItem,
  VipLoungeTableShape,
} from '../types';
import { mergeAssignments } from './seatGenerator';

export const VIP_CANVAS_WIDTH = 800;
export const VIP_CANVAS_HEIGHT = 480;
export const VIP_SEAT_SIZE = 48;
export const VIP_TABLE_COFFEE_W = 56;
export const VIP_TABLE_COFFEE_H = 40;
export const VIP_TABLE_ROUND_SIZE = 64;
export const VIP_CHAIR_SIZE = 44;
export const VIP_GRID = 24;
export const VIP_SNAP_THRESHOLD = 8;

export function defaultVipLounge(): VipLoungeConfig {
  return { enabled: false, items: [] };
}

function normalizeVipItem(item: VipLoungeItem): VipLoungeItem {
  if (item.kind === 'chair') {
    return {
      id: item.id,
      kind: 'chair',
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      width: item.width ?? VIP_CHAIR_SIZE,
      height: item.height ?? VIP_CHAIR_SIZE,
      rotation: item.rotation ?? 0,
    };
  }
  if (item.kind === 'table') {
    const shape: VipLoungeTableShape = item.shape === 'round' ? 'round' : 'coffee';
    return {
      id: item.id,
      kind: 'table',
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      shape,
      width: item.width ?? (shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_W),
      height: item.height ?? (shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_H),
      label: item.label,
    };
  }
  return {
    id: item.id,
    kind: 'seat',
    x: Number(item.x) || 0,
    y: Number(item.y) || 0,
    rotation: item.rotation ?? 0,
    displayNumber: item.displayNumber,
  };
}

export function normalizeVipLounge(raw?: Partial<VipLoungeConfig> | null): VipLoungeConfig {
  if (!raw) return defaultVipLounge();
  return {
    enabled: Boolean(raw.enabled),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeVipItem) : [],
  };
}

export function nextVipSeatDisplayNumber(items: VipLoungeItem[]): number {
  const nums = items
    .filter((i): i is VipLoungeSeatItem => i.kind === 'seat')
    .map((i) => i.displayNumber ?? 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function createVipSeatItem(
  x = 120,
  y = 120,
  items: VipLoungeItem[] = [],
): VipLoungeSeatItem {
  return {
    id: generateId(),
    kind: 'seat',
    x,
    y,
    rotation: 0,
    displayNumber: nextVipSeatDisplayNumber(items),
  };
}

export function createVipTableItem(
  x = 220,
  y = 160,
  shape: VipLoungeTableShape = 'coffee',
): VipLoungeTableItem {
  return {
    id: generateId(),
    kind: 'table',
    x,
    y,
    shape,
    width: shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_W,
    height: shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_H,
  };
}

export function createVipChairItem(x = 200, y = 140): VipLoungeChairItem {
  return {
    id: generateId(),
    kind: 'chair',
    x,
    y,
    width: VIP_CHAIR_SIZE,
    height: VIP_CHAIR_SIZE,
    rotation: 0,
  };
}

function vipItemToSeat(item: VipLoungeSeatItem, index: number): Seat {
  const num = item.displayNumber ?? index + 1;
  return {
    id: item.id,
    label: `VIP-${num}`,
    zone: 'vip',
    index,
    displayNumber: num,
    x: item.x,
    y: item.y,
    rotation: item.rotation ?? 0,
  };
}

export function syncSubEventVipLounge(sub: SubEvent): SubEvent {
  const vipLounge = normalizeVipLounge(sub.vipLounge);
  const nonVipSeats = sub.seats.filter((s) => s.zone !== 'vip');
  const assignments = { ...sub.assignments };

  if (!vipLounge.enabled) {
    sub.seats
      .filter((s) => s.zone === 'vip')
      .forEach((s) => {
        delete assignments[s.id];
      });
    return { ...sub, vipLounge, seats: nonVipSeats, assignments };
  }

  const seatItems = vipLounge.items.filter((i): i is VipLoungeSeatItem => i.kind === 'seat');
  const vipSeats = seatItems.map((item, i) => vipItemToSeat(item, i));
  const seatIds = new Set(vipSeats.map((s) => s.id));

  Object.keys(assignments).forEach((id) => {
    const seat = sub.seats.find((s) => s.id === id);
    if (seat?.zone === 'vip' && !seatIds.has(id)) delete assignments[id];
  });

  const seats = [...nonVipSeats, ...vipSeats];
  return {
    ...sub,
    vipLounge,
    seats,
    assignments: mergeAssignments(seats, assignments),
  };
}

export function isVipLoungeEnabled(sub?: { vipLounge?: VipLoungeConfig } | null): boolean {
  return Boolean(sub?.vipLounge?.enabled);
}
