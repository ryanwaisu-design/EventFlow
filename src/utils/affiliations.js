function newAffiliationId() {
  return `aff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** 正規化單筆 affiliation，補上穩定 id */
export function normalizeAffiliation(aff = {}, { forcePrimary = false } = {}) {
  return {
    id: aff.id || newAffiliationId(),
    organization: aff.organization || '',
    title: aff.title || '',
    isPrimary: forcePrimary ? true : Boolean(aff.isPrimary),
  };
}

/** 確保嘉賓 affiliations 皆有 id，且至少一組主要 */
export function ensureGuestAffiliations(guest) {
  if (!guest) return guest;
  let affiliations = Array.isArray(guest.affiliations) ? guest.affiliations : [];
  if (!affiliations.length) {
    affiliations = [{ organization: '', title: '', isPrimary: true }];
  }
  affiliations = affiliations.map((a) => normalizeAffiliation(a));
  if (!affiliations.some((a) => a.isPrimary)) {
    affiliations = affiliations.map((a, i) => ({ ...a, isPrimary: i === 0 }));
  }
  return { ...guest, affiliations };
}

export function ensureGuestsAffiliations(guests) {
  return (guests || []).map(ensureGuestAffiliations);
}

export function getPrimaryAffiliation(guest) {
  const normalized = ensureGuestAffiliations(guest);
  const primary = normalized.affiliations.find((a) => a.isPrimary) || normalized.affiliations[0];
  return {
    id: primary?.id || '',
    organization: primary?.organization || '',
    title: primary?.title || '',
    isPrimary: true,
  };
}

export function formatAffiliationLabel(aff) {
  if (!aff) return '—';
  const org = (aff.organization || '').trim();
  const title = (aff.title || '').trim();
  if (org && title) return `${org}／${title}`;
  return org || title || '—';
}

/**
 * 本活動顯示用單位／職銜
 * 優先：出席記錄快照 → affiliationId → 主要身分
 */
export function getEventAffiliation(guest, attendance) {
  const inviteOrg = (attendance?.inviteOrganization ?? '').trim();
  const inviteTitle = (attendance?.inviteTitle ?? '').trim();
  if (inviteOrg || inviteTitle || attendance?.affiliationId) {
    if (inviteOrg || inviteTitle) {
      return {
        id: attendance?.affiliationId || '',
        organization: inviteOrg,
        title: inviteTitle,
        isPrimary: false,
        fromEvent: true,
      };
    }
  }

  const normalized = ensureGuestAffiliations(guest);
  if (attendance?.affiliationId) {
    const matched = normalized.affiliations.find((a) => a.id === attendance.affiliationId);
    if (matched) {
      return {
        id: matched.id,
        organization: matched.organization || '',
        title: matched.title || '',
        isPrimary: Boolean(matched.isPrimary),
        fromEvent: true,
      };
    }
  }

  return { ...getPrimaryAffiliation(normalized), fromEvent: false };
}

/** 由某一組 affiliation 產生出席記錄欄位 */
export function buildInviteAffiliationFields(affiliation) {
  if (!affiliation) {
    return { affiliationId: '', inviteOrganization: '', inviteTitle: '' };
  }
  return {
    affiliationId: affiliation.id || '',
    inviteOrganization: affiliation.organization || '',
    inviteTitle: affiliation.title || '',
  };
}

function normText(value) {
  return (value || '').trim().toLowerCase();
}

/** 在嘉賓多組單位中尋找最接近的一組 */
export function findMatchingAffiliation(guest, organization, title = '') {
  const normalized = ensureGuestAffiliations(guest);
  const orgKey = normText(organization);
  const titleKey = normText(title);
  if (!orgKey && !titleKey) return getPrimaryAffiliation(normalized);

  const exact = normalized.affiliations.find(
    (a) => normText(a.organization) === orgKey && (!titleKey || normText(a.title) === titleKey),
  );
  if (exact) return exact;

  if (orgKey) {
    const byOrg = normalized.affiliations.find((a) => normText(a.organization) === orgKey);
    if (byOrg) return byOrg;
  }

  return null;
}
