import { canUseEngine, incrementQuota } from './searchQuota';
import { getPrimaryAffiliation } from './helpers';
import { filterImagesByRecency } from './urlExtract';

function buildQueries(guest, region) {
  const aff = getPrimaryAffiliation(guest);
  const name = guest?.name?.trim() || '';
  const org = aff.organization?.trim() || '';
  const title = aff.title?.trim() || '';
  const base = [name, org, title].filter(Boolean).join(' ');

  if (region === 'mainland') {
    return [
      `${base} site:gov.cn`,
      `${base} ${org} 出席`,
      `${base} 活动`,
      `${base}`,
    ];
  }

  return [
    `${base} site:gov.mo`,
    `${base} 澳門 出席`,
    `${base} 澳门 活动`,
    `${base}`,
  ];
}

function parseCseItems(data) {
  return (data?.items || []).map((item) => {
    const thumb = item.pagemap?.cse_image?.[0]?.src || item.pagemap?.cse_thumbnail?.[0]?.src || '';
    const img = thumb || item.link;
    return {
      url: img,
      title: item.title || '',
      sourceName: item.displayLink || '',
      sourceUrl: item.link || '',
      sourceDate: parseDateFromSnippet(item.snippet || item.title || ''),
    };
  }).filter((x) => x.url);
}

function parseDateFromSnippet(text) {
  const m = text.match(/(20\d{2})[年\-/.](\d{1,2})[月\-/.]?(\d{1,2})?/);
  if (!m) return '';
  const y = m[1];
  const mo = String(m[2]).padStart(2, '0');
  const d = String(m[3] || '01').padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

async function googleCseSearch(query, settings) {
  const check = canUseEngine('google', settings);
  if (!check.allowed) throw new Error(check.reason);

  const key = settings.googleCseApiKey?.trim();
  const cx = settings.googleCseCx?.trim();
  if (!key || !cx) throw new Error('請在系統設定中配置 Google Custom Search API Key 與 CX');

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: '5',
    dateRestrict: `y${Math.ceil((settings.photoSearchFallbackMonths || 24) / 12)}`,
    lr: 'lang_zh-CN|lang_zh-TW',
  });

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Google 搜尋失敗');
  }
  incrementQuota('google');
  const data = await res.json();
  return parseCseItems(data);
}

export async function searchGuestPhotos(guest, settings) {
  if (!settings?.enablePhotoSearch) {
    throw new Error('請在系統設定中啟用「網路相片搜尋」');
  }

  const region = guest?.photoRegion || settings.defaultGuestRegion || 'macau';
  const queries = buildQueries(guest, region);
  const primaryMonths = settings.photoSearchPrimaryMonths || 12;
  const fallbackMonths = settings.photoSearchFallbackMonths || 24;

  const all = [];
  const seen = new Set();

  for (const q of queries) {
    if (all.length >= 6) break;
    try {
      const check = canUseEngine('google', settings);
      if (!check.allowed) break;
      const results = await googleCseSearch(q, settings);
      for (const r of results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        all.push(r);
      }
    } catch (e) {
      if (all.length) break;
      throw e;
    }
  }

  if (!all.length) {
    throw new Error('未找到合適相片，請改用手動上傳或貼上文章連結');
  }

  const filtered = filterImagesByRecency(all, primaryMonths, fallbackMonths);
  return filtered.slice(0, 6);
}
