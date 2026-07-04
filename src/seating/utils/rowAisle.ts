import type { BanquetVenueConfig, Seat, StageSettings, StageVenueConfig, VenueConfig } from '../types';
import { sortSeatsPhysical } from './rankOrder';

/** 平面圖上每 1 單位走道寬度（px）；匯出時每單位 = 1 欄空格 */
export const ROW_AISLE_UNIT_PX = 48;

export const ROW_AISLE_GAP_MAX = 5;
/** @deprecated 請用 ROW_SEATS_PER_SEGMENT_MAX */
export const ROW_SEGMENT_COUNT_MAX = 12;
export const ROW_SEATS_PER_SEGMENT_MAX = 99;

function clampGap(value: unknown): number {
  return Math.max(0, Math.min(ROW_AISLE_GAP_MAX, Math.floor(Number(value)) || 0));
}

function clampSegmentCount(value: unknown): number {
  return Math.max(1, Math.min(ROW_SEGMENT_COUNT_MAX, Math.floor(Number(value)) || 1));
}

function clampSeatsPerSegment(value: unknown): number {
  return Math.max(0, Math.min(ROW_SEATS_PER_SEGMENT_MAX, Math.floor(Number(value)) || 0));
}

/** 宴會枱間走道（向下相容 tableAisleGap） */
export function getBanquetFloorAisleGap(config: BanquetVenueConfig, row: number): number {
  const raw = config.rowOverrides?.[row]?.tableAisleGap ?? config.tableAisleGap ?? config.rowAisleGap ?? 1;
  return clampGap(raw);
}

export function getStageRowAisleGap(
  config: StageSettings | StageVenueConfig,
  row: number,
): number {
  const raw = config.stageRowOverrides?.[row]?.rowAisleGap ?? config.rowAisleGap ?? 1;
  return clampGap(raw);
}

/** 走道寬度（0 = 無走道） */
export function getRowAisleGap(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
): number {
  if (zone === 'stage') {
    if (config.type === 'stage') return getStageRowAisleGap(config, row);
    if (config.type === 'banquet' || config.type === 'theater') {
      return config.hasStage ? getStageRowAisleGap(config, row) : 0;
    }
    return 0;
  }

  if (config.type === 'banquet') return getBanquetFloorAisleGap(config, row);
  if (config.type === 'theater') {
    const raw = config.rowOverrides?.[row]?.rowAisleGap ?? config.rowAisleGap ?? 1;
    return clampGap(raw);
  }
  return 0;
}

/** 每段座位數（0 = 不分段） */
export function getRowSeatsPerSegment(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
): number {
  if (zone === 'stage') {
    if (config.type === 'stage') {
      return clampSeatsPerSegment(
        config.stageRowOverrides?.[row]?.rowSeatsPerSegment ?? config.rowSeatsPerSegment ?? 0,
      );
    }
    if ((config.type === 'banquet' || config.type === 'theater') && config.hasStage) {
      return clampSeatsPerSegment(
        config.stageRowOverrides?.[row]?.rowSeatsPerSegment ?? config.rowSeatsPerSegment ?? 0,
      );
    }
    return 0;
  }

  if (config.type === 'theater') {
    return clampSeatsPerSegment(
      config.rowOverrides?.[row]?.rowSeatsPerSegment ?? config.rowSeatsPerSegment ?? 0,
    );
  }

  return 0;
}

/** @deprecated 請用 getRowSeatsPerSegment */
export function getRowSegmentCount(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
): number {
  if (zone === 'stage') {
    if (config.type === 'stage') {
      return clampSegmentCount(
        config.stageRowOverrides?.[row]?.rowSegmentCount ?? config.rowSegmentCount ?? 1,
      );
    }
    if ((config.type === 'banquet' || config.type === 'theater') && config.hasStage) {
      return clampSegmentCount(
        config.stageRowOverrides?.[row]?.rowSegmentCount ?? config.rowSegmentCount ?? 1,
      );
    }
    return 1;
  }

  if (config.type === 'theater') {
    return clampSegmentCount(
      config.rowOverrides?.[row]?.rowSegmentCount ?? config.rowSegmentCount ?? 1,
    );
  }

  return 1;
}

/** 依手動斷點拆排（在指定 seat.index 之後插入走道） */
export function splitRowByAisleBreaks(seats: Seat[], breakAfterIndices: number[]): Seat[][] {
  const sorted = sortSeatsPhysical(seats);
  if (sorted.length === 0) return [];
  const breakSet = new Set(
    breakAfterIndices.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n)),
  );
  if (breakSet.size === 0) return [sorted];

  const segments: Seat[][] = [];
  let current: Seat[] = [];

  for (const seat of sorted) {
    current.push(seat);
    if (breakSet.has(seat.index)) {
      segments.push(current);
      current = [];
    }
  }

  if (current.length > 0) segments.push(current);
  return segments.length > 0 ? segments : [sorted];
}

