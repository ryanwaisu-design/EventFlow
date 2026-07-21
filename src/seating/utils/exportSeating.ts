import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Guest, Seat, SeatingPlan } from '../types';
import { buildVisualLayout, type LayoutExcelResult } from './seatLayout';
import {
  buildSeatingContext,
  countGuestFloorSeats,
  countGuestStageSeats,
  countGuestVipSeats,
  getUnassignedGuests,
  participantGuests,
} from './guestSeats';
import { buildSeatingView, type EventFlowEventMeta } from './seatingView';
import { getTableDisplayNumber, MAIN_TABLE_KEY } from './tableNumber';
import { longTableSeatLabel, roundTableSeatLabel } from './rankOrder';

function getGuest(guests: Guest[], guestId: string | null): Guest | undefined {
  if (!guestId) return undefined;
  return guests.find((g) => g.id === guestId);
}

function getGuestName(guests: Guest[], guestId: string | null): string {
  return getGuest(guests, guestId)?.name ?? '';
}

function getGuestOrg(guests: Guest[], guestId: string | null): string {
  return getGuest(guests, guestId)?.organization ?? '';
}

function getGuestTitle(guests: Guest[], guestId: string | null): string {
  return getGuest(guests, guestId)?.title ?? '';
}

function getGuestJobLevel(guests: Guest[], guestId: string | null): string {
  return getGuest(guests, guestId)?.jobLevel ?? '';
}

function seatNumber(seat: Seat, plan: SeatingPlan): string {
  if (seat.side !== undefined) return longTableSeatLabel(seat);
  if (
    plan.venueConfig.type === 'banquet' &&
    plan.venueConfig.guestTableShape === 'round' &&
    seat.zone === 'floor' &&
    seat.table !== undefined
  ) {
    const tableNum = getTableDisplayNumber(plan, seat.row ?? 0, seat.table);
    return roundTableSeatLabel(tableNum, seat);
  }
  return String(seat.customNumber ?? seat.displayNumber);
}

function seatZoneLabel(seat: Seat): string {
  if (seat.zone === 'stage') return '台上';
  if (seat.zone === 'main') return '主桌';
  if (seat.zone === 'vip') return 'VIP 休息室';
  return '台下';
}

function seatLocationLabel(seat: Seat, plan: SeatingPlan): string {
  if (seat.zone === 'stage') {
    return seat.row !== undefined ? `第${seat.row + 1}排` : '台上';
  }
  if (seat.zone === 'main') return '主桌';
  if (seat.zone === 'vip') return 'VIP 休息室';
  if (seat.table !== undefined) {
    const tableNum = getTableDisplayNumber(plan, seat.row ?? 0, seat.table);
    return `第${(seat.row ?? 0) + 1}排 · 桌${tableNum}`;
  }
  return `第${(seat.row ?? 0) + 1}排`;
}

function seatTableLabel(seat: Seat, plan: SeatingPlan): string {
  if (seat.zone === 'main') return String(plan.customTableNumbers?.[MAIN_TABLE_KEY] ?? '主桌');
  if (seat.zone === 'floor' && seat.table !== undefined) {
    return String(getTableDisplayNumber(plan, seat.row ?? 0, seat.table));
  }
  return '';
}

function zoneSortKey(zone: Seat['zone']): number {
  if (zone === 'stage') return 0;
  if (zone === 'main') return 1;
  if (zone === 'floor') return 2;
  if (zone === 'vip') return 3;
  return 9;
}

function sortSeatsForList(a: Seat, b: Seat): number {
  const z = zoneSortKey(a.zone) - zoneSortKey(b.zone);
  if (z !== 0) return z;
  const row = (a.row ?? 0) - (b.row ?? 0);
  if (row !== 0) return row;
  const table = (a.table ?? 0) - (b.table ?? 0);
  if (table !== 0) return table;
  const side = (a.side ?? -1) - (b.side ?? -1);
  if (side !== 0) return side;
  return a.index - b.index;
}

