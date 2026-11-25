import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardCopy,
  Code2,
  Search,
  Table2,
  WrapText,
  X,
} from 'lucide-react';
import type { Translations } from '../i18n/types';
import {
  type DelimitedCellSpan,
  parseCsvTsvTableWithSpans,
  tableRowsToDelimited,
  tableRowsToMarkdown,
} from '../utils/structuredData';
import { writeClipboardText } from '../utils/platform';

export interface DataPreviewSyncTarget {
  from: number;
  to: number;
  line: number;
}

interface DataPreviewPaneProps {
  t: Translations;
  fileName: string;
  languageOverride?: string | null;
  content: string;
  activeLine: number;
  editorSelection?: { from: number; to: number } | null;
  editorCursorOffset?: number | null;
  copyCellEnabled?: boolean;
  onSyncEditorRange?: (range: DataPreviewSyncTarget | null) => void;
  onJumpToLine?: (line: number) => void;
  onCopyNotify: () => void;
}

type DelimiterOverride = 'auto' | ',' | '\t' | ';';

function parseNumericCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '').replace(/%$/, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function renderCellContent(
  text: string,
  filterQuery: string,
  syncSlice: [number, number] | null
): React.ReactNode {
  if (!text) return '';

  const marks: Array<{ start: number; end: number; kind: 'sync' | 'filter' }> = [];

  if (syncSlice) {
    const [s, e] = syncSlice;
    if (s < e) {
      marks.push({ start: Math.max(0, s), end: Math.min(text.length, e), kind: 'sync' });
    }
  }

  if (filterQuery) {
    const lowerText = text.toLowerCase();
    const lowerQuery = filterQuery.toLowerCase();
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      marks.push({ start: idx, end: idx + filterQuery.length, kind: 'filter' });
      idx = lowerText.indexOf(lowerQuery, idx + filterQuery.length);
    }
  }

  if (marks.length === 0) return text;

  // Build non-overlapping segments prioritizing 'sync' over 'filter'
  const boundaries = new Set<number>([0, text.length]);
  for (const m of marks) {
    boundaries.add(m.start);
    boundaries.add(m.end);
  }
  const pts = Array.from(boundaries).sort((a, b) => a - b);

  const out: React.ReactNode[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const segStart = pts[i];
    const segEnd = pts[i + 1];
    if (segStart >= segEnd) continue;
    const chunk = text.slice(segStart, segEnd);
    const hasSync = marks.some(
      (m) => m.kind === 'sync' && m.start <= segStart && segEnd <= m.end
    );
    const hasFilter = marks.some(
      (m) => m.kind === 'filter' && m.start <= segStart && segEnd <= m.end
    );
    if (hasSync) {
      out.push(
        <mark key={i} className="data-cell-sync-match">
          {chunk}
        </mark>
      );
    } else if (hasFilter) {
      out.push(
        <mark key={i} className="data-cell-match">
          {chunk}
        </mark>
      );
    } else {
      out.push(chunk);
    }
  }
  return out;
}

function getEditorOverlapForCell(
  cell: DelimitedCellSpan,
  editorSelection: { from: number; to: number } | null | undefined,
  editorCursorOffset: number | null | undefined
): {
  isSelected: boolean;
  isCaret: boolean;
  syncSlice: [number, number] | null;
} {
  if (editorSelection && editorSelection.from < editorSelection.to) {
    const overlaps =
      cell.from === cell.to
        ? editorSelection.from <= cell.from && cell.from <= editorSelection.to
        : cell.from < editorSelection.to && cell.to > editorSelection.from;
    if (!overlaps) {
      return { isSelected: false, isCaret: false, syncSlice: null };
    }
    let syncSlice: [number, number] | null = null;
    if (cell.valueFrom !== null && cell.valueTo !== null && cell.valueFrom < cell.valueTo) {
      const s = Math.max(0, editorSelection.from - cell.valueFrom);
      const e = Math.min(cell.value.length, editorSelection.to - cell.valueFrom);
      if (s < e) {
        syncSlice = [s, e];
      }
    }
    return { isSelected: true, isCaret: false, syncSlice };
  }

  if (typeof editorCursorOffset === 'number') {
    const isCaret = cell.from <= editorCursorOffset && editorCursorOffset <= cell.to;
    return { isSelected: false, isCaret, syncSlice: null };
  }

  return { isSelected: false, isCaret: false, syncSlice: null };
}

