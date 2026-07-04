import type { Guest, GuestParticipation, Seat, SeatAssignment, SeatingPlan } from '../types';
import { defaultParticipation } from './planUtils';

export type QuotaZone = 'floor' | 'stage';
export type SeatingMode = 'audience' | 'stage';

/** 單一排位方案的上下文 */
export interface SeatingContext {
  guests: Guest[];
  seats: Seat[];
  assignments: Record<string, SeatAssignment>;
  participations: Record<string, GuestParticipation>;
  participantGuestIds: string[];
}

export function buildSeatingContext(guests: Guest[], plan: SeatingPlan): SeatingContext {
  return {
    guests,
    seats: plan.seats,
    assignments: plan.assignments,
    participations: plan.participations,
    participantGuestIds: plan.participantGuestIds,
  };
}

export function participantGuests(ctx: SeatingContext): Guest[] {
  const ids = new Set(ctx.participantGuestIds);
  return ctx.guests.filter((g) => ids.has(g.id));
}

function participationFor(ctx: SeatingContext, guestId: string): GuestParticipation {
  return ctx.participations[guestId] ?? defaultParticipation(guestId);
}

export function seatZone(seat: Seat): QuotaZone | 'main' {
  if (seat.zone === 'stage') return 'stage';
  return 'floor';
}

export function isStageSeat(seat: Seat): boolean {
  return seat.zone === 'stage';
}

export function isAudienceSeat(seat: Seat): boolean {
  return seat.zone !== 'stage';
}

export interface SeatOccupancyStats {
  assigned: number;
  total: number;
}

export function getSeatOccupancyStats(
  mode: SeatingMode,
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): SeatOccupancyStats {
  const relevant = seats.filter((s) => (mode === 'stage' ? isStageSeat(s) : isAudienceSeat(s)));
  const assigned = relevant.filter((s) => assignments[s.id]?.guestId).length;
  return { assigned, total: relevant.length };
}

export interface GuestSeatIndex {
  floorIds: Set<string>;
  stageIds: Set<string>;
  floorCountByGuest: Map<string, number>;
  stageCountByGuest: Map<string, number>;
  hasStage: boolean;
}

export function buildGuestSeatIndex(
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): GuestSeatIndex {
  const floorIds = new Set<string>();
  const stageIds = new Set<string>();
  let hasStage = false;

  for (const seat of seats) {
    if (seat.zone === 'stage') {
      stageIds.add(seat.id);
      hasStage = true;
    } else if (seat.zone === 'floor' || seat.zone === 'main') {
      floorIds.add(seat.id);
    }
  }

  const floorCountByGuest = new Map<string, number>();
  const stageCountByGuest = new Map<string, number>();

  for (const [seatId, assignment] of Object.entries(assignments)) {
    const guestId = assignment.guestId;
    if (!guestId) continue;
    if (floorIds.has(seatId)) {
      floorCountByGuest.set(guestId, (floorCountByGuest.get(guestId) ?? 0) + 1);
    }
    if (stageIds.has(seatId)) {
      stageCountByGuest.set(guestId, (stageCountByGuest.get(guestId) ?? 0) + 1);
    }
  }

  return { floorIds, stageIds, floorCountByGuest, stageCountByGuest, hasStage };
}

function floorCountFor(
  guestId: string,
  index: GuestSeatIndex | null,
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): number {
  if (index) return index.floorCountByGuest.get(guestId) ?? 0;
  return countGuestFloorSeats(guestId, assignments, seats);
}

function stageCountFor(
  guestId: string,
  index: GuestSeatIndex | null,
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): number {
  if (index) return index.stageCountByGuest.get(guestId) ?? 0;
  return countGuestStageSeats(guestId, assignments, seats);
}

export function countGuestFloorSeats(
  guestId: string,
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): number {
  const floorIds = new Set(
    seats.filter((s) => s.zone === 'floor' || s.zone === 'main').map((s) => s.id),
  );
  return Object.entries(assignments).filter(
    ([id, a]) => floorIds.has(id) && a.guestId === guestId,
  ).length;
}

