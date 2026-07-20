import {
  getPrimaryAffiliation,
  findMatchingAffiliation,
  buildInviteAffiliationFields,
  formatAffiliationLabel,
  ensureGuestAffiliations,
  normalizeAffiliation,
} from './affiliations';
import { importGuestsFromExcel } from './export';

const NAME_KEYS = ['姓名', 'name', 'Name'];
const ORG_KEYS = ['所屬單位', '單位', '單位名稱', 'organization', 'Organization', 'Org'];
const TITLE_KEYS = ['職銜', '職務', 'title', 'Title'];

export const AFFILIATION_MISMATCH_ACTIONS = {
  eventOnly: 'eventOnly',
  addToMaster: 'addToMaster',
  usePrimary: 'usePrimary',
  skip: 'skip',
};

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
    title: pickField(row, TITLE_KEYS),
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

function pushMatched(target, row, guest, affiliation, existingGuestIdsInEvent) {
  const inviteFields = buildInviteAffiliationFields(affiliation);
  const entry = {
    ...row,
    guestId: guest.id,
    guest,
    inviteFields,
    affiliationLabel: formatAffiliationLabel(affiliation),
  };
  if (existingGuestIdsInEvent.has(guest.id)) {
    target.alreadyInEvent.push(entry);
  } else {
    target.toAdd.push(entry);
  }
}

/**
 * 將擬邀請名單與嘉賓主檔比對
 * 若 Excel 有單位／職銜，會對照嘉賓所有 affiliations；對不到則列入 affiliationMismatch
 */
export function resolveInvitationGuests(invitationRows, guests, existingGuestIdsInEvent = new Set()) {
  const toAdd = [];
  const notFound = [];
  const alreadyInEvent = [];
  const ambiguous = [];
  const affiliationMismatch = [];

  for (const row of invitationRows) {
    const candidates = guests.filter((g) => nameMatches(g.name || '', row.name));

    if (candidates.length === 0) {
      notFound.push(row);
      continue;
    }

    const hasOrgInfo = Boolean(row.organization || row.title);

    if (hasOrgInfo) {
      const withAff = candidates
        .map((g) => ({ guest: g, affiliation: findMatchingAffiliation(g, row.organization, row.title) }))
        .filter((x) => x.affiliation);

      if (withAff.length === 1) {
        pushMatched(
          { toAdd, alreadyInEvent },
          row,
          withAff[0].guest,
          withAff[0].affiliation,
          existingGuestIdsInEvent,
        );
        continue;
      }

      if (withAff.length > 1) {
        ambiguous.push({ ...row, matchCount: withAff.length });
        continue;
      }

      // 姓名找到，但單位／職銜對不到任何一組
      if (candidates.length === 1) {
        const guest = ensureGuestAffiliations(candidates[0]);
        affiliationMismatch.push({
          ...row,
          guestId: guest.id,
          guest,
          alreadyInEvent: existingGuestIdsInEvent.has(guest.id),
          primaryLabel: formatAffiliationLabel(getPrimaryAffiliation(guest)),
          masterAffiliations: guest.affiliations.map((a) => ({
            id: a.id,
            label: formatAffiliationLabel(a),
            isPrimary: Boolean(a.isPrimary),
          })),
        });
        continue;
      }

      ambiguous.push({ ...row, matchCount: candidates.length });
      continue;
    }

    if (candidates.length > 1) {
      ambiguous.push({ ...row, matchCount: candidates.length });
      continue;
    }

    pushMatched(
      { toAdd, alreadyInEvent },
      row,
      candidates[0],
      getPrimaryAffiliation(candidates[0]),
      existingGuestIdsInEvent,
    );
  }

  return { toAdd, notFound, alreadyInEvent, ambiguous, affiliationMismatch };
}

/**
 * 將單位差異的處理結果轉成邀請欄位（及可選的主檔更新）
 * @param {'eventOnly'|'addToMaster'|'usePrimary'|'skip'} action
 */
export function resolveAffiliationMismatchItem(item, action) {
  if (action === AFFILIATION_MISMATCH_ACTIONS.skip) {
    return { skip: true };
  }

  if (action === AFFILIATION_MISMATCH_ACTIONS.usePrimary) {
    const primary = getPrimaryAffiliation(item.guest);
    return {
      skip: false,
      guestId: item.guestId,
      alreadyInEvent: item.alreadyInEvent,
      inviteFields: buildInviteAffiliationFields(primary),
      affiliationLabel: formatAffiliationLabel(primary),
      guestUpdate: null,
      name: item.name,
      organization: item.organization,
      title: item.title,
    };
  }

  if (action === AFFILIATION_MISMATCH_ACTIONS.eventOnly) {
    const inviteFields = {
      affiliationId: '',
      inviteOrganization: item.organization || '',
      inviteTitle: item.title || '',
    };
    return {
      skip: false,
      guestId: item.guestId,
      alreadyInEvent: item.alreadyInEvent,
      inviteFields,
      affiliationLabel: formatAffiliationLabel(inviteFields),
      guestUpdate: null,
      name: item.name,
      organization: item.organization,
      title: item.title,
    };
  }

  // addToMaster
  const guest = ensureGuestAffiliations(item.guest);
  const newAff = normalizeAffiliation({
    organization: item.organization || '',
    title: item.title || '',
    isPrimary: false,
  });
  return {
    skip: false,
    guestId: item.guestId,
    alreadyInEvent: item.alreadyInEvent,
    inviteFields: buildInviteAffiliationFields(newAff),
    affiliationLabel: formatAffiliationLabel(newAff),
    guestUpdate: {
      affiliations: [...guest.affiliations, newAff],
    },
    name: item.name,
    organization: item.organization,
    title: item.title,
  };
}
