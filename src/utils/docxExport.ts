import { renderMarkdownToHtml, splitFrontmatter } from './markdown';
import { resolveImageSrc } from './platform';
import type { ImageSrcResolver } from './exportHelpers';

export interface DocxExportOptions {
  baseDir?: string | null;
  imageResolver?: ImageSrcResolver;
}

/* ---------------------------- Minimal ZIP Builder ---------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
  name: string;
  data: Uint8Array;
}

function buildStoredZip(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const localHdr = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHdr.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // method: stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0x5421, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHdr.set(nameBytes, 30);

    localParts.push(localHdr, data);

    // Central directory header (46 bytes + filename)
    const centralHdr = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHdr.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHdr.set(nameBytes, 46);
    centralParts.push(centralHdr);

    offset += localHdr.length + data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const totalLen = centralStart + centralSize + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.length;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.length;
  }
  out.set(eocd, pos);
  return out;
}

/* ----------------------------- OOXML Helpers ----------------------------- */

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface InlineRunStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  linkHref?: string;
}

interface DocxEmbeddedImage {
  rId: string;
  target: string; // e.g. media/image1.png
  ext: string;
  mime: string;
  data: Uint8Array;
  cx: number; // EMUs
  cy: number; // EMUs
  docPrId: number;
  name: string;
}

interface DocxContext {
  hyperlinks: Array<{ id: string; url: string }>;
  images: Map<HTMLElement, DocxEmbeddedImage>;
  mediaList: DocxEmbeddedImage[];
  nextRelNum: number;
}

function renderDrawingRunXml(img: DocxEmbeddedImage): string {
  const safeName = xmlEscape(img.name || 'Image');
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${img.cx}" cy="${img.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${img.docPrId}" name="${safeName}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${img.docPrId}" name="${safeName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${img.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function renderRunXml(text: string, style: InlineRunStyle): string {
  if (!text) return '';
  const props: string[] = [];
  if (style.bold) props.push('<w:b/>');
  if (style.italic) props.push('<w:i/>');
  if (style.strike) props.push('<w:strike/>');
  if (style.code) {
    props.push(
      '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="MS Gothic"/>',
      '<w:sz w:val="20"/>',
      '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>'
    );
  }
  if (style.linkHref) {
    props.push('<w:color w:val="0969DA"/>', '<w:u w:val="single"/>');
  }
  const rPr = props.length > 0 ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  const parts = text.split('\n');
  const inner = parts
    .map((part, idx) => {
      const spaceAttr = /^\s|\s$/.test(part) ? ' xml:space="preserve"' : '';
      const t = `<w:t${spaceAttr}>${xmlEscape(part)}</w:t>`;
      return idx === 0 ? t : `<w:br/>${t}`;
    })
    .join('');
  return `<w:r>${rPr}${inner}</w:r>`;
}

function collectInlineRuns(node: Node, style: InlineRunStyle, ctx: DocxContext): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return renderRunXml(node.textContent || '', style);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    return '<w:r><w:br/></w:r>';
  }
  if (tag === 'img') {
    const embedded = ctx.images.get(el);
    if (embedded) {
      return renderDrawingRunXml(embedded);
    }
    const alt = el.getAttribute('alt') || el.getAttribute('src') || 'image';
    return renderRunXml(`[Image: ${alt}]`, style);
  }
  if (tag === 'input' && (el as HTMLInputElement).type === 'checkbox') {
    const checked = (el as HTMLInputElement).checked || el.hasAttribute('checked');
    return renderRunXml(checked ? '☑ ' : '☐ ', style);
  }

  const nextStyle: InlineRunStyle = { ...style };
  if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
  if (tag === 'em' || tag === 'i') nextStyle.italic = true;
  if (tag === 'del' || tag === 's') nextStyle.strike = true;
  if (tag === 'code') nextStyle.code = true;

  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    const innerRuns = Array.from(el.childNodes)
      .map((c) => collectInlineRuns(c, { ...nextStyle, linkHref: href }, ctx))
      .join('');
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
      const rId = `rId${ctx.nextRelNum++}`;
      ctx.hyperlinks.push({ id: rId, url: href });
      return `<w:hyperlink r:id="${rId}" w:history="1">${innerRuns}</w:hyperlink>`;
    }
    return innerRuns;
  }

  return Array.from(el.childNodes)
    .map((c) => collectInlineRuns(c, nextStyle, ctx))
    .join('');
}