export function countGuestStageSeats(
  guestId: string,
  assignments: Record<string, SeatAssignment>,
  seats: Seat[],
): number {
  const stageIds = new Set(seats.filter((s) => s.zone === 'stage').map((s) => s.id));
  return Object.entries(assignments).filter(
    ([id, a]) => stageIds.has(id) && a.guestId === guestId,
  ).length;
}

export function guestNeedsFloorSeats(
  ctx: SeatingContext,
  guest: Guest,
  index?: GuestSeatIndex | null,
): boolean {
  const p = participationFor(ctx, guest.id);
  const max = Math.max(1, p.floorSeatCount);
  const seatIndex = index ?? buildGuestSeatIndex(ctx.assignments, ctx.seats);
  return floorCountFor(guest.id, seatIndex, ctx.assignments, ctx.seats) < max;
}

export function guestNeedsStageSeats(
  ctx: SeatingContext,
  guest: Guest,
  index?: GuestSeatIndex | null,
): boolean {
  const p = participationFor(ctx, guest.id);
  const max = p.stageSeatCount ?? 1;
  if (max <= 0) return false;
  const seatIndex = index ?? buildGuestSeatIndex(ctx.assignments, ctx.seats);
  return stageCountFor(guest.id, seatIndex, ctx.assignments, ctx.seats) < max;
}

export function getUnassignedGuests(
  ctx: SeatingContext,
  mode: SeatingMode,
  index?: GuestSeatIndex | null,
): Guest[] {
  const guests = participantGuests(ctx);
  const seatIndex = index ?? buildGuestSeatIndex(ctx.assignments, ctx.seats);
  if (mode === 'stage') {
    return guests.filter((g) => guestNeedsStageSeats(ctx, g, seatIndex));
  }
  return guests.filter((g) => guestNeedsFloorSeats(ctx, g, seatIndex));
}

export function getAssignedGuests(
  ctx: SeatingContext,
  mode: SeatingMode,
  index?: GuestSeatIndex | null,
): Guest[] {
  const guests = participantGuests(ctx);
  const seatIndex = index ?? buildGuestSeatIndex(ctx.assignments, ctx.seats);
  if (mode === 'stage') {
    return guests.filter((g) => {
      const max = participationFor(ctx, g.id).stageSeatCount ?? 1;
      if (max <= 0) return false;
      return stageCountFor(g.id, seatIndex, ctx.assignments, ctx.seats) > 0;
    });
  }
  return guests.filter(
    (g) => floorCountFor(g.id, seatIndex, ctx.assignments, ctx.seats) > 0,
  );
}

export function getGuestQuotaStatus(
  ctx: SeatingContext,
  guest: Guest,
  index?: GuestSeatIndex | null,
) {
  const p = participationFor(ctx, guest.id);
  const seatIndex = index ?? buildGuestSeatIndex(ctx.assignments, ctx.seats);
  const floorCount = floorCountFor(guest.id, seatIndex, ctx.assignments, ctx.seats);
  const stageCount = stageCountFor(guest.id, seatIndex, ctx.assignments, ctx.seats);
  const floorMax = Math.max(1, p.floorSeatCount);
  const stageMax = p.stageSeatCount ?? 1;

  return {
    floor: {
      count: floorCount,
      max: floorMax,
      full: floorCount >= floorMax,
      applicable: true,
    },
    stage: {
      count: stageCount,
      max: stageMax,
      full: stageMax > 0 && stageCount >= stageMax,
      applicable: seatIndex.hasStage && stageMax > 0,
    },
  };
}

export type GuestQuotaStatus = ReturnType<typeof getGuestQuotaStatus>;

export function getGuestQuotaTags(quota: GuestQuotaStatus, mode: SeatingMode): string[] {
  const tags: string[] = [];
  if (mode === 'audience' && quota.floor.applicable) {
    tags.push(`台下 ${quota.floor.count}/${quota.floor.max}`);
  }
  if (mode === 'stage' && quota.stage.applicable) {
    tags.push(`台上 ${quota.stage.count}/${quota.stage.max}`);
  }
  return tags;
}