export const DataPreviewPane: React.FC<DataPreviewPaneProps> = ({
  t,
  fileName,
  languageOverride,
  content,
  activeLine,
  editorSelection,
  editorCursorOffset,
  copyCellEnabled = true,
  onSyncEditorRange,
  onJumpToLine,
  onCopyNotify,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [wrapCells, setWrapCells] = useState(false);
  const [delimiterOverride, setDelimiterOverride] = useState<DelimiterOverride>('auto');
  const [selectedPreviewCellKey, setSelectedPreviewCellKey] = useState<string | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const rawBodyRef = useRef<HTMLDivElement | null>(null);
  const [tableScrollTop, setTableScrollTop] = useState(0);
  const [tableViewportH, setTableViewportH] = useState(600);
  const [rawScrollTop, setRawScrollTop] = useState(0);
  const [rawViewportH, setRawViewportH] = useState(600);

  const deferredContent = useDeferredValue(content);
  const deferredFilterText = useDeferredValue(filterText);

  const isJa = t.actions.close === '閉じる';

  const isTsv =
    languageOverride === 'tsv' ||
    (!languageOverride && fileName.toLowerCase().endsWith('.tsv'));

  const parsed = useMemo(() => {
    const forced =
      delimiterOverride !== 'auto'
        ? delimiterOverride
        : languageOverride === 'tsv'
          ? '\t'
          : isTsv
            ? '\t'
            : undefined;
    return parseCsvTsvTableWithSpans(deferredContent, forced);
  }, [deferredContent, isTsv, languageOverride, delimiterOverride]);

  const indexedRows = useMemo(() => {
    const q = deferredFilterText.trim().toLowerCase();
    const mapped = parsed.rows.map((cells, idx) => ({
      cells,
      sourceLine: cells[0]?.line ?? idx + 2,
    }));

    const filtered = q
      ? mapped.filter((r) => r.cells.some((c) => c.value.toLowerCase().includes(q)))
      : mapped;

    if (sortCol === null || sortCol < 0 || sortCol >= parsed.headers.length) {
      return filtered;
    }

    const dirMul = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.cells[sortCol]?.value ?? '';
      const bv = b.cells[sortCol]?.value ?? '';
      const an = parseNumericCell(av);
      const bn = parseNumericCell(bv);
      if (an !== null && bn !== null) {
        return (an - bn) * dirMul;
      }
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dirMul;
    });
  }, [parsed.rows, parsed.headers.length, deferredFilterText, sortCol, sortDir]);

  const numericCols = useMemo(() => {
    const sampleLimit = Math.min(parsed.rows.length, 400);
    return parsed.headers.map((_, cIdx) => {
      let nonEmpty = 0;
      let numeric = 0;
      for (let i = 0; i < sampleLimit; i++) {
        const val = (parsed.rows[i][cIdx]?.value ?? '').trim();
        if (!val) continue;
        nonEmpty += 1;
        if (parseNumericCell(val) !== null) numeric += 1;
      }
      return nonEmpty > 0 && numeric / nonEmpty >= 0.85;
    });
  }, [parsed.headers, parsed.rows]);

  const sortedColStats = useMemo(() => {
    if (sortCol === null || !numericCols[sortCol]) return null;
    const nums: number[] = [];
    for (const r of indexedRows) {
      const n = parseNumericCell(r.cells[sortCol]?.value ?? '');
      if (n !== null) nums.push(n);
    }
    if (nums.length === 0) return null;
    let sum = 0;
    let min = nums[0];
    let max = nums[0];
    for (const n of nums) {
      sum += n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    const avg = sum / nums.length;
    const fmt = (v: number) =>
      Number.isInteger(v) ? v.toLocaleString() : Number(v.toFixed(2)).toLocaleString();
    return {
      colName: parsed.headers[sortCol]?.value ?? `Col ${sortCol + 1}`,
      count: nums.length,
      sum: fmt(sum),
      avg: fmt(avg),
      min: fmt(min),
      max: fmt(max),
    };
  }, [sortCol, numericCols, indexedRows, parsed.headers]);

  // Track viewport heights for virtualized rendering
  useEffect(() => {
    const el = viewMode === 'table' ? tableWrapRef.current : rawBodyRef.current;
    if (!el) return;
    const updateH = () => {
      const h = el.clientHeight;
      if (h > 0) {
        if (viewMode === 'table') setTableViewportH(h);
        else setRawViewportH(h);
      }
    };
    updateH();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateH);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode, parsed.headers.length]);

  // Clear preview-side active cell marker when editor selection changes
  useEffect(() => {
    if (editorSelection && editorSelection.from < editorSelection.to) {
      setSelectedPreviewCellKey(null);
    }
  }, [editorSelection]);

  // Scroll matched row into view when editor selection changes (works with virtualization)
  useEffect(() => {
    if (viewMode !== 'table' || !editorSelection || editorSelection.from >= editorSelection.to) {
      return;
    }
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    const target = wrap.querySelector('.is-editor-selected-cell');
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const matchIdx = indexedRows.findIndex((r) =>
      r.cells.some((c) => c.from < editorSelection.to && c.to > editorSelection.from)
    );
    if (matchIdx >= 0 && !wrapCells) {
      const targetTop = Math.max(0, matchIdx * 30 - wrap.clientHeight / 2);
      wrap.scrollTop = targetTop;
    }
  }, [editorSelection, viewMode, indexedRows, wrapCells]);

  const toggleSort = (colIdx: number) => {
    if (sortCol !== colIdx) {
      setSortCol(colIdx);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol(null);
    }
  };

  const handleCopyMarkdown = async () => {
    const md = tableRowsToMarkdown(
      parsed.headers.map((h) => h.value),
      indexedRows.map((r) => r.cells.map((c) => c.value))
    );
    const ok = await writeClipboardText(md);
    if (ok) onCopyNotify();
  };

  const handleCopyCsv = async () => {
    const csv = tableRowsToDelimited(
      parsed.headers.map((h) => h.value),
      indexedRows.map((r) => r.cells.map((c) => c.value)),
      ','
    );
    const ok = await writeClipboardText(csv);
    if (ok) onCopyNotify();
  };

  const handleCopyCell = async (cellValue: string) => {
    if (!copyCellEnabled || !cellValue) return;
    const ok = await writeClipboardText(cellValue);
    if (ok) onCopyNotify();
  };

  const handleCellClick = (cell: DelimitedCellSpan, key: string) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      return;
    }
    setSelectedPreviewCellKey(key);
    const from = cell.valueFrom ?? cell.from;
    const to = cell.valueTo ?? cell.to;
    onSyncEditorRange?.({ from, to, line: cell.line });
    onJumpToLine?.(cell.line);
  };

  const handleTableMouseUp = () => {
    if (!onSyncEditorRange) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const domRange = sel.getRangeAt(0);
    const startEl =
      domRange.startContainer instanceof Element
        ? domRange.startContainer
        : domRange.startContainer.parentElement;
    const endEl =
      domRange.endContainer instanceof Element
        ? domRange.endContainer
        : domRange.endContainer.parentElement;
    const startCell = startEl?.closest('[data-cell-from]') as HTMLElement | null;
    const endCell = endEl?.closest('[data-cell-from]') as HTMLElement | null;
    if (!startCell || !endCell) return;

    const sFrom = Number(startCell.dataset.cellFrom);
    const sTo = Number(startCell.dataset.cellTo);
    const sLine = Number(startCell.dataset.cellLine || '1');
    const eFrom = Number(endCell.dataset.cellFrom);
    const eTo = Number(endCell.dataset.cellTo);
    if (Number.isNaN(sFrom) || Number.isNaN(eTo)) return;

    if (startCell === endCell) {
      const vFromAttr = startCell.dataset.valueFrom;
      const vToAttr = startCell.dataset.valueTo;
      if (vFromAttr && vToAttr) {
        const vFrom = Number(vFromAttr);
        const vTo = Number(vToAttr);
        const pre = document.createRange();
        pre.selectNodeContents(startCell);
        pre.setEnd(domRange.startContainer, domRange.startOffset);
        const localStart = pre.toString().length;
        const selectedLen = domRange.toString().length;
        if (selectedLen > 0) {
          const mappedFrom = Math.min(vTo, vFrom + localStart);
          const mappedTo = Math.min(vTo, mappedFrom + selectedLen);
          if (mappedFrom < mappedTo) {
            setSelectedPreviewCellKey(startCell.dataset.cellKey ?? null);
            onSyncEditorRange({ from: mappedFrom, to: mappedTo, line: sLine });
            return;
          }
        }
      }
      setSelectedPreviewCellKey(startCell.dataset.cellKey ?? null);
      onSyncEditorRange({ from: sFrom, to: sTo, line: sLine });
      return;
    }

    const minFrom = Math.min(sFrom, eFrom);
    const maxTo = Math.max(sTo, eTo);
    setSelectedPreviewCellKey(null);
    onSyncEditorRange({ from: minFrom, to: maxTo, line: sLine });
  };

  const rawLines = useMemo(() => deferredContent.split(/\r?\n/), [deferredContent]);
  const trimmedQuery = deferredFilterText.trim();
  const delimiterLabel =
    parsed.delimiter === '\t' ? 'TAB' : parsed.delimiter === ';' ? ';' : ',';

  const TABLE_ROW_HEIGHT = 30;
  const TABLE_OVERSCAN = 14;
  const useVirtualTable = !wrapCells || indexedRows.length > 500;
  const tableStartIdx = useVirtualTable
    ? Math.max(0, Math.floor(tableScrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN)
    : 0;
  const tableVisibleCount = useVirtualTable
    ? Math.ceil(tableViewportH / TABLE_ROW_HEIGHT) + TABLE_OVERSCAN * 2
    : indexedRows.length;
  const tableEndIdx = useVirtualTable
    ? Math.min(indexedRows.length, tableStartIdx + tableVisibleCount)
    : indexedRows.length;
  const tableTopPad = useVirtualTable ? tableStartIdx * TABLE_ROW_HEIGHT : 0;
  const tableBottomPad = useVirtualTable
    ? Math.max(0, (indexedRows.length - tableEndIdx) * TABLE_ROW_HEIGHT)
    : 0;
  const visibleRows = indexedRows.slice(tableStartIdx, tableEndIdx);

  const RAW_LINE_HEIGHT = 20;
  const RAW_OVERSCAN = 20;
  const rawStartIdx = Math.max(0, Math.floor(rawScrollTop / RAW_LINE_HEIGHT) - RAW_OVERSCAN);
  const rawEndIdx = Math.min(
    rawLines.length,
    rawStartIdx + Math.ceil(rawViewportH / RAW_LINE_HEIGHT) + RAW_OVERSCAN * 2
  );
  const rawTopPad = rawStartIdx * RAW_LINE_HEIGHT;
  const rawBottomPad = Math.max(0, (rawLines.length - rawEndIdx) * RAW_LINE_HEIGHT);
  const visibleRawLines = rawLines.slice(rawStartIdx, rawEndIdx);

  return (
    <div className="data-preview-pane">
      <div className="code-preview-toolbar data-preview-toolbar">
        <div className="data-preview-title-group">
          <span className="code-preview-lang">
            {isTsv ? t.dataPreview.titleTsv : t.dataPreview.titleCsv}
          </span>
          <span className="data-preview-stats">
            {indexedRows.length}/{parsed.rows.length} {t.dataPreview.rowsLabel} · {parsed.headers.length}{' '}
            {t.dataPreview.colsLabel}
          </span>
          <select
            className="data-delimiter-select"
            value={delimiterOverride}
            onChange={(e) => setDelimiterOverride(e.target.value as DelimiterOverride)}
            title={isJa ? `区切り文字 (現在: ${delimiterLabel})` : `Delimiter (active: ${delimiterLabel})`}
          >
            <option value="auto">{isJa ? `自動 (${delimiterLabel})` : `Auto (${delimiterLabel})`}</option>
            <option value=",">CSV (,)</option>
            <option value={'\t'}>TSV (Tab)</option>
            <option value=";">CSV (;)</option>
          </select>
        </div>

        <div className="data-preview-actions">
          {viewMode === 'table' && (
            <>
              <div className="data-filter-box">
                <Search size={12} />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder={t.dataPreview.filterPlaceholder}
                />
                {filterText && (
                  <button
                    type="button"
                    className="data-filter-clear-btn"
                    onClick={() => setFilterText('')}
                    title={isJa ? 'フィルターをクリア' : 'Clear filter'}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              <button
                type="button"
                className={`mini-pill-btn ${wrapCells ? 'is-active' : ''}`}
                onClick={() => setWrapCells((v) => !v)}
                title={isJa ? 'セルの折り返し表示を切り替え' : 'Toggle cell text wrapping'}
              >
                <WrapText size={12} />
                <span>{isJa ? '折り返し' : 'Wrap'}</span>
              </button>
            </>
          )}

          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${viewMode === 'table' ? 'is-active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <Table2 size={12} />
              <span>{t.dataPreview.viewTableBtn}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${viewMode === 'raw' ? 'is-active' : ''}`}
              onClick={() => setViewMode('raw')}
            >
              <Code2 size={12} />
              <span>{t.dataPreview.viewRawBtn}</span>
            </button>
          </div>

          <button
            type="button"
            className="mini-pill-btn"
            onClick={() => void handleCopyMarkdown()}
            title={t.dataPreview.copyMarkdownBtn}
          >
            <ClipboardCopy size={12} />
            <span>{t.dataPreview.copyMarkdownBtn}</span>
          </button>
          <button
            type="button"
            className="mini-pill-btn"
            onClick={() => void handleCopyCsv()}
            title={t.dataPreview.copyCsvBtn}
          >
            <ClipboardCopy size={12} />
            <span>{t.dataPreview.copyCsvBtn}</span>
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        <div
          ref={rawBodyRef}
          className="code-preview-body"
          onScroll={(e) => setRawScrollTop(e.currentTarget.scrollTop)}
        >
          {rawTopPad > 0 && <div style={{ height: rawTopPad }} aria-hidden="true" />}
          {visibleRawLines.map((line, idx) => {
            const lineNum = rawStartIdx + idx + 1;
            const isActive = lineNum === activeLine;
            return (
              <div
                key={lineNum}
                className={`code-preview-line ${isActive ? 'is-active' : ''}`}
                style={{ height: RAW_LINE_HEIGHT }}
                onClick={() => onJumpToLine?.(lineNum)}
              >
                <span className="code-preview-ln">{lineNum}</span>
                <span className="code-preview-text">{line || ' '}</span>
              </div>
            );
          })}
          {rawBottomPad > 0 && <div style={{ height: rawBottomPad }} aria-hidden="true" />}
        </div>
      ) : parsed.headers.length === 0 ? (
        <div className="data-preview-empty">{t.dataPreview.emptyTable}</div>
      ) : (
        <>
          <div
            ref={tableWrapRef}
            className="data-preview-table-wrap"
            onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
            onMouseUp={handleTableMouseUp}
          >
            <table className={`data-preview-table ${wrapCells ? 'is-wrapped' : ''}`}>
              <thead>
                <tr>
                  <th className="data-row-num-col">#</th>
                  {parsed.headers.map((h, cIdx) => {
                    const isSorted = sortCol === cIdx;
                    const isNum = numericCols[cIdx];
                    const sync = getEditorOverlapForCell(h, editorSelection, editorCursorOffset);
                    const cellKey = `h-${cIdx}`;
                    const thClasses = [
                      isNum ? 'is-numeric-col' : '',
                      sync.isSelected ? 'is-editor-selected-cell' : '',
                      sync.isCaret ? 'is-editor-caret-cell' : '',
                      selectedPreviewCellKey === cellKey ? 'is-preview-active-cell' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <th
                        key={cIdx}
                        className={thClasses}
                        data-cell-key={cellKey}
                        data-cell-from={h.from}
                        data-cell-to={h.to}
                        data-value-from={h.valueFrom ?? undefined}
                        data-value-to={h.valueTo ?? undefined}
                        data-cell-line={h.line}
                      >
                        <button
                          type="button"
                          className={`data-sort-th-btn ${isSorted ? 'is-sorted' : ''}`}
                          onClick={() => {
                            toggleSort(cIdx);
                            handleCellClick(h, cellKey);
                          }}
                          title={
                            isJa
                              ? `${h.value} でソート（クリックで昇順/降順/解除）`
                              : `Sort by ${h.value} (click to cycle asc/desc/off)`
                          }
                        >
                          <span className="data-th-label">
                            {renderCellContent(h.value, trimmedQuery, sync.syncSlice)}
                          </span>
                          {isSorted ? (
                            sortDir === 'asc' ? (
                              <ArrowUp size={12} />
                            ) : (
                              <ArrowDown size={12} />
                            )
                          ) : (
                            <ArrowUpDown size={11} className="data-sort-idle" />
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableTopPad > 0 && (
                  <tr className="data-virtual-spacer" aria-hidden="true">
                    <td
                      colSpan={parsed.headers.length + 1}
                      style={{ height: tableTopPad, padding: 0, border: 'none' }}
                    />
                  </tr>
                )}
                {visibleRows.map((row, sliceIdx) => {
                  const actualIdx = tableStartIdx + sliceIdx;
                  const isActive = row.sourceLine === activeLine;
                  const rowClasses = [
                    isActive ? 'is-active' : '',
                    actualIdx % 2 === 1 ? 'is-even-row' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr
                      key={row.sourceLine}
                      className={rowClasses}
                      style={useVirtualTable ? { height: TABLE_ROW_HEIGHT } : undefined}
                      onClick={() => onJumpToLine?.(row.sourceLine)}
                    >
                      <td className="data-row-num-col">{row.sourceLine}</td>
                      {parsed.headers.map((_, cIdx) => {
                        const cell = row.cells[cIdx] ?? {
                          value: '',
                          from: 0,
                          to: 0,
                          valueFrom: null,
                          valueTo: null,
                          line: row.sourceLine,
                        };
                        const isNum = numericCols[cIdx];
                        const sync = getEditorOverlapForCell(
                          cell,
                          editorSelection,
                          editorCursorOffset
                        );
                        const cellKey = `r-${row.sourceLine}-c-${cIdx}`;
                        const tdClasses = [
                          isNum ? 'is-numeric-cell' : '',
                          sync.isSelected ? 'is-editor-selected-cell' : '',
                          sync.isCaret ? 'is-editor-caret-cell' : '',
                          selectedPreviewCellKey === cellKey ? 'is-preview-active-cell' : '',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <td
                            key={cIdx}
                            className={tdClasses}
                            data-cell-key={cellKey}
                            data-cell-from={cell.from}
                            data-cell-to={cell.to}
                            data-value-from={cell.valueFrom ?? undefined}
                            data-value-to={cell.valueTo ?? undefined}
                            data-cell-line={cell.line}
                            title={
                              cell.value
                                ? copyCellEnabled
                                  ? isJa
                                    ? `${cell.value}（ダブルクリックでコピー）`
                                    : `${cell.value} (double-click to copy)`
                                  : cell.value
                                : undefined
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCellClick(cell, cellKey);
                            }}
                            onDoubleClick={(e) => {
                              if (!copyCellEnabled) return;
                              e.stopPropagation();
                              void handleCopyCell(cell.value);
                            }}
                          >
                            {renderCellContent(cell.value, trimmedQuery, sync.syncSlice)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {tableBottomPad > 0 && (
                  <tr className="data-virtual-spacer" aria-hidden="true">
                    <td
                      colSpan={parsed.headers.length + 1}
                      style={{ height: tableBottomPad, padding: 0, border: 'none' }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="data-preview-footer">
            <span className="data-preview-footer-hint">
              {copyCellEnabled
                ? isJa
                  ? 'セル選択で双方向ハイライト · ダブルクリックで値コピー'
                  : 'Select or click cells for bidirectional highlight · Double-click to copy'
                : isJa
                  ? 'セル選択で双方向ハイライト'
                  : 'Select or click cells for bidirectional highlight'}
            </span>
            {sortedColStats && (
              <span className="data-preview-col-stats">
                <strong>{sortedColStats.colName}</strong>: Σ {sortedColStats.sum} ·{' '}
                {isJa ? '平均' : 'Avg'} {sortedColStats.avg} · {isJa ? '最小' : 'Min'}{' '}
                {sortedColStats.min} · {isJa ? '最大' : 'Max'} {sortedColStats.max} (n=
                {sortedColStats.count})
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
};
