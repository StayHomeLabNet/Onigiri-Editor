import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardCopy,
  Code2,
  Download,
  FileSpreadsheet,
  Plus,
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
import { saveBinaryExportFile, writeClipboardText } from '../utils/platform';
import {
  type AutoFillDirection,
  type AutoFillMode,
  adjustFormulasForRowColEdit,
  buildOdsBytes,
  buildXlsxBytes,
  colIndexToLetters,
  evaluateSpreadsheetGrid,
  generateAutoFillSeries,
  lettersToColIndex,
  parseCellRef,
  resolveAutoFillEffectiveMode,
  shiftFormulaReferences,
} from '../utils/spreadsheetEngine';

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
  onUpdateContent?: (nextContent: string) => void;
  onInsertToEditor?: (text: string) => void;
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
  onUpdateContent,
  onInsertToEditor,
  onCopyNotify,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [wrapCells, setWrapCells] = useState(false);
  const [delimiterOverride, setDelimiterOverride] = useState<DelimiterOverride>('auto');
  const [selectedPreviewCellKey, setSelectedPreviewCellKey] = useState<string | null>(null);
  const [showInsertTable, setShowInsertTable] = useState(false);
  const [insertRows, setInsertRows] = useState(5);
  const [insertCols, setInsertCols] = useState(4);
  const insertTableWrapRef = useRef<HTMLDivElement | null>(null);
  const [editingCell, setEditingCell] = useState<{
    key: string;
    row: number;
    col: number;
    value: string;
    selectAllOnMount: boolean;
  } | null>(null);
  const [activeFormulaCell, setActiveFormulaCell] = useState<{
    coord: string;
    row: number;
    col: number;
    value: string;
    display: string;
  } | null>(null);
  const [formulaBarText, setFormulaBarText] = useState('');
  const [formulaBarFocused, setFormulaBarFocused] = useState(false);
  const [gridSelection, setGridSelection] = useState<{
    anchor: { row: number; col: number };
    focus: { row: number; col: number };
  } | null>(null);
  const [isRangeSelecting, setIsRangeSelecting] = useState(false);
  const [fillDrag, setFillDrag] = useState<{
    rMin: number;
    rMax: number;
    cMin: number;
    cMax: number;
    targetRow: number;
    targetCol: number;
    ctrlPressed: boolean;
    clientX: number;
    clientY: number;
  } | null>(null);
  const [autoFillSmartTag, setAutoFillSmartTag] = useState<{
    rMin: number;
    rMax: number;
    cMin: number;
    cMax: number;
    srcRMin: number;
    srcRMax: number;
    srcCMin: number;
    srcCMax: number;
    direction: AutoFillDirection;
    activeMode: Exclude<AutoFillMode, 'auto'>;
    hasDate: boolean;
    preFillMatrix: string[][];
    menuOpen: boolean;
  } | null>(null);
  const [cellCtxMenu, setCellCtxMenu] = useState<{
    x: number;
    y: number;
    row: number;
    col: number;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const formulaBarInputRef = useRef<HTMLInputElement | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const rawBodyRef = useRef<HTMLDivElement | null>(null);
  const internalClipboardRef = useRef<{
    rMin: number;
    cMin: number;
    rawMatrix: string[][];
    displayMatrix: string[][];
    tsvText: string;
  } | null>(null);
  const formulaPointDragRef = useRef<{
    isDragging: boolean;
    anchorRow: number;
    anchorCol: number;
    strStart: number;
    strEnd: number;
    target: 'cell' | 'formulaBar';
  } | null>(null);
  const historyRef = useRef<{
    undoStack: Array<{
      content: string;
      selection: { anchor: { row: number; col: number }; focus: { row: number; col: number } } | null;
    }>;
    redoStack: Array<{
      content: string;
      selection: { anchor: { row: number; col: number }; focus: { row: number; col: number } } | null;
    }>;
  }>({ undoStack: [], redoStack: [] });
  const undoRedoHandlerRef = useRef<{ undo: () => boolean; redo: () => boolean }>({
    undo: () => false,
    redo: () => false,
  });
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
      origRowIdx: idx + 1,
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

  // Initialize default grid selection when table loads so arrow keys & direct typing work immediately
  useEffect(() => {
    if (viewMode !== 'table' || parsed.headers.length === 0 || gridSelection !== null) return;
    const initRow = parsed.rows.length > 0 ? 1 : 0;
    const rawVal =
      initRow === 0
        ? parsed.headers[0]?.value ?? ''
        : parsed.rows[0]?.[0]?.value ?? '';
    const evalCell = evaluatedGrid.rows[initRow]?.[0];
    setGridSelection({ anchor: { row: initRow, col: 0 }, focus: { row: initRow, col: 0 } });
    setActiveFormulaCell({
      coord: `${colIndexToLetters(0)}${initRow + 1}`,
      row: initRow,
      col: 0,
      value: rawVal,
      display: evalCell?.isFormula ? evalCell.display : rawVal,
    });
    setFormulaBarText(rawVal);
  }, [viewMode, parsed.headers.length, parsed.rows.length, gridSelection]);

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

  useEffect(() => {
    if (!showInsertTable) return;
    const onDown = (e: MouseEvent) => {
      if (insertTableWrapRef.current && !insertTableWrapRef.current.contains(e.target as Node)) {
        setShowInsertTable(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowInsertTable(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [showInsertTable]);

  useEffect(() => {
    if (!editingCell) return;
    const raf = window.requestAnimationFrame(() => {
      const inp = editInputRef.current;
      if (!inp) return;
      inp.focus();
      if (editingCell.selectAllOnMount) {
        inp.select();
      } else {
        const len = inp.value.length;
        inp.setSelectionRange(len, len);
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [editingCell?.key]);

  const evaluatedGrid = useMemo(() => {
    const headerRaw = parsed.headers.map((h) => h.value ?? '');
    const bodyRaw = parsed.rows.map((r) =>
      parsed.headers.map((_, cIdx) => r[cIdx]?.value ?? '')
    );
    return evaluateSpreadsheetGrid([headerRaw, ...bodyRaw]);
  }, [parsed.headers, parsed.rows]);

  const handleExportSpreadsheet = async (format: 'xlsx' | 'ods') => {
    const baseName = (fileName || 'sheet').replace(/\.(csv|tsv)$/i, '');
    if (format === 'xlsx') {
      const bytes = buildXlsxBytes(evaluatedGrid);
      await saveBinaryExportFile(
        bytes,
        `${baseName}.xlsx`,
        'Excel Workbook',
        ['xlsx'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } else {
      const bytes = buildOdsBytes(evaluatedGrid);
      await saveBinaryExportFile(
        bytes,
        `${baseName}.ods`,
        'OpenDocument Spreadsheet',
        ['ods'],
        'application/vnd.oasis.opendocument.spreadsheet'
      );
    }
  };

  const getRawGridMatrix = (): string[][] => {
    const headerRaw = parsed.headers.map((h) => h.value ?? '');
    const bodyRaw = parsed.rows.map((r) =>
      parsed.headers.map((_, cIdx) => r[cIdx]?.value ?? '')
    );
    return [headerRaw, ...bodyRaw];
  };

  const commitNextContent = (nextContent: string) => {
    if (!onUpdateContent || nextContent === content) return;
    historyRef.current.undoStack.push({
      content,
      selection: gridSelection
        ? { anchor: { ...gridSelection.anchor }, focus: { ...gridSelection.focus } }
        : null,
    });
    if (historyRef.current.undoStack.length > 100) {
      historyRef.current.undoStack.shift();
    }
    historyRef.current.redoStack = [];
    onUpdateContent(nextContent);
  };

  const performUndo = (): boolean => {
    if (!onUpdateContent) return false;
    const entry = historyRef.current.undoStack.pop();
    if (!entry) return false;
    historyRef.current.redoStack.push({
      content,
      selection: gridSelection
        ? { anchor: { ...gridSelection.anchor }, focus: { ...gridSelection.focus } }
        : null,
    });
    setEditingCell(null);
    setAutoFillSmartTag(null);
    onUpdateContent(entry.content);
    if (entry.selection) {
      setGridSelection(entry.selection);
    }
    return true;
  };

  const performRedo = (): boolean => {
    if (!onUpdateContent) return false;
    const entry = historyRef.current.redoStack.pop();
    if (!entry) return false;
    historyRef.current.undoStack.push({
      content,
      selection: gridSelection
        ? { anchor: { ...gridSelection.anchor }, focus: { ...gridSelection.focus } }
        : null,
    });
    setEditingCell(null);
    setAutoFillSmartTag(null);
    onUpdateContent(entry.content);
    if (entry.selection) {
      setGridSelection(entry.selection);
    }
    return true;
  };

  undoRedoHandlerRef.current = { undo: performUndo, redo: performRedo };

  useEffect(() => {
    historyRef.current = { undoStack: [], redoStack: [] };
  }, [fileName]);

  useEffect(() => {
    const onMenuUndoRedo = (ev: Event) => {
      const detail = (ev as CustomEvent<{ kind?: 'undo' | 'redo' }>).detail;
      if (detail?.kind === 'undo') undoRedoHandlerRef.current.undo();
      else if (detail?.kind === 'redo') undoRedoHandlerRef.current.redo();
    };
    window.addEventListener('onigiri-data-undo', onMenuUndoRedo);
    return () => window.removeEventListener('onigiri-data-undo', onMenuUndoRedo);
  }, []);

  const commitGridMatrix = (matrix: string[][]) => {
    if (!onUpdateContent || matrix.length === 0) return;
    const delim =
      delimiterOverride !== 'auto'
        ? delimiterOverride
        : parsed.delimiter || (isTsv ? '\t' : ',');
    const nextContent = tableRowsToDelimited(matrix[0] || [], matrix.slice(1), delim);
    commitNextContent(nextContent);
  };

  const commitFormulaBarEdit = () => {
    if (!activeFormulaCell || !onUpdateContent) return;
    const matrix = getRawGridMatrix();
    const { row, col } = activeFormulaCell;
    while (matrix.length <= row) {
      matrix.push(new Array(Math.max(1, parsed.headers.length)).fill(''));
    }
    while (matrix[row].length <= col) {
      matrix[row].push('');
    }
    matrix[row][col] = formulaBarText;
    formulaPointDragRef.current = null;
    commitGridMatrix(matrix);
  };

  const activeFormulaEditTarget: 'cell' | 'formulaBar' | null =
    editingCell && editingCell.value.trimStart().startsWith('=')
      ? 'cell'
      : formulaBarFocused && activeFormulaCell && formulaBarText.trimStart().startsWith('=')
        ? 'formulaBar'
        : null;

  const activeFormulaEditText =
    activeFormulaEditTarget === 'cell'
      ? editingCell?.value ?? ''
      : activeFormulaEditTarget === 'formulaBar'
        ? formulaBarText
        : '';

  const formulaRefHighlightSet = useMemo(() => {
    const set = new Set<string>();
    if (!activeFormulaEditText.trimStart().startsWith('=')) return set;
    const expr = activeFormulaEditText.replace(/"(?:[^"]|"")*"/g, '""');
    const rangeRe = /(\$?[A-Za-z]{1,3}\$?\d+)\s*:\s*(\$?[A-Za-z]{1,3}\$?\d+)/g;
    let m: RegExpExecArray | null;
    const stripped = expr.replace(rangeRe, (_full, startRef: string, endRef: string) => {
      const s = parseCellRef(startRef);
      const e = parseCellRef(endRef);
      if (s && e) {
        const rMin = Math.min(s.row, e.row);
        const rMax = Math.max(s.row, e.row);
        const cMin = Math.min(s.col, e.col);
        const cMax = Math.max(s.col, e.col);
        for (let r = rMin; r <= rMax && r <= parsed.rows.length + 5; r++) {
          for (let c = cMin; c <= cMax && c <= parsed.headers.length + 5; c++) {
            set.add(`${r}:${c}`);
          }
        }
      }
      return ' ';
    });
    const singleRe = /(?<![A-Za-z0-9_])\$?[A-Za-z]{1,3}\$?\d+(?![A-Za-z0-9_(])/g;
    while ((m = singleRe.exec(stripped)) !== null) {
      const p = parseCellRef(m[0]);
      if (p) set.add(`${p.row}:${p.col}`);
    }
    return set;
  }, [activeFormulaEditText, parsed.rows.length, parsed.headers.length]);

  const applyFormulaPointRef = (targetRow: number, targetCol: number, isDragUpdate: boolean) => {
    const target = activeFormulaEditTarget;
    if (!target) return;
    const inputEl = target === 'cell' ? editInputRef.current : formulaBarInputRef.current;
    const curText = target === 'cell' ? editingCell?.value ?? '' : formulaBarText;
    const setText = (next: string) => {
      if (target === 'cell') {
        setEditingCell((prev) => (prev ? { ...prev, value: next } : null));
        setFormulaBarText(next);
      } else {
        setFormulaBarText(next);
      }
    };

    const formatRefRange = (r1: number, c1: number, r2: number, c2: number) => {
      const rMin = Math.min(r1, r2);
      const rMax = Math.max(r1, r2);
      const cMin = Math.min(c1, c2);
      const cMax = Math.max(c1, c2);
      const startCoord = `${colIndexToLetters(cMin)}${rMin + 1}`;
      if (rMin === rMax && cMin === cMax) return startCoord;
      return `${startCoord}:${colIndexToLetters(cMax)}${rMax + 1}`;
    };

    if (isDragUpdate) {
      const drag = formulaPointDragRef.current;
      if (!drag || !drag.isDragging || drag.target !== target) return;
      const refStr = formatRefRange(drag.anchorRow, drag.anchorCol, targetRow, targetCol);
      const next = curText.slice(0, drag.strStart) + refStr + curText.slice(drag.strEnd);
      const nextEnd = drag.strStart + refStr.length;
      formulaPointDragRef.current = { ...drag, strEnd: nextEnd };
      setText(next);
      window.requestAnimationFrame(() => {
        if (inputEl) {
          inputEl.focus();
          inputEl.setSelectionRange(nextEnd, nextEnd);
        }
      });
      return;
    }

    const selStart = inputEl?.selectionStart ?? curText.length;
    const selEnd = inputEl?.selectionEnd ?? curText.length;
    const prevDrag = formulaPointDragRef.current;
    const coord = `${colIndexToLetters(targetCol)}${targetRow + 1}`;

    // If the user just pointed a ref and immediately clicks another cell without typing an operator,
    // replace that pointed reference (just like Excel).
    if (
      prevDrag &&
      prevDrag.target === target &&
      selStart === selEnd &&
      selStart === prevDrag.strEnd &&
      prevDrag.strStart <= prevDrag.strEnd &&
      prevDrag.strEnd <= curText.length
    ) {
      const next = curText.slice(0, prevDrag.strStart) + coord + curText.slice(prevDrag.strEnd);
      const nextEnd = prevDrag.strStart + coord.length;
      formulaPointDragRef.current = {
        isDragging: true,
        anchorRow: targetRow,
        anchorCol: targetCol,
        strStart: prevDrag.strStart,
        strEnd: nextEnd,
        target,
      };
      setText(next);
      window.requestAnimationFrame(() => {
        if (inputEl) {
          inputEl.focus();
          inputEl.setSelectionRange(nextEnd, nextEnd);
        }
      });
      return;
    }

    const next = curText.slice(0, selStart) + coord + curText.slice(selEnd);
    const nextEnd = selStart + coord.length;
    formulaPointDragRef.current = {
      isDragging: true,
      anchorRow: targetRow,
      anchorCol: targetCol,
      strStart: selStart,
      strEnd: nextEnd,
      target,
    };
    setText(next);
    window.requestAnimationFrame(() => {
      if (inputEl) {
        inputEl.focus();
        inputEl.setSelectionRange(nextEnd, nextEnd);
      }
    });
  };

  const selectionBounds = useMemo(() => {
    if (!gridSelection) return null;
    return {
      rMin: Math.min(gridSelection.anchor.row, gridSelection.focus.row),
      rMax: Math.max(gridSelection.anchor.row, gridSelection.focus.row),
      cMin: Math.min(gridSelection.anchor.col, gridSelection.focus.col),
      cMax: Math.max(gridSelection.anchor.col, gridSelection.focus.col),
    };
  }, [gridSelection]);

  const fillTargetBounds = useMemo(() => {
    if (!fillDrag) return null;
    const drDown = Math.max(0, fillDrag.targetRow - fillDrag.rMax);
    const drUp = Math.max(0, fillDrag.rMin - fillDrag.targetRow);
    const dcRight = Math.max(0, fillDrag.targetCol - fillDrag.cMax);
    const dcLeft = Math.max(0, fillDrag.cMin - fillDrag.targetCol);
    const maxV = Math.max(drDown, drUp);
    const maxH = Math.max(dcRight, dcLeft);
    if (maxV === 0 && maxH === 0) return null;
    if (maxV >= maxH) {
      return {
        rMin: Math.min(fillDrag.rMin, fillDrag.targetRow),
        rMax: Math.max(fillDrag.rMax, fillDrag.targetRow),
        cMin: fillDrag.cMin,
        cMax: fillDrag.cMax,
        direction: drDown >= drUp ? ('down' as const) : ('up' as const),
      };
    }
    return {
      rMin: fillDrag.rMin,
      rMax: fillDrag.rMax,
      cMin: Math.min(fillDrag.cMin, fillDrag.targetCol),
      cMax: Math.max(fillDrag.cMax, fillDrag.targetCol),
      direction: dcRight >= dcLeft ? ('right' as const) : ('left' as const),
    };
  }, [fillDrag]);

  const rangeSelectionStats = useMemo(() => {
    if (!selectionBounds) return null;
    const { rMin, rMax, cMin, cMax } = selectionBounds;
    if (rMin === rMax && cMin === cMax) return null;
    let totalCells = 0;
    let nonEmpty = 0;
    let sum = 0;
    let numCount = 0;
    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        totalCells++;
        const cell = evaluatedGrid.rows[r]?.[c];
        if (!cell) continue;
        if (cell.display.trim() !== '') nonEmpty++;
        if (cell.numericValue !== null && !cell.error) {
          sum += cell.numericValue;
          numCount++;
        }
      }
    }
    return {
      label: `${colIndexToLetters(cMin)}${rMin + 1}:${colIndexToLetters(cMax)}${rMax + 1}`,
      totalCells,
      nonEmpty,
      numCount,
      sum: Number(sum.toFixed(6)),
      avg: numCount > 0 ? Number((sum / numCount).toFixed(4)) : null,
    };
  }, [selectionBounds, evaluatedGrid]);

  const executeAutoFill = (
    baseMatrix: string[][],
    src: { rMin: number; rMax: number; cMin: number; cMax: number },
    target: { rMin: number; rMax: number; cMin: number; cMax: number; direction: AutoFillDirection },
    mode: AutoFillMode,
    toggleModifier: boolean
  ): { nextMatrix: string[][]; effectiveMode: Exclude<AutoFillMode, 'auto'>; hasDate: boolean } => {
    const nextMatrix = baseMatrix.map((row) => [...row]);
    const isVertical = target.direction === 'down' || target.direction === 'up';
    let effectiveMode: Exclude<AutoFillMode, 'auto'> = mode === 'auto' ? 'copy' : mode;
    let hasDate = false;
    const dateRe = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{4}年\d{1,2}月\d{1,2}日$/;

    if (isVertical) {
      const count =
        target.direction === 'down'
          ? target.rMax - src.rMax
          : src.rMin - target.rMin;
      if (count > 0) {
        for (let c = src.cMin; c <= src.cMax; c++) {
          const srcSlice: string[] = [];
          for (let r = src.rMin; r <= src.rMax; r++) {
            srcSlice.push(baseMatrix[r]?.[c] ?? '');
          }
          if (srcSlice.some((v) => dateRe.test(v.trim()))) hasDate = true;
          if (c === src.cMin) {
            effectiveMode = resolveAutoFillEffectiveMode(srcSlice, mode, toggleModifier);
          }
          const generated = generateAutoFillSeries(srcSlice, count, target.direction, mode, toggleModifier);
          for (let i = 0; i < count; i++) {
            const destRow = target.direction === 'down' ? src.rMax + 1 + i : src.rMin - count + i;
            if (nextMatrix[destRow]) nextMatrix[destRow][c] = generated[i];
          }
        }
      }
    } else {
      const count =
        target.direction === 'right'
          ? target.cMax - src.cMax
          : src.cMin - target.cMin;
      if (count > 0) {
        for (let r = src.rMin; r <= src.rMax; r++) {
          const srcSlice: string[] = [];
          for (let c = src.cMin; c <= src.cMax; c++) {
            srcSlice.push(baseMatrix[r]?.[c] ?? '');
          }
          if (srcSlice.some((v) => dateRe.test(v.trim()))) hasDate = true;
          if (r === src.rMin) {
            effectiveMode = resolveAutoFillEffectiveMode(srcSlice, mode, toggleModifier);
          }
          const generated = generateAutoFillSeries(srcSlice, count, target.direction, mode, toggleModifier);
          for (let i = 0; i < count; i++) {
            const destCol = target.direction === 'right' ? src.cMax + 1 + i : src.cMin - count + i;
            if (nextMatrix[r]) nextMatrix[r][destCol] = generated[i];
          }
        }
      }
    }
    return { nextMatrix, effectiveMode, hasDate };
  };

  const fillDragPreview = useMemo(() => {
    if (!fillDrag || !fillTargetBounds) return null;
    const matrix = getRawGridMatrix();
    const { rMin, rMax, cMin, cMax } = fillDrag;
    const dir = fillTargetBounds.direction;
    let previewText = '';
    let effectiveMode: Exclude<AutoFillMode, 'auto'> = 'copy';

    if (dir === 'down' || dir === 'up') {
      const count = dir === 'down' ? fillTargetBounds.rMax - rMax : rMin - fillTargetBounds.rMin;
      const srcSlice: string[] = [];
      for (let r = rMin; r <= rMax; r++) srcSlice.push(matrix[r]?.[cMax] ?? '');
      effectiveMode = resolveAutoFillEffectiveMode(srcSlice, 'auto', fillDrag.ctrlPressed);
      const gen = generateAutoFillSeries(srcSlice, count, dir, 'auto', fillDrag.ctrlPressed);
      previewText = dir === 'down' ? (gen[gen.length - 1] ?? '') : (gen[0] ?? '');
    } else {
      const count = dir === 'right' ? fillTargetBounds.cMax - cMax : cMin - fillTargetBounds.cMin;
      const srcSlice: string[] = [];
      for (let c = cMin; c <= cMax; c++) srcSlice.push(matrix[rMax]?.[c] ?? '');
      effectiveMode = resolveAutoFillEffectiveMode(srcSlice, 'auto', fillDrag.ctrlPressed);
      const gen = generateAutoFillSeries(srcSlice, count, dir, 'auto', fillDrag.ctrlPressed);
      previewText = dir === 'right' ? (gen[gen.length - 1] ?? '') : (gen[0] ?? '');
    }
    return {
      text: previewText,
      effectiveMode,
      clientX: fillDrag.clientX,
      clientY: fillDrag.clientY,
    };
  }, [fillDrag, fillTargetBounds, parsed.headers, parsed.rows, content]);

  const handleFillHandleDoubleClick = () => {
    if (!selectionBounds || !onUpdateContent) return;
    const matrix = getRawGridMatrix();
    const { rMin, rMax, cMin, cMax } = selectionBounds;
    const adjCol = cMin > 0 ? cMin - 1 : cMax + 1;
    if (adjCol < 0 || adjCol >= (matrix[0]?.length ?? 0)) return;
    let lastRow = rMax;
    for (let r = rMax + 1; r < matrix.length; r++) {
      if ((matrix[r]?.[adjCol] ?? '').trim() !== '') {
        lastRow = r;
      } else {
        break;
      }
    }
    if (lastRow <= rMax) return;
    const target = { rMin, rMax: lastRow, cMin, cMax, direction: 'down' as const };
    const { nextMatrix, effectiveMode, hasDate } = executeAutoFill(
      matrix,
      selectionBounds,
      target,
      'auto',
      false
    );
    commitGridMatrix(nextMatrix);
    setGridSelection({
      anchor: { row: rMin, col: cMin },
      focus: { row: lastRow, col: cMax },
    });
    setAutoFillSmartTag({
      rMin,
      rMax: lastRow,
      cMin,
      cMax,
      srcRMin: rMin,
      srcRMax: rMax,
      srcCMin: cMin,
      srcCMax: cMax,
      direction: 'down',
      activeMode: effectiveMode,
      hasDate,
      preFillMatrix: matrix,
      menuOpen: false,
    });
  };

  useEffect(() => {
    if (!isRangeSelecting && !fillDrag && !activeFormulaEditTarget) return;
    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!fillDrag) return;
      const mod = e.ctrlKey || e.altKey;
      setFillDrag((prev) =>
        prev
          ? { ...prev, ctrlPressed: mod, clientX: e.clientX, clientY: e.clientY }
          : null
      );
    };
    const onGlobalKeyChange = (e: KeyboardEvent) => {
      if (!fillDrag) return;
      const mod = e.ctrlKey || e.altKey;
      setFillDrag((prev) => (prev && prev.ctrlPressed !== mod ? { ...prev, ctrlPressed: mod } : prev));
    };
    const onGlobalMouseUp = () => {
      if (formulaPointDragRef.current) {
        formulaPointDragRef.current.isDragging = false;
      }
      if (fillDrag && fillTargetBounds && onUpdateContent) {
        const matrix = getRawGridMatrix();
        const src = {
          rMin: fillDrag.rMin,
          rMax: fillDrag.rMax,
          cMin: fillDrag.cMin,
          cMax: fillDrag.cMax,
        };
        const { nextMatrix, effectiveMode, hasDate } = executeAutoFill(
          matrix,
          src,
          fillTargetBounds,
          'auto',
          fillDrag.ctrlPressed
        );
        commitGridMatrix(nextMatrix);
        setGridSelection({
          anchor: { row: fillTargetBounds.rMin, col: fillTargetBounds.cMin },
          focus: { row: fillTargetBounds.rMax, col: fillTargetBounds.cMax },
        });
        setAutoFillSmartTag({
          rMin: fillTargetBounds.rMin,
          rMax: fillTargetBounds.rMax,
          cMin: fillTargetBounds.cMin,
          cMax: fillTargetBounds.cMax,
          srcRMin: src.rMin,
          srcRMax: src.rMax,
          srcCMin: src.cMin,
          srcCMax: src.cMax,
          direction: fillTargetBounds.direction,
          activeMode: effectiveMode,
          hasDate,
          preFillMatrix: matrix,
          menuOpen: false,
        });
      }
      setIsRangeSelecting(false);
      setFillDrag(null);
    };
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('keydown', onGlobalKeyChange);
    window.addEventListener('keyup', onGlobalKeyChange);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('keydown', onGlobalKeyChange);
      window.removeEventListener('keyup', onGlobalKeyChange);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  });

  useEffect(() => {
    if (!cellCtxMenu && !autoFillSmartTag?.menuOpen) return;
    const close = () => {
      setCellCtxMenu(null);
      setAutoFillSmartTag((prev) => (prev ? { ...prev, menuOpen: false } : null));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [cellCtxMenu, autoFillSmartTag?.menuOpen]);

  const selectGridCell = (row: number, col: number, extend = false) => {
    const safeRow = Math.max(0, Math.min(row, parsed.rows.length));
    const safeCol = Math.max(0, Math.min(col, Math.max(0, parsed.headers.length - 1)));
    setGridSelection((prev) => ({
      anchor: extend && prev ? prev.anchor : { row: safeRow, col: safeCol },
      focus: { row: safeRow, col: safeCol },
    }));
    const rawVal =
      safeRow === 0
        ? parsed.headers[safeCol]?.value ?? ''
        : parsed.rows[safeRow - 1]?.[safeCol]?.value ?? '';
    const evalCell = evaluatedGrid.rows[safeRow]?.[safeCol];
    setActiveFormulaCell({
      coord: `${colIndexToLetters(safeCol)}${safeRow + 1}`,
      row: safeRow,
      col: safeCol,
      value: rawVal,
      display: evalCell?.isFormula ? evalCell.display : rawVal,
    });
    setFormulaBarText(rawVal);
  };

  const startCellEdit = (
    row: number,
    col: number,
    initialValue?: string,
    selectAllOnMount = false
  ) => {
    if (!onUpdateContent) return;
    const safeRow = Math.max(0, Math.min(row, parsed.rows.length));
    const safeCol = Math.max(0, Math.min(col, Math.max(0, parsed.headers.length - 1)));
    const matrix = getRawGridMatrix();
    const rawVal = matrix[safeRow]?.[safeCol] ?? '';
    const nextVal = initialValue !== undefined ? initialValue : rawVal;
    const cellKey = safeRow === 0 ? `h-${safeCol}` : `r-${safeRow}-c-${safeCol}`;
    const evalCell = evaluatedGrid.rows[safeRow]?.[safeCol];
    formulaPointDragRef.current = null;
    setActiveFormulaCell({
      coord: `${colIndexToLetters(safeCol)}${safeRow + 1}`,
      row: safeRow,
      col: safeCol,
      value: rawVal,
      display: evalCell?.isFormula ? evalCell.display : rawVal,
    });
    setFormulaBarText(nextVal);
    setEditingCell({
      key: cellKey,
      row: safeRow,
      col: safeCol,
      value: nextVal,
      selectAllOnMount,
    });
  };

  const commitCellEdit = (moveDir?: { dRow: number; dCol: number }) => {
    if (!editingCell || !onUpdateContent) {
      setEditingCell(null);
      return;
    }
    const { row, col, value } = editingCell;
    const matrix = getRawGridMatrix();
    const minCols = Math.max(1, parsed.headers.length, col + 1);
    while (matrix.length <= row) {
      matrix.push(new Array(minCols).fill(''));
    }
    while (matrix[row].length < minCols) {
      matrix[row].push('');
    }
    matrix[row][col] = value;
    setEditingCell(null);
    formulaPointDragRef.current = null;
    commitGridMatrix(matrix);
    setFormulaBarText(value);
    if (moveDir) {
      selectGridCell(row + moveDir.dRow, col + moveDir.dCol, false);
      window.requestAnimationFrame(() => tableWrapRef.current?.focus({ preventScroll: true }));
    }
  };

  const getActiveBounds = (fallbackRow?: number, fallbackCol?: number) => {
    if (selectionBounds) return selectionBounds;
    if (typeof fallbackRow === 'number' && typeof fallbackCol === 'number') {
      return { rMin: fallbackRow, rMax: fallbackRow, cMin: fallbackCol, cMax: fallbackCol };
    }
    if (gridSelection) {
      return {
        rMin: gridSelection.focus.row,
        rMax: gridSelection.focus.row,
        cMin: gridSelection.focus.col,
        cMax: gridSelection.focus.col,
      };
    }
    return null;
  };

  const copySelectionRange = async (asDisplayValue = false, fallbackRow?: number, fallbackCol?: number) => {
    const bounds = getActiveBounds(fallbackRow, fallbackCol);
    if (!bounds) return;
    const matrix = getRawGridMatrix();
    const rawMatrix: string[][] = [];
    const displayMatrix: string[][] = [];
    const lines: string[] = [];
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
      const rawRow: string[] = [];
      const dispRow: string[] = [];
      for (let c = bounds.cMin; c <= bounds.cMax; c++) {
        const rawVal = matrix[r]?.[c] ?? '';
        const ev = evaluatedGrid.rows[r]?.[c];
        const dispVal = ev?.isFormula ? ev.display : rawVal;
        rawRow.push(rawVal);
        dispRow.push(dispVal);
      }
      rawMatrix.push(rawRow);
      displayMatrix.push(dispRow);
      lines.push((asDisplayValue ? dispRow : rawRow).join('\t'));
    }
    const tsvText = lines.join('\n');
    internalClipboardRef.current = {
      rMin: bounds.rMin,
      cMin: bounds.cMin,
      rawMatrix,
      displayMatrix,
      tsvText,
    };
    await writeClipboardText(tsvText);
    onCopyNotify();
  };

  const cutSelectionRange = async (fallbackRow?: number, fallbackCol?: number) => {
    const bounds = getActiveBounds(fallbackRow, fallbackCol);
    if (!bounds || !onUpdateContent) return;
    await copySelectionRange(false, fallbackRow, fallbackCol);
    const matrix = getRawGridMatrix();
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
      for (let c = bounds.cMin; c <= bounds.cMax; c++) {
        if (matrix[r]) matrix[r][c] = '';
      }
    }
    commitGridMatrix(matrix);
  };

  const pasteToSelection = async (valuesOnly = false, fallbackRow?: number, fallbackCol?: number) => {
    if (!onUpdateContent) return;
    const bounds = getActiveBounds(fallbackRow, fallbackCol);
    const startR = bounds ? bounds.rMin : 0;
    const startC = bounds ? bounds.cMin : 0;
    const maxCol = Math.max(0, parsed.headers.length - 1);

    let clipText = '';
    try {
      clipText = await navigator.clipboard.readText();
    } catch {
      clipText = internalClipboardRef.current?.tsvText ?? '';
    }
    if (!clipText && internalClipboardRef.current) {
      clipText = internalClipboardRef.current.tsvText;
    }
    if (!clipText) return;

    const normalizedClip = clipText.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const internal = internalClipboardRef.current;
    const useInternal =
      internal !== null && normalizedClip === internal.tsvText;

    const pasteRows = useInternal
      ? (valuesOnly ? internal.displayMatrix : internal.rawMatrix)
      : normalizedClip.split('\n').map((l) => l.split('\t'));

    const matrix = getRawGridMatrix();
    const neededRows = startR + pasteRows.length;
    const neededCols = Math.max(
      maxCol + 1,
      startC + Math.max(...pasteRows.map((r) => r.length))
    );
    while (matrix.length < neededRows) {
      matrix.push(new Array(neededCols).fill(''));
    }
    for (const r of matrix) {
      while (r.length < neededCols) r.push('');
    }
    for (let pr = 0; pr < pasteRows.length; pr++) {
      for (let pc = 0; pc < pasteRows[pr].length; pc++) {
        let val = pasteRows[pr][pc];
        if (useInternal && !valuesOnly && val.trim().startsWith('=')) {
          const rowDelta = startR - internal.rMin;
          const colDelta = startC - internal.cMin;
          val = shiftFormulaReferences(val, rowDelta, colDelta);
        }
        matrix[startR + pr][startC + pc] = val;
      }
    }
    commitGridMatrix(matrix);
    setGridSelection({
      anchor: { row: startR, col: startC },
      focus: {
        row: startR + pasteRows.length - 1,
        col: startC + Math.max(0, (pasteRows[0]?.length ?? 1) - 1),
      },
    });
  };

  const handleTableKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editingCell) return;
    const targetTag = (e.target as HTMLElement)?.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
    if (!gridSelection) return;

    const { focus } = gridSelection;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectGridCell(focus.row - 1, focus.col, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectGridCell(focus.row + 1, focus.col, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectGridCell(focus.row, focus.col - 1, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectGridCell(focus.row, focus.col + 1, e.shiftKey);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      selectGridCell(focus.row, focus.col + (e.shiftKey ? -1 : 1), false);
      return;
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      if (!onUpdateContent) return;
      e.preventDefault();
      startCellEdit(focus.row, focus.col, undefined, false);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && onUpdateContent && selectionBounds) {
      e.preventDefault();
      const matrix = getRawGridMatrix();
      for (let r = selectionBounds.rMin; r <= selectionBounds.rMax; r++) {
        for (let c = selectionBounds.cMin; c <= selectionBounds.cMax; c++) {
          if (matrix[r]) matrix[r][c] = '';
        }
      }
      commitGridMatrix(matrix);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && onUpdateContent) {
      e.preventDefault();
      performUndo();
      return;
    }
    if (
      (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'y')) &&
      onUpdateContent
    ) {
      e.preventDefault();
      performRedo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && selectionBounds) {
      e.preventDefault();
      await copySelectionRange(false);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x' && selectionBounds && onUpdateContent) {
      e.preventDefault();
      await cutSelectionRange();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && onUpdateContent && selectionBounds) {
      e.preventDefault();
      const matrix = getRawGridMatrix();
      const { rMin, rMax, cMin, cMax } = selectionBounds;
      if (rMax > rMin) {
        const { nextMatrix } = executeAutoFill(
          matrix,
          { rMin, rMax: rMin, cMin, cMax },
          { rMin, rMax, cMin, cMax, direction: 'down' },
          'copy',
          false
        );
        commitGridMatrix(nextMatrix);
      } else if (rMin > 0) {
        const { nextMatrix } = executeAutoFill(
          matrix,
          { rMin: rMin - 1, rMax: rMin - 1, cMin, cMax },
          { rMin: rMin - 1, rMax: rMin, cMin, cMax, direction: 'down' },
          'copy',
          false
        );
        commitGridMatrix(nextMatrix);
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r' && onUpdateContent && selectionBounds) {
      e.preventDefault();
      const matrix = getRawGridMatrix();
      const { rMin, rMax, cMin, cMax } = selectionBounds;
      if (cMax > cMin) {
        const { nextMatrix } = executeAutoFill(
          matrix,
          { rMin, rMax, cMin, cMax: cMin },
          { rMin, rMax, cMin, cMax, direction: 'right' },
          'copy',
          false
        );
        commitGridMatrix(nextMatrix);
      } else if (cMin > 0) {
        const { nextMatrix } = executeAutoFill(
          matrix,
          { rMin, rMax, cMin: cMin - 1, cMax: cMin - 1 },
          { rMin, rMax, cMin: cMin - 1, cMax: cMin, direction: 'right' },
          'copy',
          false
        );
        commitGridMatrix(nextMatrix);
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v' && onUpdateContent) {
      e.preventDefault();
      await pasteToSelection(false);
      return;
    }
    // Direct typing on selected cell (Excel-style)
    if (onUpdateContent && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === 'Process') {
        startCellEdit(focus.row, focus.col, '', false);
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        startCellEdit(focus.row, focus.col, e.key, false);
      }
    }
  };

  const applyRowColAction = (
    action:
      | 'cut'
      | 'copy'
      | 'copy-value'
      | 'paste'
      | 'paste-values'
      | 'insert-row-above'
      | 'insert-row-below'
      | 'insert-col-left'
      | 'insert-col-right'
      | 'delete-row'
      | 'delete-col'
      | 'clear-selection'
  ) => {
    if (!cellCtxMenu) return;
    const { row, col } = cellCtxMenu;
    setCellCtxMenu(null);

    if (action === 'copy') {
      void copySelectionRange(false, row, col);
      return;
    }
    if (action === 'copy-value') {
      void copySelectionRange(true, row, col);
      return;
    }
    if (action === 'cut') {
      void cutSelectionRange(row, col);
      return;
    }
    if (action === 'paste') {
      void pasteToSelection(false, row, col);
      return;
    }
    if (action === 'paste-values') {
      void pasteToSelection(true, row, col);
      return;
    }

    if (!onUpdateContent) return;
    let matrix = getRawGridMatrix();
    const colCount = matrix[0]?.length || 1;

    if (action === 'insert-row-above') {
      matrix.splice(row, 0, new Array(colCount).fill(''));
      matrix = adjustFormulasForRowColEdit(matrix, 'insert-row', row);
    } else if (action === 'insert-row-below') {
      matrix.splice(row + 1, 0, new Array(colCount).fill(''));
      matrix = adjustFormulasForRowColEdit(matrix, 'insert-row', row + 1);
    } else if (action === 'delete-row') {
      if (matrix.length > 1) {
        matrix.splice(row, 1);
        matrix = adjustFormulasForRowColEdit(matrix, 'delete-row', row);
      }
    } else if (action === 'insert-col-left') {
      for (const r of matrix) r.splice(col, 0, '');
      matrix = adjustFormulasForRowColEdit(matrix, 'insert-col', col);
    } else if (action === 'insert-col-right') {
      for (const r of matrix) r.splice(col + 1, 0, '');
      matrix = adjustFormulasForRowColEdit(matrix, 'insert-col', col + 1);
    } else if (action === 'delete-col') {
      if (colCount > 1) {
        for (const r of matrix) r.splice(col, 1);
        matrix = adjustFormulasForRowColEdit(matrix, 'delete-col', col);
      }
    } else if (action === 'clear-selection') {
      const bounds = getActiveBounds(row, col);
      if (bounds) {
        for (let r = bounds.rMin; r <= bounds.rMax; r++) {
          for (let c = bounds.cMin; c <= bounds.cMax; c++) {
            if (matrix[r]) matrix[r][c] = '';
          }
        }
      }
    }
    commitGridMatrix(matrix);
  };

  const handleInsertEmptyTable = () => {
    const rCount = Math.max(1, Math.min(200, Math.floor(insertRows) || 1));
    const cCount = Math.max(1, Math.min(50, Math.floor(insertCols) || 1));
    const delim =
      delimiterOverride !== 'auto'
        ? delimiterOverride
        : parsed.delimiter || (isTsv ? '\t' : ',');
    const emptyRow = new Array(Math.max(0, cCount - 1)).fill('').join(delim);
    const lines = new Array(rCount).fill(emptyRow).join('\n');
    setShowInsertTable(false);
    if (content.trim().length === 0 && onUpdateContent) {
      commitNextContent(lines);
    } else if (onInsertToEditor) {
      const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      onInsertToEditor(`${prefix}${lines}`);
    } else if (onUpdateContent) {
      const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
      commitNextContent(`${content}${prefix}${lines}`);
    }
  };

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
          {(onUpdateContent || onInsertToEditor) && (
            <div className="data-insert-table-wrap" ref={insertTableWrapRef}>
              <button
                type="button"
                className={`mini-pill-btn ${showInsertTable ? 'is-active' : ''}`}
                onClick={() => setShowInsertTable((v) => !v)}
                title={isJa ? '空の表をエディタに挿入' : 'Insert empty table into editor'}
              >
                <Plus size={12} />
                <span>{isJa ? '表を挿入' : 'Insert Table'}</span>
              </button>
              {showInsertTable && (
                <form
                  className="data-insert-table-popover"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleInsertEmptyTable();
                  }}
                >
                  <div className="data-insert-table-title">
                    {isJa ? '表サイズを指定' : 'Table Dimensions'}
                  </div>
                  <div className="data-insert-table-grid">
                    <label>
                      <span>{isJa ? '縦（行）' : 'Rows'}</span>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        className="text-input"
                        value={insertRows}
                        onChange={(e) => setInsertRows(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span>{isJa ? '横（列）' : 'Cols'}</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        className="text-input"
                        value={insertCols}
                        onChange={(e) => setInsertCols(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div className="data-insert-table-actions">
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => setShowInsertTable(false)}
                    >
                      {t.actions.cancel}
                    </button>
                    <button type="submit" className="mini-pill-btn is-primary">
                      {isJa ? '挿入' : 'Insert'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
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
          <button
            type="button"
            className="mini-pill-btn"
            onClick={() => void handleExportSpreadsheet('xlsx')}
            title={isJa ? 'Excel (.xlsx) 形式で保存' : 'Save as Excel (.xlsx)'}
          >
            <Download size={12} />
            <span>.xlsx</span>
          </button>
          <button
            type="button"
            className="mini-pill-btn"
            onClick={() => void handleExportSpreadsheet('ods')}
            title={isJa ? 'OpenDocument (.ods) 形式で保存' : 'Save as OpenDocument (.ods)'}
          >
            <Download size={12} />
            <span>.ods</span>
          </button>
        </div>
      </div>

      {viewMode === 'table' && evaluatedGrid.hasFormulas && (
        <div className="data-formula-save-banner">
          <div className="data-formula-save-msg">
            <FileSpreadsheet size={14} />
            <span>
              {isJa
                ? `数式・関数が ${evaluatedGrid.formulaCount} セルで使用されています。数式を保持するため .xlsx または .ods での保存をおすすめします。`
                : `Formulas detected in ${evaluatedGrid.formulaCount} cell(s). Save as .xlsx or .ods to preserve formulas instead of plain CSV text.`}
            </span>
          </div>
          <div className="data-formula-save-actions">
            <button
              type="button"
              className="mini-pill-btn is-primary"
              onClick={() => void handleExportSpreadsheet('xlsx')}
            >
              <Download size={12} />
              <span>{isJa ? '.xlsx で保存' : 'Save .xlsx'}</span>
            </button>
            <button
              type="button"
              className="mini-pill-btn is-primary"
              onClick={() => void handleExportSpreadsheet('ods')}
            >
              <Download size={12} />
              <span>{isJa ? '.ods で保存' : 'Save .ods'}</span>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'table' && parsed.headers.length > 0 && (
        <div className="data-formula-bar">
          <span className="data-formula-coord">
            {activeFormulaCell?.coord || 'A1'}
          </span>
          <span className="data-formula-fx">fx</span>
          <input
            ref={formulaBarInputRef}
            type="text"
            className="data-formula-input"
            value={formulaBarText}
            disabled={!onUpdateContent || !activeFormulaCell}
            placeholder={
              isJa
                ? 'セルを選択して値や数式（例: =SUM(B2:B5)）を編集...'
                : 'Select a cell to view or edit value / formula (e.g. =SUM(B2:B5))...'
            }
            onFocus={() => setFormulaBarFocused(true)}
            onBlur={() => {
              setFormulaBarFocused(false);
              formulaPointDragRef.current = null;
            }}
            onChange={(e) => {
              formulaPointDragRef.current = null;
              setFormulaBarText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                commitFormulaBarEdit();
                tableWrapRef.current?.focus({ preventScroll: true });
              } else if (e.key === 'Escape') {
                e.preventDefault();
                formulaPointDragRef.current = null;
                setFormulaBarText(activeFormulaCell?.value ?? '');
                tableWrapRef.current?.focus({ preventScroll: true });
              }
            }}
          />
          {onUpdateContent && activeFormulaCell && (
            <button
              type="button"
              className="mini-pill-btn is-primary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitFormulaBarEdit}
            >
              {isJa ? '適用' : 'Apply'}
            </button>
          )}
        </div>
      )}

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
            tabIndex={0}
            className="data-preview-table-wrap"
            onScroll={(e) => setTableScrollTop(e.currentTarget.scrollTop)}
            onMouseUp={handleTableMouseUp}
            onKeyDown={(e) => void handleTableKeyDown(e)}
          >
            <table className={`data-preview-table ${wrapCells ? 'is-wrapped' : ''}`}>
              <thead>
                <tr>
                  <th className="data-row-num-col">1</th>
                  {parsed.headers.map((h, cIdx) => {
                    const isSorted = sortCol === cIdx;
                    const isNum = numericCols[cIdx];
                    const sync = getEditorOverlapForCell(h, editorSelection, editorCursorOffset);
                    const cellKey = `h-${cIdx}`;
                    const evalHeader = evaluatedGrid.rows[0]?.[cIdx];
                    const headerDisplay = evalHeader?.isFormula ? evalHeader.display : h.value;
                    const inSelection =
                      selectionBounds !== null &&
                      0 >= selectionBounds.rMin &&
                      0 <= selectionBounds.rMax &&
                      cIdx >= selectionBounds.cMin &&
                      cIdx <= selectionBounds.cMax;
                    const isSelTop = inSelection && selectionBounds !== null && 0 === selectionBounds.rMin;
                    const isSelBottom = inSelection && selectionBounds !== null && 0 === selectionBounds.rMax;
                    const isSelLeft = inSelection && selectionBounds !== null && cIdx === selectionBounds.cMin;
                    const isSelRight = inSelection && selectionBounds !== null && cIdx === selectionBounds.cMax;
                    const isSelAnchor =
                      inSelection &&
                      gridSelection !== null &&
                      0 === gridSelection.anchor.row &&
                      cIdx === gridSelection.anchor.col;
                    const isFormulaRef = formulaRefHighlightSet.has(`0:${cIdx}`);
                    const thClasses = [
                      isNum ? 'is-numeric-col' : '',
                      evalHeader?.isFormula ? 'is-formula-cell' : '',
                      evalHeader?.error ? 'is-formula-error' : '',
                      inSelection ? 'is-grid-selected' : '',
                      isSelTop ? 'is-sel-top' : '',
                      isSelBottom ? 'is-sel-bottom' : '',
                      isSelLeft ? 'is-sel-left' : '',
                      isSelRight ? 'is-sel-right' : '',
                      isSelAnchor ? 'is-sel-anchor' : '',
                      isFormulaRef ? 'is-formula-ref-highlight' : '',
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
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          setCellCtxMenu(null);
                          if (activeFormulaEditTarget) {
                            const isSelf =
                              activeFormulaEditTarget === 'cell' &&
                              editingCell?.row === 0 &&
                              editingCell?.col === cIdx;
                            if (!isSelf) {
                              e.preventDefault();
                              applyFormulaPointRef(0, cIdx, false);
                            }
                            return;
                          }
                          if (editingCell) {
                            commitCellEdit();
                          }
                          e.preventDefault();
                          window.getSelection()?.removeAllRanges();
                          tableWrapRef.current?.focus({ preventScroll: true });
                          setAutoFillSmartTag(null);
                          if (e.shiftKey && gridSelection) {
                            selectGridCell(0, cIdx, true);
                          } else {
                            selectGridCell(0, cIdx, false);
                            setIsRangeSelecting(true);
                          }
                        }}
                        onMouseEnter={() => {
                          if (formulaPointDragRef.current?.isDragging && activeFormulaEditTarget) {
                            applyFormulaPointRef(0, cIdx, true);
                            return;
                          }
                          if (fillDrag) {
                            setFillDrag((prev) =>
                              prev ? { ...prev, targetRow: 0, targetCol: cIdx } : null
                            );
                          } else if (isRangeSelecting) {
                            selectGridCell(0, cIdx, true);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const inside =
                            selectionBounds !== null &&
                            0 >= selectionBounds.rMin &&
                            0 <= selectionBounds.rMax &&
                            cIdx >= selectionBounds.cMin &&
                            cIdx <= selectionBounds.cMax;
                          if (!inside) {
                            selectGridCell(0, cIdx, false);
                          }
                          setCellCtxMenu({
                            x: Math.min(e.clientX, window.innerWidth - 220),
                            y: Math.min(e.clientY, window.innerHeight - 360),
                            row: 0,
                            col: cIdx,
                          });
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeFormulaEditTarget) return;
                          handleCellClick(h, cellKey);
                        }}
                        onDoubleClick={(e) => {
                          if (!onUpdateContent) return;
                          e.stopPropagation();
                          startCellEdit(0, cIdx, undefined, false);
                        }}
                      >
                        {editingCell?.key === cellKey ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            className="data-cell-edit-input"
                            value={editingCell.value}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              formulaPointDragRef.current = null;
                              const nextVal = e.target.value;
                              setEditingCell((prev) =>
                                prev ? { ...prev, value: nextVal } : null
                              );
                              setFormulaBarText(nextVal);
                            }}
                            onBlur={() => commitCellEdit()}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitCellEdit({ dRow: e.shiftKey ? -1 : 1, dCol: 0 });
                              } else if (e.key === 'Tab') {
                                e.preventDefault();
                                commitCellEdit({ dRow: 0, dCol: e.shiftKey ? -1 : 1 });
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                formulaPointDragRef.current = null;
                                setEditingCell(null);
                                setFormulaBarText(activeFormulaCell?.value ?? '');
                                window.requestAnimationFrame(() =>
                                  tableWrapRef.current?.focus({ preventScroll: true })
                                );
                              }
                            }}
                          />
                        ) : (
                          <div className={`data-sort-th-btn ${isSorted ? 'is-sorted' : ''}`}>
                            <span className="data-col-letter">{colIndexToLetters(cIdx)}</span>
                            <span className="data-th-label">
                              {renderCellContent(headerDisplay, trimmedQuery, sync.syncSlice)}
                            </span>
                            <button
                              type="button"
                              className="data-sort-icon-btn"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSort(cIdx);
                              }}
                              title={
                                isJa
                                  ? `${h.value} でソート（クリックで昇順/降順/解除）`
                                  : `Sort by ${h.value} (click to sort)`
                              }
                            >
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
                          </div>
                        )}
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
                        const cellKey = `r-${row.origRowIdx}-c-${cIdx}`;
                        const evalCell = evaluatedGrid.rows[row.origRowIdx]?.[cIdx];
                        const displayVal = evalCell?.isFormula ? evalCell.display : cell.value;
                        const gridRowIdx = row.origRowIdx;
                        const isFormulaRef = formulaRefHighlightSet.has(`${gridRowIdx}:${cIdx}`);
                        const inSelection =
                          selectionBounds !== null &&
                          gridRowIdx >= selectionBounds.rMin &&
                          gridRowIdx <= selectionBounds.rMax &&
                          cIdx >= selectionBounds.cMin &&
                          cIdx <= selectionBounds.cMax;
                        const isFillTarget =
                          fillTargetBounds !== null &&
                          gridRowIdx >= fillTargetBounds.rMin &&
                          gridRowIdx <= fillTargetBounds.rMax &&
                          cIdx >= fillTargetBounds.cMin &&
                          cIdx <= fillTargetBounds.cMax &&
                          !(
                            fillDrag &&
                            gridRowIdx >= fillDrag.rMin &&
                            gridRowIdx <= fillDrag.rMax &&
                            cIdx >= fillDrag.cMin &&
                            cIdx <= fillDrag.cMax
                          );
                        const isBottomRightOfSelection =
                          selectionBounds !== null &&
                          gridRowIdx === selectionBounds.rMax &&
                          cIdx === selectionBounds.cMax &&
                          Boolean(onUpdateContent) &&
                          editingCell?.key !== cellKey;
                        const isSelTop =
                          inSelection && selectionBounds !== null && gridRowIdx === selectionBounds.rMin;
                        const isSelBottom =
                          inSelection && selectionBounds !== null && gridRowIdx === selectionBounds.rMax;
                        const isSelLeft =
                          inSelection && selectionBounds !== null && cIdx === selectionBounds.cMin;
                        const isSelRight =
                          inSelection && selectionBounds !== null && cIdx === selectionBounds.cMax;
                        const isSelAnchor =
                          inSelection &&
                          gridSelection !== null &&
                          gridRowIdx === gridSelection.anchor.row &&
                          cIdx === gridSelection.anchor.col;
                        const isSmartTagCell =
                          !fillDrag &&
                          autoFillSmartTag !== null &&
                          gridRowIdx === autoFillSmartTag.rMax &&
                          cIdx === autoFillSmartTag.cMax;
                        const isLastGridRow = gridRowIdx === parsed.rows.length;
                        const isLastGridCol = cIdx === parsed.headers.length - 1;
                        const tdClasses = [
                          isNum ? 'is-numeric-cell' : '',
                          evalCell?.isFormula ? 'is-formula-cell' : '',
                          evalCell?.error ? 'is-formula-error' : '',
                          inSelection ? 'is-grid-selected' : '',
                          isSelTop ? 'is-sel-top' : '',
                          isSelBottom ? 'is-sel-bottom' : '',
                          isSelLeft ? 'is-sel-left' : '',
                          isSelRight ? 'is-sel-right' : '',
                          isSelAnchor ? 'is-sel-anchor' : '',
                          isBottomRightOfSelection ? 'is-fill-handle-cell' : '',
                          isSmartTagCell ? 'is-smart-tag-cell' : '',
                          isFillTarget ? 'is-fill-target' : '',
                          isFormulaRef ? 'is-formula-ref-highlight' : '',
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
                              evalCell?.isFormula
                                ? `${cell.value} → ${evalCell.display}`
                                : onUpdateContent
                                  ? isJa
                                    ? `${cell.value ? `${cell.value} ` : ''}（ダブルクリックで編集）`
                                    : `${cell.value ? `${cell.value} ` : ''}(double-click to edit)`
                                  : cell.value || undefined
                            }
                            onMouseDown={(e) => {
                              if (e.button !== 0) return;
                              setCellCtxMenu(null);
                              if (activeFormulaEditTarget) {
                                const isSelf =
                                  activeFormulaEditTarget === 'cell' &&
                                  editingCell?.row === gridRowIdx &&
                                  editingCell?.col === cIdx;
                                if (!isSelf) {
                                  e.preventDefault();
                                  applyFormulaPointRef(gridRowIdx, cIdx, false);
                                }
                                return;
                              }
                              if (editingCell) {
                                commitCellEdit();
                              }
                              e.preventDefault();
                              window.getSelection()?.removeAllRanges();
                              tableWrapRef.current?.focus({ preventScroll: true });
                              setAutoFillSmartTag(null);
                              if (e.shiftKey && gridSelection) {
                                selectGridCell(gridRowIdx, cIdx, true);
                              } else {
                                selectGridCell(gridRowIdx, cIdx, false);
                                setIsRangeSelecting(true);
                              }
                            }}
                            onMouseEnter={() => {
                              if (formulaPointDragRef.current?.isDragging && activeFormulaEditTarget) {
                                applyFormulaPointRef(gridRowIdx, cIdx, true);
                                return;
                              }
                              if (fillDrag) {
                                setFillDrag((prev) =>
                                  prev
                                    ? { ...prev, targetRow: gridRowIdx, targetCol: cIdx }
                                    : null
                                );
                              } else if (isRangeSelecting) {
                                selectGridCell(gridRowIdx, cIdx, true);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const inside =
                                selectionBounds !== null &&
                                gridRowIdx >= selectionBounds.rMin &&
                                gridRowIdx <= selectionBounds.rMax &&
                                cIdx >= selectionBounds.cMin &&
                                cIdx <= selectionBounds.cMax;
                              if (!inside) {
                                selectGridCell(gridRowIdx, cIdx, false);
                              }
                              setCellCtxMenu({
                                x: Math.min(e.clientX, window.innerWidth - 220),
                                y: Math.min(e.clientY, window.innerHeight - 360),
                                row: gridRowIdx,
                                col: cIdx,
                              });
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeFormulaEditTarget) return;
                              handleCellClick(cell, cellKey);
                              if (copyCellEnabled && (e.metaKey || e.ctrlKey) && displayVal) {
                                void handleCopyCell(displayVal);
                              }
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (onUpdateContent) {
                                startCellEdit(gridRowIdx, cIdx, undefined, false);
                              } else if (copyCellEnabled) {
                                void handleCopyCell(cell.value);
                              }
                            }}
                          >
                            {editingCell?.key === cellKey ? (
                              <input
                                ref={editInputRef}
                                type="text"
                                className="data-cell-edit-input"
                                value={editingCell.value}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  formulaPointDragRef.current = null;
                                  const nextVal = e.target.value;
                                  setEditingCell((prev) =>
                                    prev ? { ...prev, value: nextVal } : null
                                  );
                                  setFormulaBarText(nextVal);
                                }}
                                onBlur={() => commitCellEdit()}
                                onKeyDown={(e) => {
                                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitCellEdit({ dRow: e.shiftKey ? -1 : 1, dCol: 0 });
                                  } else if (e.key === 'Tab') {
                                    e.preventDefault();
                                    commitCellEdit({ dRow: 0, dCol: e.shiftKey ? -1 : 1 });
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    formulaPointDragRef.current = null;
                                    setEditingCell(null);
                                    setFormulaBarText(activeFormulaCell?.value ?? '');
                                    window.requestAnimationFrame(() =>
                                      tableWrapRef.current?.focus({ preventScroll: true })
                                    );
                                  }
                                }}
                              />
                            ) : (
                              <>
                                <span className="data-cell-text-clip">
                                  {renderCellContent(displayVal, trimmedQuery, sync.syncSlice)}
                                </span>
                                {isBottomRightOfSelection && selectionBounds && (
                                  <span
                                    className="data-cell-fill-handle"
                                    title={
                                      isJa
                                        ? 'ドラッグしてオートフィル（Ctrl/Optionでコピー⇔連番切替・ダブルクリックで自動展開）'
                                        : 'Drag to autofill (Ctrl/Option toggles Copy/Series, double-click to fill down)'
                                    }
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAutoFillSmartTag(null);
                                      setFillDrag({
                                        rMin: selectionBounds.rMin,
                                        rMax: selectionBounds.rMax,
                                        cMin: selectionBounds.cMin,
                                        cMax: selectionBounds.cMax,
                                        targetRow: selectionBounds.rMax,
                                        targetCol: selectionBounds.cMax,
                                        ctrlPressed: e.ctrlKey || e.altKey,
                                        clientX: e.clientX,
                                        clientY: e.clientY,
                                      });
                                    }}
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleFillHandleDoubleClick();
                                    }}
                                  />
                                )}
                                {isSmartTagCell && autoFillSmartTag && (
                                    <div
                                      className={[
                                        'data-autofill-smart-tag-wrap',
                                        isLastGridRow ? 'is-last-row' : '',
                                        isLastGridCol ? 'is-last-col' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' ')}
                                      onClick={(e) => e.stopPropagation()}
                                      onMouseDown={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        className="data-autofill-smart-tag-btn"
                                        title={isJa ? 'オートフィル オプション' : 'AutoFill Options'}
                                        onClick={() =>
                                          setAutoFillSmartTag((prev) =>
                                            prev ? { ...prev, menuOpen: !prev.menuOpen } : null
                                          )
                                        }
                                      >
                                        ▾
                                      </button>
                                      {autoFillSmartTag.menuOpen && (
                                        <div className="data-autofill-smart-tag-menu">
                                          {(
                                            [
                                              {
                                                mode: 'copy' as const,
                                                label: isJa ? 'セルのコピー' : 'Copy Cells',
                                              },
                                              {
                                                mode: 'series' as const,
                                                label: isJa ? '連続データ' : 'Fill Series',
                                              },
                                              ...(autoFillSmartTag.hasDate
                                                ? [
                                                    {
                                                      mode: 'weekdays' as const,
                                                      label: isJa ? '週日単位' : 'Fill Weekdays',
                                                    },
                                                    {
                                                      mode: 'months' as const,
                                                      label: isJa ? '月単位' : 'Fill Months',
                                                    },
                                                    {
                                                      mode: 'years' as const,
                                                      label: isJa ? '年単位' : 'Fill Years',
                                                    },
                                                  ]
                                                : []),
                                            ] as Array<{
                                              mode: Exclude<AutoFillMode, 'auto'>;
                                              label: string;
                                            }>
                                          ).map((opt) => (
                                            <button
                                              key={opt.mode}
                                              type="button"
                                              className={
                                                autoFillSmartTag.activeMode === opt.mode
                                                  ? 'is-active'
                                                  : ''
                                              }
                                              onClick={() => {
                                                const { nextMatrix } = executeAutoFill(
                                                  autoFillSmartTag.preFillMatrix,
                                                  {
                                                    rMin: autoFillSmartTag.srcRMin,
                                                    rMax: autoFillSmartTag.srcRMax,
                                                    cMin: autoFillSmartTag.srcCMin,
                                                    cMax: autoFillSmartTag.srcCMax,
                                                  },
                                                  {
                                                    rMin: autoFillSmartTag.rMin,
                                                    rMax: autoFillSmartTag.rMax,
                                                    cMin: autoFillSmartTag.cMin,
                                                    cMax: autoFillSmartTag.cMax,
                                                    direction: autoFillSmartTag.direction,
                                                  },
                                                  opt.mode,
                                                  false
                                                );
                                                commitGridMatrix(nextMatrix);
                                                setAutoFillSmartTag((prev) =>
                                                  prev
                                                    ? { ...prev, activeMode: opt.mode, menuOpen: false }
                                                    : null
                                                );
                                              }}
                                            >
                                              <span>{opt.label}</span>
                                              {autoFillSmartTag.activeMode === opt.mode && <span>✓</span>}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                              </>
                            )}
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
              {isJa
                ? 'ドラッグ範囲選択 · 右下角ドラッグ(+Ctrl/Optionで連番⇔コピー) · ダブルクリック自動展開 · Ctrl+D/R · 右クリックで行列操作'
                : 'Drag to select · Corner drag (+Ctrl/Option toggles Series/Copy) · Double-click fill · Ctrl+D/R · Right-click menu'}
            </span>
            {rangeSelectionStats ? (
              <span className="data-preview-col-stats">
                <strong>{rangeSelectionStats.label}</strong>:{' '}
                {rangeSelectionStats.numCount > 0 && (
                  <>
                    Σ {rangeSelectionStats.sum} · {isJa ? '平均' : 'Avg'}{' '}
                    {rangeSelectionStats.avg} ·{' '}
                  </>
                )}
                {isJa ? '個数' : 'Count'} {rangeSelectionStats.nonEmpty}/
                {rangeSelectionStats.totalCells}
              </span>
            ) : (
              sortedColStats && (
                <span className="data-preview-col-stats">
                  <strong>{sortedColStats.colName}</strong>: Σ {sortedColStats.sum} ·{' '}
                  {isJa ? '平均' : 'Avg'} {sortedColStats.avg} · {isJa ? '最小' : 'Min'}{' '}
                  {sortedColStats.min} · {isJa ? '最大' : 'Max'} {sortedColStats.max} (n=
                  {sortedColStats.count})
                </span>
              )
            )}
          </div>

          {fillDragPreview && (
        <div
          className="data-autofill-tooltip"
          style={{ left: fillDragPreview.clientX + 14, top: fillDragPreview.clientY + 14 }}
        >
          <span>{fillDragPreview.text || (isJa ? '（空）' : '(empty)')}</span>
          <span className="data-autofill-tooltip-mode">
            {fillDragPreview.effectiveMode === 'copy'
              ? isJa
                ? 'コピー'
                : 'Copy'
              : isJa
                ? '連続データ'
                : 'Series'}
          </span>
        </div>
      )}
      {cellCtxMenu && (
            <div
              className="data-cell-context-menu"
              style={{ left: cellCtxMenu.x, top: cellCtxMenu.y }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {onUpdateContent && (
                <>
                  <button
                    type="button"
                    disabled={historyRef.current.undoStack.length === 0}
                    onClick={() => {
                      setCellCtxMenu(null);
                      performUndo();
                    }}
                  >
                    <span>{isJa ? '元に戻す' : 'Undo'}</span>
                    <span className="data-ctx-shortcut">⌘Z</span>
                  </button>
                  <button
                    type="button"
                    disabled={historyRef.current.redoStack.length === 0}
                    onClick={() => {
                      setCellCtxMenu(null);
                      performRedo();
                    }}
                  >
                    <span>{isJa ? 'やり直し' : 'Redo'}</span>
                    <span className="data-ctx-shortcut">⇧⌘Z</span>
                  </button>
                  <hr />
                  <button type="button" onClick={() => applyRowColAction('cut')}>
                    <span>{isJa ? '切り取り' : 'Cut'}</span>
                    <span className="data-ctx-shortcut">⌘X</span>
                  </button>
                </>
              )}
              <button type="button" onClick={() => applyRowColAction('copy')}>
                <span>{isJa ? 'コピー' : 'Copy'}</span>
                <span className="data-ctx-shortcut">⌘C</span>
              </button>
              <button type="button" onClick={() => applyRowColAction('copy-value')}>
                <span>{isJa ? '計算結果をコピー' : 'Copy value'}</span>
              </button>
              {onUpdateContent && (
                <>
                  <button type="button" onClick={() => applyRowColAction('paste')}>
                    <span>{isJa ? '貼り付け' : 'Paste'}</span>
                    <span className="data-ctx-shortcut">⌘V</span>
                  </button>
                  <button type="button" onClick={() => applyRowColAction('paste-values')}>
                    <span>{isJa ? '値のみ貼り付け' : 'Paste values only'}</span>
                  </button>
                  <hr />
                  <button type="button" onClick={() => applyRowColAction('insert-row-above')}>
                    {isJa ? '上に行を挿入' : 'Insert row above'}
                  </button>
                  <button type="button" onClick={() => applyRowColAction('insert-row-below')}>
                    {isJa ? '下に行を挿入' : 'Insert row below'}
                  </button>
                  <button type="button" onClick={() => applyRowColAction('insert-col-left')}>
                    {isJa ? '左に列を挿入' : 'Insert column left'}
                  </button>
                  <button type="button" onClick={() => applyRowColAction('insert-col-right')}>
                    {isJa ? '右に列を挿入' : 'Insert column right'}
                  </button>
                  <hr />
                  <button type="button" onClick={() => applyRowColAction('clear-selection')}>
                    <span>{isJa ? '内容をクリア' : 'Clear contents'}</span>
                    <span className="data-ctx-shortcut">⌫</span>
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => applyRowColAction('delete-row')}
                  >
                    {isJa ? 'この行を削除' : 'Delete row'}
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => applyRowColAction('delete-col')}
                  >
                    {isJa ? 'この列を削除' : 'Delete column'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