function applyLayoutSheetMeta(ws: XLSX.WorkSheet, layout: LayoutExcelResult): void {
  if (layout.merges.length > 0) ws['!merges'] = layout.merges;
  if (layout.colWidths.length > 0) {
    ws['!cols'] = layout.colWidths.map((w) => ({ wch: w }));
  }
  const rows: Array<{ hpt?: number }> = [];
  layout.aoa.forEach((_, i) => {
    rows[i] = layout.rowHeights[i] ? { hpt: layout.rowHeights[i] } : { hpt: 18 };
  });
  ws['!rows'] = rows;
}

function buildSeatListRow(seat: Seat, plan: SeatingPlan, guests: Guest[]) {
  const assignment = plan.assignments[seat.id];
  const guestId = assignment?.guestId ?? null;
  return {
    區域: seatZoneLabel(seat),
    位置: seatLocationLabel(seat, plan),
    桌號: seatTableLabel(seat, plan),
    座位編號: seatNumber(seat, plan),
    姓名: getGuestName(guests, guestId),
    單位: getGuestOrg(guests, guestId),
    職稱: getGuestTitle(guests, guestId),
    職務層次: getGuestJobLevel(guests, guestId),
    鎖定: assignment?.locked ? '是' : '',
    座位ID: seat.id,
  };
}

/**
 * 名單 Excel：可編輯主檔（下載後可自行修改，不會自動匯回系統）
 * -「全部座位」含空位，方便離線填寫
 * -「已排位 / 未排位」方便核對
 */
export function exportSeatingListExcel(
  event: EventFlowEventMeta,
  plan: SeatingPlan,
  guests: Guest[],
): void {
  const ctx = buildSeatingContext(guests, plan);
  const participants = participantGuests(ctx);

  if (participants.length === 0 && plan.seats.length === 0) {
    alert('目前沒有任何嘉賓資料可供匯出。');
    return;
  }

  const sortedSeats = [...plan.seats].sort(sortSeatsForList);
  const allSeatRows = sortedSeats.map((seat) => buildSeatListRow(seat, plan, guests));

  const assignedRows = sortedSeats
    .filter((seat) => plan.assignments[seat.id]?.guestId)
    .map((seat) => buildSeatListRow(seat, plan, guests));

  const unassignedAudience = getUnassignedGuests(ctx, 'audience').map((g) => {
    const p = plan.participations[g.id];
    return {
      姓名: g.name,
      單位: g.organization,
      職稱: g.title,
      職務層次: g.jobLevel ?? '',
      台下佔位: p?.floorSeatCount ?? 1,
      台下已排: countGuestFloorSeats(g.id, plan.assignments, plan.seats),
      台上佔位: p?.stageSeatCount ?? 0,
      台上已排: countGuestStageSeats(g.id, plan.assignments, plan.seats),
      VIP可排: p?.vipEligible ? '是' : '',
      VIP佔位: p?.vipEligible ? (p?.vipSeatCount ?? 1) : 0,
      VIP已排: countGuestVipSeats(g.id, plan.assignments, plan.seats),
    };
  });

  const noteSheet = XLSX.utils.aoa_to_sheet([
    ['EventFlow 排位名單（可編輯主檔）'],
    [''],
    ['說明'],
    ['1. 「全部座位」為主編輯工作表：每列一座位，含空位；可在「姓名／單位／職稱」欄自行修改。'],
    ['2. 「已排位」「未排位」僅供核對，修改後不會自動匯回系統。'],
    ['3. 「座位ID」請勿更改（若日後需要對照匯入時使用）。'],
    [''],
    ['活動', event.name],
    ['子活動／場次', plan.name ?? ''],
    ['匯出時間', new Date().toLocaleString('zh-HK')],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, noteSheet, '說明');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allSeatRows), '全部座位');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignedRows), '已排位');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unassignedAudience), '未排位');
  XLSX.writeFile(wb, `${event.name}_排位名單.xlsx`);
}

