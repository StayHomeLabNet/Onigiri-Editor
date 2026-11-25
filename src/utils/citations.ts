import { fetchUrlContent } from './platform';
import { formatLocalDateYmd } from './templates';

export interface UrlMetadata {
  url: string;
  title: string;
  description: string;
  siteName: string;
  domain: string;
  imageUrl?: string;
}

export interface BibtexEntry {
  entryType: string;
  citeKey: string;
  fields: Record<string, string>;
}

function resolveHttpImageUrl(raw: string, baseUrl: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
  } catch {
    // ignore invalid image URL
  }
  return '';
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function extractUrlMetadataFromHtml(html: string, url: string): UrlMetadata {
  let domain = '';
  try {
    domain = new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    domain = url;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const getMeta = (names: string[]): string => {
      for (const n of names) {
        const el =
          doc.querySelector(`meta[property="${n}"]`) ||
          doc.querySelector(`meta[name="${n}"]`);
        const content = el?.getAttribute('content')?.trim();
        if (content) return content;
      }
      return '';
    };

    const rawTitle =
      getMeta(['og:title', 'twitter:title']) ||
      doc.querySelector('title')?.textContent?.trim() ||
      domain ||
      url;
    const description = getMeta(['og:description', 'description', 'twitter:description']);
    const siteName = getMeta(['og:site_name']) || domain;
    const rawImage =
      getMeta(['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']) ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() ||
      doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')?.trim() ||
      '';
    const imageUrl = resolveHttpImageUrl(rawImage, url);
    return {
      url,
      title: rawTitle.replace(/\s+/g, ' ').trim(),
      description: description.replace(/\s+/g, ' ').trim(),
      siteName: siteName.trim(),
      domain,
      ...(imageUrl ? { imageUrl } : {}),
    };
  } catch {
    return {
      url,
      title: domain || url,
      description: '',
      siteName: domain,
      domain,
    };
  }
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  const res = await fetchUrlContent(url);
  return extractUrlMetadataFromHtml(res.html, res.finalUrl || url);
}

export function formatMarkdownLink(title: string, url: string): string {
  const safeTitle = title.replace(/[\[\]]/g, '').trim() || url;
  return `[${safeTitle}](${url})`;
}

export function formatMarkdownLinkCard(
  meta: UrlMetadata,
  options?: { includeThumbnail?: boolean }
): string {
  const title = meta.title.replace(/[\[\]]/g, '').trim() || meta.url;
  const lines: string[] = [];
  if (options?.includeThumbnail && meta.imageUrl) {
    lines.push(
      `> <img src="${escapeHtmlAttr(meta.imageUrl)}" alt="${escapeHtmlAttr(title)}" align="left" width="120" />`
    );
  }
  lines.push(`> **[${title}](${meta.url})**`);
  if (meta.description) {
    const trimmed =
      meta.description.length > 180
        ? `${meta.description.slice(0, 177).trim()}...`
        : meta.description;
    lines.push(`> ${trimmed}`);
  }
  lines.push(`> \`${meta.siteName || meta.domain}\``);
  return `${lines.join('\n')}\n`;
}

