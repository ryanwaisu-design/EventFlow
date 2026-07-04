import type {
  BanquetVenueConfig,
  Seat,
  SeatAssignment,
  StageSettings,
  StageVenueConfig,
  TheaterVenueConfig,
  VenueConfig,
} from '../types';
import { normalizeBanquetConfig } from '../types';
import { floorTableKey, MAIN_TABLE_KEY, parseFloorTableKey } from './tableNumber';
import {
  getAudienceProtocolSequence,
  getLongTableBottomSequence,
  getLongTableTopSequence,
  getStageProtocolSequence,
  roundTableClockwiseOrder,
} from './rankOrder';

function createAssignment(seatId: string): SeatAssignment {
  return { seatId, guestId: null, locked: false };
}

function buildStageSeatsFromSettings(
  settings: StageSettings | StageVenueConfig,
): Seat[] {
  const seats: Seat[] = [];

  const rowCount =
    'hasStage' in settings
      ? settings.hasStage
        ? settings.stageRowCount
        : 0
      : settings.stageRowCount;

  if (rowCount <= 0) return seats;

  const defaultPerRow = settings.stageSeatsPerRow;
  const overrides = settings.stageRowOverrides;

  for (let row = 0; row < rowCount; row++) {
    const seatsPerRow = overrides?.[row]?.seatsPerRow ?? defaultPerRow;
    const protocol = getStageProtocolSequence(seatsPerRow);
    protocol.forEach((displayNum, i) => {
      seats.push({
        id: `stage-r${row}-s${i}`,
        label: `台上 第${row + 1}排 座${displayNum}`,
        zone: 'stage',
        row,
        index: i,
        displayNumber: displayNum,
      });
    });
  }

  return seats;
}

interface LongTableSides {
  topEnabled: boolean;
  bottomEnabled: boolean;
  topSeats: number;
  bottomSeats: number;
  sideLeftEnabled: boolean;
  sideRightEnabled: boolean;
  sideLeftSeats: number;
  sideRightSeats: number;
}

function addLongTableSeats(
  seats: Seat[],
  opts: {
    zone: 'main' | 'floor';
    row: number;
    table: number;
    labelPrefix: string;
    sides: LongTableSides;
  },
): void {
  const { zone, row, table, labelPrefix, sides } = opts;

  // side 0 = 上排（枱面上方），禮賓序 A1 在中間
  if (sides.topEnabled && sides.topSeats > 0) {
    const protocol = getLongTableTopSequence(sides.topSeats);
    protocol.forEach((displayNum, physicalIdx) => {
      seats.push({
        id: `${zone}-r${row}-t${table}-top-s${physicalIdx}`,
        label: `${labelPrefix} A${displayNum}`,
        zone,
        row,
        table,
        side: 0,
        index: physicalIdx,
        displayNumber: displayNum,
      });
    });
  }

  // side 1 = 下排（枱面下方），禮賓序 B1 在中間
  if (sides.bottomEnabled && sides.bottomSeats > 0) {
    const protocol = getLongTableBottomSequence(sides.bottomSeats);
    protocol.forEach((displayNum, physicalIdx) => {
      seats.push({
        id: `${zone}-r${row}-t${table}-bottom-s${physicalIdx}`,
        label: `${labelPrefix} B${displayNum}`,
        zone,
        row,
        table,
        side: 1,
        index: physicalIdx,
        displayNumber: displayNum,
      });
    });
  }

  // side 2 = 左側（枱面左邊），禮賓序 C1 在中間
  if (sides.sideLeftEnabled && sides.sideLeftSeats > 0) {
    const protocol = getLongTableTopSequence(sides.sideLeftSeats);
    protocol.forEach((displayNum, physicalIdx) => {
      seats.push({
        id: `${zone}-r${row}-t${table}-left-s${physicalIdx}`,
        label: `${labelPrefix} C${displayNum}`,
        zone,
        row,
        table,
        side: 2,
        index: physicalIdx,
        displayNumber: displayNum,
      });
    });
  }

  // side 3 = 右側（枱面右邊），禮賓序 D1 在中間
  if (sides.sideRightEnabled && sides.sideRightSeats > 0) {
    const protocol = getLongTableBottomSequence(sides.sideRightSeats);
    protocol.forEach((displayNum, physicalIdx) => {
      seats.push({
        id: `${zone}-r${row}-t${table}-right-s${physicalIdx}`,
        label: `${labelPrefix} D${displayNum}`,
        zone,
        row,
        table,
        side: 3,
        index: physicalIdx,
        displayNumber: displayNum,
      });
    });
  }
}

function addTableSeats(
  seats: Seat[],
  opts: {
    zone: 'main' | 'floor';
    row: number;
    table: number;
    tableShape: 'round' | 'long';
    seatsPerTable: number;
    longSides: LongTableSides;
    labelPrefix: string;
  },
): void {
  const { zone, row, table, tableShape, seatsPerTable, longSides, labelPrefix } = opts;

  if (tableShape === 'long') {
    addLongTableSeats(seats, { zone, row, table, labelPrefix, sides: longSides });
    return;
  }

  const order = roundTableClockwiseOrder(seatsPerTable);
  order.forEach((idx, i) => {
    const seatNum = i + 1;
    seats.push({
      id: `${zone}-r${row}-t${table}-s${idx}`,
      label: `${labelPrefix} 座${seatNum}`,
      zone,
      row,
      table,
      index: idx,
      displayNumber: seatNum,
    });
  });
}

