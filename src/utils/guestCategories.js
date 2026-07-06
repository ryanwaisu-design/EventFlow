import { GUEST_CATEGORIES } from '../data/constants';
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

  return {
    key,
    settings: {
      ...settings,
      customGuestCategories: { ...custom, [key]: trimmed },
    },
  };
}

export function removeCustomGuestCategory(settings, key) {
  if (GUEST_CATEGORIES[key]) return { error: 'builtin' };
  const custom = { ...(settings?.customGuestCategories || {}) };
  if (!custom[key]) return { error: 'missing' };
  const next = { ...custom };
  delete next[key];
  return {
    settings: { ...settings, customGuestCategories: next },
  };
}

export function listCustomGuestCategories(settings) {
  return Object.entries(settings?.customGuestCategories || {});
}