export function getNextFootnoteNumber(markdown: string): number {
  const re = /\[\^(\d+)\]/g;
  let max = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export function appendFootnoteDefinition(
  markdown: string,
  markerId: string,
  definitionBody: string
): string {
  const cleanDef = `[^${markerId}]: ${definitionBody.trim()}`;
  const trimmed = markdown.replace(/\s+$/, '');
  return trimmed ? `${trimmed}\n\n${cleanDef}\n` : `${cleanDef}\n`;
}

export function parseBibtex(input: string): BibtexEntry[] {
  const entries: BibtexEntry[] = [];
  const headerRe = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,/g;
  let match: RegExpExecArray | null;

  while ((match = headerRe.exec(input)) !== null) {
    const entryType = match[1].toLowerCase();
    const citeKey = match[2].trim();
    let idx = headerRe.lastIndex;
    let depth = 1;
    const bodyStart = idx;
    while (idx < input.length && depth > 0) {
      const ch = input[idx];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      idx++;
    }
    const body = input.slice(bodyStart, Math.max(bodyStart, idx - 1));
    const fields: Record<string, string> = {};

    let pos = 0;
    while (pos < body.length) {
      while (pos < body.length && /[\s,]/.test(body[pos])) pos++;
      if (pos >= body.length) break;
      const eqIdx = body.indexOf('=', pos);
      if (eqIdx < 0) break;
      const key = body.slice(pos, eqIdx).trim().toLowerCase();
      pos = eqIdx + 1;
      while (pos < body.length && /\s/.test(body[pos])) pos++;
      if (pos >= body.length) break;

      let value = '';
      if (body[pos] === '{') {
        pos++;
        let d = 1;
        const start = pos;
        while (pos < body.length && d > 0) {
          if (body[pos] === '{') d++;
          else if (body[pos] === '}') d--;
          pos++;
        }
        value = body.slice(start, Math.max(start, pos - 1));
      } else if (body[pos] === '"') {
        pos++;
        const start = pos;
        while (pos < body.length && body[pos] !== '"') {
          if (body[pos] === '\\' && pos + 1 < body.length) pos += 2;
          else pos++;
        }
        value = body.slice(start, pos);
        if (body[pos] === '"') pos++;
      } else {
        const start = pos;
        while (pos < body.length && body[pos] !== ',' && body[pos] !== '\n') pos++;
        value = body.slice(start, pos);
      }

      if (key) {
        fields[key] = value.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
      }
    }

    entries.push({ entryType, citeKey, fields });
    headerRe.lastIndex = idx;
  }

  return entries;
}

export function formatBibtexAsReference(
  entry: BibtexEntry,
  style: 'apa' | 'markdown' = 'apa'
): string {
  const f = entry.fields;
  const author = f.author ? f.author.replace(/\s+and\s+/gi, ', ') : 'Unknown';
  const year = f.year || 'n.d.';
  const title = f.title || entry.citeKey;
  const venue = f.journal || f.booktitle || f.publisher || '';
  const volPages = [
    f.volume ? `vol. ${f.volume}` : '',
    f.number ? `no. ${f.number}` : '',
    f.pages ? `pp. ${f.pages}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const doiUrl = f.doi
    ? `https://doi.org/${f.doi.replace(/^https?:\/\/doi\.org\//i, '')}`
    : f.url || '';

  if (style === 'markdown') {
    const parts = [author, `(${year})`, `**${title}**`];
    if (venue) parts.push(`*${venue}*`);
    if (volPages) parts.push(volPages);
    if (doiUrl) parts.push(`[${doiUrl}](${doiUrl})`);
    return parts.join('. ');
  }

  const parts = [`${author} (${year}). ${title}.`];
  if (venue) parts.push(`*${venue}*${volPages ? `, ${volPages}` : ''}.`);
  else if (volPages) parts.push(`${volPages}.`);
  if (doiUrl) parts.push(doiUrl);
  return parts.join(' ');
}

export function normalizeDoiInput(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^doi:\s*/i, '')
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function fetchBibtexByDoi(rawDoi: string): Promise<BibtexEntry> {
  const doi = normalizeDoiInput(rawDoi);
  if (!doi) {
    throw new Error('Invalid DOI format (expected e.g. 10.1145/1234567.1234568)');
  }
  const res = await fetchUrlContent(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const json = JSON.parse(res.html) as {
    message?: {
      type?: string;
      title?: string[];
      author?: Array<{ given?: string; family?: string; name?: string }>;
      'container-title'?: string[];
      publisher?: string;
      volume?: string;
      issue?: string;
      page?: string;
      published?: { 'date-parts'?: number[][] };
      issued?: { 'date-parts'?: number[][] };
      URL?: string;
    };
  };
  const m = json.message;
  if (!m) throw new Error('Crossref metadata not found');

  const authors = (m.author || [])
    .map((a) => (a.family && a.given ? `${a.family}, ${a.given}` : a.name || a.family || ''))
    .filter(Boolean);
  const yearNum =
    m.issued?.['date-parts']?.[0]?.[0] ||
    m.published?.['date-parts']?.[0]?.[0] ||
    new Date().getFullYear();
  const firstAuthorWord = (authors[0] || 'ref').split(/[\s,]+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'ref';
  const citeKey = `${firstAuthorWord}${yearNum}`;

  return {
    entryType: m.type === 'book' ? 'book' : m.type === 'proceedings-article' ? 'inproceedings' : 'article',
    citeKey,
    fields: {
      author: authors.join(' and ') || 'Unknown',
      title: (m.title && m.title[0]) || doi,
      journal: (m['container-title'] && m['container-title'][0]) || '',
      publisher: m.publisher || '',
      year: String(yearNum),
      volume: m.volume || '',
      number: m.issue || '',
      pages: m.page || '',
      doi,
      url: m.URL || `https://doi.org/${doi}`,
    },
  };
}

export function formatUrlCitationFootnote(meta: UrlMetadata): string {
  const today = formatLocalDateYmd();
  return `[${meta.title}](${meta.url}) (${meta.siteName || meta.domain}, accessed ${today})`;
}
