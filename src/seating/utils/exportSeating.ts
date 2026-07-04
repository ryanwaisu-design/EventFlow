import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { Guest, Seat, SeatingPlan } from '../types';
import { buildVisualLayout, type LayoutExcelResult } from './seatLayout';
import {
  buildSeatingContext,
  countGuestFloorSeats,
  getUnassignedGuests,
  participantGuests,
} from './guestSeats';
import { buildSeatingView, type EventFlowEventMeta } from './seatingView';

function getGuestName(guests: Guest[], guestId: string | null): string {
  if (!guestId) return '';
  return guests.find((g) => g.id === guestId)?.name ?? '';
}

function getGuestOrg(guests: Guest[], guestId: string | null): string {
  if (!guestId) return '';
  return guests.find((g) => g.id === guestId)?.organization ?? '';
}

function getGuestTitle(guests: Guest[], guestId: string | null): string {
  if (!guestId) return '';
  return guests.find((g) => g.id === guestId)?.title ?? '';
}

function seatNumber(seat: Seat): string {
  const n = seat.customNumber ?? seat.displayNumber;
  return String(n);
}

function seatAreaLabel(seat: Seat): string {
  if (seat.zone === 'stage') return '台上';
  if (seat.zone === 'main') return '主桌';
  if (seat.table !== undefined) return `第${(seat.row ?? 0) + 1}排 桌${(seat.table ?? 0) + 1}`;
  return `第${(seat.row ?? 0) + 1}排`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellHtml(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br/>');
}

function buildLayoutTableHtml(layout: LayoutExcelResult): string {
  const rows = layout.aoa
    .map((row) => {
      const cells = row.map((cell) => `<td>${cellHtml(cell)}</td>`).join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="seating-export-table">${rows}</table>`;
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

  const assignedRows = plan.seats
    .filter((seat) => plan.assignments[seat.id]?.guestId)
    .map((seat) => {
      const assignment = plan.assignments[seat.id];
      return {
        '區域 / 桌名': seatAreaLabel(seat),
        座位編號: seatNumber(seat),
        姓名: getGuestName(guests, assignment?.guestId ?? null),
        單位: getGuestOrg(guests, assignment?.guestId ?? null),
        職稱: getGuestTitle(guests, assignment?.guestId ?? null),
      };
    });

  const unassignedRows = getUnassignedGuests(ctx, 'audience').map((g) => {
    const p = plan.participations[g.id];
    return {
      姓名: g.name,
      單位: g.organization,
      職稱: g.title,
      台下佔位: p?.floorSeatCount ?? 1,
      台下已排: countGuestFloorSeats(g.id, plan.assignments, plan.seats),
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignedRows), '已排位名單');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unassignedRows), '未排位名單');
  XLSX.writeFile(wb, `${event.name}_Seating_List.xlsx`);
}

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

export async function exportSeatingPdf(
  _elementId: string,
  event: EventFlowEventMeta,
  plan: SeatingPlan,
  guests: Guest[],
): Promise<void> {
  const view = buildSeatingView(event, plan, guests);
  const layout = buildVisualLayout(view, plan, event);

  const stage = document.createElement('div');
  stage.className = 'pdf-export-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.innerHTML = `
    <style>
      .seating-export-table {
        border-collapse: collapse;
        font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
        font-size: 9px;
        line-height: 1.25;
        color: #111;
      }
      .seating-export-table td {
        border: 1px solid #cbd5e1;
        padding: 3px 5px;
        vertical-align: middle;
        text-align: center;
        white-space: pre-wrap;
        min-width: 36px;
      }
      .seating-export-table tr:first-child td {
        font-size: 16px;
        font-weight: 700;
        border: none;
        padding-bottom: 6px;
      }
      .seating-export-table tr:nth-child(2) td {
        font-size: 13px;
        font-weight: 600;
        border: none;
        padding-bottom: 4px;
      }
      .seating-export-table tr:nth-child(3) td,
      .seating-export-table tr:nth-child(4) td,
      .seating-export-table tr:nth-child(5) td {
        border: none;
        text-align: left;
        font-size: 10px;
        color: #475569;
        padding: 1px 0;
      }
      .seating-export-table tr:nth-child(6) td {
        border: none;
        height: 8px;
      }
    </style>
    ${buildLayoutTableHtml(layout)}
  `;

  document.body.appendChild(stage);

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const width = Math.ceil(stage.scrollWidth);
    const height = Math.ceil(stage.scrollHeight);
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
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const margin = 12;
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
  }
}
