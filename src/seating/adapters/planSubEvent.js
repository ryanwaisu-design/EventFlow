import { generateId, nowISO } from '../../utils/helpers';
import { defaultParticipation, defaultVenueConfig, normalizeParticipation } from '../types';
import { generateAssignments, generateSeats, mergeAssignments } from '../utils/seatGenerator';
import { defaultVipLounge, normalizeVipLounge, syncSubEventVipLounge } from '../utils/vipLounge';

const SUB_FIELDS = [
  'name', 'date', 'time', 'location',
  'venueType', 'venueConfig', 'seats', 'assignments', 'showTooltip', 'customTableNumbers',
  'vipLounge',
  'participantGuestIds', 'participations', 'step',
];

export function pickSubFields(sub) {
  const out = {};
  for (const key of SUB_FIELDS) {
    if (sub[key] !== undefined) out[key] = sub[key];
  }
  return out;
}

export function createSubEvent(partial = {}) {
  const venueType = partial.venueType ?? 'banquet';
  const venueConfig = defaultVenueConfig(venueType);
  const seats = generateSeats(venueConfig);
  return {
    id: generateId(),
    name: partial.name ?? '新子活動',
    date: partial.date ?? '',
    time: partial.time ?? '',
    location: partial.location ?? '',
    venueType,
    venueConfig,
    seats,
    assignments: generateAssignments(seats),
    showTooltip: true,
    customTableNumbers: {},
    participantGuestIds: [],
    participations: {},
    step: 'setup',
    vipLounge: defaultVipLounge(),
  };
}

export function normalizeSubEvent(sub) {
  const venueType = sub.venueType ?? 'banquet';
  const participations = { ...(sub.participations ?? {}) };
  for (const guestId of sub.participantGuestIds ?? []) {
    participations[guestId] = normalizeParticipation(
      participations[guestId] ?? defaultParticipation(guestId),
    );
  }
  const venueConfig = sub.venueConfig ?? defaultVenueConfig(venueType);
  const seats = sub.seats?.length ? sub.seats : generateSeats(venueConfig);
  const assignments = sub.assignments && Object.keys(sub.assignments).length
    ? sub.assignments
    : generateAssignments(seats);
  return syncSubEventVipLounge({
    ...sub,
    name: sub.name ?? '子活動',
    date: sub.date ?? '',
    time: sub.time ?? '',
    location: sub.location ?? '',
    venueType,
    venueConfig,
    participations,
    assignments,
    seats,
    customTableNumbers: sub.customTableNumbers ?? {},
    participantGuestIds: sub.participantGuestIds ?? [],
    showTooltip: sub.showTooltip ?? true,
    step: sub.step ?? 'setup',
    vipLounge: normalizeVipLounge(sub.vipLounge),
  });
}

export function normalizePlanSubEvents(plan) {
  if (!plan) return null;
  const subEvents = (plan.subEvents ?? []).map(normalizeSubEvent);
  const currentSubEventId =
    plan.currentSubEventId && subEvents.some((s) => s.id === plan.currentSubEventId)
      ? plan.currentSubEventId
      : (subEvents[0]?.id ?? null);
  return {
    ...plan,
    subEvents,
    currentSubEventId,
    customTableNumbers: plan.customTableNumbers ?? {},
    participations: plan.participations ?? {},
    assignments: plan.assignments ?? {},
    seats: plan.seats ?? [],
    participantGuestIds: plan.participantGuestIds ?? [],
    savedSnapshot: plan.savedSnapshot ?? '',
  };
}

/** 舊版 flat SeatingPlan → 含 subEvents 的結構 */
export function migratePlanToSubEvents(plan, eventMeta = {}) {
  if (!plan) return null;
  if (plan.subEvents?.length) {
    return flattenToSub(normalizePlanSubEvents(plan), plan.currentSubEventId);
  }

  const subId = generateId();
  const sub = normalizeSubEvent({
    id: subId,
    name: eventMeta.name || '主活動',
    date: eventMeta.date || '',
    time: eventMeta.startTime || '',
    location: eventMeta.venue || '',
    venueType: plan.venueType ?? 'banquet',
    venueConfig: plan.venueConfig ?? defaultVenueConfig('banquet'),
    seats: plan.seats ?? [],
    assignments: plan.assignments ?? {},
    showTooltip: plan.showTooltip ?? true,
    customTableNumbers: plan.customTableNumbers,
    participantGuestIds: plan.participantGuestIds ?? [],
    participations: plan.participations ?? {},
    step: plan.step ?? 'setup',
  });

  const container = {
    id: plan.id || plan.eventId,
    eventId: plan.eventId,
    subEvents: [sub],
    currentSubEventId: subId,
    savedSnapshot: plan.savedSnapshot ?? '',
    createdAt: plan.createdAt ?? nowISO(),
    updatedAt: plan.updatedAt ?? nowISO(),
  };
  return { ...container, ...pickSubFields(sub) };
}

