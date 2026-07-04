import { create } from 'zustand';
import type {
  BanquetVenueConfig,
  EventStep,
  Guest,
  GuestParticipation,
  SeatingPlan,
  Seat,
  SubEvent,
  VenueConfig,
  VenueType,
} from '../types';
import {
  addGuestToSubEvents,
  copySubEventVenueConfig,
  createSubEvent,
  flattenToSub,
  getCurrentSubFromPlan,
  migratePlanToSubEvents,
  pickSubFields,
  reorderSubEvents,
  setGuestSubEventAttendeeCount,
  setSubEventParticipationBulk,
  sortSubEventsBySchedule,
  syncFlatToSubEvents,
} from '../adapters/planSubEvent';
import { defaultVenueConfig } from '../types';
import {
  getAisleBreakAfterIndexBetweenSeats,
  getRowAisleGap,
  getRowSeatsPerSegment,
  isSeatEligibleForAisleBreak,
  ROW_AISLE_GAP_MAX,
  ROW_SEATS_PER_SEGMENT_MAX,
  setRowAisleGapOnConfig,
  setRowSeatsPerSegmentOnConfig,
  toggleRowAisleBreakOnConfig,
} from '../utils/rowAisle';
import { canAssignGuestToSeat } from '../utils/guestSeats';
import { MAIN_TABLE_KEY, parseFloorTableKey } from '../utils/tableNumber';
import {
  applyPlanAssignments,
  applyPlanVenueConfig,
  prepareConfig,
  regeneratePlanSeats,
  setVenueTypeOnPlan,
  syncParticipationSeatRefs,
  updateVenueConfigOnPlan,
} from '../utils/planUtils';

function now(): string {
  return new Date().toISOString();
}

function touch(plan: SeatingPlan): SeatingPlan {
  return syncFlatToSubEvents({ ...plan, updatedAt: now() });
}

export type LongTableAdjustSide = 'top' | 'bottom' | 'sideLeft' | 'sideRight';

type LongOverrideField =
  | 'longTopSeats'
  | 'longBottomSeats'
  | 'longSideLeftSeats'
  | 'longSideRightSeats';

function longTableSideMeta(
  config: BanquetVenueConfig,
  tableKey: string,
  side: LongTableAdjustSide,
): { enabled: boolean; defaultSeats: number; field: LongOverrideField } | null {
  const isHead = tableKey === MAIN_TABLE_KEY;
  if (isHead && config.headTableShape !== 'long') return null;
  if (!isHead && config.guestTableShape !== 'long') return null;

  if (isHead) {
    switch (side) {
      case 'top':
        return {
          enabled: config.headLongLeftEnabled,
          defaultSeats: config.headLongLeftSeats,
          field: 'longTopSeats',
        };
      case 'bottom':
        return {
          enabled: config.headLongRightEnabled,
          defaultSeats: config.headLongRightSeats,
          field: 'longBottomSeats',
        };
      case 'sideLeft':
        return {
          enabled: config.headLongSideLeftEnabled,
          defaultSeats: config.headLongSideLeftSeats,
          field: 'longSideLeftSeats',
        };
      case 'sideRight':
        return {
          enabled: config.headLongSideRightEnabled,
          defaultSeats: config.headLongSideRightSeats,
          field: 'longSideRightSeats',
        };
    }
  }

  switch (side) {
    case 'top':
      return {
        enabled: config.guestLongLeftEnabled,
        defaultSeats: config.guestLongLeftSeats,
        field: 'longTopSeats',
      };
    case 'bottom':
      return {
        enabled: config.guestLongRightEnabled,
        defaultSeats: config.guestLongRightSeats,
        field: 'longBottomSeats',
      };
    case 'sideLeft':
      return {
        enabled: config.guestLongSideLeftEnabled,
        defaultSeats: config.guestLongSideLeftSeats,
        field: 'longSideLeftSeats',
      };
    case 'sideRight':
      return {
        enabled: config.guestLongSideRightEnabled,
        defaultSeats: config.guestLongSideRightSeats,
        field: 'longSideRightSeats',
      };
  }
}

function snapshotPlan(plan: SeatingPlan): string {
  return JSON.stringify({
    venueType: plan.venueType,
    venueConfig: plan.venueConfig,
    seats: plan.seats,
    assignments: plan.assignments,
    customTableNumbers: plan.customTableNumbers,
    participations: plan.participations,
    participantGuestIds: plan.participantGuestIds,
    showTooltip: plan.showTooltip,
    step: plan.step,
  });
}

