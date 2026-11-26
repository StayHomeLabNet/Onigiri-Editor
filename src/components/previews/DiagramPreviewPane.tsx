import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { AlertTriangle, Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { Locale, ThemeId } from '../../types';
import { exportSvgStringToPng } from './SvgPreviewPane';

interface DiagramPreviewPaneProps {
  locale: Locale;
  theme: ThemeId;
  fileName: string;
  content: string;
}

/** Convert common Graphviz DOT graphs to Mermaid flowchart syntax for offline rendering. */
function convertDotToMermaid(dotSource: string): string {
  const lines = dotSource.replace(/\r\n/g, '\n').split('\n');
  const isUndirected = /^\s*(?:strict\s+)?graph\b/i.test(dotSource);
  const rankdirMatch = dotSource.match(/\brankdir\s*=\s*"?(LR|RL|TB|BT)"?/i);
  const dir = rankdirMatch ? rankdirMatch[1].toUpperCase() : 'TD';
  const out: string[] = [`flowchart ${dir === 'TB' ? 'TD' : dir}`];
  const nodeLabels = new Map<string, string>();

  const sanitizeId = (raw: string) => raw.replace(/[^A-Za-z0-9_]/g, '_') || 'node';

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/;$/, '');
    if (
      !line ||
      line.startsWith('//') ||
      line.startsWith('#') ||
      /^(?:strict\s+)?(?:di)?graph\b/i.test(line) ||
      line === '{' ||
      line === '}' ||
      /^(?:graph|node|edge|rankdir|size|bgcolor)\b/i.test(line)
    ) {
      continue;
    }

    const edgeMatch = line.match(
      /^("?[^"\s\[]+"?)\s*(->|--)\s*("?[^"\s\[]+"?)(?:\s*\[([^\]]*)\])?/
    );
    if (edgeMatch) {
      const fromRaw = edgeMatch[1].replace(/^"|"$/g, '');
      const toRaw = edgeMatch[3].replace(/^"|"$/g, '');
      const attrs = edgeMatch[4] || '';
      const labelMatch = attrs.match(/\blabel\s*=\s*"([^"]*)"/i);
      const fromId = sanitizeId(fromRaw);
      const toId = sanitizeId(toRaw);
      const arrow = isUndirected || edgeMatch[2] === '--' ? '---' : '-->';
      const fromExpr = nodeLabels.has(fromId) ? fromId : `${fromId}["${fromRaw}"]`;
      const toExpr = nodeLabels.has(toId) ? toId : `${toId}["${toRaw}"]`;
      nodeLabels.set(fromId, fromRaw);
      nodeLabels.set(toId, toRaw);
      if (labelMatch && labelMatch[1]) {
        out.push(`  ${fromExpr} ${arrow}|"${labelMatch[1]}"| ${toExpr}`);
      } else {
        out.push(`  ${fromExpr} ${arrow} ${toExpr}`);
      }
      continue;
    }

    const nodeMatch = line.match(/^("?[^"\s\[]+"?)\s*\[([^\]]*)\]/);
    if (nodeMatch) {
      const nodeRaw = nodeMatch[1].replace(/^"|"$/g, '');
      const labelMatch = nodeMatch[2].match(/\blabel\s*=\s*"([^"]*)"/i);
      const id = sanitizeId(nodeRaw);
      const label = labelMatch ? labelMatch[1] : nodeRaw;
      nodeLabels.set(id, label);
      out.push(`  ${id}["${label}"]`);
    }
  }

  return out.length > 1 ? out.join('\n') : 'flowchart TD\n  Empty["Empty DOT graph"]';
}

export const DiagramPreviewPane: React.FC<DiagramPreviewPaneProps> = ({
  locale,
  theme,
  fileName,
  content,
}) => {
  const isJa = locale === 'ja';
  const isDot = /\.(dot|gv)$/i.test(fileName);
  const renderId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [svgMarkup, setSvgMarkup] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const sourceToRender = useMemo(
    () => (isDot ? convertDotToMermaid(content) : content),
    [content, isDot]
  );

  useEffect(() => {
    let cancelled = false;
    const trimmed = sourceToRender.trim();
    if (!trimmed) {
      setSvgMarkup('');
      setErrorMsg(null);
      return;
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
    });

    mermaid
      .render(`ext-diagram-${renderId}-${Date.now()}`, trimmed)
      .then(({ svg }) => {
        if (!cancelled) {
          setSvgMarkup(svg);
          setErrorMsg(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [renderId, sourceToRender, theme]);

  const handleExportSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.(mmd|mermaid|dot|gv)$/i, '') + '.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">{isDot ? 'GRAPHVIZ DOT' : 'MERMAID'}</span>
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className="ext-tool-btn"
            onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.2).toFixed(2))))}
          >
            <ZoomOut size={13} />
          </button>
          <span className="ext-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="ext-tool-btn"
            onClick={() => setZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
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
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            className="ext-tool-btn"
            disabled={!svgMarkup}
            onClick={handleExportSvg}
          >
            <Download size={13} />
            <span>SVG</span>
          </button>
          <button
            type="button"
            className="ext-tool-btn is-primary"
            disabled={!svgMarkup}
            onClick={() => exportSvgStringToPng(svgMarkup, fileName || 'diagram.png')}
          >
            <Download size={13} />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="ext-preview-body">
          <div className="ext-error-box">
            <div className="ext-error-header">
              <AlertTriangle size={16} />
              <span>{isJa ? 'ダイアグラム構文エラー' : 'Diagram Syntax Error'}</span>
            </div>
            <div className="ext-error-message">{errorMsg}</div>
          </div>
        </div>
      ) : (
        <div
          className="ext-canvas-stage"
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
          {svgMarkup ? (
            <div
              className="ext-diagram-svg-wrap"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
            />
          ) : (
            <div className="ext-empty-cell">{isJa ? '図表データが空です' : 'Empty diagram'}</div>
          )}
        </div>
      )}
    </div>
  );
};
