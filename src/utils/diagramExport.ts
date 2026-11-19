import { saveBinaryExportFile, saveExportFile } from './platform';

function parseSvgSize(svgMarkup: string): { width: number; height: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return { width: 800, height: 600 };

    const attrW = parseFloat(svg.getAttribute('width') || '');
    const attrH = parseFloat(svg.getAttribute('height') || '');
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return {
          width: Number.isFinite(attrW) && attrW > 0 ? attrW : parts[2],
          height: Number.isFinite(attrH) && attrH > 0 ? attrH : parts[3],
        };
      }
    }
    if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
      return { width: attrW, height: attrH };
    }
  } catch {
    // ignore parse errors
  }
  return { width: 800, height: 600 };
}

function normalizeSvgMarkup(svgMarkup: string, width: number, height: number): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return svgMarkup;
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!svg.getAttribute('xmlns:xlink')) {
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  svg.setAttribute('width', String(Math.ceil(width)));
  svg.setAttribute('height', String(Math.ceil(height)));
  return new XMLSerializer().serializeToString(svg);
}

export async function svgToPngBytes(
  svgMarkup: string,
  options?: { backgroundColor?: string | null; scale?: number }
): Promise<Uint8Array> {
  const { width, height } = parseSvgSize(svgMarkup);
  const scale = options?.scale ?? 2;
  const normalized = normalizeSvgMarkup(svgMarkup, width, height);
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(normalized)}`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to rasterize SVG diagram'));
    img.src = encoded;
  });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  if (options?.backgroundColor) {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('PNG conversion failed'));
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function saveSvgFile(
  svgMarkup: string,
  suggestedName = 'diagram.svg'
): Promise<boolean> {
  const { width, height } = parseSvgSize(svgMarkup);
  const clean = normalizeSvgMarkup(svgMarkup, width, height);
  return saveExportFile(clean, suggestedName, 'SVG Image', ['svg'], 'image/svg+xml;charset=utf-8');
}

export async function saveSvgAsPngFile(
  svgMarkup: string,
  suggestedName = 'diagram.png',
  options?: { backgroundColor?: string | null }
): Promise<boolean> {
  const bytes = await svgToPngBytes(svgMarkup, options);
  return saveBinaryExportFile(bytes, suggestedName, 'PNG Image', ['png'], 'image/png');
}

export function buildKatexSvgWrapper(
  renderedHtml: string,
  width: number,
  height: number,
  color = '#1f2328'
): string {
  const safeW = Math.max(120, Math.ceil(width + 24));
  const safeH = Math.max(48, Math.ceil(height + 20));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeW}" height="${safeH}" viewBox="0 0 ${safeW} ${safeH}">
  <foreignObject x="0" y="0" width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:${color};font-family:'KaTeX_Main','Times New Roman',serif;font-size:20px;">
      ${renderedHtml}
    </div>
  </foreignObject>
</svg>`;
}