/** 將平面欄位寫回 subEvents 陣列 */
export function syncFlatToSubEvents(plan) {
  if (!plan?.subEvents?.length) return migratePlanToSubEvents(plan);
  const subId = plan.currentSubEventId ?? plan.subEvents[0]?.id;
  const flat = pickSubFields(plan);
  const subEvents = plan.subEvents.map((s) =>
    s.id === subId ? normalizeSubEvent({ ...s, ...flat, id: s.id }) : s,
  );
  return normalizePlanSubEvents({
    ...plan,
    subEvents,
    currentSubEventId: subId,
    ...flat,
  });
}

export function getCurrentSubFromPlan(plan) {
  if (!plan?.subEvents?.length) return null;
  const id = plan.currentSubEventId ?? plan.subEvents[0].id;
  return plan.subEvents.find((s) => s.id === id) ?? plan.subEvents[0];
}

/** 切換作用中子活動：先保存當前，再載入目標子活動欄位 */
export function flattenToSub(plan, subId) {
  const synced = syncFlatToSubEvents(plan);
  const targetId = subId ?? synced.currentSubEventId ?? synced.subEvents[0]?.id;
  const sub = synced.subEvents.find((s) => s.id === targetId) ?? synced.subEvents[0];
  if (!sub) return synced;
  return { ...synced, ...pickSubFields(sub), currentSubEventId: sub.id };
}

export function planTotalSeats(plan) {
  return (plan.subEvents ?? []).reduce((sum, s) => sum + (s.seats?.length ?? 0), 0);
}

export function planAggregateStep(plan) {
  const subs = plan.subEvents ?? [];
  if (!subs.length) return plan.step ?? 'setup';
  if (subs.some((s) => s.step === 'dashboard')) return 'dashboard';
  return 'setup';
}

export function compareSubEventSchedule(a, b) {
  const aHasDate = !!a.date;
  const bHasDate = !!b.date;
  if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const aTime = a.time || '00:00';
  const bTime = b.time || '00:00';
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return a.name.localeCompare(b.name, 'zh-Hant');
}

export function sortSubEventsBySchedule(subEvents) {
  return [...subEvents].sort(compareSubEventSchedule);
}

export function reorderSubEvents(subEvents, index, direction) {
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= subEvents.length) return subEvents;
  const next = [...subEvents];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function subVenueConfigKey(sub) {
  return JSON.stringify({ venueType: sub.venueType, venueConfig: sub.venueConfig });
}

export function syncParticipationSeatRefs(sub) {
  const participations = { ...sub.participations };
  for (const guestId of sub.participantGuestIds) {
    let audienceSeat = null;
    let stageSeat = null;
    let vipSeat = null;
    for (const seat of sub.seats) {
      const assignment = sub.assignments[seat.id];
      if (assignment?.guestId !== guestId) continue;
      if (seat.zone === 'stage') stageSeat = seat.id;
      else if (seat.zone === 'vip') vipSeat = seat.id;
      else if (!audienceSeat) audienceSeat = seat.id;
    }
    const prev = participations[guestId] ?? defaultParticipation(guestId);
    participations[guestId] = { ...prev, audienceSeat, stageSeat, vipSeat };
  }
  return { ...sub, participations };
}

export function applySubEventVenueConfig(sub, venueConfig) {
  const synced = syncSubEventVipLounge(sub);
  const vipSeats = synced.seats.filter((s) => s.zone === 'vip');
  const generated = generateSeats(venueConfig);
  const seats = [...generated, ...vipSeats];
  const assignments = mergeAssignments(seats, synced.assignments);
  return syncParticipationSeatRefs({ ...synced, venueConfig, seats, assignments });
}

export function regenerateSubEventSeats(sub, force) {
  const hasAssignments = Object.values(sub.assignments).some((a) => a.guestId);
  if (hasAssignments && !force) return null;
  const seats = generateSeats(sub.venueConfig);
  const clearedParticipations = {};
  for (const guestId of sub.participantGuestIds) {
    clearedParticipations[guestId] = {
      ...(sub.participations[guestId] ?? defaultParticipation(guestId)),
      audienceSeat: null,
      stageSeat: null,
      vipSeat: null,
    };
  }
  return {
    ...sub,
    seats,
    assignments: mergeAssignments(seats, {}),
    participations: clearedParticipations,
  };
}

