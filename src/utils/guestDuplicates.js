/** 正規化嘉賓姓名以便比對 */
export function normalizeGuestName(name) {
  return (name || '').trim().replace(/\s+/g, '');
}

function displayValue(value) {
  const v = (value || '').trim();
  return v || '—';
}

/** 嘉賓摘要：姓名、單位、職銜 */
export function guestAffiliationSummary(guest, getPrimaryAffiliation) {
  const aff = getPrimaryAffiliation(guest);
  return {
    name: displayValue(guest?.name),
    organization: displayValue(aff.organization),
    title: displayValue(aff.title),
  };
}

/** 在現有嘉賓中找出同名者 */
export function findExistingGuestsByName(name, guests, excludeGuestId) {
  const key = normalizeGuestName(name);
  if (!key) return [];
  return (guests || []).filter(
    (g) => g.id !== excludeGuestId && normalizeGuestName(g.name) === key,
  );
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

/** 單一新增時的現有／新增嘉賓對照 */
export function buildDuplicateCompareForAdd(newGuest, existingGuests, getPrimaryAffiliation) {
  const existing = findExistingGuestsByName(newGuest.name, existingGuests);
  return [{
    name: newGuest.name?.trim() || '',
    existing: existing.map((g) => guestAffiliationSummary(g, getPrimaryAffiliation)),
    incoming: [guestAffiliationSummary(newGuest, getPrimaryAffiliation)],
  }];
}

/** 匯入時的現有／匯入嘉賓對照（按重複姓名分組） */
export function buildDuplicateCompareForImport(parsedGuests, existingGuests, getPrimaryAffiliation) {
  const { all } = analyzeImportDuplicateNames(parsedGuests, existingGuests);
  return all.map((name) => {
    const key = normalizeGuestName(name);
    const existing = findExistingGuestsByName(name, existingGuests);
    const incoming = parsedGuests
      .filter((g) => normalizeGuestName(g.name) === key)
      .map((g) => guestAffiliationSummary(g, getPrimaryAffiliation));
    return {
      name,
      existing: existing.map((g) => guestAffiliationSummary(g, getPrimaryAffiliation)),
      incoming,
    };
  });
}

/** 匯入時以同名現有嘉賓為準進行取代規劃 */
export function planImportWithReplace(incomingGuests, existingGuests) {
  const existingByName = new Map();
  for (const g of existingGuests || []) {
    const key = normalizeGuestName(g.name);
    if (key && !existingByName.has(key)) existingByName.set(key, g);
  }

  const updates = [];
  const toAdd = [];
  const replacedKeys = new Set();
  const addedKeys = new Set();

  for (const incoming of incomingGuests || []) {
    const key = normalizeGuestName(incoming.name);
    if (!key) continue;

    const existing = existingByName.get(key);
    if (existing && !replacedKeys.has(key)) {
      updates.push({ id: existing.id, data: incoming });
      replacedKeys.add(key);
      continue;
    }
    if (existing) continue;

    if (addedKeys.has(key)) continue;
    toAdd.push(incoming);
    addedKeys.add(key);
  }

  return { updates, toAdd };
}
