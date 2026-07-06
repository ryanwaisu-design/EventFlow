export type VenueType = 'banquet' | 'theater' | 'stage';

export type TableShape = 'round' | 'long';

export interface StageSettings {
  hasStage: boolean;
  stageRowCount: number;
  stageSeatsPerRow: number;
  /** 走道寬度預設（台上各排；匯出空格欄 / 平面圖間距） */
  rowAisleGap?: number;
  /** 每段座位數（走道間斷；0 = 不分段） */
  rowSeatsPerSegment?: number;
  /** @deprecated 請用 rowSeatsPerSegment */
  rowSegmentCount?: number;
  stageRowOverrides?: Record<
    number,
    {
      seatsPerRow?: number;
      rowAisleGap?: number;
      rowSeatsPerSegment?: number;
      rowSegmentCount?: number;
      rowAisleBreakAfterIndex?: number[];
    }
  >;
}

export interface BanquetVenueConfig extends StageSettings {
  type: 'banquet';
  /** @deprecated 請用 headTableShape / guestTableShape */
  tableShape?: TableShape;
  headTableShape: TableShape;
  guestTableShape: TableShape;
  /** 主桌座位數（圓桌） */
  mainTableSeats: number;
  floorRowCount: number;
  tablesPerRow: number[];
  /** 枱間走道寬度（單位數；平面圖與匯出空格欄共用，預設 1） */
  tableAisleGap?: number;
  /** 與 tableAisleGap 同義，供通用走道邏輯讀取 */
  rowAisleGap?: number;
  /** 圓桌：每桌座位數 */
  seatsPerTable: number;
  /** 長桌：每側座位數（舊版相容） */
  seatsPerSide: number;
  /** 主桌長桌：上排是否有座位（headLongLeft* 為歷史欄位名） */
  headLongLeftEnabled: boolean;
  /** 主桌長桌：下排是否有座位（headLongRight* 為歷史欄位名） */
  headLongRightEnabled: boolean;
  headLongLeftSeats: number;
  headLongRightSeats: number;
  /** 主桌長桌：枱面左側是否有座位 */
  headLongSideLeftEnabled: boolean;
  headLongSideLeftSeats: number;
  /** 主桌長桌：枱面右側是否有座位 */
  headLongSideRightEnabled: boolean;
  headLongSideRightSeats: number;
  /** 客桌長桌：上排是否有座位（guestLongLeft* 為歷史欄位名） */
  guestLongLeftEnabled: boolean;
  /** 客桌長桌：下排是否有座位（guestLongRight* 為歷史欄位名） */
  guestLongRightEnabled: boolean;
  guestLongLeftSeats: number;
  guestLongRightSeats: number;
  /** 客桌長桌：枱面左側是否有座位 */
  guestLongSideLeftEnabled: boolean;
  guestLongSideLeftSeats: number;
  /** 客桌長桌：枱面右側是否有座位 */
  guestLongSideRightEnabled: boolean;
  guestLongSideRightSeats: number;
  rowOverrides?: Record<
    number,
    {
      tablesPerRow?: number;
      seatsPerTable?: number;
      seatsPerSide?: number;
      tableAisleGap?: number;
      rowAisleGap?: number;
    }
  >;
  /** 單桌座位覆寫，key 為 `main` 或 `floor-r{row}-t{table}` */
  tableOverrides?: Record<
    string,
    {
      seatsPerTable?: number;
      longTopSeats?: number;
      longBottomSeats?: number;
      longSideLeftSeats?: number;
      longSideRightSeats?: number;
    }
  >;
}

export interface TheaterVenueConfig extends StageSettings {
  type: 'theater';
  rowCount: number;
  seatsPerRow: number;
  rowOverrides?: Record<
    number,
    {
      seatsPerRow?: number;
      rowAisleGap?: number;
      rowSeatsPerSegment?: number;
      rowSegmentCount?: number;
      rowAisleBreakAfterIndex?: number[];
    }
  >;
}

