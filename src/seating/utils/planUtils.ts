import type { BanquetVenueConfig, GuestParticipation, SeatingPlan, VenueConfig, VenueType } from '../types';
import { normalizeBanquetConfig, normalizeBanquetTables, normalizeParticipation } from '../types';
import { generateAssignments, generateSeats, mergeAssignments } from './seatGenerator';

export function defaultParticipation(guestId: string): GuestParticipation {
  return {
    guestId,
    audienceSeat: null,
    stageSeat: null,
    floorSeatCount: 1,
    stageSeatCount: 1,
  };
}

function prepareConfig(config: VenueConfig): VenueConfig {
  if (config.type === 'banquet') {
    return normalizeBanquetTables(normalizeBanquetConfig(config));
  }
  return config;
}

export function syncParticipationSeatRefs(plan: SeatingPlan): SeatingPlan {
  const participations = { ...plan.participations };
  for (const guestId of plan.participantGuestIds) {
    let audienceSeat: string | null = null;
    let stageSeat: string | null = null;
    for (const seat of plan.seats) {
      const assignment = plan.assignments[seat.id];
      if (assignment?.guestId !== guestId) continue;
      if (seat.zone === 'stage') stageSeat = seat.id;
      else if (!audienceSeat) audienceSeat = seat.id;
    }
    const prev = participations[guestId] ?? defaultParticipation(guestId);
    participations[guestId] = { ...prev, audienceSeat, stageSeat };
  }
  return { ...plan, participations };
}

export function applyPlanVenueConfig(plan: SeatingPlan, venueConfig: VenueConfig): SeatingPlan {
  const seats = generateSeats(venueConfig);
  const assignments = mergeAssignments(seats, plan.assignments);
  const next = { ...plan, venueConfig, seats, assignments };
  return syncParticipationSeatRefs(next);
}

export function regeneratePlanSeats(plan: SeatingPlan, force: boolean): SeatingPlan | null {
  const hasAssignments = Object.values(plan.assignments).some((a) => a.guestId);
  if (hasAssignments && !force) return null;
  const seats = generateSeats(plan.venueConfig);
  const clearedParticipations: Record<string, GuestParticipation> = {};
  for (const guestId of plan.participantGuestIds) {
    clearedParticipations[guestId] = {
      ...(plan.participations[guestId] ?? defaultParticipation(guestId)),
      audienceSeat: null,
      stageSeat: null,
    };
  }
  return {
    ...plan,
    seats,
    assignments: mergeAssignments(seats, {}),
    participations: clearedParticipations,
  };
}

export function venueConfigKey(plan: SeatingPlan): string {
  return JSON.stringify({ venueType: plan.venueType, venueConfig: plan.venueConfig });
}

export function planStats(plan: SeatingPlan) {
  const assignedCount = Object.values(plan.assignments).filter((a) => a.guestId).length;
  const participantCount = plan.participantGuestIds.length;
  return { assignedCount, participantCount };
}

export function setVenueTypeOnPlan(plan: SeatingPlan, type: VenueType, defaultVenueConfig: (t: VenueType) => VenueConfig): SeatingPlan {
  const config = defaultVenueConfig(type);
  return applyPlanVenueConfig({ ...plan, venueType: type }, config);
}

export function updateVenueConfigOnPlan(plan: SeatingPlan, config: VenueConfig): SeatingPlan {
  return applyPlanVenueConfig(plan, prepareConfig(config));
}

function applyPlanAssignments(
  plan: SeatingPlan,
  updater: (assignments: SeatingPlan['assignments']) => SeatingPlan['assignments'],
): SeatingPlan {
  const assignments = updater({ ...plan.assignments });
  return syncParticipationSeatRefs({ ...plan, assignments });
}

export { applyPlanAssignments, prepareConfig };
