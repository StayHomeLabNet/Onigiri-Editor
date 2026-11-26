import React, { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Locale } from '../../types';
import { writeClipboardText } from '../../utils/platform';
import { extractSvgMetadata } from '../../utils/previewParsers';

interface SvgPreviewPaneProps {
  locale: Locale;
  fileName: string;
  content: string;
  onCopyNotify: () => void;
}

type BgMode = 'checker' | 'light' | 'dark';

export function exportSvgStringToPng(svgMarkup: string, outName: string): void {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const w = Math.max(1, img.naturalWidth || 800);
    const h = Math.max(1, img.naturalHeight || 600);
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = outName.replace(/\.(svg|mmd|mermaid|dot|gv)$/i, '') + '.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(pngUrl);
        }
      }, 'image/png');
    }
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export const SvgPreviewPane: React.FC<SvgPreviewPaneProps> = ({
  locale,
  fileName,
  content,
  onCopyNotify,
}) => {
  const isJa = locale === 'ja';
  const [bgMode, setBgMode] = useState<BgMode>('checker');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const meta = useMemo(() => extractSvgMetadata(content), [content]);

  const svgDataUrl = useMemo(() => {
    if (!content.trim()) return '';
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
  }, [content]);

  const handleCopyColor = async (color: string) => {
    await writeClipboardText(color);
    onCopyNotify();
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">SVG</span>
          {meta.viewBox && <span className="ext-meta-pill">viewBox: {meta.viewBox}</span>}
          {(meta.width || meta.height) && (
            <span className="ext-meta-pill">
              {meta.width || 'auto'} × {meta.height || 'auto'}
            </span>
          )}
        </div>
        <div className="ext-preview-toolbar-right">
          <div className="ext-seg-group">
            <button
              type="button"
              className={`ext-tool-btn ${bgMode === 'checker' ? 'is-active' : ''}`}
              onClick={() => setBgMode('checker')}
            >
              {isJa ? '市松' : 'Checker'}
            </button>
            <button
              type="button"
              className={`ext-tool-btn ${bgMode === 'light' ? 'is-active' : ''}`}
              onClick={() => setBgMode('light')}
            >
              {isJa ? '白' : 'Light'}
            </button>
            <button
              type="button"
              className={`ext-tool-btn ${bgMode === 'dark' ? 'is-active' : ''}`}
              onClick={() => setBgMode('dark')}
            >
              {isJa ? '黒' : 'Dark'}
            </button>
          </div>
          <button
            type="button"
            className="ext-tool-btn"
            onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.2).toFixed(2))))}
            title="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <span className="ext-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="ext-tool-btn"
            onClick={() => setZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
            title="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button
            type="button"
            className="ext-tool-btn"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            title="Reset"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="ext-tool-btn is-primary"
            disabled={!content.trim()}
            onClick={() => exportSvgStringToPng(content, fileName || 'image.svg')}
          >
            <Download size={13} />
            <span>PNG</span>
          </button>
        </div>
      </div>

      <div
        className={`ext-canvas-stage is-${bgMode}`}
        onMouseDown={(e) => {
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
        }}
        onMouseMove={(e) => {
          if (!dragRef.current) return;
          setPan({
            x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
          });
        }}
        onMouseUp={() => {
          dragRef.current = null;
        }}
        onMouseLeave={() => {
          dragRef.current = null;
        }}
      >
        {svgDataUrl ? (
          <img
            src={svgDataUrl}
            alt={fileName}
            draggable={false}
            className="ext-svg-preview-img"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          />
        ) : (
          <div className="ext-empty-cell">{isJa ? 'SVG が空です' : 'Empty SVG'}</div>
        )}
      </div>

      {meta.colors.length > 0 && (
        <div className="ext-palette-bar">
          <span className="ext-palette-title">
            {isJa ? `カラー (${meta.colors.length})` : `Colors (${meta.colors.length})`}
          </span>
          <div className="ext-palette-swatches">
            {meta.colors.map((c) => (
              <button
                key={c}
                type="button"
                className="ext-palette-chip"
                onClick={() => void handleCopyColor(c)}
                title={`${isJa ? 'コピー' : 'Copy'}: ${c}`}
              >
                <span className="ext-swatch-dot" style={{ backgroundColor: c }} />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
