import type { Guest, Seat, SeatingPlan } from '../types';
import { longTableSeatLabel, roundTableSeatLabel, sortSeatsPhysical } from './rankOrder';
import { getTableDisplayNumber } from './tableNumber';
import {
  buildFloorRowSegments,
  buildStageRowSegments,
  getRowAisleGap,
  getSortedTableSegments,
} from './rowAisle';
import type { EventFlowEventMeta, SeatingView } from './seatingView';

export interface SeatGroup {
  stageByRow: Record<number, Seat[]>;
  main: Seat[];
  floorByRow: Record<number, Seat[]>;
  floorByRowTable: Record<number, Record<number, Seat[]>>;
}

export interface LayoutExcelResult {
  aoa: string[][];
  merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  colWidths: number[];
  rowHeights: Record<number, number>;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function formatExportDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const w = WEEKDAYS[d.getDay()];
    return `${y}年${m}月${day}日（星期${w}）`;
  } catch {
    return dateStr;
  }
}

function exportVersionLabel(plan: SeatingPlan, event?: EventFlowEventMeta): string {
  if (event?.exportVersion) return event.exportVersion;
  const ts = plan.updatedAt ?? event?.updatedAt;
  if (!ts) return 'V1';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'V1';
  return `V${d.getMonth() + 1}${String(d.getDate()).padStart(2, '0')}`;
}

/** 排位圖匯出標題區（Excel / PDF 共用） */
export function buildExportHeaderRows(
  event: EventFlowEventMeta,
  plan: SeatingPlan,
): string[][] {
  const dateLabel = formatExportDate(event.date);
  const version = exportVersionLabel(plan, event);
  const dataSource = event.dataSource || 'EventFlow 邀請名單';
  const totalSeats = plan.seats.length;

  return [
    [event.name],
    ['嘉賓座位圖'],
    [dateLabel ? `日期：${dateLabel}\t${version}` : version],
    [
      [event.venue ? `地點：${event.venue}` : '', `資料來源:${dataSource}`]
        .filter(Boolean)
        .join('\t'),
    ],
    [`全場位置: ${totalSeats}位`],
    [''],
  ];
}

function guestName(guests: Guest[], guestId: string | null): string {
  if (!guestId) return '';
  return guests.find((g) => g.id === guestId)?.name ?? '';
}

function guestDetail(guests: Guest[], guestId: string | null): string {
  const g = guests.find((x) => x.id === guestId);
  if (!g) return '';
  return [g.organization, g.title].filter(Boolean).join('\n');
}

function seatNum(seat: Seat, sub: SeatingPlan): string {
  if (seat.side !== undefined) {
    return longTableSeatLabel(seat);
  }
  if (
    sub.venueConfig.type === 'banquet' &&
    sub.venueConfig.guestTableShape === 'round' &&
    seat.zone === 'floor' &&
    seat.table !== undefined
  ) {
    const tableNum = getTableDisplayNumber(sub, seat.row ?? 0, seat.table);
    return roundTableSeatLabel(tableNum, seat);
  }
  return String(seat.customNumber ?? seat.displayNumber);
}

export function groupSeats(seats: Seat[]): SeatGroup {
  const stage = sortSeatsPhysical(seats.filter((s) => s.zone === 'stage'));
  const main = sortSeatsPhysical(seats.filter((s) => s.zone === 'main'));
  const floor = seats.filter((s) => s.zone === 'floor');

  const stageByRow: Record<number, Seat[]> = {};
  stage.forEach((s) => {
    const row = s.row ?? 0;
    if (!stageByRow[row]) stageByRow[row] = [];
    stageByRow[row].push(s);
  });
  Object.keys(stageByRow).forEach((k) => {
    stageByRow[Number(k)] = sortSeatsPhysical(stageByRow[Number(k)]);
  });

  const floorByRow: Record<number, Seat[]> = {};
  floor.forEach((s) => {
    const row = s.row ?? 0;
    if (!floorByRow[row]) floorByRow[row] = [];
    floorByRow[row].push(s);
  });
  Object.keys(floorByRow).forEach((k) => {
    floorByRow[Number(k)] = sortSeatsPhysical(floorByRow[Number(k)]);
  });

  const floorByRowTable: Record<number, Record<number, Seat[]>> = {};
  floor.forEach((s) => {
    const row = s.row ?? 0;
    const table = s.table ?? 0;
    if (!floorByRowTable[row]) floorByRowTable[row] = {};
    if (!floorByRowTable[row][table]) floorByRowTable[row][table] = [];
    floorByRowTable[row][table].push(s);
  });
  Object.keys(floorByRowTable).forEach((rowKey) => {
    Object.keys(floorByRowTable[Number(rowKey)]).forEach((tableKey) => {
      floorByRowTable[Number(rowKey)][Number(tableKey)] = sortSeatsPhysical(
        floorByRowTable[Number(rowKey)][Number(tableKey)],
      );
    });
  });

  return { stageByRow, main, floorByRow, floorByRowTable };
}