export function formatGuestQuotaSummary(
  quota: GuestQuotaStatus,
  mode: SeatingMode,
): string | null {
  if (mode === 'audience' && quota.floor.applicable) {
    const { count, max } = quota.floor;
    const remaining = Math.max(0, max - count);
    if (quota.floor.full) return `台下已排滿 ${count}/${max} 位`;
    return `台下已排 ${count}/${max} 位，尚餘 ${remaining} 位`;
  }
  if (mode === 'stage' && quota.stage.applicable) {
    const { count, max } = quota.stage;
    const remaining = Math.max(0, max - count);
    if (quota.stage.full) return `已排滿 ${count}/${max} 位`;
    return `已排 ${count}/${max} 位，尚餘 ${remaining} 位`;
  }
  return null;
}

export function guestQuotaListItemClasses(
  quota: GuestQuotaStatus,
  mode: SeatingMode,
  extra: string[] = [],
): string {
  const classes = [...extra];
  if (mode === 'audience' && quota.floor.full) classes.push('quota-full-floor');
  if (mode === 'stage' && quota.stage.full) classes.push('quota-full-stage');
  return classes.filter(Boolean).join(' ');
}

export function canAssignGuestToSeat(
  ctx: SeatingContext,
  seatId: string,
  guestId: string | null,
): boolean {
  if (!guestId) return true;

  const seat = ctx.seats.find((s) => s.id === seatId);
  const guest = ctx.guests.find((g) => g.id === guestId);
  if (!seat || !guest) return false;
  if (!ctx.participantGuestIds.includes(guestId)) return false;

  const current = ctx.assignments[seatId];
  if (current?.guestId === guestId) return true;

  const p = participationFor(ctx, guestId);

  if (seat.zone === 'stage') {
    const max = p.stageSeatCount ?? 1;
    if (max <= 0) return false;
    const count = countGuestStageSeats(guestId, ctx.assignments, ctx.seats);
    return count < max;
  }

  if (seat.zone === 'floor' || seat.zone === 'main') {
    const max = Math.max(1, p.floorSeatCount);
    const count = countGuestFloorSeats(guestId, ctx.assignments, ctx.seats);
    return count < max;
  }

  return true;
}

export function canSwapSeats(ctx: SeatingContext, fromSeatId: string, toSeatId: string): boolean {
  const fromSeat = ctx.seats.find((s) => s.id === fromSeatId);
  const toSeat = ctx.seats.find((s) => s.id === toSeatId);
  if (!fromSeat || !toSeat) return false;

  const from = ctx.assignments[fromSeatId];
  const to = ctx.assignments[toSeatId];
  if (!from || !to || from.locked || to.locked) return false;

  const fromIsStage = fromSeat.zone === 'stage';
  const toIsStage = toSeat.zone === 'stage';
  if (fromIsStage !== toIsStage) return false;

  return true;
}

export function roundTableRadius(seatCount: number): number {
  const total = Math.max(1, seatCount);
  const seatArc = 50;
  const minRadius = (total * seatArc) / (2 * Math.PI);
  return Math.ceil(minRadius + 20);
}

export function roundTableSize(radius: number): number {
  return (radius + 24) * 2;
}

export function roundTableRowGap(seatCount = 12): number {
  const radius = roundTableRadius(seatCount);
  const diameter = roundTableSize(radius);
  return Math.round(diameter * 0.5);
}

export function quotaDenyMessage(
  guest: Guest,
  zone: QuotaZone,
  participation?: GuestParticipation,
): string {
  const label = zone === 'floor' ? '台下' : '台上';
  const max =
    zone === 'floor'
      ? Math.max(1, participation?.floorSeatCount ?? 1)
      : (participation?.stageSeatCount ?? 1);
  return `${guest.name} ${label}佔位已排滿（${max} 個），無法再安排${label}座位`;
}
