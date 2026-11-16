import React, { useCallback, useEffect, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import type { ThemeId, WrapMode } from '../types';

interface EditorRulerProps {
  viewRef: React.RefObject<EditorView | null>;
  theme: ThemeId;
  fontSize: number;
  editorFont: 'mono' | 'sans';
  lineNumbers: boolean;
  wrapMode: WrapMode;
  wrapColumn: number;
  rulerVersion: number;
}

function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x3000 && code <= 0x30ff)
  );
}

function computeVisualColumns(slice: string, tabSize = 4): number {
  let cols = 0;
  for (const ch of slice) {
    if (ch === '\t') {
      cols += tabSize - (cols % tabSize);
    } else {
      const cp = ch.codePointAt(0) ?? 0;
      cols += isWideChar(cp) ? 2 : 1;
    }
  }
  return cols;
}

export const EditorRuler: React.FC<EditorRulerProps> = ({
  viewRef,
  theme,
  fontSize,
  editorFont,
  lineNumbers,
  wrapMode,
  wrapColumn,
  rulerVersion,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const draw = useCallback(() => {
    const container = wrapRef.current;
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 22;
    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette =
      theme === 'midnight'
        ? {
            bg: '#0c111d',
            border: '#1e293b',
            tick: '#475569',
            majorTick: '#94a3b8',
            text: '#cbd5e1',
            cursorBg: 'rgba(56, 189, 248, 0.88)',
            wrapLine: '#38bdf8',
          }
        : theme === 'dark'
          ? {
              bg: '#191e29',
              border: '#2c3547',
              tick: '#64748b',
              majorTick: '#cbd5e1',
              text: '#cbd5e1',
              cursorBg: '#e2e8f0',
              cursorFg: '#0f172a',
              wrapLine: '#818cf8',
            }
          : theme === 'sepia'
            ? {
                bg: '#ece3cf',
                border: '#d3c2a3',
                tick: '#9b8772',
                majorTick: '#5b4631',
                text: '#4a3928',
                cursorBg: '#7c2d12',
                cursorFg: '#fffaf0',
                wrapLine: '#b45309',
              }
            : {
                bg: '#eef2f7',
                border: '#cbd5e1',
                tick: '#94a3b8',
                majorTick: '#334155',
                text: '#1e293b',
                cursorBg: '#1e293b',
                cursorFg: '#ffffff',
                wrapLine: '#4f46e5',
              };

    if (theme === 'midnight') {
      (palette as { cursorFg?: string }).cursorFg = '#05070e';
    }
    const cursorFg = (palette as { cursorFg?: string }).cursorFg ?? '#05070e';

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 0.5);
    ctx.lineTo(width, height - 0.5);
    ctx.stroke();

    if (!view) return;

    const rulerRect = container.getBoundingClientRect();
    const contentEl = view.contentDOM;
    const contentRect = contentEl.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(contentEl).paddingLeft || '0') || 0;
    const textOriginX = contentRect.left + padLeft - rulerRect.left;

    const guttersEl = view.dom.querySelector('.cm-gutters') as HTMLElement | null;
    const gutterRightX = guttersEl
      ? Math.max(0, guttersEl.getBoundingClientRect().right - rulerRect.left)
      : 0;

    if (gutterRightX > 1) {
      ctx.strokeStyle = palette.border;
      ctx.beginPath();
      ctx.moveTo(Math.floor(gutterRightX) + 0.5, 0);
      ctx.lineTo(Math.floor(gutterRightX) + 0.5, height);
      ctx.stroke();
    }

    const charWidth = Math.max(4, view.defaultCharacterWidth || fontSize * 0.6);

    ctx.save();
    ctx.beginPath();
    ctx.rect(gutterRightX, 0, Math.max(0, width - gutterRightX), height);
    ctx.clip();

    // Cursor column marker position
    const head = view.state.selection.main.head;
    let cursorX: number | null = null;
    try {
      const coords = view.coordsAtPos(head);
      if (coords) {
        cursorX = coords.left - rulerRect.left;
      }
    } catch {
      cursorX = null;
    }
    if (cursorX === null) {
      const line = view.state.doc.lineAt(head);
      const beforeCursor = view.state.sliceDoc(line.from, head);
      cursorX = textOriginX + computeVisualColumns(beforeCursor) * charWidth;
    }

    const markerW = Math.max(7, Math.round(charWidth));
    const markerX = Math.round(cursorX);

    const firstCol = Math.max(0, Math.floor((gutterRightX - textOriginX) / charWidth) - 2);
    const lastCol = Math.ceil((width - textOriginX) / charWidth) + 2;

    ctx.font = `600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textBaseline = 'top';

    const drawTicks = (fromC: number, toC: number, tickCol: string, majorCol: string, txtCol: string) => {
      for (let col = fromC; col <= toC; col += 1) {
        const x = Math.round(textOriginX + col * charWidth) + 0.5;
        if (x < gutterRightX - 20 || x > width + 20) continue;

        if (col % 10 === 0) {
          ctx.strokeStyle = majorCol;
          ctx.beginPath();
          ctx.moveTo(x, 2);
          ctx.lineTo(x, height - 1);
          ctx.stroke();

          ctx.fillStyle = txtCol;
          ctx.fillText(String(col), x + 3, 2);
        } else if (col % 5 === 0) {
          ctx.strokeStyle = majorCol;
          ctx.beginPath();
          ctx.moveTo(x, height - 8);
          ctx.lineTo(x, height - 1);
          ctx.stroke();
        } else {
          ctx.strokeStyle = tickCol;
          ctx.beginPath();
          ctx.moveTo(x, height - 4);
          ctx.lineTo(x, height - 1);
          ctx.stroke();
        }
      }
    };

    drawTicks(firstCol, lastCol, palette.tick, palette.majorTick, palette.text);

    if (markerX + markerW >= gutterRightX && markerX <= width) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(markerX, 1, markerW, height - 2);
      ctx.clip();
      ctx.fillStyle = palette.cursorBg;
      ctx.fillRect(markerX, 1, markerW, height - 2);
      const nearStart = Math.max(0, firstCol);
      drawTicks(nearStart, lastCol, cursorFg, cursorFg, cursorFg);
      ctx.restore();
    }

    // Wrap column indicator
    if (wrapMode === 'column' && wrapColumn > 0) {
      const wx = Math.round(textOriginX + wrapColumn * charWidth) + 0.5;
      if (wx >= gutterRightX && wx <= width) {
        ctx.strokeStyle = palette.wrapLine;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx, 0);
        ctx.lineTo(wx, height - 1);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    ctx.restore();
  }, [viewRef, theme, fontSize, wrapMode, wrapColumn]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, rulerVersion, theme, fontSize, editorFont, lineNumbers, wrapMode, wrapColumn]);

  useEffect(() => {
    const container = wrapRef.current;
    const view = viewRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => scheduleDraw());
    ro.observe(container);
    if (view?.contentDOM) {
      ro.observe(view.contentDOM);
    }

    const scroller = view?.scrollDOM;
    const onScroll = () => scheduleDraw();
    scroller?.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      ro.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [viewRef, scheduleDraw, rulerVersion]);

  return (
    <div ref={wrapRef} className="editor-ruler" aria-hidden="true">
      <canvas ref={canvasRef} className="editor-ruler-canvas" />
    </div>
  );
};
