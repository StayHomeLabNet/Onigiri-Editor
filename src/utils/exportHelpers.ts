import { resolveImageSrc } from './platform';

export type ImageSrcResolver = (src: string, baseDir?: string | null) => Promise<string>;

export function isRemoteOrInlineImageSrc(src: string): boolean {
  const s = (src || '').trim().toLowerCase();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  );
}

/**
 * Rewrites local `<img src="...">` elements in HTML to embedded `data:` URIs
 * so exported HTML files remain self-contained when opened anywhere.
 */
export async function inlineLocalImagesInHtml(
  html: string,
  baseDir?: string | null,
  resolver: ImageSrcResolver = resolveImageSrc
): Promise<string> {
  if (!html || !/<img\b/i.test(html)) return html;

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const imgs = Array.from(doc.body.querySelectorAll('img'));
    const cache = new Map<string, Promise<string>>();

    await Promise.all(
      imgs.map(async (img) => {
        const rawSrc = (img.getAttribute('src') || '').trim();
        if (!rawSrc || isRemoteOrInlineImageSrc(rawSrc)) return;
        let promise = cache.get(rawSrc);
        if (!promise) {
          promise = resolver(rawSrc, baseDir);
          cache.set(rawSrc, promise);
        }
        const resolved = await promise;
        if (resolved && resolved.startsWith('data:')) {
          img.setAttribute('src', resolved);
        }
      })
    );
    return doc.body.innerHTML;
  }

  return html;
}
