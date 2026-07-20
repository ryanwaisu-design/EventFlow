export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function nowISO() {
  return new Date().toISOString();
}

export {
  getPrimaryAffiliation,
  getEventAffiliation,
  formatAffiliationLabel,
  ensureGuestAffiliations,
  ensureGuestsAffiliations,
  buildInviteAffiliationFields,
  findMatchingAffiliation,
  normalizeAffiliation,
} from './affiliations';

export function getInitials(name) {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0);
}

export function getAvatarColor(name) {
  const colors = [
    '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6',
    '#ec4899', '#06b6d4', '#ef4444', '#84cc16',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(content, filename, mime = 'text/plain') {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function compareByField(a, b, field, dir = 'asc') {
  const va = (a[field] || '').toString().toLowerCase();
  const vb = (b[field] || '').toString().toLowerCase();
  const cmp = va.localeCompare(vb, 'zh-Hant');
  return dir === 'desc' ? -cmp : cmp;
}

export function sanitizeFilename(name) {
  return (name || 'export').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}
