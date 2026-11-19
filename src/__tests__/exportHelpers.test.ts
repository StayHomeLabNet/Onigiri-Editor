import { describe, expect, it } from 'vitest';
import { inlineLocalImagesInHtml } from '../utils/exportHelpers';
import { exportMarkdownToDocxBytes } from '../utils/docxExport';

// 1x1 transparent PNG bytes as data URI
const TINY_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('export image embedding helpers', () => {
  it('inlines local images in HTML while keeping remote and data URIs untouched', async () => {
    const calls: string[] = [];
    const resolver = async (src: string) => {
      calls.push(src);
      if (src.includes('local.png')) return TINY_PNG_DATA_URI;
      return src;
    };

    const html = [
      '<p><img src="./assets/local.png" alt="local" /></p>',
      '<p><img src="./assets/local.png" alt="dup" /></p>',
      '<p><img src="https://example.com/remote.png" alt="remote" /></p>',
    ].join('');

    const out = await inlineLocalImagesInHtml(html, '/docs/note.md', resolver);
    expect(calls).toEqual(['./assets/local.png']);
    expect(out).toContain(`src="${TINY_PNG_DATA_URI}"`);
    expect(out).toContain('src="https://example.com/remote.png"');
  });

  it('embeds data URI and resolved local PNG images inside DOCX ZIP package', async () => {
    const md = [
      '# Report',
      '',
      '![Tiny](./assets/tiny.png)',
      '',
      'Paragraph after image.',
    ].join('\n');

    const bytes = await exportMarkdownToDocxBytes(md, {
      baseDir: '/docs/report.md',
      imageResolver: async () => TINY_PNG_DATA_URI,
    });

    // Verify ZIP local file header signature ("PK\x03\x04")
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    // Uncompressed STORE ZIP lets us inspect entry names & XML directly
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain('word/media/image1.png');
    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('word/_rels/document.xml.rels');
    expect(text).toContain('<w:drawing>');
    expect(text).toContain('Extension="png"');
  });
});