interface SeatingWorkspaceStore {
  plan: SeatingPlan | null;
  guests: Guest[];
  savedSnapshot: string;

  hydrate: (plan: SeatingPlan, guests: Guest[]) => void;
  getPlan: () => SeatingPlan | null;
  replacePlan: (plan: SeatingPlan) => void;

  setStep: (step: EventStep) => void;
  setVenueType: (type: VenueType) => void;
  updateVenueConfig: (config: VenueConfig) => void;
  regenerateSeats: (force?: boolean) => boolean;

  setGuestFloorSeatCount: (guestId: string, floorSeatCount: number) => void;
  updateParticipation: (guestId: string, updates: Partial<Omit<GuestParticipation, 'guestId'>>) => void;

  assignGuest: (seatId: string, guestId: string | null) => boolean;
  swapSeats: (fromSeatId: string, toSeatId: string) => boolean;
  toggleLock: (seatId: string) => void;
  setCustomNumber: (seatId: string, value: string | undefined, swapWithId?: string) => void;
  setCustomTableNumber: (tableKey: string, value: string | undefined, swapWithKey?: string) => void;
  resetAssignments: () => void;
  setShowTooltip: (show: boolean) => void;

  saveSnapshot: () => void;
  revertToSaved: () => void;
  hasUnsavedChanges: () => boolean;

  adjustRowSeats: (row: number, delta: number) => void;
  adjustFloorRowSeats: (row: number, delta: number) => void;
  adjustRowTableAisleGap: (row: number, delta: number) => void;
  adjustRowAisleGap: (row: number, delta: number, zone: 'floor' | 'stage') => void;
  adjustRowSeatsPerSegment: (row: number, delta: number, zone: 'floor' | 'stage') => void;
  toggleRowAisleBreak: (seatIdA: string, seatIdB: string) => 'added' | 'removed' | 'invalid';
  adjustTableSeats: (tableKey: string, delta: number, side?: LongTableAdjustSide) => void;
  adjustStageSeats: (row: number, delta: number) => void;

  setCurrentSubEvent: (subEventId: string) => void;
  addSubEvent: (partial?: { name?: string; date?: string; time?: string; location?: string }) => void;
  updateSubEventMeta: (updates: { name?: string; date?: string; time?: string; location?: string }) => void;
  deleteSubEvent: (subEventId: string) => boolean;
  reorderSubEvent: (index: number, direction: 'up' | 'down') => void;
  sortSubEventsBySchedule: () => void;
  copySubEventVenue: (fromSubEventId: string) => boolean;
  setGuestSubEvents: (guestId: string, subEventIds: string[]) => void;
  setGuestSubEventAttendeeCount: (guestId: string, subEventId: string, count: number) => void;
  toggleSubEventForAllGuests: (subEventId: string, participate: boolean) => void;
}