/** 排位圖 Excel：視覺參考（盡量接近畫面，非 1:1；請以名單為主檔編輯） */
export function exportSeatingLayoutExcel(
  event: EventFlowEventMeta,
  plan: SeatingPlan,
  guests: Guest[],
): void {
  const view = buildSeatingView(event, plan, guests);
  const layout = buildVisualLayout(view, plan, event);
  const ws = XLSX.utils.aoa_to_sheet(layout.aoa);
  applyLayoutSheetMeta(ws, layout);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '排位圖');
  XLSX.writeFile(wb, `${event.name}_排位圖.xlsx`);
}

/**
 * PDF：截取畫面上的排位圖（與目前顯示一致）
 */
export async function exportSeatingPdf(
  elementId: string,
  event: EventFlowEventMeta,
  _plan: SeatingPlan,
  _guests: Guest[],
): Promise<void> {
  const source = document.getElementById(elementId);
  if (!source) {
    throw new Error('找不到排位圖元素');
  }

  const panContent = source.closest('.pan-zoom-content') as HTMLElement | null;
  const prevTransform = panContent?.style.transform ?? '';
  if (panContent) {
    panContent.style.transform = 'none';
  }

  const stage = document.createElement('div');
  stage.className = 'pdf-export-stage';
  stage.setAttribute('aria-hidden', 'true');

  const header = document.createElement('div');
  header.className = 'print-header';
  header.innerHTML = `
    <h1>${escapeHtml(event.name)}</h1>
    <p>嘉賓座位圖${event.date ? ` · ${escapeHtml(event.date)}` : ''}${
      event.venue ? ` · ${escapeHtml(event.venue)}` : ''
    }</p>
  `;

  const wrap = document.createElement('div');
  wrap.className = 'pdf-export-chart-wrap';
  const clone = source.cloneNode(true) as HTMLElement;
  clone.id = `${elementId}-pdf-clone`;
  clone.querySelectorAll('.no-print').forEach((el) => el.remove());
  wrap.appendChild(clone);

  stage.appendChild(header);
  stage.appendChild(wrap);
  document.body.appendChild(stage);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const width = Math.ceil(Math.max(stage.scrollWidth, wrap.scrollWidth, 800));
    const height = Math.ceil(Math.max(stage.scrollHeight, wrap.scrollHeight, 600));
    const maxCanvasDim = 16384;
    let scale = 2;
    if (width * scale > maxCanvasDim || height * scale > maxCanvasDim) {
      scale = Math.min(maxCanvasDim / width, maxCanvasDim / height, 2);
    }

    const canvas = await html2canvas(stage, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      logging: false,
      onclone: (_doc, el) => {
        el.querySelectorAll('.no-print, .row-controls, .seat-remove, .banquet-seat-remove, .table-seat-controls, .vip-lounge-toolbar, .vip-lounge-item-remove').forEach(
          (node) => {
            (node as HTMLElement).style.display = 'none';
          },
        );
      },
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const margin = 10;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    const pxToMm = 0.264583;
    const imgWmm = (canvas.width / scale) * pxToMm;
    const imgHmm = (canvas.height / scale) * pxToMm;
    const fitScale = Math.min(maxW / imgWmm, maxH / imgHmm, 1);
    const drawW = imgWmm * fitScale;
    const drawH = imgHmm * fitScale;
    const x = margin + (maxW - drawW) / 2;
    const y = margin + (maxH - drawH) / 2;

    pdf.addImage(imgData, 'PNG', x, y, drawW, drawH, undefined, 'FAST');
    pdf.save(`${event.name}_排位圖.pdf`);
  } finally {
    stage.remove();
    if (panContent) {
      panContent.style.transform = prevTransform;
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