export function getRowAisleBreakAfterIndex(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
): number[] {
  let raw: number[] | undefined;

  if (zone === 'stage') {
    if (config.type === 'stage') {
      raw = config.stageRowOverrides?.[row]?.rowAisleBreakAfterIndex ?? config.rowAisleBreakAfterIndex;
    } else if ((config.type === 'banquet' || config.type === 'theater') && config.hasStage) {
      raw = config.stageRowOverrides?.[row]?.rowAisleBreakAfterIndex;
    }
  } else if (config.type === 'theater') {
    raw = config.rowOverrides?.[row]?.rowAisleBreakAfterIndex;
  }

  if (!raw || !Array.isArray(raw)) return [];
  return [...new Set(raw.map((n) => Math.floor(Number(n))).filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
}

export function canPlaceRowAisleBreaks(config: VenueConfig): boolean {
  if (config.type === 'stage' || config.type === 'theater') return true;
  if (config.type === 'banquet' && config.hasStage) return true;
  return false;
}

export function isSeatEligibleForAisleBreak(seat: Seat, config: VenueConfig): boolean {
  if (seat.zone === 'main') return false;
  if (seat.zone === 'stage') {
    if (config.type === 'stage') return true;
    if (config.type === 'banquet' || config.type === 'theater') return config.hasStage;
    return false;
  }
  if (seat.zone === 'floor') return config.type === 'theater';
  return false;
}

/** 兩座位是否在同一排且物理相鄰；回傳走道應插入於左側座位的 index */
export function getAisleBreakAfterIndexBetweenSeats(
  seatA: Seat,
  seatB: Seat,
  rowSeats: Seat[],
): number | null {
  if (seatA.row !== seatB.row || seatA.zone !== seatB.zone) return null;
  const sorted = sortSeatsPhysical(rowSeats);
  const idxA = sorted.findIndex((s) => s.id === seatA.id);
  const idxB = sorted.findIndex((s) => s.id === seatB.id);
  if (idxA < 0 || idxB < 0 || Math.abs(idxA - idxB) !== 1) return null;
  const leftIdx = Math.min(idxA, idxB);
  return sorted[leftIdx]?.index ?? null;
}

export function setRowAisleBreakAfterIndexOnConfig(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  breakAfterIndices: number[],
): void {
  const normalized = [...new Set(breakAfterIndices.map((n) => Math.floor(Number(n))))]
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const patch = { rowAisleBreakAfterIndex: normalized.length > 0 ? normalized : undefined };

  if (zone === 'stage') {
    if (config.type === 'stage') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], ...patch },
      };
      return;
    }
    if (config.type === 'banquet' || config.type === 'theater') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], ...patch },
      };
    }
    return;
  }

  if (config.type === 'theater') {
    config.rowOverrides = {
      ...config.rowOverrides,
      [row]: { ...config.rowOverrides?.[row], ...patch },
    };
  }
}

/** 切換單一走道斷點；回傳 true 表示已新增，false 表示已移除 */
export function toggleRowAisleBreakOnConfig(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  breakAfterIndex: number,
): boolean {
  const current = getRowAisleBreakAfterIndex(config, row, zone);
  const exists = current.includes(breakAfterIndex);
  const next = exists
    ? current.filter((i) => i !== breakAfterIndex)
    : [...current, breakAfterIndex].sort((a, b) => a - b);
  setRowAisleBreakAfterIndexOnConfig(config, row, zone, next);
  return !exists;
}

/** 依每段座位數拆排（例如 15 位、每段 5 → 5+5+5） */
export function splitRowBySeatsPerSegment(seats: Seat[], seatsPerSegment: number): Seat[][] {
  const sorted = sortSeatsPhysical(seats);
  if (sorted.length === 0) return [];
  const size = clampSeatsPerSegment(seatsPerSegment);
  if (size <= 0) return [sorted];

  const segments: Seat[][] = [];
  for (let offset = 0; offset < sorted.length; offset += size) {
    segments.push(sorted.slice(offset, offset + size));
  }

  return segments.length > 0 ? segments : [sorted];
}

/** @deprecated 舊版依分段數均分 */
export function splitRowIntoSegments(seats: Seat[], segmentCount: number): Seat[][] {
  const sorted = sortSeatsPhysical(seats);
  if (sorted.length === 0) return [];
  const count = clampSegmentCount(segmentCount);
  if (count <= 1) return [sorted];

  const segments: Seat[][] = [];
  const base = Math.floor(sorted.length / count);
  let remainder = sorted.length % count;
  let offset = 0;

  for (let i = 0; i < count; i++) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (size > 0) {
      segments.push(sorted.slice(offset, offset + size));
      offset += size;
    }
  }

  return segments.length > 0 ? segments : [sorted];
}