export interface StageVenueConfig {
  type: 'stage';
  stageRowCount: number;
  stageSeatsPerRow: number;
  rowAisleGap?: number;
  rowSeatsPerSegment?: number;
  /** @deprecated 請用 rowSeatsPerSegment */
  rowSegmentCount?: number;
  rowAisleBreakAfterIndex?: number[];
  stageRowOverrides?: Record<
    number,
    {
      seatsPerRow?: number;
      rowAisleGap?: number;
      rowSeatsPerSegment?: number;
      rowSegmentCount?: number;
      rowAisleBreakAfterIndex?: number[];
    }
  >;
}

export type VenueConfig = BanquetVenueConfig | TheaterVenueConfig | StageVenueConfig;

export interface Guest {
  id: string;
  name: string;
  organization: string;
  title: string;
  rank: number;
}

/** 嘉賓在單一子活動內的排位狀態 */
export interface GuestParticipation {
  guestId: string;
  audienceSeat: string | null;
  stageSeat: string | null;
  vipSeat: string | null;
  floorSeatCount: number;
  stageSeatCount: number;
  vipSeatCount: number;
  vipEligible: boolean;
}

export type VipLoungeTableShape = 'coffee' | 'round';

export interface VipLoungeSeatItem {
  id: string;
  kind: 'seat';
  x: number;
  y: number;
  rotation?: number;
  displayNumber?: number;
}

export interface VipLoungeTableItem {
  id: string;
  kind: 'table';
  x: number;
  y: number;
  shape: VipLoungeTableShape;
  width?: number;
  height?: number;
  label?: string;
}

/** 裝飾用椅子（不可排嘉賓） */
export interface VipLoungeChairItem {
  id: string;
  kind: 'chair';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
}

export type VipLoungeItem = VipLoungeSeatItem | VipLoungeTableItem | VipLoungeChairItem;

export interface VipLoungeConfig {
  enabled: boolean;
  items: VipLoungeItem[];
}

export interface SubEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  venueType: VenueType;
  venueConfig: VenueConfig;
  seats: Seat[];
  assignments: Record<string, SeatAssignment>;
  showTooltip: boolean;
  customTableNumbers?: Record<string, string | number>;
  vipLounge?: VipLoungeConfig;
  /** 手動勾選出席此子活動的嘉賓 ID */
  participantGuestIds: string[];
  participations: Record<string, GuestParticipation>;
  step: EventStep;
}

export interface Seat {
  id: string;
  label: string;
  zone: 'main' | 'floor' | 'stage' | 'vip';
  row?: number;
  table?: number;
  side?: 0 | 1 | 2 | 3;
  index: number;
  displayNumber: number;
  customNumber?: string | number;
  /** VIP 休息室自由定位 */
  x?: number;
  y?: number;
  rotation?: number;
}

export interface SeatAssignment {
  seatId: string;
  guestId: string | null;
  locked: boolean;
}

export type EventStep = 'setup' | 'dashboard';

/** EventFlow：1 event = 1 排位方案，可含多個子活動 */
export interface SeatingPlan {
  id: string;
  eventId: string;
  subEvents: SubEvent[];
  currentSubEventId: string | null;
  /** 當前子活動欄位（與作用中 subEvent 同步，供排位引擎使用） */
  name: string;
  date: string;
  time: string;
  location: string;
  venueType: VenueType;
  venueConfig: VenueConfig;
  seats: Seat[];
  assignments: Record<string, SeatAssignment>;
  showTooltip: boolean;
  customTableNumbers?: Record<string, string | number>;
  participantGuestIds: string[];
  participations: Record<string, GuestParticipation>;
  step: EventStep;
  vipLounge?: VipLoungeConfig;
  savedSnapshot?: string;
  createdAt: string;
  updatedAt: string;
}

