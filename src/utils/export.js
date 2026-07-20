import * as XLSX from 'xlsx';
import {
  GUEST_CATEGORIES,
  ATTENDANCE_STATUS,
  EVENT_TYPES,
} from '../data/constants';
import { formatGuestCategoryLabel, getGuestCategoryLabel, parseImportedGuestCategory } from './guestCategories';
import {
  getPrimaryAffiliation,
  getEventAffiliation,
  escapeHTML,
  downloadBlob,
  sanitizeFilename,
  formatDateTime,
} from './helpers';

function buildGuestRow(event, guest, att, categories, settings) {
  const aff = getEventAffiliation(guest, att);
  const cats = categories || GUEST_CATEGORIES;
  return {
    活動名稱: event?.name || '',
    姓名: guest?.name || '',
    類別: settings
      ? formatGuestCategoryLabel(guest?.category, guest?.subcategory, settings)
      : (cats[guest?.category] || guest?.category || ''),
    主類別: getGuestCategoryLabel(guest?.category, settings || {}),
    次類別: guest?.subcategory || '',
    所屬單位: aff.organization,
    職銜: aff.title,
    電郵: guest?.email || '',
    電話: guest?.phone || '',
    地址: guest?.address || '',
    助理姓名: guest?.assistantName || '',
    助理電郵: guest?.assistantEmail || '',
    助理電話: guest?.assistantPhone || '',
    出席狀態: ATTENDANCE_STATUS[att?.status] || att?.status || '',
    發函日期: att?.invitedDate || '',
    回覆日期: att?.respondedDate || '',
    簽到時間: att?.checkedInAt ? formatDateTime(att.checkedInAt) : '',
    桌號: att?.tableNo || '',
    座位: att?.seatNo || '',
    陪同人數: att?.companionCount ?? '',
    飲食備註: att?.dietaryNotes || '',
    VIP備註: att?.vipNotes || '',
    內部備註: att?.internalNotes || '',
  };
}

function exportExcelRows(rows, filename) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '名單');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename
  );
}

export function buildAttendanceRows(event, guests, attendance, filterFn, categories, settings) {
  const guestMap = Object.fromEntries((guests || []).map((g) => [g.id, g]));
  return (attendance || [])
    .filter((a) => a.eventId === event?.id)
    .filter(filterFn || (() => true))
    .map((a) => buildGuestRow(event, guestMap[a.guestId], a, categories, settings));
}

export function exportAttendanceExcel(event, guests, attendance, filterFn, label, prefix, categories, settings) {
  const rows = buildAttendanceRows(event, guests, attendance, filterFn, categories, settings);
  if (!rows.length) throw new Error('沒有可匯出的資料');
  const filename = `${prefix}_${label}_${sanitizeFilename(event.name)}.xlsx`;
  exportExcelRows(rows, filename);
}

export function exportGuestDatabaseExcel(guests, prefix, categories, settings) {
  const cats = categories || GUEST_CATEGORIES;
  const rows = (guests || []).map((g) => {
    const aff = getPrimaryAffiliation(g);
    return {
      姓名: g.name || '',
      類別: settings
        ? formatGuestCategoryLabel(g.category, g.subcategory, settings)
        : (cats[g.category] || g.category || ''),
      主類別: getGuestCategoryLabel(g.category, settings || {}),
      次類別: g.subcategory || '',
      所屬單位: aff.organization,
      職銜: aff.title,
      電郵: g.email || '',
      電話: g.phone || '',
      地址: g.address || '',
      助理姓名: g.assistantName || '',
      助理電郵: g.assistantEmail || '',
      助理電話: g.assistantPhone || '',
      備註: g.notes || '',
      標籤: (g.tags || []).join(', '),
    };
  });
  exportExcelRows(rows, `${prefix}_嘉賓資料庫.xlsx`);
}

export function exportLabelMergeExcel(event, guests, attendance, prefix, categories, settings) {
  const rows = buildAttendanceRows(
    event,
    guests,
    attendance,
    (a) => ['attending', 'checked_in'].includes(a.status),
    categories,
    settings,
  ).map((r) => ({
    姓名: r.姓名,
    單位: r.所屬單位,
    職銜: r.職銜,
    桌號: r.桌號,
    座位: r.座位,
  }));
  if (!rows.length) throw new Error('沒有可匯出的標籤資料');
  exportExcelRows(rows, `${prefix}_標籤合併列印_${sanitizeFilename(event.name)}.xlsx`);
}

