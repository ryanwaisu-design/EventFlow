export const PHOTO_SOURCE_MAX_AGE_YEARS = 2;

export function parsePhotoSourceDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 相片來源日期是否早於指定年數 */
export function isPhotoSourceOlderThan(value, years = PHOTO_SOURCE_MAX_AGE_YEARS, reference = new Date()) {
  const d = parsePhotoSourceDate(value);
  if (!d) return false;
  const cutoff = new Date(reference);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return d < cutoff;
}

/** 找出有相片且來源日期已超過年限的嘉賓 */
export function findGuestsWithStalePhotoSource(guestList, { guestIds, years = PHOTO_SOURCE_MAX_AGE_YEARS } = {}) {
  const idSet = guestIds?.length ? new Set(guestIds) : null;
  return (guestList || []).filter((g) => {
    if (idSet && !idSet.has(g.id)) return false;
    if (!g.photo) return false;
    return isPhotoSourceOlderThan(g.photoSourceDate, years);
  });
}

export function formatStalePhotoSourceMessage(guests) {
  if (!guests.length) return '';
  const lines = guests.map((g) => `· ${g.name}（來源日期：${g.photoSourceDate}）`);
  return `以下 ${guests.length} 位嘉賓的相片來源日期已超過 ${PHOTO_SOURCE_MAX_AGE_YEARS} 年，建議更新後再匯出：\n\n${lines.join('\n')}`;
}
