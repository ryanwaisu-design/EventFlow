import { isImageUrl } from './imageUtils';

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function parseDateFromText(text) {
  if (!text) return '';
  const patterns = [
    /(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})/,
    /(20\d{2})-(\d{2})-(\d{2})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const y = m[1];
      const mo = String(m[2]).padStart(2, '0');
      const d = String(m[3]).padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }
  }
  return '';
}

export function parseImagesFromHtml(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title =
    doc.querySelector('meta[property="og:title"]')?.content ||
    doc.querySelector('title')?.textContent ||
    '';
  const sourceName =
    doc.querySelector('meta[property="og:site_name"]')?.content ||
    (pageUrl ? new URL(pageUrl).hostname : '');
  const dateText =
    doc.querySelector('meta[property="article:published_time"]')?.content ||
    doc.querySelector('time')?.getAttribute('datetime') ||
    doc.querySelector('time')?.textContent ||
    title;
  const photoSourceDate = parseDateFromText(dateText);

  const candidates = new Set();

  const og = doc.querySelector('meta[property="og:image"]')?.content;
  if (og) candidates.add(resolveUrl(pageUrl, og));

  doc.querySelector('meta[property="twitter:image"]')?.content &&
    candidates.add(resolveUrl(pageUrl, doc.querySelector('meta[property="twitter:image"]').content));

  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    const w = parseInt(img.getAttribute('width') || '0', 10);
    const h = parseInt(img.getAttribute('height') || '0', 10);
    if ((w && w < 80) || (h && h < 80)) return;
    if (/icon|logo|avatar|qr|banner-ad/i.test(src)) return;
    candidates.add(resolveUrl(pageUrl, src));
  });

  const images = [...candidates]
    .filter((u) => u && !u.endsWith('.svg'))
    .slice(0, 8)
    .map((url) => ({
      url,
      title: title.slice(0, 120),
      sourceName,
      sourceUrl: pageUrl,
      sourceDate: photoSourceDate,
    }));

  return { title, sourceName, photoSourceDate, images };
}

async function fetchViaProxy(url, proxyTemplate) {
  const proxyUrl = proxyTemplate.includes('{url}')
    ? proxyTemplate.replace('{url}', encodeURIComponent(url))
    : `${proxyTemplate}${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('無法讀取網頁內容');
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return json.contents || json.data || '';
  }
  return res.text();
}

export async function extractFromUrl(inputUrl, settings) {
  const trimmed = inputUrl?.trim();
  if (!trimmed) throw new Error('請輸入連結');

  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  if (isImageUrl(url)) {
    return {
      images: [{
        url,
        title: '直接圖片連結',
        sourceName: new URL(url).hostname,
        sourceUrl: url,
        sourceDate: '',
      }],
      title: '圖片連結',
      sourceName: new URL(url).hostname,
      photoSourceDate: '',
    };
  }

  let html = '';
  try {
    const direct = await fetch(url, { mode: 'cors' });
    if (direct.ok) html = await direct.text();
  } catch {
    /* try proxy */
  }

  if (!html && settings?.corsProxyUrl) {
    html = await fetchViaProxy(url, settings.corsProxyUrl);
  }

  if (!html) {
    throw new Error('無法讀取網頁（CORS 限制）。請在設定中配置 CORS Proxy，或改用手動上傳 / 直接貼圖片連結');
  }

  return parseImagesFromHtml(html, url);
}

export function filterImagesByRecency(images, primaryMonths, fallbackMonths) {
  const now = new Date();
  const within = (months) => (img) => {
    if (!img.sourceDate) return months === fallbackMonths;
    const d = new Date(img.sourceDate);
    if (Number.isNaN(d.getTime())) return months === fallbackMonths;
    const diffMonths = (now - d) / (1000 * 60 * 60 * 24 * 30);
    return diffMonths <= months;
  };

  let filtered = images.filter(within(primaryMonths));
  if (filtered.length < 2) {
    filtered = images.filter(within(fallbackMonths));
  }
  return filtered.length ? filtered : images;
}