export function isBanquetLayout(view: SeatingView): boolean {
  return view.venueConfig.type === 'banquet';
}

export function isLongTable(view: SeatingView, shape?: 'round' | 'long'): boolean {
  if (view.venueConfig.type !== 'banquet') return false;
  const s = shape ?? view.venueConfig.guestTableShape;
  return s === 'long';
}

/** 將多枱座位展開為匯出欄位；null 代表走道空格 */
function buildGappedExportColumns(segments: Seat[][], gapColumns: number): Array<Seat | null> {
  const cols: Array<Seat | null> = [];
  const gap = Math.max(0, Math.floor(gapColumns) || 0);
  segments.forEach((seg, segIndex) => {
    if (segIndex > 0 && gap > 0) {
      for (let g = 0; g < gap; g++) cols.push(null);
    }
    cols.push(...seg);
  });
  return cols;
}

function buildGappedRowCells<T>(
  segments: Seat[][],
  mapper: (seat: Seat) => T,
  gapValue: T,
  gapColumns: number,
): T[] {
  return buildGappedExportColumns(segments, gapColumns).map((col) => (col ? mapper(col) : gapValue));
}

/** 匯出列中 1 號座位的欄位索引（0-based，含走道空格） */
export function seatOneColumnIndexFromGapped(segments: Seat[][], gapColumns = 1): number {
  const cols = buildGappedExportColumns(segments, gapColumns);
  if (cols.length === 0) return 0;

  const seatPositions = cols
    .map((seat, i) =>
      seat ? { i, n: Number(seat.customNumber ?? seat.displayNumber) } : null,
    )
    .filter((x): x is { i: number; n: number } => x !== null);

  const ones = seatPositions.filter(({ n }) => n === 1);
  if (ones.length === 1) return ones[0].i;
  if (ones.length > 1) {
    const center = (cols.length - 1) / 2;
    return ones.reduce((best, cur) =>
      (Math.abs(cur.i - center) < Math.abs(best.i - center) ? cur : best),
    ).i;
  }

  const center = (cols.length - 1) / 2;
  return seatPositions.reduce(
    (best, cur) => (Math.abs(cur.i - center) < Math.abs(best.i - center) ? cur : best),
    seatPositions[0] ?? { i: 0, n: 0 },
  ).i;
}

/** 匯出列中 1 號座位的欄位索引（0-based，單一連續區塊） */
export function seatOneColumnIndex(seats: Seat[]): number {
  return seatOneColumnIndexFromGapped([sortSeatsPhysical(seats)], 0);
}

function padExportRow(cells: string[], leftPad: number, rightPad = 0): string[] {
  return [
    ...Array(Math.max(0, leftPad)).fill(''),
    ...cells,
    ...Array(Math.max(0, rightPad)).fill(''),
  ];
}

