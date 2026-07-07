import { DEFAULT_GUEST_SUBCATEGORIES, GUEST_CATEGORIES } from '../data/constants';
import { generateId } from './helpers';

/** 內建類別 + 使用者自訂類別 */
export function getGuestCategories(settings) {
  const custom = settings?.customGuestCategories || {};
  return { ...GUEST_CATEGORIES, ...custom };
}

export function getGuestCategoryLabel(category, settings) {
  if (!category) return '其他';
  return getGuestCategories(settings)[category] || category;
}

/** 合併內建與自訂的次類別清單 */
export function getGuestSubcategories(settings, parentCategory) {
  if (!parentCategory) return [];
  const stored = settings?.guestCategorySubcategories?.[parentCategory];
  const defaults = DEFAULT_GUEST_SUBCATEGORIES[parentCategory] || [];
  const merged = [...defaults, ...(Array.isArray(stored) ? stored : [])];
  return [...new Set(merged.map((s) => s.trim()).filter(Boolean))];
}

export function formatGuestCategoryLabel(category, subcategory, settings) {
  const primary = getGuestCategoryLabel(category, settings);
  const sub = (subcategory || '').trim();
  return sub ? `${primary} · ${sub}` : primary;
}

function categoryKeyForLabel(label, categories) {
  const trimmed = label.trim();
  const existing = Object.entries(categories).find(([, v]) => v === trimmed);
  if (existing) return existing[0];

  const base = `cat_${trimmed.replace(/\s+/g, '_')}`;
  if (!categories[base]) return base;
  return `cat_${generateId().slice(0, 8)}`;
}

/** 新增自訂類別；若名稱已存在則回傳既有 key */
export function addCustomGuestCategory(settings, label) {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  const custom = { ...(settings?.customGuestCategories || {}) };
  const merged = { ...GUEST_CATEGORIES, ...custom };
  const key = categoryKeyForLabel(trimmed, merged);

  if (merged[key] === trimmed && custom[key] === undefined && GUEST_CATEGORIES[key]) {
    return { key, settings };
  }
  if (custom[key] === trimmed) {
    return { key, settings };
  }

  const subcategories = { ...(settings?.guestCategorySubcategories || {}) };
  if (!subcategories[key]) subcategories[key] = [];

  return {
    key,
    settings: {
      ...settings,
      customGuestCategories: { ...custom, [key]: trimmed },
      guestCategorySubcategories: subcategories,
    },
  };
}

/** 新增某主類別下的次類別選項 */
export function addGuestSubcategory(settings, parentCategory, label) {
  const trimmed = label?.trim();
  if (!parentCategory || !trimmed) return null;

  const current = getGuestSubcategories(settings, parentCategory);
  if (current.includes(trimmed)) {
    return { label: trimmed, settings };
  }

  const map = { ...(settings?.guestCategorySubcategories || {}) };
  const list = [...(map[parentCategory] || [])];
  list.push(trimmed);
  map[parentCategory] = list;

  return {
    label: trimmed,
    settings: { ...settings, guestCategorySubcategories: map },
  };
}

export function removeCustomGuestCategory(settings, key) {
  if (GUEST_CATEGORIES[key]) return { error: 'builtin' };
  const custom = { ...(settings?.customGuestCategories || {}) };
  if (!custom[key]) return { error: 'missing' };
  const next = { ...custom };
  delete next[key];
  const subcategories = { ...(settings?.guestCategorySubcategories || {}) };
  delete subcategories[key];
  return {
    settings: {
      ...settings,
      customGuestCategories: next,
      guestCategorySubcategories: subcategories,
    },
  };
}

export function removeGuestSubcategory(settings, parentCategory, label) {
  const trimmed = label?.trim();
  if (!parentCategory || !trimmed) return { error: 'invalid' };
  if ((DEFAULT_GUEST_SUBCATEGORIES[parentCategory] || []).includes(trimmed)) {
    return { error: 'builtin' };
  }

  const map = { ...(settings?.guestCategorySubcategories || {}) };
  const list = (map[parentCategory] || []).filter((s) => s !== trimmed);
  if (list.length === map[parentCategory]?.length) return { error: 'missing' };

  return {
    settings: {
      ...settings,
      guestCategorySubcategories: { ...map, [parentCategory]: list },
    },
  };
}

export function listCustomGuestCategories(settings) {
  return Object.entries(settings?.customGuestCategories || {});
}

export function listAllSubcategories(settings) {
  const categories = getGuestCategories(settings);
  return Object.keys(categories).flatMap((parentKey) =>
    getGuestSubcategories(settings, parentKey).map((label) => ({
      parentKey,
      parentLabel: categories[parentKey],
      label,
    })),
  );
}

/** 解析匯入的類別欄（支援「政府 / 行政會」或分欄） */
export function parseImportedGuestCategory(rawCategory, rawSubcategory, categories) {
  const cats = categories || GUEST_CATEGORIES;
  const categoryMap = Object.fromEntries(Object.entries(cats).map(([k, v]) => [v, k]));

  let subcategory = (rawSubcategory || '').trim();
  let primaryRaw = (rawCategory || '').trim();

  if (!subcategory && primaryRaw.includes('/')) {
    const parts = primaryRaw.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      primaryRaw = parts[0];
      subcategory = parts.slice(1).join(' / ');
    }
  }

  const category = categoryMap[primaryRaw] || primaryRaw || 'other';

  return {
    category: category || 'other',
    subcategory,
  };
}
