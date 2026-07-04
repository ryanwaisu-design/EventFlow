import type {
  Guest,
  Seat,
  SeatAssignment,
  SeatingPlan,
  VenueConfig,
} from '../types';

export interface EventFlowEventMeta {
  name: string;
  date?: string;
  venue?: string;
  startTime?: string;
  updatedAt?: string;
  /** 匯出排位圖時顯示的資料來源說明 */
  dataSource?: string;
  /** 匯出版本標籤，例如 V3 */
  exportVersion?: string;
}

/** 排位圖／匯出用的視圖 */
export interface SeatingView {
  name: string;
  date: string;
  time: string;
  location: string;
  venueConfig: VenueConfig;
  seats: Seat[];
  assignments: Record<string, SeatAssignment>;
  customTableNumbers?: Record<string, string | number>;
  showTooltip: boolean;
  guests: Guest[];
}

export function buildSeatingView(
  event: EventFlowEventMeta,
  plan: SeatingPlan,
  guests: Guest[],
): SeatingView {
  return {
    name: event.name,
    date: event.date ?? '',
    time: event.startTime ?? '',
    location: event.venue ?? '',
    venueConfig: plan.venueConfig,
    seats: plan.seats,
    assignments: plan.assignments,
    customTableNumbers: plan.customTableNumbers,
    showTooltip: plan.showTooltip,
    guests,
  };
}

export function groupSeatsFromList(seats: Seat[]) {
  const stage = seats.filter((s) => s.zone === 'stage');
  const main = seats.filter((s) => s.zone === 'main');
  const floor = seats.filter((s) => s.zone === 'floor');
  return { stage, main, floor, all: seats };
}