function computeExportAnchorColumn(
  grouped: SeatGroup,
  sub: SeatingPlan,
  useLongRowExport: boolean,
): number {
  let anchor = 0;
  const config = sub.venueConfig;

  const considerFlat = (seats: Seat[], leadingCols = 0) => {
    if (seats.length === 0) return;
    anchor = Math.max(anchor, leadingCols + seatOneColumnIndex(seats));
  };

  const considerSegments = (
    segments: Seat[][],
    gapColumns: number,
    leadingCols = 0,
  ) => {
    if (segments.length === 0) return;
    anchor = Math.max(anchor, leadingCols + seatOneColumnIndexFromGapped(segments, gapColumns));
  };

  Object.entries(grouped.stageByRow).forEach(([rowKey, seats]) => {
    const row = Number(rowKey);
    const segments = buildStageRowSegments(config, row, seats);
    considerSegments(segments, getRowAisleGap(config, row, 'stage'));
  });
  considerFlat(grouped.main);

  if (Object.keys(grouped.floorByRowTable).length > 0) {
    Object.entries(grouped.floorByRowTable).forEach(([rowKey, tables]) => {
      const row = Number(rowKey);
      const segments = buildFloorRowSegments(config, row, [], tables);
      const gapCols = getRowAisleGap(config, row, 'floor');
      if (useLongRowExport) {
        considerSegments(segments, gapCols, 1);
      } else {
        considerSegments(segments, gapCols);
      }
    });
  } else {
    Object.entries(grouped.floorByRow).forEach(([rowKey, seats]) => {
      const row = Number(rowKey);
      const segments = buildFloorRowSegments(config, row, seats);
      considerSegments(segments, getRowAisleGap(config, row, 'floor'));
    });
  }

  return anchor;
}

function normalizeLayoutColumns(result: LayoutExcelResult): void {
  const maxCols = result.aoa.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxCols === 0) return;

  result.aoa = result.aoa.map((row) =>
    row.length < maxCols ? [...row, ...Array(maxCols - row.length).fill('')] : row,
  );

  while (result.colWidths.length < maxCols) {
    result.colWidths.push(18);
  }
}

function appendGappedSeatBlock(
  result: LayoutExcelResult,
  title: string,
  segments: Seat[][],
  view: SeatingView,
  sub: SeatingPlan,
  anchorCol: number,
  gapColumns: number,
  leadingCols = 0,
): void {
  const activeSegments = segments.filter((seg) => seg.length > 0);
  if (activeSegments.length === 0) return;

  const seatOneCol = seatOneColumnIndexFromGapped(activeSegments, gapColumns);
  const leftPad = Math.max(0, anchorCol - leadingCols - seatOneCol);
  const startRow = result.aoa.length;

  const names = buildGappedRowCells(activeSegments, (s) =>
    guestName(view.guests, view.assignments[s.id]?.guestId ?? null),
  '', gapColumns);
  const details = buildGappedRowCells(activeSegments, (s) =>
    guestDetail(view.guests, view.assignments[s.id]?.guestId ?? null),
  '', gapColumns);
  const numbers = buildGappedRowCells(activeSegments, (s) => seatNum(s, sub), '', gapColumns);
  const colCount = names.length;

  result.aoa.push(padExportRow([title, ...Array(Math.max(0, colCount - 1)).fill('')], leftPad));
  result.aoa.push(padExportRow(names, leftPad));
  result.aoa.push(padExportRow(details, leftPad));
  result.aoa.push(padExportRow(numbers, leftPad));
  result.aoa.push(['']);

  if (colCount > 1) {
    result.merges.push({
      s: { r: startRow, c: leftPad },
      e: { r: startRow, c: leftPad + colCount - 1 },
    });
  }

  const detailRow = startRow + 2;
  const maxLines = Math.max(1, ...details.map((d) => (d ? d.split('\n').length : 1)));
  result.rowHeights[detailRow] = Math.max(36, maxLines * 15);
}

function appendSeatBlock(
  result: LayoutExcelResult,
  title: string,
  seats: Seat[],
  view: SeatingView,
  sub: SeatingPlan,
  anchorCol: number,
): void {
  if (seats.length === 0) return;
  appendGappedSeatBlock(result, title, [sortSeatsPhysical(seats)], view, sub, anchorCol, 0);
}

/** 長枱台下：整排橫向匯出（枱與枱之間留走道空格） */
function appendLongTableFloorRow(
  result: LayoutExcelResult,
  rowIndex: number,
  tables: Record<number, Seat[]>,
  view: SeatingView,
  sub: SeatingPlan,
  anchorCol: number,
  gapColumns: number,
): void {
  const segments = getSortedTableSegments(tables);
  if (segments.length === 0) return;

  const startRow = result.aoa.length;
  const seatOneCol = seatOneColumnIndexFromGapped(segments, gapColumns);
  const leftPad = Math.max(0, anchorCol - 1 - seatOneCol);
  const totalSeats = segments.reduce((sum, seg) => sum + seg.length, 0);

  const numbers = buildGappedRowCells(segments, (s) => seatNum(s, sub), '', gapColumns);
  const names = buildGappedRowCells(segments, (s) =>
    guestName(view.guests, view.assignments[s.id]?.guestId ?? null),
  '', gapColumns);
  const details = buildGappedRowCells(segments, (s) =>
    guestDetail(view.guests, view.assignments[s.id]?.guestId ?? null),
  '', gapColumns);

  const assignedCount = names.filter((n) => n.trim()).length;

  result.aoa.push(padExportRow([String(totalSeats), ...numbers], leftPad));
  result.aoa.push(padExportRow([String(assignedCount), ...names], leftPad));
  result.aoa.push(padExportRow(['', ...details], leftPad));
  result.aoa.push(['']);

  const detailRow = startRow + 2;
  const maxLines = Math.max(1, ...details.map((d) => (d ? d.split('\n').length : 1)));
  result.rowHeights[detailRow] = Math.max(36, maxLines * 15);
}

