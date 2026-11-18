import { htmlToMarkdown } from './markdown';

function sanitizeFileSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return cleaned || 'web-clip';
}

function resolveMaybeRelativeUrl(rawUrl: string, baseUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('data:') || trimmed.startsWith('javascript:')) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return trimmed;
  }
}

function extractTitleFallback(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function extractMainHtmlFallback(html: string): string {
  let cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '');

  const articleMatch = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch && articleMatch[1].trim().length > 100) {
    return articleMatch[1];
  }
  const mainMatch = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && mainMatch[1].trim().length > 100) {
    return mainMatch[1];
  }
  const bodyMatch = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : cleaned;
}

export function clipHtmlToMarkdown(
  rawHtml: string,
  finalUrl: string,
  options?: { includeFrontmatter?: boolean; dateStr?: string }
): { title: string; markdown: string; suggestedFileName: string } {
  const includeFrontmatter = options?.includeFrontmatter ?? true;
  const dateStr = options?.dateStr || new Date().toISOString().slice(0, 10);

  let title = '';
  let contentHtml = '';

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      doc.querySelector('h1')?.textContent?.trim() ||
      '';

    const noiseSelectors = [
      'script',
      'style',
      'noscript',
      'iframe',
      'svg',
      'nav',
      'footer',
      'aside',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.sidebar',
      '.breadcrumb',
      '.toc',
      '.cookie-banner',
    ];
    for (const sel of noiseSelectors) {
      doc.querySelectorAll(sel).forEach((el) => el.remove());
    }

    const candidate =
      doc.querySelector('article') ||
      doc.querySelector('main') ||
      doc.querySelector('[role="main"]') ||
      doc.body ||
      doc.documentElement;

    if (candidate) {
      candidate.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href) a.setAttribute('href', resolveMaybeRelativeUrl(href, finalUrl));
      });
      candidate.querySelectorAll('img[src]').forEach((img) => {
        const src = img.getAttribute('src');
        if (src) img.setAttribute('src', resolveMaybeRelativeUrl(src, finalUrl));
      });
      contentHtml = candidate.innerHTML;
    }
  } else {
    title = extractTitleFallback(rawHtml);
    contentHtml = extractMainHtmlFallback(rawHtml);
  }

  let bodyMd = htmlToMarkdown(contentHtml || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!title) {
    try {
      title = new URL(finalUrl).hostname;
    } catch {
      title = 'Web Clip';
    }
  }

  const safeTitleYaml = title.replace(/"/g, '\\"');
  const frontmatter = includeFrontmatter
    ? `---\ntitle: "${safeTitleYaml}"\nsource: ${finalUrl}\nclipped_at: ${dateStr}\ntags: [web-clip]\n---\n\n`
    : '';

  const hasH1 = /^#\s+/m.test(bodyMd);
  const headingPrefix = hasH1 ? '' : `# ${title}\n\n`;
  const markdown = `${frontmatter}${headingPrefix}${bodyMd}\n`;
  const suggestedFileName = `${sanitizeFileSlug(title)}.md`;

  return {
    title,
    markdown,
    suggestedFileName,
  };
}