export function getGuestSubEventAttendeeCount(sub, guestId) {
  if (!sub.participantGuestIds.includes(guestId)) return 1;
  const p = sub.participations?.[guestId];
  return Math.max(1, p?.floorSeatCount ?? 1);
}

export function setGuestSubEventAttendeeCount(subEvents, subEventId, guestId, count) {
  const parsed = Math.max(1, Math.floor(count) || 1);
  return subEvents.map((sub) => {
    if (sub.id !== subEventId) return sub;
    if (!sub.participantGuestIds.includes(guestId)) return sub;
    const prev = sub.participations[guestId] ?? defaultParticipation(guestId);
    return {
      ...sub,
      participations: {
        ...sub.participations,
        [guestId]: { ...prev, floorSeatCount: parsed },
      },
    };
  });
}

export function addGuestToSubEvents(subEvents, guestId, subEventIds) {
  const idSet = new Set(subEventIds);
  return subEvents.map((sub) => {
    const participates = idSet.has(sub.id);
    const inList = sub.participantGuestIds.includes(guestId);
    if (participates && !inList) {
      return {
        ...sub,
        participantGuestIds: [...sub.participantGuestIds, guestId],
        participations: {
          ...sub.participations,
          [guestId]: sub.participations[guestId] ?? defaultParticipation(guestId),
        },
      };
    }
    if (!participates && inList) {
      const assignments = { ...sub.assignments };
      Object.keys(assignments).forEach((seatId) => {
        if (assignments[seatId].guestId === guestId) {
          assignments[seatId] = { ...assignments[seatId], guestId: null };
        }
      });
      const participations = { ...sub.participations };
      delete participations[guestId];
      return {
        ...sub,
        participantGuestIds: sub.participantGuestIds.filter((id) => id !== guestId),
        participations,
        assignments,
      };
    }
    return sub;
  });
}

export function setSubEventParticipationBulk(subEvents, subEventId, guestIds, participate) {
  const idSet = new Set(guestIds);
  return subEvents.map((sub) => {
    if (sub.id !== subEventId) return sub;
    if (participate) {
      const participantGuestIds = [...new Set([...sub.participantGuestIds, ...guestIds])];
      const participations = { ...sub.participations };
      for (const guestId of guestIds) {
        participations[guestId] = participations[guestId] ?? defaultParticipation(guestId);
      }
      return { ...sub, participantGuestIds, participations };
    }
    const participantGuestIds = sub.participantGuestIds.filter((id) => !idSet.has(id));
    const assignments = { ...sub.assignments };
    const participations = { ...sub.participations };
    for (const guestId of guestIds) {
      Object.keys(assignments).forEach((seatId) => {
        if (assignments[seatId].guestId === guestId) {
          assignments[seatId] = { ...assignments[seatId], guestId: null };
        }
      });
      delete participations[guestId];
    }
    return { ...sub, participantGuestIds, participations, assignments };
  });
}

export function setGuestVipEligible(subEvents, subEventId, guestId, eligible) {
  return subEvents.map((sub) => {
    if (sub.id !== subEventId) return sub;
    if (!sub.participantGuestIds.includes(guestId)) return sub;
    const prev = sub.participations[guestId] ?? defaultParticipation(guestId);
    const participations = {
      ...sub.participations,
      [guestId]: { ...prev, vipEligible: Boolean(eligible) },
    };
    if (eligible) return { ...sub, participations };
    const assignments = { ...sub.assignments };
    Object.keys(assignments).forEach((seatId) => {
      const seat = sub.seats.find((s) => s.id === seatId);
      if (seat?.zone === 'vip' && assignments[seatId].guestId === guestId) {
        assignments[seatId] = { ...assignments[seatId], guestId: null };
      }
    });
    return syncParticipationSeatRefs({
      ...sub,
      participations: {
        ...participations,
        [guestId]: { ...participations[guestId], vipSeat: null },
      },
      assignments,
    });
  });
}

export function copySubEventVenueConfig(source, target) {
  const venueConfig = structuredClone(source.venueConfig);
  const vipLounge = structuredClone(normalizeVipLounge(source.vipLounge));
  const withVenue = applySubEventVenueConfig({ ...target, venueType: source.venueType, vipLounge }, venueConfig);
  return syncSubEventVipLounge(withVenue);
}