function buildSeatRowSegments(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  seats: Seat[],
): Seat[][] {
  const breakAfter = getRowAisleBreakAfterIndex(config, row, zone);
  if (breakAfter.length > 0) {
    return splitRowByAisleBreaks(seats, breakAfter);
  }

  const seatsPerSegment = getRowSeatsPerSegment(config, row, zone);
  if (seatsPerSegment > 0) {
    return splitRowBySeatsPerSegment(seats, seatsPerSegment);
  }

  const segmentCount = getRowSegmentCount(config, row, zone);
  if (segmentCount > 1) {
    return splitRowIntoSegments(seats, segmentCount);
  }

  const sorted = sortSeatsPhysical(seats);
  return sorted.length > 0 ? [sorted] : [];
}

export function getSortedTableSegments(tables: Record<number, Seat[]>): Seat[][] {
  return Object.entries(tables)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, seats]) => sortSeatsPhysical(seats))
    .filter((seats) => seats.length > 0);
}

export function buildFloorRowSegments(
  config: VenueConfig,
  row: number,
  seats: Seat[],
  tables?: Record<number, Seat[]>,
): Seat[][] {
  if (config.type === 'banquet' && tables && Object.keys(tables).length > 0) {
    return getSortedTableSegments(tables);
  }
  return buildSeatRowSegments(config, row, 'floor', seats);
}

export function buildStageRowSegments(
  config: VenueConfig,
  row: number,
  seats: Seat[],
): Seat[][] {
  return buildSeatRowSegments(config, row, 'stage', seats);
}

export function rowAisleWidthPx(gap: number): number {
  if (gap <= 0) return 0;
  return gap * ROW_AISLE_UNIT_PX;
}

export function setRowAisleGapOnConfig(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  value: number,
): void {
  const gap = clampGap(value);
  if (zone === 'stage') {
    if (config.type === 'stage') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowAisleGap: gap },
      };
      return;
    }
    if (config.type === 'banquet' || config.type === 'theater') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowAisleGap: gap },
      };
    }
    return;
  }

  if (config.type === 'banquet') {
    const banquet = config as BanquetVenueConfig;
    banquet.rowOverrides = {
      ...banquet.rowOverrides,
      [row]: { ...banquet.rowOverrides?.[row], tableAisleGap: gap, rowAisleGap: gap },
    };
    banquet.tableAisleGap = banquet.tableAisleGap ?? gap;
    banquet.rowAisleGap = banquet.rowAisleGap ?? gap;
    return;
  }

  if (config.type === 'theater') {
    config.rowOverrides = {
      ...config.rowOverrides,
      [row]: { ...config.rowOverrides?.[row], rowAisleGap: gap },
    };
  }
}

export function setRowSeatsPerSegmentOnConfig(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  value: number,
): void {
  const seatsPerSegment = clampSeatsPerSegment(value);
  if (zone === 'stage') {
    if (config.type === 'stage') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowSeatsPerSegment: seatsPerSegment },
      };
      return;
    }
    if (config.type === 'banquet' || config.type === 'theater') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowSeatsPerSegment: seatsPerSegment },
      };
    }
    return;
  }

  if (config.type === 'theater') {
    config.rowOverrides = {
      ...config.rowOverrides,
      [row]: { ...config.rowOverrides?.[row], rowSeatsPerSegment: seatsPerSegment },
    };
  }
}

/** @deprecated 請用 setRowSeatsPerSegmentOnConfig */
export function setRowSegmentCountOnConfig(
  config: VenueConfig,
  row: number,
  zone: 'floor' | 'stage',
  value: number,
): void {
  const count = clampSegmentCount(value);
  if (zone === 'stage') {
    if (config.type === 'stage') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowSegmentCount: count },
      };
      return;
    }
    if (config.type === 'banquet' || config.type === 'theater') {
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { ...config.stageRowOverrides?.[row], rowSegmentCount: count },
      };
    }
    return;
  }

  if (config.type === 'theater') {
    config.rowOverrides = {
      ...config.rowOverrides,
      [row]: { ...config.rowOverrides?.[row], rowSegmentCount: count },
    };
  }
}

/** @deprecated 使用 getBanquetFloorAisleGap */
export const getRowTableAisleGap = getBanquetFloorAisleGap;
/** @deprecated 使用 rowAisleWidthPx */
export const tableAisleWidthPx = rowAisleWidthPx;
/** @deprecated 使用 ROW_AISLE_GAP_MAX */
export const TABLE_AISLE_GAP_MAX = ROW_AISLE_GAP_MAX;