function renderParagraphXml(
  innerRuns: string,
  opts?: {
    styleId?: string;
    indentLeftTwips?: number;
    borderLeft?: boolean;
    shadingFill?: string;
    spacingAfter?: number;
  }
): string {
  const pPr: string[] = [];
  if (opts?.styleId) pPr.push(`<w:pStyle w:val="${xmlEscape(opts.styleId)}"/>`);
  if (opts?.indentLeftTwips) {
    pPr.push(`<w:ind w:left="${opts.indentLeftTwips}"/>`);
  }
  if (opts?.borderLeft) {
    pPr.push(
      '<w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="3B82F6"/></w:pBdr>'
    );
  }
  if (opts?.shadingFill) {
    pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shadingFill}"/>`);
  }
  if (opts?.spacingAfter !== undefined) {
    pPr.push(`<w:spacing w:after="${opts.spacingAfter}"/>`);
  }
  const pPrXml = pPr.length > 0 ? `<w:pPr>${pPr.join('')}</w:pPr>` : '';
  return `<w:p>${pPrXml}${innerRuns}</w:p>`;
}

function convertElementToDocxBlocks(
  el: HTMLElement,
  ctx: DocxContext,
  depth = 0
): string[] {
  const tag = el.tagName.toLowerCase();
  const blocks: string[] = [];

  if (/^h[1-6]$/.test(tag)) {
    const level = tag.slice(1);
    const runs = Array.from(el.childNodes)
      .map((c) => collectInlineRuns(c, {}, ctx))
      .join('');
    blocks.push(renderParagraphXml(runs, { styleId: `Heading${level}`, spacingAfter: 120 }));
    return blocks;
  }

  if (tag === 'p') {
    const runs = Array.from(el.childNodes)
      .map((c) => collectInlineRuns(c, {}, ctx))
      .join('');
    blocks.push(renderParagraphXml(runs, { spacingAfter: 140 }));
    return blocks;
  }

  if (tag === 'hr') {
    blocks.push(
      '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr></w:pPr></w:p>'
    );
    return blocks;
  }

  if (tag === 'pre') {
    const codeText = (el.textContent || '').replace(/\r\n/g, '\n');
    const lines = codeText.split('\n');
    const runs = lines
      .map((line, i) => {
        const prefix = i > 0 ? '<w:br/>' : '';
        const spaceAttr = /^\s|\s$/.test(line) ? ' xml:space="preserve"' : '';
        return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:eastAsia="MS Gothic"/><w:sz w:val="19"/></w:rPr>${prefix}<w:t${spaceAttr}>${xmlEscape(line)}</w:t></w:r>`;
      })
      .join('');
    blocks.push(
      `<w:p><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="6" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="8" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="6" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="8" w:color="CBD5E1"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/><w:spacing w:before="80" w:after="160"/></w:pPr>${runs}</w:p>`
    );
    return blocks;
  }

  if (tag === 'blockquote') {
    for (const child of Array.from(el.children)) {
      const innerRuns = Array.from(child.childNodes)
        .map((c) => collectInlineRuns(c, {}, ctx))
        .join('');
      if (innerRuns) {
        blocks.push(
          renderParagraphXml(innerRuns, {
            indentLeftTwips: 420,
            borderLeft: true,
            shadingFill: 'F8FAFC',
            spacingAfter: 120,
          })
        );
      }
    }
    if (blocks.length === 0) {
      const runs = Array.from(el.childNodes)
        .map((c) => collectInlineRuns(c, {}, ctx))
        .join('');
      blocks.push(
        renderParagraphXml(runs, {
          indentLeftTwips: 420,
          borderLeft: true,
          shadingFill: 'F8FAFC',
          spacingAfter: 120,
        })
      );
    }
    return blocks;
  }

  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol';
    let idx = 1;
    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() !== 'li') continue;
      const prefix = isOrdered ? `${idx++}. ` : '• ';
      const inlineNodes: Node[] = [];
      const nestedLists: HTMLElement[] = [];
      for (const liChild of Array.from(child.childNodes)) {
        if (
          liChild.nodeType === Node.ELEMENT_NODE &&
          ['ul', 'ol'].includes((liChild as HTMLElement).tagName.toLowerCase())
        ) {
          nestedLists.push(liChild as HTMLElement);
        } else {
          inlineNodes.push(liChild);
        }
      }
      const runs =
        renderRunXml(prefix, {}) +
        inlineNodes.map((n) => collectInlineRuns(n, {}, ctx)).join('');
      blocks.push(
        renderParagraphXml(runs, {
          indentLeftTwips: 360 + depth * 320,
          spacingAfter: 80,
        })
      );
      for (const nested of nestedLists) {
        blocks.push(...convertElementToDocxBlocks(nested, ctx, depth + 1));
      }
    }
    return blocks;
  }

  if (tag === 'table') {
    const rows = Array.from(el.querySelectorAll('tr'));
    if (rows.length === 0) return blocks;
    const rowXml = rows
      .map((tr) => {
        const cells = Array.from(tr.children).filter((c) =>
          ['th', 'td'].includes(c.tagName.toLowerCase())
        );
        const cellsXml = cells
          .map((cell) => {
            const isTh = cell.tagName.toLowerCase() === 'th';
            const runs = Array.from(cell.childNodes)
              .map((c) => collectInlineRuns(c, { bold: isTh }, ctx))
              .join('');
            const shd = isTh ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>' : '';
            return `<w:tc><w:tcPr>${shd}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="130" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="130" w:type="dxa"/></w:tcMar></w:tcPr>${renderParagraphXml(runs, { spacingAfter: 0 })}</w:tc>`;
          })
          .join('');
        return `<w:tr>${cellsXml}</w:tr>`;
      })
      .join('');
    blocks.push(
      `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/></w:tblBorders></w:tblPr>${rowXml}</w:tbl>`
    );
    return blocks;
  }

  for (const child of Array.from(el.children)) {
    blocks.push(...convertElementToDocxBlocks(child as HTMLElement, ctx, depth));
  }
  return blocks;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Yu Gothic"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1F2328"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="120" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr><w:b/><w:color w:val="57606A"/></w:rPr>
  </w:style>
</w:styles>`;

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/is);
  if (!m) return null;
  const mime = (m[1] || 'application/octet-stream').toLowerCase();
  const isB64 = Boolean(m[2]);
  const payload = m[3] || '';
  try {
    if (isB64) {
      const bin = atob(payload.replace(/\s+/g, ''));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return { mime, bytes: out };
    }
    const decoded = decodeURIComponent(payload);
    return { mime, bytes: new TextEncoder().encode(decoded) };
  } catch {
    return null;
  }
}

function readImageDimensionsFromBytes(
  mime: string,
  bytes: Uint8Array
): { width: number; height: number } | null {
  // PNG IHDR
  if (
    mime === 'image/png' &&
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0) return { width, height };
  }
  // GIF87a / GIF89a
  if (mime === 'image/gif' && bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    if (width > 0 && height > 0) return { width, height };
  }
  // JPEG SOF0/SOF1/SOF2
  if (mime === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      if (len < 2 || i + 2 + len > bytes.length) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6];
        const width = (bytes[i + 7] << 8) | bytes[i + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function loadImageDimensionsAndMaybePng(
  dataUrl: string,
  mime: string,
  rawBytes: Uint8Array
): Promise<{ ext: string; mime: string; bytes: Uint8Array; width: number; height: number } | null> {
  const nativeExtMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  };

  const nativeExt = nativeExtMap[mime];
  const headerDims = nativeExt ? readImageDimensionsFromBytes(mime === 'image/jpg' ? 'image/jpeg' : mime, rawBytes) : null;

  // For formats Word doesn't universally support natively (svg/webp/avif), convert via canvas when available
  const needsCanvasConvert = !nativeExt;
  if (typeof Image !== 'undefined' && (needsCanvasConvert || !headerDims)) {
    const imgResult = await new Promise<{ width: number; height: number; pngBytes?: Uint8Array } | null>((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 1500);
      img.onload = () => {
        clearTimeout(timer);
        const w = img.naturalWidth || 480;
        const h = img.naturalHeight || 320;
        if (!needsCanvasConvert) {
          resolve({ width: w, height: h });
          return;
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const pngUrl = canvas.toDataURL('image/png');
          const decoded = decodeDataUrl(pngUrl);
          if (!decoded) {
            resolve(null);
            return;
          }
          resolve({ width: w, height: h, pngBytes: decoded.bytes });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = dataUrl;
    });

    if (imgResult) {
      if (needsCanvasConvert && imgResult.pngBytes) {
        return {
          ext: 'png',
          mime: 'image/png',
          bytes: imgResult.pngBytes,
          width: imgResult.width,
          height: imgResult.height,
        };
      }
      if (nativeExt) {
        return {
          ext: nativeExt,
          mime: mime === 'image/jpg' ? 'image/jpeg' : mime,
          bytes: rawBytes,
          width: imgResult.width,
          height: imgResult.height,
        };
      }
    }
  }

  if (nativeExt) {
    return {
      ext: nativeExt,
      mime: mime === 'image/jpg' ? 'image/jpeg' : mime,
      bytes: rawBytes,
      width: headerDims?.width ?? 480,
      height: headerDims?.height ?? 320,
    };
  }
  return null;
}

function buildContentTypesXml(mediaList: DocxEmbeddedImage[]): string {
  const seenExts = new Map<string, string>();
  for (const m of mediaList) {
    if (!seenExts.has(m.ext)) {
      seenExts.set(m.ext, m.mime);
    }
  }
  const mediaDefaults = Array.from(seenExts.entries())
    .map(([ext, mime]) => `  <Default Extension="${ext}" ContentType="${mime}"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>${mediaDefaults ? `\n${mediaDefaults}` : ''}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
}

export async function exportMarkdownToDocxBytes(
  markdown: string,
  options?: DocxExportOptions
): Promise<Uint8Array> {
  const { body } = splitFrontmatter(markdown || '');
  const html = await renderMarkdownToHtml(body);
  const container = document.createElement('div');
  container.innerHTML = html;

  const ctx: DocxContext = {
    hyperlinks: [],
    images: new Map(),
    mediaList: [],
    nextRelNum: 2, // rId1 reserved for styles.xml
  };

  const resolver = options?.imageResolver ?? resolveImageSrc;
  const imgElements = Array.from(container.querySelectorAll('img'));
  const maxWidthEmu = 5486400; // ~576px (6.0 in) inside A4 margins
  const resolvedCache = new Map<string, string>();
  let docPrCounter = 1;

  for (const imgEl of imgElements) {
    const rawSrc = (imgEl.getAttribute('src') || '').trim();
    if (!rawSrc) continue;
    let dataUrl = resolvedCache.get(rawSrc);
    if (dataUrl === undefined) {
      dataUrl = rawSrc.startsWith('data:')
        ? rawSrc
        : await resolver(rawSrc, options?.baseDir);
      resolvedCache.set(rawSrc, dataUrl);
    }
    if (!dataUrl.startsWith('data:')) continue;
    const decoded = decodeDataUrl(dataUrl);
    if (!decoded) continue;
    const prepared = await loadImageDimensionsAndMaybePng(dataUrl, decoded.mime, decoded.bytes);
    if (!prepared) continue;

    let cx = Math.max(1, Math.round(prepared.width * 9525));
    let cy = Math.max(1, Math.round(prepared.height * 9525));
    if (cx > maxWidthEmu) {
      const ratio = maxWidthEmu / cx;
      cx = maxWidthEmu;
      cy = Math.max(1, Math.round(cy * ratio));
    }

    const rId = `rId${ctx.nextRelNum++}`;
    const idx = ctx.mediaList.length + 1;
    const target = `media/image${idx}.${prepared.ext}`;
    const embedded: DocxEmbeddedImage = {
      rId,
      target,
      ext: prepared.ext,
      mime: prepared.mime,
      data: prepared.bytes,
      cx,
      cy,
      docPrId: docPrCounter++,
      name: imgEl.getAttribute('alt') || `image${idx}.${prepared.ext}`,
    };
    ctx.mediaList.push(embedded);
    ctx.images.set(imgEl, embedded);
  }

  const blocks: string[] = [];
  for (const child of Array.from(container.children)) {
    blocks.push(...convertElementToDocxBlocks(child as HTMLElement, ctx));
  }
  if (blocks.length === 0) {
    blocks.push('<w:p><w:r><w:t></w:t></w:r></w:p>');
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${blocks.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const relEntries: string[] = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    ...ctx.hyperlinks.map(
      (h) =>
        `<Relationship Id="${h.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(h.url)}" TargetMode="External"/>`
    ),
    ...ctx.mediaList.map(
      (m) =>
        `<Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${m.target}"/>`
    ),
  ];

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relEntries.join('\n  ')}
</Relationships>`;

  const encoder = new TextEncoder();
  const contentTypesXml = ctx.mediaList.length > 0 ? buildContentTypesXml(ctx.mediaList) : CONTENT_TYPES_XML;
  const zipEntries: ZipEntryInput[] = [
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'word/styles.xml', data: encoder.encode(STYLES_XML) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(docRelsXml) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
    ...ctx.mediaList.map((m) => ({ name: `word/${m.target}`, data: m.data })),
  ];

  return buildStoredZip(zipEntries);
}

