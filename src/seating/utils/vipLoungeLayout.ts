import type { VipLoungeItem } from '../types';
import {
  VIP_CANVAS_HEIGHT,
  VIP_CANVAS_WIDTH,
  VIP_CHAIR_SIZE,
  VIP_GRID,
  VIP_SEAT_SIZE,
  VIP_SNAP_THRESHOLD,
  VIP_TABLE_COFFEE_H,
  VIP_TABLE_COFFEE_W,
  VIP_TABLE_ROUND_SIZE,
} from './vipLounge';

export type VipAlignMode = 'left' | 'right' | 'centerX' | 'top' | 'bottom' | 'centerY';

export interface VipItemBounds {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  right: number;
  bottom: number;
}

export interface VipSnapGuides {
  vertical: number | null;
  horizontal: number | null;
}

export function getVipItemSize(item: VipLoungeItem): { w: number; h: number } {
  if (item.kind === 'seat') return { w: VIP_SEAT_SIZE, h: VIP_SEAT_SIZE };
  if (item.kind === 'chair') {
    return { w: item.width ?? VIP_CHAIR_SIZE, h: item.height ?? VIP_CHAIR_SIZE };
  }
  const shape = item.shape;
  return {
    w: item.width ?? (shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_W),
    h: item.height ?? (shape === 'round' ? VIP_TABLE_ROUND_SIZE : VIP_TABLE_COFFEE_H),
  };
}

export function getVipItemBounds(item: VipLoungeItem): VipItemBounds {
  const { w, h } = getVipItemSize(item);
  return {
    id: item.id,
    x: item.x,
    y: item.y,
    w,
    h,
    cx: item.x + w / 2,
    cy: item.y + h / 2,
    right: item.x + w,
    bottom: item.y + h,
  };
}

function clampPos(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(VIP_CANVAS_WIDTH - w, x)),
    y: Math.max(0, Math.min(VIP_CANVAS_HEIGHT - h, y)),
  };
}

/** 拖曳時吸附網格及其他物件邊緣／中心 */
export function snapVipDragPosition(
  moving: VipLoungeItem,
  items: VipLoungeItem[],
  rawX: number,
  rawY: number,
): { x: number; y: number; guides: VipSnapGuides } {
  const { w, h } = getVipItemSize(moving);
  const xCandidates: number[] = [];
  const yCandidates: number[] = [];

  for (const item of items) {
    if (item.id === moving.id) continue;
    const b = getVipItemBounds(item);
    xCandidates.push(b.x, b.cx, b.right);
    yCandidates.push(b.y, b.cy, b.bottom);
  }

  let bestX = rawX;
  let bestXDist = VIP_SNAP_THRESHOLD + 1;
  let vGuide: number | null = null;

  const gridX = Math.round(rawX / VIP_GRID) * VIP_GRID;
  if (Math.abs(gridX - rawX) <= VIP_SNAP_THRESHOLD) {
    bestX = gridX;
    bestXDist = Math.abs(gridX - rawX);
    vGuide = null;
  }

  for (const c of xCandidates) {
    for (const [pos, offset] of [
      [rawX, 0],
      [rawX + w / 2, w / 2],
      [rawX + w, w],
    ] as const) {
      const dist = Math.abs(pos - c);
      if (dist <= VIP_SNAP_THRESHOLD && dist < bestXDist) {
        bestX = c - offset;
        bestXDist = dist;
        vGuide = c;
      }
    }
  }

  let bestY = rawY;
  let bestYDist = VIP_SNAP_THRESHOLD + 1;
  let hGuide: number | null = null;

  const gridY = Math.round(rawY / VIP_GRID) * VIP_GRID;
  if (Math.abs(gridY - rawY) <= VIP_SNAP_THRESHOLD) {
    bestY = gridY;
    bestYDist = Math.abs(gridY - rawY);
    hGuide = null;
  }

  for (const c of yCandidates) {
    for (const [pos, offset] of [
      [rawY, 0],
      [rawY + h / 2, h / 2],
      [rawY + h, h],
    ] as const) {
      const dist = Math.abs(pos - c);
      if (dist <= VIP_SNAP_THRESHOLD && dist < bestYDist) {
        bestY = c - offset;
        bestYDist = dist;
        hGuide = c;
      }
    }
  }

  const clamped = clampPos(bestX, bestY, w, h);
  return {
    x: Math.round(clamped.x),
    y: Math.round(clamped.y),
    guides: { vertical: vGuide, horizontal: hGuide },
  };
}

/** 將多個已選項目對齊 */
export function alignVipItems(
  items: VipLoungeItem[],
  selectedIds: string[],
  mode: VipAlignMode,
): VipLoungeItem[] {
  if (selectedIds.length < 2) return items;
  const idSet = new Set(selectedIds);
  const bounds = items.filter((i) => idSet.has(i.id)).map(getVipItemBounds);
  if (bounds.length < 2) return items;

  const minX = Math.min(...bounds.map((b) => b.x));
  const maxRight = Math.max(...bounds.map((b) => b.right));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxBottom = Math.max(...bounds.map((b) => b.bottom));
  const centerX = (minX + maxRight) / 2;
  const centerY = (minY + maxBottom) / 2;

  return items.map((item) => {
    if (!idSet.has(item.id)) return item;
    const { w, h } = getVipItemSize(item);
    let x = item.x;
    let y = item.y;

    switch (mode) {
      case 'left':
        x = minX;
        break;
      case 'right':
        x = maxRight - w;
        break;
      case 'centerX':
        x = centerX - w / 2;
        break;
      case 'top':
        y = minY;
        break;
      case 'bottom':
        y = maxBottom - h;
        break;
      case 'centerY':
        y = centerY - h / 2;
        break;
      default:
        break;
    }

    const clamped = clampPos(x, y, w, h);
    return { ...item, x: Math.round(clamped.x), y: Math.round(clamped.y) };
  });
}
