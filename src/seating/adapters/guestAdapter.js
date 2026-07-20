import { getPrimaryAffiliation, getEventAffiliation } from '../../utils/helpers';

/** EventFlow guest → seat-planner Guest（共用 id） */
export function toSeatingGuest(guest, rank = 0, attendance) {
  const aff = attendance ? getEventAffiliation(guest, attendance) : getPrimaryAffiliation(guest);
  return {
    id: guest.id,
    name: guest.name || '',
    organization: aff.organization || '',
    title: aff.title || '',
    jobLevel: (guest.jobLevel || '').trim(),
    rank: rank || 1,
  };
}

/** 批量轉換，rank 依陣列順序；可傳入 attendanceByGuestId 以使用本活動邀請身分 */
export function toSeatingGuests(guests, participantGuestIds, attendanceByGuestId) {
  const order = new Map(participantGuestIds.map((id, i) => [id, i + 1]));
  return guests
    .filter((g) => order.has(g.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((g) => toSeatingGuest(g, order.get(g.id), attendanceByGuestId?.[g.id]));
}