export function defaultParticipation(guestId: string): GuestParticipation {
  return {
    guestId,
    audienceSeat: null,
    stageSeat: null,
    vipSeat: null,
    floorSeatCount: 1,
    stageSeatCount: 1,
    vipSeatCount: 1,
    vipEligible: false,
  };
}

export interface EventProject {
  id: string;
  /** 活動系列名稱 */
  name: string;
  date: string;
  location: string;
  /** 全活動共用嘉賓主檔 */
  guests: Guest[];
  subEvents: SubEvent[];
  currentSubEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 舊版 flat 結構欄位（遷移用） */
export interface LegacyEventFields {
  venueType?: VenueType;
  venueConfig?: VenueConfig;
  seats?: Seat[];
  assignments?: Record<string, SeatAssignment>;
  showTooltip?: boolean;
  step?: EventStep;
  customTableNumbers?: Record<string, string | number>;
}

export type DuplicateResolveAction =
  | 'skip'
  | 'importAll'
  | 'importOne'
  | 'overwrite'
  | 'keepBoth';

export interface DuplicateGuestConflict {
  name: string;
  imports: Array<{
    name: string;
    organization: string;
    title: string;
    floorSeatCount?: number;
    stageSeatCount?: number;
    subEventNames?: string[];
  }>;
  existing?: Guest;
  resolve?: DuplicateResolveAction;
  selectedImportIndex?: number;
}

export interface AttendanceChangeEntry {
  name: string;
  subEventNames: string[];
}

export interface AttendanceUpdateResult {
  updated: number;
  unchanged: number;
  notFound: string[];
  startedAttending: AttendanceChangeEntry[];
  stoppedAttending: AttendanceChangeEntry[];
}

export function normalizeParticipation(p: GuestParticipation): GuestParticipation {
  return {
    ...p,
    audienceSeat: p.audienceSeat ?? null,
    stageSeat: p.stageSeat ?? null,
    vipSeat: p.vipSeat ?? null,
    floorSeatCount: Math.max(1, p.floorSeatCount ?? 1),
    stageSeatCount: p.stageSeatCount ?? 1,
    vipSeatCount: Math.max(0, p.vipSeatCount ?? 1),
    vipEligible: Boolean(p.vipEligible),
  };
}

/** @deprecated 使用 normalizeParticipation */
export function normalizeGuest(g: Guest & Partial<GuestParticipation>): Guest {
  return {
    id: g.id,
    name: g.name,
    organization: g.organization,
    title: g.title,
    rank: g.rank,
  };
}

export function normalizeBanquetConfig(config: BanquetVenueConfig): BanquetVenueConfig {
  const shape = config.tableShape ?? config.headTableShape ?? config.guestTableShape ?? 'round';
  return {
    ...config,
    headTableShape: config.headTableShape ?? shape,
    guestTableShape: config.guestTableShape ?? shape,
    headLongLeftEnabled: config.headLongLeftEnabled ?? true,
    headLongRightEnabled: config.headLongRightEnabled ?? true,
    headLongLeftSeats: config.headLongLeftSeats ?? config.seatsPerSide ?? 5,
    headLongRightSeats: config.headLongRightSeats ?? config.seatsPerSide ?? 5,
    headLongSideLeftEnabled: config.headLongSideLeftEnabled ?? false,
    headLongSideLeftSeats: config.headLongSideLeftSeats ?? 3,
    headLongSideRightEnabled: config.headLongSideRightEnabled ?? false,
    headLongSideRightSeats: config.headLongSideRightSeats ?? 3,
    guestLongLeftEnabled: config.guestLongLeftEnabled ?? true,
    guestLongRightEnabled: config.guestLongRightEnabled ?? true,
    guestLongLeftSeats: config.guestLongLeftSeats ?? config.seatsPerSide ?? 5,
    guestLongRightSeats: config.guestLongRightSeats ?? config.seatsPerSide ?? 5,
    guestLongSideLeftEnabled: config.guestLongSideLeftEnabled ?? false,
    guestLongSideLeftSeats: config.guestLongSideLeftSeats ?? 3,
    guestLongSideRightEnabled: config.guestLongSideRightEnabled ?? false,
    guestLongSideRightSeats: config.guestLongSideRightSeats ?? 3,
    tableAisleGap: Math.max(0, Math.min(5, Math.floor(Number(config.tableAisleGap ?? config.rowAisleGap ?? 1)) || 0)),
    rowAisleGap: Math.max(0, Math.min(5, Math.floor(Number(config.rowAisleGap ?? config.tableAisleGap ?? 1)) || 0)),
  };
}

export function defaultVenueConfig(type: VenueType): VenueConfig {
  switch (type) {
    case 'banquet':
      return normalizeBanquetConfig({
        type: 'banquet',
        headTableShape: 'round',
        guestTableShape: 'round',
        mainTableSeats: 20,
        floorRowCount: 3,
        tablesPerRow: [3, 4, 3],
        tableAisleGap: 1,
        rowAisleGap: 1,
        rowSeatsPerSegment: 0,
        seatsPerTable: 12,
        seatsPerSide: 5,
        headLongLeftEnabled: true,
        headLongRightEnabled: true,
        headLongLeftSeats: 5,
        headLongRightSeats: 5,
        headLongSideLeftEnabled: false,
        headLongSideLeftSeats: 3,
        headLongSideRightEnabled: false,
        headLongSideRightSeats: 3,
        guestLongLeftEnabled: true,
        guestLongRightEnabled: true,
        guestLongLeftSeats: 5,
        guestLongRightSeats: 5,
        guestLongSideLeftEnabled: false,
        guestLongSideLeftSeats: 3,
        guestLongSideRightEnabled: false,
        guestLongSideRightSeats: 3,
        hasStage: false,
        stageRowCount: 1,
        stageSeatsPerRow: 8,
      });
    case 'theater':
      return {
        type: 'theater',
        rowCount: 5,
        seatsPerRow: 12,
        rowAisleGap: 1,
        rowSeatsPerSegment: 0,
        hasStage: false,
        stageRowCount: 1,
        stageSeatsPerRow: 8,
      };
    case 'stage':
      return {
        type: 'stage',
        stageRowCount: 1,
        stageSeatsPerRow: 8,
        rowAisleGap: 1,
        rowSeatsPerSegment: 0,
      };
  }
}

export function migrateVenueConfig(config: unknown, venueType?: string): VenueConfig {
  const c = config as Record<string, unknown>;
  const type = String(c.type ?? venueType ?? 'banquet');

  if (type === 'round' || type === 'banquet') {
    const rows = Number(c.rowsPerSection ?? c.floorRowCount ?? 3);
    const defaultTables = Number(c.tablesPerRow ?? 5);
    const tablesPerRow: number[] = Array.from({ length: rows }, (_, i) => {
      const overrides = c.rowOverrides as Record<number, { tablesPerRow?: number }> | undefined;
      if (Array.isArray(c.tablesPerRow)) return Number((c.tablesPerRow as number[])[i] ?? defaultTables);
      return overrides?.[i]?.tablesPerRow ?? defaultTables;
    });
    return normalizeBanquetConfig({
      type: 'banquet',
      tableShape: (c.tableShape as TableShape) ?? 'round',
      headTableShape: (c.headTableShape as TableShape) ?? (c.tableShape as TableShape) ?? 'round',
      guestTableShape: (c.guestTableShape as TableShape) ?? (c.tableShape as TableShape) ?? 'round',
      mainTableSeats: Number(c.mainTableSeats ?? 10),
      floorRowCount: rows,
      tablesPerRow,
      tableAisleGap: Number(c.tableAisleGap ?? 1),
      rowAisleGap: Number(c.rowAisleGap ?? c.tableAisleGap ?? 1),
      rowSeatsPerSegment: Number(c.rowSeatsPerSegment ?? 0),
      seatsPerTable: Number(c.seatsPerTable ?? 10),
      seatsPerSide: Number(c.seatsPerSide ?? 5),
      headLongLeftEnabled: c.headLongLeftEnabled !== false,
      headLongRightEnabled: c.headLongRightEnabled !== false,
      headLongLeftSeats: Number(c.headLongLeftSeats ?? c.seatsPerSide ?? 5),
      headLongRightSeats: Number(c.headLongRightSeats ?? c.seatsPerSide ?? 5),
      headLongSideLeftEnabled: c.headLongSideLeftEnabled === true,
      headLongSideLeftSeats: Number(c.headLongSideLeftSeats ?? 3),
      headLongSideRightEnabled: c.headLongSideRightEnabled === true,
      headLongSideRightSeats: Number(c.headLongSideRightSeats ?? 3),
      guestLongLeftEnabled: c.guestLongLeftEnabled !== false,
      guestLongRightEnabled: c.guestLongRightEnabled !== false,
      guestLongLeftSeats: Number(c.guestLongLeftSeats ?? c.seatsPerSide ?? 5),
      guestLongRightSeats: Number(c.guestLongRightSeats ?? c.seatsPerSide ?? 5),
      guestLongSideLeftEnabled: c.guestLongSideLeftEnabled === true,
      guestLongSideLeftSeats: Number(c.guestLongSideLeftSeats ?? 3),
      guestLongSideRightEnabled: c.guestLongSideRightEnabled === true,
      guestLongSideRightSeats: Number(c.guestLongSideRightSeats ?? 3),
      hasStage: Boolean(c.hasStage ?? false),
      stageRowCount: Number(c.stageRowCount ?? 1),
      stageSeatsPerRow: Number(c.stageSeatsPerRow ?? 8),
      stageRowOverrides: c.stageRowOverrides as BanquetVenueConfig['stageRowOverrides'],
      rowOverrides: c.rowOverrides as BanquetVenueConfig['rowOverrides'],
    });
  }

  if (type === 'theater') {
    return {
      type: 'theater',
      rowCount: Number(c.rowCount ?? 5),
      seatsPerRow: Number(c.seatsPerRow ?? 12),
      rowAisleGap: Number(c.rowAisleGap ?? 1),
      rowSeatsPerSegment: Number(c.rowSeatsPerSegment ?? 0),
      rowOverrides: c.rowOverrides as TheaterVenueConfig['rowOverrides'],
      hasStage: Boolean(c.hasStage ?? false),
      stageRowCount: Number(c.stageRowCount ?? 1),
      stageSeatsPerRow: Number(c.stageSeatsPerRow ?? 8),
      stageRowOverrides: c.stageRowOverrides as TheaterVenueConfig['stageRowOverrides'],
    };
  }

  return {
    type: 'stage',
    stageRowCount: Number(c.stageRowCount ?? 1),
    stageSeatsPerRow: Number(c.stageSeatsPerRow ?? c.stageSeats ?? 8),
    rowAisleGap: Number(c.rowAisleGap ?? 1),
    rowSeatsPerSegment: Number(c.rowSeatsPerSegment ?? 0),
    stageRowOverrides: c.stageRowOverrides as StageVenueConfig['stageRowOverrides'],
  };
}

export function normalizeBanquetTables(config: BanquetVenueConfig): BanquetVenueConfig {
  const count = Math.max(0, config.floorRowCount);
  const tablesPerRow = [...config.tablesPerRow];
  while (tablesPerRow.length < count) {
    tablesPerRow.push(tablesPerRow[tablesPerRow.length - 1] ?? 4);
  }
  while (tablesPerRow.length > count) tablesPerRow.pop();
  return { ...config, floorRowCount: count, tablesPerRow };
}