export function buildVisualLayout(
  view: SeatingView,
  sub: SeatingPlan,
  event?: EventFlowEventMeta,
): LayoutExcelResult {
  const grouped = groupSeats(view.seats);
  const result: LayoutExcelResult = {
    aoa: [],
    merges: [],
    colWidths: [],
    rowHeights: {},
  };

  if (event) {
    result.aoa.push(...buildExportHeaderRows(event, sub));
  }

  const useLongRowExport = isLongTable(view);
  const anchorCol = computeExportAnchorColumn(grouped, sub, useLongRowExport);
  const config = sub.venueConfig;

  if (Object.keys(grouped.stageByRow).length > 0) {
    Object.entries(grouped.stageByRow)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([rowKey, seats]) => {
        const row = Number(rowKey);
        const label =
          Object.keys(grouped.stageByRow).length > 1
            ? `（台上嘉賓座位 — 第${row + 1}排）`
            : '（台上嘉賓座位）';
        const segments = buildStageRowSegments(config, row, seats);
        appendGappedSeatBlock(
          result,
          label,
          segments,
          view,
          sub,
          anchorCol,
          getRowAisleGap(config, row, 'stage'),
        );
      });
  }

  if (grouped.main.length > 0) {
    appendSeatBlock(result, '（主枱嘉賓座位）', grouped.main, view, sub, anchorCol);
  }

  if (Object.keys(grouped.floorByRowTable).length > 0) {
    const floorRowCount = Object.keys(grouped.floorByRowTable).length;
    Object.entries(grouped.floorByRowTable)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([rowKey, tables]) => {
        const row = Number(rowKey);
        const gapCols = getRowAisleGap(config, row, 'floor');
        if (useLongRowExport) {
          appendLongTableFloorRow(result, row, tables, view, sub, anchorCol, gapCols);
          return;
        }

        const segments = buildFloorRowSegments(config, row, [], tables);
        const label =
          floorRowCount > 1
            ? `（台下嘉賓座位 — 第${row + 1}排）`
            : '（台下嘉賓座位）';
        appendGappedSeatBlock(result, label, segments, view, sub, anchorCol, gapCols);
      });
  } else if (Object.keys(grouped.floorByRow).length > 0) {
    Object.entries(grouped.floorByRow)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([rowKey, seats]) => {
        const row = Number(rowKey);
        const label =
          Object.keys(grouped.floorByRow).length > 1
            ? `（台下嘉賓座位 — 第${row + 1}排）`
            : '（台下嘉賓座位）';
        const segments = buildFloorRowSegments(config, row, seats);
        appendGappedSeatBlock(
          result,
          label,
          segments,
          view,
          sub,
          anchorCol,
          getRowAisleGap(config, row, 'floor'),
        );
      });
  }

  const vipSeats = sortSeatsPhysical(view.seats.filter((s) => s.zone === 'vip'));
  if (vipSeats.length > 0 && sub.vipLounge?.enabled) {
    appendSeatBlock(result, '（VIP 休息室）', vipSeats, view, sub, anchorCol);
  }

  normalizeLayoutColumns(result);

  // 長枱整排匯出：第一欄為統計數字，略窄
  if (useLongRowExport && result.colWidths.length > 0) {
    result.colWidths[0] = Math.min(result.colWidths[0], 6);
  }

  return result;
}

export function buildLayoutRows(
  view: SeatingView,
  sub: SeatingPlan,
  event?: EventFlowEventMeta,
): string[][] {
  return buildVisualLayout(view, sub, event).aoa;
}