export const useSeatingWorkspaceStore = create<SeatingWorkspaceStore>((set, get) => ({
  plan: null,
  guests: [],
  savedSnapshot: '',

  hydrate: (plan, guests) => {
    const normalized = syncFlatToSubEvents(migratePlanToSubEvents(plan));
    set({
      plan: normalized,
      guests,
      savedSnapshot: normalized?.savedSnapshot || snapshotPlan(normalized),
    });
  },

  getPlan: () => get().plan,

  replacePlan: (plan) => set({ plan: touch(plan) }),

  setStep: (step) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: touch({ ...plan, step }) });
  },

  setVenueType: (type) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: touch(setVenueTypeOnPlan(plan, type, defaultVenueConfig)) });
  },

  updateVenueConfig: (config) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: touch(updateVenueConfigOnPlan(plan, config)) });
  },

  regenerateSeats: (force) => {
    const plan = get().plan;
    if (!plan) return false;
    const next = regeneratePlanSeats(plan, !!force);
    if (!next) return false;
    set({ plan: touch(next) });
    return true;
  },

  setGuestFloorSeatCount: (guestId, floorSeatCount) => {
    const plan = get().plan;
    if (!plan) return;
    const count = Math.max(1, Math.floor(floorSeatCount) || 1);
    const prev = plan.participations[guestId];
    if (!prev) return;
    set({
      plan: touch({
        ...plan,
        participations: {
          ...plan.participations,
          [guestId]: { ...prev, floorSeatCount: count },
        },
      }),
    });
  },

  updateParticipation: (guestId, updates) => {
    const plan = get().plan;
    if (!plan) return;
    const prev = plan.participations[guestId];
    if (!prev) return;
    set({
      plan: touch({
        ...plan,
        participations: {
          ...plan.participations,
          [guestId]: { ...prev, ...updates, guestId },
        },
      }),
    });
  },

  assignGuest: (seatId, guestId) => {
    const { plan, guests } = get();
    if (!plan) return false;
    const assignment = plan.assignments[seatId];
    if (!assignment || assignment.locked) return false;

    const ctx = {
      guests,
      seats: plan.seats,
      assignments: plan.assignments,
      participations: plan.participations,
      participantGuestIds: plan.participantGuestIds,
    };
    if (!canAssignGuestToSeat(ctx, seatId, guestId)) return false;

    set({
      plan: touch(
        applyPlanAssignments(plan, (assignments) => ({
          ...assignments,
          [seatId]: { ...assignment, guestId },
        })),
      ),
    });
    return true;
  },

  swapSeats: (fromSeatId, toSeatId) => {
    const plan = get().plan;
    if (!plan) return false;
    const from = plan.assignments[fromSeatId];
    const to = plan.assignments[toSeatId];
    if (!from || !to || from.locked || to.locked) return false;

    const fromSeat = plan.seats.find((s) => s.id === fromSeatId);
    const toSeat = plan.seats.find((s) => s.id === toSeatId);
    if (!fromSeat || !toSeat) return false;
    if (fromSeat.zone === 'stage' && toSeat.zone !== 'stage') return false;
    if (fromSeat.zone !== 'stage' && toSeat.zone === 'stage') return false;

    set({
      plan: touch(
        applyPlanAssignments(plan, (assignments) => ({
          ...assignments,
          [fromSeatId]: { ...from, guestId: to.guestId },
          [toSeatId]: { ...to, guestId: from.guestId },
        })),
      ),
    });
    return true;
  },

  toggleLock: (seatId) => {
    const plan = get().plan;
    if (!plan) return;
    const assignment = plan.assignments[seatId];
    if (!assignment) return;
    set({
      plan: touch(
        applyPlanAssignments(plan, (assignments) => ({
          ...assignments,
          [seatId]: { ...assignment, locked: !assignment.locked },
        })),
      ),
    });
  },

  setCustomNumber: (seatId, value, swapWithId) => {
    const plan = get().plan;
    if (!plan) return;
    const parseNum = (v: string | undefined) => {
      if (v === '' || v === undefined) return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    };

    if (swapWithId) {
      const a = plan.seats.find((x) => x.id === seatId);
      const b = plan.seats.find((x) => x.id === swapWithId);
      if (!a || !b) return;
      const effective = (seat: Seat) => seat.customNumber ?? seat.displayNumber;
      const seats = plan.seats.map((seat) => {
        if (seat.id === seatId) return { ...seat, customNumber: effective(b) };
        if (seat.id === swapWithId) return { ...seat, customNumber: effective(a) };
        return seat;
      });
      set({ plan: touch({ ...plan, seats }) });
      return;
    }

    const seats = plan.seats.map((seat) =>
      seat.id === seatId ? { ...seat, customNumber: parseNum(value) } : seat,
    );
    set({ plan: touch({ ...plan, seats }) });
  },

  setCustomTableNumber: (tableKey, value, swapWithKey) => {
    const plan = get().plan;
    if (!plan) return;
    const parseNum = (v: string | undefined) => {
      if (v === '' || v === undefined) return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    };
    const customTableNumbers = { ...(plan.customTableNumbers ?? {}) };

    const effective = (key: string): string | number => {
      if (customTableNumbers[key] !== undefined) return customTableNumbers[key]!;
      const m = /^floor-r(\d+)-t(\d+)$/.exec(key);
      if (!m) return key;
      const row = Number(m[1]);
      const table = Number(m[2]);
      if (plan.venueConfig.type !== 'banquet') return table + 1;
      let offset = 0;
      for (let r = 0; r < row; r++) offset += plan.venueConfig.tablesPerRow[r] ?? 0;
      return offset + table + 1;
    };

    if (swapWithKey) {
      customTableNumbers[tableKey] = effective(swapWithKey);
      customTableNumbers[swapWithKey] = effective(tableKey);
      set({ plan: touch({ ...plan, customTableNumbers }) });
      return;
    }

    if (value === '' || value === undefined) {
      delete customTableNumbers[tableKey];
    } else {
      customTableNumbers[tableKey] = parseNum(value)!;
    }
    set({ plan: touch({ ...plan, customTableNumbers }) });
  },

  resetAssignments: () => {
    const plan = get().plan;
    if (!plan) return;
    const assignments = { ...plan.assignments };
    Object.keys(assignments).forEach((id) => {
      if (!assignments[id].locked) {
        assignments[id] = { ...assignments[id], guestId: null };
      }
    });
    const participations = { ...plan.participations };
    for (const guestId of plan.participantGuestIds) {
      const p = participations[guestId];
      if (!p) continue;
      const lockedAudience = p.audienceSeat && assignments[p.audienceSeat]?.locked;
      const lockedStage = p.stageSeat && assignments[p.stageSeat]?.locked;
      participations[guestId] = {
        ...p,
        audienceSeat: lockedAudience ? p.audienceSeat : null,
        stageSeat: lockedStage ? p.stageSeat : null,
      };
    }
    set({ plan: touch(syncParticipationSeatRefs({ ...plan, assignments, participations })) });
  },

  setShowTooltip: (show) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: touch({ ...plan, showTooltip: show }) });
  },

  saveSnapshot: () => {
    const plan = get().plan;
    if (!plan) return;
    const snap = snapshotPlan(plan);
    set({ plan: touch({ ...plan, savedSnapshot: snap }), savedSnapshot: snap });
  },

  revertToSaved: () => {
    const { plan, savedSnapshot } = get();
    if (!plan || !savedSnapshot) return;
    try {
      const saved = JSON.parse(savedSnapshot) as Partial<SeatingPlan>;
      set({ plan: touch({ ...plan, ...saved }) });
    } catch {
      /* ignore */
    }
  },

  hasUnsavedChanges: () => {
    const { plan, savedSnapshot } = get();
    if (!plan) return false;
    return snapshotPlan(plan) !== savedSnapshot;
  },

  adjustRowSeats: (row, delta) => {
    const plan = get().plan;
    if (!plan) return;
    const config = prepareConfig({ ...plan.venueConfig });

    if (config.type === 'theater') {
      const current = config.rowOverrides?.[row]?.seatsPerRow ?? config.seatsPerRow;
      config.rowOverrides = { ...config.rowOverrides, [row]: { seatsPerRow: Math.max(1, current + delta) } };
    } else if (config.type === 'banquet') {
      const current = config.rowOverrides?.[row]?.tablesPerRow ?? config.tablesPerRow[row] ?? 4;
      const next = Math.max(0, current + delta);
      config.rowOverrides = {
        ...config.rowOverrides,
        [row]: { ...config.rowOverrides?.[row], tablesPerRow: next },
      };
      const tables = [...config.tablesPerRow];
      tables[row] = next;
      config.tablesPerRow = tables;
    }

    get().updateVenueConfig(config);
  },

  adjustFloorRowSeats: (row, delta) => {
    const plan = get().plan;
    if (!plan) return;
    const config = prepareConfig({ ...plan.venueConfig });

    if (config.type === 'theater') {
      const current = config.rowOverrides?.[row]?.seatsPerRow ?? config.seatsPerRow;
      config.rowOverrides = {
        ...config.rowOverrides,
        [row]: { seatsPerRow: Math.max(1, current + delta) },
      };
    } else if (config.type === 'banquet') {
      const banquet = config as BanquetVenueConfig;
      const rowDef = { ...banquet.rowOverrides?.[row] };
      if (banquet.guestTableShape === 'long') {
        const current = rowDef.seatsPerSide ?? banquet.seatsPerSide;
        rowDef.seatsPerSide = Math.max(1, current + delta);
      } else {
        const current = rowDef.seatsPerTable ?? banquet.seatsPerTable;
        rowDef.seatsPerTable = Math.max(1, current + delta);
      }
      banquet.rowOverrides = { ...banquet.rowOverrides, [row]: rowDef };
      get().updateVenueConfig(banquet);
      return;
    } else {
      return;
    }

    get().updateVenueConfig(config);
  },

  adjustRowTableAisleGap: (row, delta) => {
    get().adjustRowAisleGap(row, delta, 'floor');
  },

  adjustRowAisleGap: (row, delta, zone) => {
    const plan = get().plan;
    if (!plan) return;
    const config = prepareConfig({ ...plan.venueConfig });
    const current = getRowAisleGap(config, row, zone);
    const next = Math.max(0, Math.min(ROW_AISLE_GAP_MAX, current + delta));
    setRowAisleGapOnConfig(config, row, zone, next);
    get().updateVenueConfig(config);
  },

  adjustRowSeatsPerSegment: (row, delta, zone) => {
    const plan = get().plan;
    if (!plan) return;
    const config = prepareConfig({ ...plan.venueConfig });
    const current = getRowSeatsPerSegment(config, row, zone);
    const next = Math.max(0, Math.min(ROW_SEATS_PER_SEGMENT_MAX, current + delta));
    setRowSeatsPerSegmentOnConfig(config, row, zone, next);
    get().updateVenueConfig(config);
  },

  toggleRowAisleBreak: (seatIdA, seatIdB) => {
    const plan = get().plan;
    if (!plan) return 'invalid';
    const seatA = plan.seats.find((s) => s.id === seatIdA);
    const seatB = plan.seats.find((s) => s.id === seatIdB);
    if (!seatA || !seatB) return 'invalid';
    if (!isSeatEligibleForAisleBreak(seatA, plan.venueConfig)) return 'invalid';
    if (!isSeatEligibleForAisleBreak(seatB, plan.venueConfig)) return 'invalid';

    const row = seatA.row ?? 0;
    const zone = seatA.zone === 'stage' ? 'stage' : 'floor';
    const rowSeats = plan.seats.filter((s) => s.zone === seatA.zone && (s.row ?? 0) === row);
    const breakAfterIndex = getAisleBreakAfterIndexBetweenSeats(seatA, seatB, rowSeats);
    if (breakAfterIndex === null) return 'invalid';

    const config = prepareConfig({ ...plan.venueConfig });
    const added = toggleRowAisleBreakOnConfig(config, row, zone, breakAfterIndex);
    if (added && getRowAisleGap(config, row, zone) === 0) {
      setRowAisleGapOnConfig(config, row, zone, 1);
    }
    get().updateVenueConfig(config);
    return added ? 'added' : 'removed';
  },

  adjustTableSeats: (tableKey, delta, side) => {
    const plan = get().plan;
    if (!plan || plan.venueConfig.type !== 'banquet') return;
    const config = prepareConfig({ ...plan.venueConfig }) as BanquetVenueConfig;
    const overrides = { ...config.tableOverrides };
    const current = { ...overrides[tableKey] };

    if (tableKey === MAIN_TABLE_KEY) {
      if (config.headTableShape === 'long') {
        if (!side) return;
        const meta = longTableSideMeta(config, tableKey, side);
        if (!meta?.enabled) return;
        current[meta.field] = Math.max(1, (current[meta.field] ?? meta.defaultSeats) + delta);
      } else {
        const seats = current.seatsPerTable ?? config.mainTableSeats;
        current.seatsPerTable = Math.max(1, seats + delta);
      }
    } else if (config.guestTableShape === 'long') {
      if (!side) return;
      const meta = longTableSideMeta(config, tableKey, side);
      if (!meta?.enabled) return;
      current[meta.field] = Math.max(1, (current[meta.field] ?? meta.defaultSeats) + delta);
    } else {
      const parsed = parseFloorTableKey(tableKey);
      const row = parsed?.row ?? 0;
      const rowDef = config.rowOverrides?.[row];
      const seats =
        current.seatsPerTable ?? rowDef?.seatsPerTable ?? config.seatsPerTable;
      current.seatsPerTable = Math.max(1, seats + delta);
    }

    overrides[tableKey] = current;
    config.tableOverrides = overrides;
    get().updateVenueConfig(config);
  },

  adjustStageSeats: (row, delta) => {
    const plan = get().plan;
    if (!plan) return;
    const config = { ...plan.venueConfig };

    if (config.type === 'stage') {
      const current = config.stageRowOverrides?.[row]?.seatsPerRow ?? config.stageSeatsPerRow;
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { seatsPerRow: Math.max(1, current + delta) },
      };
    } else if (
      (config.type === 'banquet' || config.type === 'theater') &&
      config.hasStage
    ) {
      const current = config.stageRowOverrides?.[row]?.seatsPerRow ?? config.stageSeatsPerRow;
      config.stageRowOverrides = {
        ...config.stageRowOverrides,
        [row]: { seatsPerRow: Math.max(1, current + delta) },
      };
    } else {
      return;
    }

    get().updateVenueConfig(config);
  },

  setCurrentSubEvent: (subEventId) => {
    const plan = get().plan;
    if (!plan) return;
    set({ plan: touch(flattenToSub(plan, subEventId)) });
  },

  addSubEvent: (partial = {}) => {
    const plan = get().plan;
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    const sub = createSubEvent(partial);
    const subEvents = [...synced.subEvents, sub];
    set({
      plan: touch({
        ...synced,
        subEvents,
        currentSubEventId: sub.id,
        ...pickSubFields(sub),
      }),
    });
  },

  updateSubEventMeta: (updates) => {
    const plan = get().plan;
    if (!plan) return;
    set({
      plan: touch({
        ...plan,
        name: updates.name ?? plan.name,
        date: updates.date ?? plan.date,
        time: updates.time ?? plan.time,
        location: updates.location ?? plan.location,
      }),
    });
  },

  deleteSubEvent: (subEventId) => {
    const plan = get().plan;
    if (!plan || plan.subEvents.length <= 1) return false;
    const synced = syncFlatToSubEvents(plan);
    const subEvents = synced.subEvents.filter((s: SubEvent) => s.id !== subEventId);
    const nextId =
      synced.currentSubEventId === subEventId
        ? subEvents[0]?.id
        : synced.currentSubEventId;
    set({ plan: touch(flattenToSub({ ...synced, subEvents, currentSubEventId: nextId }, nextId)) });
    return true;
  },

  reorderSubEvent: (index, direction) => {
    const plan = get().plan;
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    set({
      plan: touch({
        ...synced,
        subEvents: reorderSubEvents(synced.subEvents, index, direction),
      }),
    });
  },

  sortSubEventsBySchedule: () => {
    const plan = get().plan;
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    set({
      plan: touch({
        ...synced,
        subEvents: sortSubEventsBySchedule(synced.subEvents),
      }),
    });
  },

  copySubEventVenue: (fromSubEventId) => {
    const plan = get().plan;
    if (!plan) return false;
    const synced = syncFlatToSubEvents(plan);
    const source = synced.subEvents.find((s: SubEvent) => s.id === fromSubEventId);
    const current = getCurrentSubFromPlan(synced);
    if (!source || !current || source.id === current.id) return false;
    const updated = copySubEventVenueConfig(source, current);
    set({
      plan: touch({
        ...synced,
        venueType: updated.venueType,
        venueConfig: updated.venueConfig,
        seats: updated.seats,
        assignments: updated.assignments,
        participations: updated.participations,
      }),
    });
    return true;
  },

  setGuestSubEvents: (guestId, subEventIds) => {
    const plan = get().plan;
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    const subEvents = addGuestToSubEvents(synced.subEvents, guestId, subEventIds);
    const current = getCurrentSubFromPlan({ ...synced, subEvents });
    if (!current) return;
    set({
      plan: touch({
        ...synced,
        subEvents,
        participantGuestIds: current.participantGuestIds,
        participations: current.participations,
        assignments: current.assignments,
      }),
    });
  },

  setGuestSubEventAttendeeCount: (guestId, subEventId, count) => {
    const plan = get().plan;
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    const subEvents = setGuestSubEventAttendeeCount(
      synced.subEvents,
      subEventId,
      guestId,
      count,
    );
    const current = getCurrentSubFromPlan({ ...synced, subEvents });
    if (!current) return;
    set({
      plan: touch({
        ...synced,
        subEvents,
        participantGuestIds: current.participantGuestIds,
        participations: current.participations,
        assignments: current.assignments,
      }),
    });
  },

  toggleSubEventForAllGuests: (subEventId, participate) => {
    const { plan, guests } = get();
    if (!plan) return;
    const synced = syncFlatToSubEvents(plan);
    const guestIds = guests.map((g) => g.id);
    const subEvents = setSubEventParticipationBulk(synced.subEvents, subEventId, guestIds, participate);
    const current = getCurrentSubFromPlan({ ...synced, subEvents });
    if (!current) return;
    set({
      plan: touch({
        ...synced,
        subEvents,
        participantGuestIds: current.participantGuestIds,
        participations: current.participations,
        assignments: current.assignments,
      }),
    });
  },
}));

export { snapshotPlan };
