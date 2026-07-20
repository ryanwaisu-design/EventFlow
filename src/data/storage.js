import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants';
import { createSeedData } from './seedData';
import {
  ensureGuestsAffiliations,
  getPrimaryAffiliation,
  buildInviteAffiliationFields,
} from '../utils/affiliations';

function safeParse(json, fallback) {
  try {
    if (!json) return fallback;
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readKey(key, fallback) {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadAllData() {
  const settings = { ...DEFAULT_SETTINGS, ...readKey(STORAGE_KEYS.settings, {}) };
  let guests = readKey(STORAGE_KEYS.guests, []);
  let events = readKey(STORAGE_KEYS.events, []);
  let attendance = readKey(STORAGE_KEYS.attendance, []);
  let seatingPlans = readKey(STORAGE_KEYS.seatingPlans, []);

  const isEmpty =
    (!Array.isArray(guests) || guests.length === 0) &&
    (!Array.isArray(events) || events.length === 0);

  if (isEmpty && settings.enableDemoData) {
    const seed = createSeedData();
    guests = seed.guests;
    events = seed.events;
    attendance = seed.attendance;
    saveAllData({ guests, events, attendance, seatingPlans, settings });
  }

  guests = ensureGuestsAffiliations(Array.isArray(guests) ? guests : []);
  const guestMap = Object.fromEntries(guests.map((g) => [g.id, g]));
  attendance = (Array.isArray(attendance) ? attendance : []).map((a) => {
    if (a.inviteOrganization || a.inviteTitle || a.affiliationId) return a;
    const guest = guestMap[a.guestId];
    if (!guest) return a;
    return { ...a, ...buildInviteAffiliationFields(getPrimaryAffiliation(guest)) };
  });

  return {
    guests,
    events: Array.isArray(events) ? events : [],
    attendance,
    seatingPlans: Array.isArray(seatingPlans) ? seatingPlans : [],
    settings,
  };
}

export function saveAllData({ guests, events, attendance, seatingPlans, settings }) {
  if (guests !== undefined) writeKey(STORAGE_KEYS.guests, guests);
  if (events !== undefined) writeKey(STORAGE_KEYS.events, events);
  if (attendance !== undefined) writeKey(STORAGE_KEYS.attendance, attendance);
  if (seatingPlans !== undefined) writeKey(STORAGE_KEYS.seatingPlans, seatingPlans);
  if (settings !== undefined) writeKey(STORAGE_KEYS.settings, settings);
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}

export function exportBackup(data) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      ...data,
    },
    null,
    2
  );
}

export function importBackup(jsonString) {
  const data = safeParse(jsonString, null);
  if (!data || typeof data !== 'object') {
    throw new Error('無效的備份檔案格式');
  }
  return {
    guests: Array.isArray(data.guests) ? data.guests : [],
    events: Array.isArray(data.events) ? data.events : [],
    attendance: Array.isArray(data.attendance) ? data.attendance : [],
    seatingPlans: Array.isArray(data.seatingPlans) ? data.seatingPlans : [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
  };
}
