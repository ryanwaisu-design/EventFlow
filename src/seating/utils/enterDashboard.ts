import type { Guest, SeatingPlan } from '../types';
import { planStats, venueConfigKey } from './planUtils';

export interface EnterDashboardAnalysis {
  venueChanged: boolean;
  removedSeatedGuestNames: string[];
  emptyLayout: boolean;
}

function guestHadSeat(plan: SeatingPlan, guestId: string): boolean {
  if (Object.values(plan.assignments).some((a) => a.guestId === guestId)) return true;
  const p = plan.participations[guestId];
  return !!(p?.audienceSeat || p?.stageSeat);
}

function guestName(guests: Guest[], guestId: string): string {
  return guests.find((g) => g.id === guestId)?.name ?? '未知嘉賓';
}

export function analyzeEnterDashboard(
  plan: SeatingPlan,
  guests: Guest[],
  savedSnapshot?: string,
): EnterDashboardAnalysis {
  const emptyLayout = plan.seats.length === 0;

  if (!savedSnapshot) {
    return { venueChanged: false, removedSeatedGuestNames: [], emptyLayout };
  }

  let saved: SeatingPlan;
  try {
    saved = JSON.parse(savedSnapshot) as SeatingPlan;
  } catch {
    return { venueChanged: false, removedSeatedGuestNames: [], emptyLayout };
  }

  const venueChanged = venueConfigKey(plan) !== venueConfigKey(saved);

  const currentIds = new Set(plan.participantGuestIds);
  const removedSeatedGuestNames: string[] = [];
  for (const guestId of saved.participantGuestIds ?? []) {
    if (currentIds.has(guestId)) continue;
    if (guestHadSeat(saved, guestId)) {
      removedSeatedGuestNames.push(guestName(guests, guestId));
    }
  }

  return { venueChanged, removedSeatedGuestNames, emptyLayout };
}

export function venueResetMessage(): string {
  return '場地配置已變更，進入排位將會清除所有排位紀錄。確定要繼續嗎？';
}

export function removedGuestMessage(names: string[]): string {
  const list = names.join('、');
  return `以下嘉賓已移除或取消出席，且先前已安排座位：${list}。確定要進入排位嗎？`;
}

export { planStats };
