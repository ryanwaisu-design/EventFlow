import type { SeatingPlan, VenueConfig } from '../types';

export function floorTableKey(row: number, table: number): string {
  return `floor-r${row}-t${table}`;
}

export const MAIN_TABLE_KEY = 'main';

export function parseFloorTableKey(key: string): { row: number; table: number } | null {
  const m = /^floor-r(\d+)-t(\d+)$/.exec(key);
  if (!m) return null;
  return { row: Number(m[1]), table: Number(m[2]) };
}

export function defaultFloorTableNumber(
  row: number,
  table: number,
  config: VenueConfig,
): number {
  if (config.type !== 'banquet') return table + 1;
  let offset = 0;
  for (let r = 0; r < row; r++) offset += config.tablesPerRow[r] ?? 0;
  return offset + table + 1;
}

export function getAllFloorTableKeys(sub: SeatingPlan): string[] {
  const keys = new Set<string>();
  for (const seat of sub.seats) {
    if (seat.zone === 'floor' && seat.table !== undefined) {
      keys.add(floorTableKey(seat.row ?? 0, seat.table));
    }
  }
  return [...keys].sort();
}

export function getTableDisplayNumber(
  sub: SeatingPlan,
  row: number,
  table: number,
): string | number {
  const key = floorTableKey(row, table);
  const custom = sub.customTableNumbers?.[key];
  if (custom !== undefined && custom !== '') return custom;
  return defaultFloorTableNumber(row, table, sub.venueConfig);
}

export function getTableDisplayNumberByKey(
  sub: SeatingPlan,
  tableKey: string,
): string | number {
  const parsed = parseFloorTableKey(tableKey);
  if (!parsed) return tableKey;
  return getTableDisplayNumber(sub, parsed.row, parsed.table);
}

export function tableTitleLabel(num: string | number): string {
  return typeof num === 'number' ? `第 ${num} 桌` : String(num);
}

export function tableCoreLabel(num: string | number): string {
  return typeof num === 'number' ? `第${num}桌` : String(num);
}

function effectiveTableNumberString(
  sub: SeatingPlan,
  tableKey: string,
  overrides?: Record<string, string | number>,
): string {
  const map = { ...sub.customTableNumbers, ...overrides };
  if (map[tableKey] !== undefined && map[tableKey] !== '') {
    return String(map[tableKey]);
  }
  const parsed = parseFloorTableKey(tableKey);
  if (!parsed) return tableKey;
  return String(defaultFloorTableNumber(parsed.row, parsed.table, sub.venueConfig));
}

export function isDuplicateTableNumber(
  sub: SeatingPlan,
  tableKey: string,
  value: string,
  excludeKey?: string,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return getAllFloorTableKeys(sub).some((key) => {
    if (key === tableKey || key === excludeKey) return false;
    return effectiveTableNumberString(sub, key) === trimmed;
  });
}

export function validateTableRenumber(
  sub: SeatingPlan,
  tableKey: string,
  value: string,
): string | null {
  if (!parseFloorTableKey(tableKey)) return '找不到枱位';
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isDuplicateTableNumber(sub, tableKey, trimmed)) {
    return '此桌號已存在，不可重複';
  }
  return null;
}

export function validateTableRenumberSwap(
  _sub: SeatingPlan,
  tableKeyA: string,
  tableKeyB: string,
): string | null {
  if (!parseFloorTableKey(tableKeyA) || !parseFloorTableKey(tableKeyB)) {
    return '找不到枱位';
  }
  if (tableKeyA === tableKeyB) return '不可與同一枱互換';
  return null;
}