function resolveLongSides(
  config: BanquetVenueConfig,
  tableKey: string,
  isHead: boolean,
): LongTableSides {
  const override = config.tableOverrides?.[tableKey];
  const parsed = tableKey === MAIN_TABLE_KEY ? null : parseFloorTableKey(tableKey);
  const rowOverride = parsed ? config.rowOverrides?.[parsed.row] : undefined;
  const rowSideDefault = rowOverride?.seatsPerSide ?? config.seatsPerSide;
  if (isHead) {
    return {
      topEnabled: config.headLongLeftEnabled,
      bottomEnabled: config.headLongRightEnabled,
      topSeats: override?.longTopSeats ?? config.headLongLeftSeats,
      bottomSeats: override?.longBottomSeats ?? config.headLongRightSeats,
      sideLeftEnabled: config.headLongSideLeftEnabled,
      sideRightEnabled: config.headLongSideRightEnabled,
      sideLeftSeats: override?.longSideLeftSeats ?? config.headLongSideLeftSeats,
      sideRightSeats: override?.longSideRightSeats ?? config.headLongSideRightSeats,
    };
  }
  return {
    topEnabled: config.guestLongLeftEnabled,
    bottomEnabled: config.guestLongRightEnabled,
    topSeats: override?.longTopSeats ?? rowSideDefault,
    bottomSeats: override?.longBottomSeats ?? rowSideDefault,
    sideLeftEnabled: config.guestLongSideLeftEnabled,
    sideRightEnabled: config.guestLongSideRightEnabled,
    sideLeftSeats: override?.longSideLeftSeats ?? config.guestLongSideLeftSeats,
    sideRightSeats: override?.longSideRightSeats ?? config.guestLongSideRightSeats,
  };
}

function buildBanquetSeats(raw: BanquetVenueConfig): Seat[] {
  const config = normalizeBanquetConfig(raw);
  const seats: Seat[] = [];

  if (config.mainTableSeats > 0 || config.headTableShape === 'long') {
    if (config.headTableShape === 'long') {
      addLongTableSeats(seats, {
        zone: 'main',
        row: 0,
        table: 0,
        labelPrefix: '主桌',
        sides: resolveLongSides(config, MAIN_TABLE_KEY, true),
      });
    } else {
      const mainSeats =
        config.tableOverrides?.[MAIN_TABLE_KEY]?.seatsPerTable ?? config.mainTableSeats;
      const order = roundTableClockwiseOrder(mainSeats);
      order.forEach((idx, i) => {
        const seatNum = i + 1;
        seats.push({
          id: `main-s${idx}`,
          label: `主桌 ${seatNum}`,
          zone: 'main',
          row: 0,
          table: 0,
          index: idx,
          displayNumber: seatNum,
        });
      });
    }
  }

  for (let row = 0; row < config.floorRowCount; row++) {
    const rowOverride = config.rowOverrides?.[row];
    const tablesInRow = rowOverride?.tablesPerRow ?? config.tablesPerRow[row] ?? 4;
    const defaultSeatsPerTable = rowOverride?.seatsPerTable ?? config.seatsPerTable;

    for (let table = 0; table < tablesInRow; table++) {
      const tableKey = floorTableKey(row, table);
      const tableOverride = config.tableOverrides?.[tableKey];
      const seatsPerTable = tableOverride?.seatsPerTable ?? defaultSeatsPerTable;

      addTableSeats(seats, {
        zone: 'floor',
        row,
        table,
        tableShape: config.guestTableShape,
        seatsPerTable,
        longSides: resolveLongSides(config, tableKey, false),
        labelPrefix: `第${row + 1}排 桌${table + 1}`,
      });
    }
  }

  if (config.hasStage) {
    seats.push(...buildStageSeatsFromSettings(config));
  }

  return seats;
}

function buildTheaterSeats(config: TheaterVenueConfig): Seat[] {
  const seats: Seat[] = [];

  for (let row = 0; row < config.rowCount; row++) {
    const seatsPerRow = config.rowOverrides?.[row]?.seatsPerRow ?? config.seatsPerRow;
    const protocol = getAudienceProtocolSequence(seatsPerRow);
    protocol.forEach((displayNum, i) => {
      seats.push({
        id: `floor-r${row}-s${i}`,
        label: `第${row + 1}排 座${displayNum}`,
        zone: 'floor',
        row,
        index: i,
        displayNumber: displayNum,
      });
    });
  }

  if (config.hasStage) {
    seats.push(...buildStageSeatsFromSettings(config));
  }

  return seats;
}

export function generateSeats(config: VenueConfig): Seat[] {
  switch (config.type) {
    case 'banquet':
      return buildBanquetSeats(config);
    case 'theater':
      return buildTheaterSeats(config);
    case 'stage':
      return buildStageSeatsFromSettings(config);
    default:
      return [];
  }
}

export function generateAssignments(seats: Seat[]): Record<string, SeatAssignment> {
  const assignments: Record<string, SeatAssignment> = {};
  seats.forEach((seat) => {
    assignments[seat.id] = createAssignment(seat.id);
  });
  return assignments;
}

export function mergeAssignments(
  seats: Seat[],
  existing: Record<string, SeatAssignment>,
): Record<string, SeatAssignment> {
  const next: Record<string, SeatAssignment> = {};
  seats.forEach((seat) => {
    next[seat.id] = existing[seat.id] ?? createAssignment(seat.id);
  });
  return next;
}