export function importGuestsFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseImportedGuestRow(row, generateId, nowISO, categories) {
  const name = row['姓名'] || row.name || row.Name || '';
  if (!name) return null;

  const { category, subcategory } = parseImportedGuestCategory(
    row['類別'] || row.category,
    row['次類別'] || row['子類別'] || row.subcategory,
    categories,
  );

  return {
    id: generateId(),
    name: String(name).trim(),
    photo: '',
    category,
    subcategory,
    affiliations: [
      {
        organization: row['所屬單位'] || row.organization || '',
        title: row['職銜'] || row['職務'] || row.title || '',
        isPrimary: true,
      },
    ],
    email: row['電郵'] || row.email || '',
    phone: row['電話'] || row.phone || '',
    address: row['地址'] || row.address || '',
    assistantName: row['助理姓名'] || '',
    assistantEmail: row['助理電郵'] || '',
    assistantPhone: row['助理電話'] || '',
    notes: row['備註'] || row.notes || '',
    tags: row['標籤'] ? String(row['標籤']).split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

import { loadImageElement } from './imageUtils';

const CM_TO_PX = 96 / 2.54;
const WORD_CELL_WIDTH_CM = 3.6;
const WORD_PHOTO_HEIGHT_CM = 3.5;
const WORD_CELL_WIDTH_PX = Math.round(WORD_CELL_WIDTH_CM * CM_TO_PX);
const WORD_PHOTO_HEIGHT_PX = Math.round(WORD_PHOTO_HEIGHT_CM * CM_TO_PX);
const WORD_COLS = 5;
const WORD_CELL_WIDTH_TWIPS = Math.round(WORD_CELL_WIDTH_CM * 567);
const WORD_TABLE_WIDTH_TWIPS = WORD_CELL_WIDTH_TWIPS * WORD_COLS;
const WORD_TABLE_WIDTH_CM = WORD_CELL_WIDTH_CM * WORD_COLS;

async function preparePhotoForWord(photoSrc) {
  if (!photoSrc) return null;
  try {
    const img = await loadImageElement(photoSrc);
    let w = (img.width / img.height) * WORD_PHOTO_HEIGHT_PX;
    let h = WORD_PHOTO_HEIGHT_PX;
    if (w > WORD_CELL_WIDTH_PX) {
      w = WORD_CELL_WIDTH_PX;
      h = (img.height / img.width) * WORD_CELL_WIDTH_PX;
    }
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width: w, height: h };
  } catch {
    return null;
  }
}

function wordPhotoHtml(photoData, guestName) {
  if (photoData) {
    return `<p align=center style='text-align:center;margin:0 0 4pt 0;line-height:normal;mso-line-height-rule:exactly;'>
<span style='mso-no-proof:yes'><img width=${photoData.width} height=${photoData.height}
src="${escapeHTML(photoData.dataUrl)}"
style='width:${photoData.width}px;height:${photoData.height}px;display:block;margin:0 auto;'></span></p>`;
  }
  const initial = escapeHTML((guestName || '?').charAt(0));
  return `<p align=center style='text-align:center;margin:0 0 4pt 0;'>
<span style='display:inline-block;width:${WORD_PHOTO_HEIGHT_PX}px;height:${WORD_PHOTO_HEIGHT_PX}px;line-height:${WORD_PHOTO_HEIGHT_PX}px;background:#f59e0b;color:#0a0f1a;font-size:20pt;font-weight:bold;font-family:"Microsoft JhengHei",sans-serif;'>${initial}</span></p>`;
}

function wordCellTd(inner) {
  return `<td width=${WORD_CELL_WIDTH_TWIPS} valign=top style='width:${WORD_CELL_WIDTH_CM}cm;width:${WORD_CELL_WIDTH_TWIPS};border:solid windowtext 1.0pt;mso-border-alt:solid windowtext .5pt;padding:4.0pt 3.0pt 4.0pt 3.0pt;vertical-align:top;'>${inner}</td>`;
}

function wordGuestCell(item, photoData) {
  if (!item) return wordCellTd('&nbsp;');
  const aff = getEventAffiliation(item.guest, item.att);
  const name = escapeHTML(item.guest.name);
  const org = escapeHTML(aff.organization);
  const title = escapeHTML(aff.title);
  const vip = escapeHTML(item.att.vipNotes || '');
  const vipLine = vip
    ? `<p align=center style='text-align:center;margin:2pt 0 0 0;font-size:9pt;color:#cc0000;font-family:"Microsoft JhengHei",sans-serif;'>${vip}</p>`
    : '';
  return wordCellTd(`
${wordPhotoHtml(photoData, item.guest.name)}
<p align=center style='text-align:center;margin:3pt 0 2pt 0;font-size:12pt;font-weight:bold;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;line-height:14pt;mso-line-height-rule:exactly;'>${name}</p>
<p align=center style='text-align:center;margin:1pt 0;font-size:10pt;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;line-height:12pt;mso-line-height-rule:exactly;'>${org}</p>
<p align=center style='text-align:center;margin:1pt 0 0 0;font-size:10pt;font-family:"Microsoft JhengHei","Noto Sans TC",sans-serif;line-height:12pt;mso-line-height-rule:exactly;'>${title}</p>
${vipLine}`);
}

export async function exportRecognitionWord(event, guests, attendance, { guestIds } = {}) {
  const guestMap = Object.fromEntries((guests || []).map((g) => [g.id, g]));
  const selectedSet = guestIds?.length ? new Set(guestIds) : null;
  const items = (attendance || [])
    .filter((a) => a.eventId === event?.id && ['attending', 'checked_in'].includes(a.status))
    .filter((a) => !selectedSet || selectedSet.has(a.guestId))
    .map((a) => ({ att: a, guest: guestMap[a.guestId] }))
    .filter((x) => x.guest);

  if (!items.length) {
    throw new Error(selectedSet ? '請先勾選要匯出的嘉賓' : '沒有可匯出的認人名單');
  }

  const photoCache = new Map();
  await Promise.all(items.map(async (item) => {
    const photo = await preparePhotoForWord(item.guest.photo);
    photoCache.set(item.guest.id, photo);
  }));

  let rows = '';
  for (let i = 0; i < items.length; i += WORD_COLS) {
    const chunk = items.slice(i, i + WORD_COLS);
    const rowNum = Math.floor(i / WORD_COLS);
    rows += `<tr style="mso-yfti-irow:${rowNum}">`;
    for (let j = 0; j < WORD_COLS; j++) {
      const item = chunk[j];
      rows += wordGuestCell(item, item ? photoCache.get(item.guest.id) : null);
    }
    rows += '</tr>';
  }

  const colgroup = Array.from({ length: WORD_COLS }, () =>
    `<col width=${WORD_CELL_WIDTH_TWIPS} style='mso-width-source:userset;mso-width-alt:${WORD_CELL_WIDTH_TWIPS * 20};width:${WORD_CELL_WIDTH_CM}cm'>`
  ).join('\n  ');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="EventFlow">
<!--[if gte mso 9]><xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml><![endif]-->
<style>
@page Section1 { size: 595.3pt 841.9pt; margin: 36pt 36pt 36pt 36pt; }
div.Section1 { page: Section1; }
table.MsoTable { border-collapse: collapse; mso-table-layout-alt: fixed; mso-yfti-tbllook: 1184; }
td.MsoCell { width: ${WORD_CELL_WIDTH_CM}cm; border: solid windowtext 1.0pt; padding: 4pt 3pt; vertical-align: top; }
</style>
</head>
<body>
<div class=Section1>
<p align=center style='text-align:center;font-size:18pt;font-weight:bold;font-family:"Microsoft JhengHei",sans-serif;margin:0 0 8pt 0;'>認人名單 — ${escapeHTML(event.name)}</p>
<p align=center style='text-align:center;font-size:10pt;color:#666666;font-family:"Microsoft JhengHei",sans-serif;margin:0 0 16pt 0;'>${escapeHTML(event.date || '')} · ${escapeHTML(event.venue || '')}</p>
<table class=MsoTable border=1 cellspacing=0 cellpadding=0
 style='border-collapse:collapse;border:none;mso-table-layout-alt:fixed;
 mso-yfti-tbllook:1184;mso-padding-alt:0cm 0cm 0cm 0cm;width:${WORD_TABLE_WIDTH_TWIPS};width:${WORD_TABLE_WIDTH_CM}cm;'>
 <colgroup>
  ${colgroup}
 </colgroup>
 ${rows}
</table>
</div>
</body>
</html>`;

  downloadBlob(
    new Blob(['\ufeff', html], { type: 'application/msword' }),
    `認人名單_${sanitizeFilename(event.name)}.doc`
  );
}

export const EXPORT_FILTERS = {
  all: { label: '完整出席名單', filter: () => true },
  draft: { label: '擬邀名單', filter: (a) => a.status === 'draft' },
  pending_invite: { label: '待發邀請名單', filter: (a) => a.status === 'pending_invite' },
  invited: { label: '已發邀請名單', filter: (a) => ['invited', 'pending_reply', 'attending', 'declined', 'waitlist', 'checked_in', 'no_show'].includes(a.status) },
  pending_reply: { label: '待回覆名單', filter: (a) => a.status === 'pending_reply' },
  attending: { label: '確認出席名單', filter: (a) => ['attending', 'checked_in'].includes(a.status) },
  declined: { label: '缺席婉拒名單', filter: (a) => a.status === 'declined' },
  checked_in: { label: '簽到名單', filter: (a) => a.status === 'checked_in' },
};
