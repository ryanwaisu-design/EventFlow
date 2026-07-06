/** 正規化嘉賓姓名以便比對 */
export function normalizeGuestName(name) {
  return (name || '').trim().replace(/\s+/g, '');
}

/** 在現有嘉賓中找出與指定姓名重複者（編輯時可排除自己） */
export function findExistingDuplicateNames(names, guests, excludeGuestId) {
  const existing = new Set(
    (guests || [])
      .filter((g) => g.id !== excludeGuestId)
      .map((g) => normalizeGuestName(g.name))
      .filter(Boolean),
  );
  const seen = new Set();
  const duplicates = [];
  for (const name of names || []) {
    const key = normalizeGuestName(name);
    if (!key || seen.has(key)) continue;
    if (existing.has(key)) {
      seen.add(key);
      duplicates.push(name.trim());
    }
  }
  return duplicates;
}

/** 匯入清單內的重複姓名 */
export function findInternalDuplicateNames(names) {
  const counts = new Map();
  for (const name of names || []) {
    const key = normalizeGuestName(name);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicates = [];
  const added = new Set();
  for (const name of names || []) {
    const key = normalizeGuestName(name);
    if (!key || added.has(key)) continue;
    if ((counts.get(key) || 0) > 1) {
      added.add(key);
      duplicates.push(name.trim());
    }
  }
  return duplicates;
}

export function analyzeImportDuplicateNames(parsedGuests, existingGuests) {
  const names = parsedGuests.map((g) => g.name);
  const existingMatches = findExistingDuplicateNames(names, existingGuests);
  const internalMatches = findInternalDuplicateNames(names);
  const all = [...new Set([...existingMatches, ...internalMatches])];
  return { existingMatches, internalMatches, all };
}

export function formatDuplicateNamesMessage(duplicateNames, { action = '新增' } = {}) {
  const list = duplicateNames.join('、');
  if (action === '匯入') {
    return `系統發現以下姓名與現有資料重複或於匯入檔案中重複：${list}。是否仍要匯入？`;
  }
  return `系統發現已有同名嘉賓「${list}」，是否仍要新增？`;
}
