import { getPrimaryAffiliation } from './helpers';
import { importGuestsFromExcel } from './export';

const NAME_KEYS = ['姓名', 'name', 'Name'];
const ORG_KEYS = ['所屬單位', '單位', '單位名稱', 'organization', 'Organization', 'Org'];

function pickField(row, keys) {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

export function parseInvitationRow(row) {
  const name = pickField(row, NAME_KEYS);
  if (!name) return null;
  return {
    name,
    organization: pickField(row, ORG_KEYS),
  };
}

/** 解析 Excel 列，依姓名去重（保留首次出現） */
export function parseInvitationRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const parsed = parseInvitationRow(row);
    if (!parsed) continue;
    const key = parsed.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(parsed);
  }
  return result;
}

export async function readInvitationExcel(file) {
  const rows = await importGuestsFromExcel(file);
  return parseInvitationRows(rows);
}

function nameMatches(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function orgMatches(guest, org) {
  if (!org) return true;
  const aff = getPrimaryAffiliation(guest);
  return aff.organization?.trim().toLowerCase() === org.trim().toLowerCase();
}

/**
 * 將擬邀請名單與嘉賓主檔比對
 * @returns {{ toAdd: object[], notFound: object[], alreadyInEvent: object[], ambiguous: object[] }}
 */
export function resolveInvitationGuests(invitationRows, guests, existingGuestIdsInEvent = new Set()) {
  const toAdd = [];
  const notFound = [];
  const alreadyInEvent = [];
  const ambiguous = [];

  for (const row of invitationRows) {
    const candidates = guests.filter((g) => nameMatches(g.name || '', row.name));

    if (candidates.length === 0) {
      notFound.push(row);
      continue;
    }

    let matched = candidates;
    if (row.organization) {
      const byOrg = candidates.filter((g) => orgMatches(g, row.organization));
      if (byOrg.length === 1) matched = byOrg;
    }

    if (matched.length > 1) {
      ambiguous.push({ ...row, matchCount: matched.length });
      continue;
    }

    const guest = matched[0];
    if (existingGuestIdsInEvent.has(guest.id)) {
      alreadyInEvent.push({ ...row, guestId: guest.id });
    } else {
      toAdd.push({ ...row, guestId: guest.id, guest });
    }
  }

  return { toAdd, notFound, alreadyInEvent, ambiguous };
}
