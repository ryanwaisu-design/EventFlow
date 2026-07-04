/** 觀眾席禮賓排序：1 在中間，偶數向右、奇數向左擴展 */
export function getAudienceProtocolSequence(n: number): number[] {
  const seq: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (i === 1) seq.push(i);
    else if (i % 2 === 0) seq.push(i);
    else seq.unshift(i);
  }
  return seq;
}

/** 台上 / 合影禮賓排序：1 在中間，偶數向左、奇數向右擴展 */
export function getStageProtocolSequence(n: number): number[] {
  const seq: number[] = [];
  for (let i = 1; i <= n; i++) {
    if (i === 1) seq.push(i);
    else if (i % 2 === 0) seq.unshift(i);
    else seq.push(i);
  }
  return seq;
}

/** 圓桌座位標籤：T{桌號}-{座位號}，順時針由頂部 12 點鐘起編 */
export function roundTableSeatLabel(tableNum: string | number, seat: {
  customNumber?: string | number;
  displayNumber: number;
}): string {
  const n = seat.customNumber ?? seat.displayNumber;
  return `T${tableNum}-${n}`;
}

/** 圓桌物理排位：0 = 12 點鐘，順時針遞增 */
export function roundTableClockwiseOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** @deprecated 僅供舊版相容；圓桌請用 roundTableClockwiseOrder */
export function centerOutOrder(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];

  const center = Math.floor((count - 1) / 2);
  const order: number[] = [center];
  let offset = 1;

  while (order.length < count) {
    const left = center - offset;
    const right = center + offset;
    if (left >= 0) order.push(left);
    if (order.length < count && right < count) order.push(right);
    offset++;
  }

  return order;
}

/** 長枱座位標籤：上排 A、下排 B、左側 C、右側 D（禮賓編號） */
export function longTableSeatLabel(seat: {
  side?: 0 | 1 | 2 | 3;
  customNumber?: string | number;
  displayNumber: number;
}): string {
  if (seat.side === undefined) return String(seat.customNumber ?? seat.displayNumber);
  const prefixes = ['A', 'B', 'C', 'D'] as const;
  const prefix = prefixes[seat.side] ?? 'A';
  return `${prefix}${seat.customNumber ?? seat.displayNumber}`;
}

/** 長枱上排（枱面上方）禮賓序：A7,A5,A3,A1,A2,A4,A6 */
export function getLongTableTopSequence(n: number): number[] {
  return getAudienceProtocolSequence(n);
}

/** 長枱下排（枱面下方）禮賓序：B6,B4,B2,B1,B3,B5,B7 */
export function getLongTableBottomSequence(n: number): number[] {
  return getStageProtocolSequence(n);
}

/** 依物理位置（左→右）排序 */
export function sortSeatsPhysical<T extends { index: number }>(seats: T[]): T[] {
  return [...seats].sort((a, b) => a.index - b.index);
}

/** 依 rank 排序嘉賓 */
export function sortGuestsByRank<T extends { rank: number }>(guests: T[]): T[] {
  return [...guests].sort((a, b) => a.rank - b.rank);
}

/** 依姓名長度計算座位字體大小 class */
export function nameFontClass(name: string): string {
  const len = name.length;
  const isLatin = /^[\x00-\x7F\s]+$/.test(name);
  if (isLatin) {
    if (len <= 10) return 'name-lg';
    if (len <= 16) return 'name-md';
    if (len <= 22) return 'name-sm';
    return 'name-xs';
  }
  if (len <= 3) return 'name-lg';
  if (len <= 5) return 'name-md';
  if (len <= 8) return 'name-sm';
  return 'name-xs';
}

/** 平面圖座位嘉賓姓名分行：中文 ≥4 字、英文兩個單詞各一行 */
export function formatSeatGuestName(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [''];

  const isLatin = /^[\x00-\x7F\s]+$/.test(trimmed);
  if (isLatin) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 2) return [words[0], words[1]];
    return [trimmed];
  }

  const chars = [...trimmed];
  if (chars.length >= 4) {
    const splitAt = Math.ceil(chars.length / 2);
    return [chars.slice(0, splitAt).join(''), chars.slice(splitAt).join('')];
  }
  return [trimmed];
}
