import { nowISO } from '../../utils/helpers';
import { defaultParticipation, normalizeParticipation } from '../types';
import {
  createSubEvent,
  migratePlanToSubEvents,
  normalizePlanSubEvents,
  pickSubFields,
  syncFlatToSubEvents,
} from './planSubEvent';

export const SEATING_PARTICIPANT_STATUSES = ['attending', 'checked_in'];

/** 建立空白排位方案（含預設子活動） */
export function createEmptyPlan(eventId, eventMeta = {}) {
  const sub = createSubEvent({
    name: eventMeta.name || '主活動',
    date: eventMeta.date || '',
    time: eventMeta.startTime || '',
    location: eventMeta.venue || '',
  });
  const ts = nowISO();
  return {
    id: eventId,
    eventId,
    subEvents: [sub],
    currentSubEventId: sub.id,
    savedSnapshot: '',
    createdAt: ts,
    updatedAt: ts,
    ...pickSubFields(sub),
  };
}

/** 從 attendance 同步當前子活動的 participantGuestIds */
export function syncParticipantsFromAttendance(plan, attendanceRecords, { statuses = SEATING_PARTICIPANT_STATUSES } = {}) {
  const migrated = migratePlanToSubEvents(plan);
  const nextIds = attendanceRecords
    .filter((a) => statuses.includes(a.status))
    .map((a) => a.guestId);

  const idSet = new Set(nextIds);
  const participations = { ...migrated.participations };

  for (const guestId of nextIds) {
    const att = attendanceRecords.find((a) => a.guestId === guestId);
    const prev = participations[guestId] ?? defaultParticipation(guestId);
    participations[guestId] = normalizeParticipation({
      ...prev,
      guestId,
      floorSeatCount: Math.max(1, (att?.companionCount ?? 0) + 1),
    });
  }

  for (const guestId of migrated.participantGuestIds ?? []) {
    if (!idSet.has(guestId)) delete participations[guestId];
  }

  const assignments = { ...migrated.assignments };
  for (const guestId of migrated.participantGuestIds ?? []) {
    if (idSet.has(guestId)) continue;
    Object.keys(assignments).forEach((seatId) => {
      if (assignments[seatId].guestId === guestId) {
        assignments[seatId] = { ...assignments[seatId], guestId: null };
      }
    });
  }

  const updated = {
    ...migrated,
    participantGuestIds: nextIds,
    participations,
    assignments,
    updatedAt: nowISO(),
  };
  return syncFlatToSubEvents(updated);
}

export function normalizePlan(plan, eventMeta) {
  if (!plan) return null;
  const migrated = migratePlanToSubEvents(plan, eventMeta);
  return syncFlatToSubEvents(migrated);
}

/** 持久化前：確保 subEvents 與平面欄位一致 */
export function preparePlanForStorage(plan) {
  return syncFlatToSubEvents(normalizePlanSubEvents(plan));
}
