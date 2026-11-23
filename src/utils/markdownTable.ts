export type TableAlignment = 'left' | 'center' | 'right';

export interface ParsedMarkdownTable {
  /** 1-based start line in document */
  startLine: number;
  /** 1-based end line in document (inclusive) */
  endLine: number;
  headers: string[];
  alignments: TableAlignment[];
  rows: string[][];
}

export interface TableCursorLocation {
  table: ParsedMarkdownTable;
  /** -1 for header row, -2 for separator row, >= 0 for body row index */
  rowIndex: number;
  /** 0-based column index */
  colIndex: number;
}

const SEPARATOR_CELL_RE = /^:?-{2,}:?$/;

export function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  let inner = trimmed;
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|') && !inner.endsWith('\\|')) inner = inner.slice(0, -1);

  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '\\' && i + 1 < inner.length && inner[i + 1] === '|') {
      cur += '\\|';
      i++;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

export function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('|') && !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => SEPARATOR_CELL_RE.test(cell.replace(/\s+/g, '')));
}

export function isTableLikeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return trimmed.includes('|');
}

function parseAlignment(cell: string): TableAlignment {
  const c = cell.replace(/\s+/g, '');
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  return 'left';
}

function formatAlignmentSep(align: TableAlignment, width: number): string {
  const w = Math.max(3, width);
  if (align === 'center') return `:${'-'.repeat(Math.max(1, w - 2))}:`;
  if (align === 'right') return `${'-'.repeat(Math.max(2, w - 1))}:`;
  return '-'.repeat(w);
}

/**
 * Computes the column index at a given 0-based character offset within a table line.
 */
export function getColumnIndexAtOffset(line: string, colOffset: number): number {
  const clamped = Math.max(0, Math.min(colOffset, line.length));
  const trimmedStart = line.length - line.trimStart().length;
  let pipeCount = 0;
  let startsWithPipe = false;

  if (line.slice(trimmedStart).startsWith('|')) {
    startsWithPipe = true;
  }

  for (let i = trimmedStart; i < clamped; i++) {
    if (line[i] === '\\' && i + 1 < clamped && line[i + 1] === '|') {
      i++;
      continue;
    }
    if (line[i] === '|') {
      pipeCount++;
    }
  }

  if (startsWithPipe) {
    return Math.max(0, pipeCount - 1);
  }
  return pipeCount;
}

/**
 * Detects if the given 1-based cursor line is inside a GFM Markdown table.
 */
export function detectMarkdownTableAtLine(
  docText: string,
  cursorLine1Based: number,
  cursorCol0Based = 0
): TableCursorLocation | null {
  const lines = docText.split('\n');
  const idx = cursorLine1Based - 1;
  if (idx < 0 || idx >= lines.length) return null;
  if (!isTableLikeLine(lines[idx])) return null;

  // Expand upwards & downwards while lines look like table lines
  let start = idx;
  while (start > 0 && isTableLikeLine(lines[start - 1])) {
    start--;
  }
  let end = idx;
  while (end + 1 < lines.length && isTableLikeLine(lines[end + 1])) {
    end++;
  }

  // Must have at least header + separator
  if (end - start < 1) return null;
  if (!isSeparatorRow(lines[start + 1])) return null;

  const rawHeaders = splitTableRow(lines[start]);
  const rawSep = splitTableRow(lines[start + 1]);
  const rawRows: string[][] = [];
  for (let i = start + 2; i <= end; i++) {
    rawRows.push(splitTableRow(lines[i]));
  }

  const colCount = Math.max(
    rawHeaders.length,
    rawSep.length,
    ...rawRows.map((r) => r.length)
  );
  if (colCount === 0) return null;

  const padRow = (r: string[]) => {
    const out = r.slice(0, colCount);
    while (out.length < colCount) out.push('');
    return out;
  };

  const headers = padRow(rawHeaders);
  const alignments: TableAlignment[] = [];
  for (let c = 0; c < colCount; c++) {
    alignments.push(rawSep[c] ? parseAlignment(rawSep[c]) : 'left');
  }
  const rows = rawRows.map(padRow);

  const relLine = idx - start;
  const rowIndex = relLine === 0 ? -1 : relLine === 1 ? -2 : relLine - 2;
  const rawCol = getColumnIndexAtOffset(lines[idx], cursorCol0Based);
  const colIndex = Math.max(0, Math.min(rawCol, colCount - 1));

  return {
    table: {
      startLine: start + 1,
      endLine: end + 1,
      headers,
      alignments,
      rows,
    },
    rowIndex,
    colIndex,
  };
}

/**
 * Serializes a ParsedMarkdownTable back into cleanly aligned GFM Markdown lines.
 */
export function serializeMarkdownTable(table: ParsedMarkdownTable): string {
  const colCount = table.headers.length;
  const widths = new Array<number>(colCount).fill(3);

  for (let c = 0; c < colCount; c++) {
    widths[c] = Math.max(widths[c], (table.headers[c] || '').length);
    for (const row of table.rows) {
      widths[c] = Math.max(widths[c], (row[c] || '').length);
    }
  }

  const formatRow = (cells: string[]) =>
    `| ${cells.map((cell, c) => (cell || '').padEnd(widths[c], ' ')).join(' | ')} |`;

  const headerLine = formatRow(table.headers);
  const sepLine = `| ${table.alignments
    .map((align, c) => formatAlignmentSep(align, widths[c]))
    .join(' | ')} |`;
  const bodyLines = table.rows.map(formatRow);

  return [headerLine, sepLine, ...bodyLines].join('\n');
}

export type TableEditOperation =
  | 'addRowAbove'
  | 'addRowBelow'
  | 'deleteRow'
  | 'addColLeft'
  | 'addColRight'
  | 'deleteCol'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'sortAsc'
  | 'sortDesc'
  | 'format';

/**
 * Applies a GUI table operation and returns the updated ParsedMarkdownTable.
 */
export function applyMarkdownTableOperation(
  loc: TableCursorLocation,
  op: TableEditOperation
): ParsedMarkdownTable {
  const headers = [...loc.table.headers];
  const alignments = [...loc.table.alignments];
  const rows = loc.table.rows.map((r) => [...r]);
  const colCount = headers.length;
  const col = Math.max(0, Math.min(loc.colIndex, colCount - 1));

  switch (op) {
    case 'addRowAbove': {
      const insertAt = loc.rowIndex >= 0 ? loc.rowIndex : 0;
      rows.splice(insertAt, 0, new Array(colCount).fill(''));
      break;
    }
    case 'addRowBelow': {
      const insertAt = loc.rowIndex >= 0 ? loc.rowIndex + 1 : 0;
      rows.splice(insertAt, 0, new Array(colCount).fill(''));
      break;
    }
    case 'deleteRow': {
      if (loc.rowIndex >= 0 && rows.length > 0) {
        rows.splice(loc.rowIndex, 1);
      }
      break;
    }
    case 'addColLeft': {
      headers.splice(col, 0, `Col ${colCount + 1}`);
      alignments.splice(col, 0, 'left');
      for (const r of rows) r.splice(col, 0, '');
      break;
    }
    case 'addColRight': {
      headers.splice(col + 1, 0, `Col ${colCount + 1}`);
      alignments.splice(col + 1, 0, 'left');
      for (const r of rows) r.splice(col + 1, 0, '');
      break;
    }
    case 'deleteCol': {
      if (colCount > 1) {
        headers.splice(col, 1);
        alignments.splice(col, 1);
        for (const r of rows) r.splice(col, 1);
      }
      break;
    }
    case 'alignLeft':
      alignments[col] = 'left';
      break;
    case 'alignCenter':
      alignments[col] = 'center';
      break;
    case 'alignRight':
      alignments[col] = 'right';
      break;
    case 'sortAsc':
    case 'sortDesc': {
      const dir = op === 'sortAsc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = (a[col] ?? '').trim();
        const bv = (b[col] ?? '').trim();
        const an = Number(av.replace(/,/g, ''));
        const bn = Number(bv.replace(/,/g, ''));
        if (av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
          return (an - bn) * dir;
        }
        return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir;
      });
      break;
    }
    case 'format':
      break;
  }

  return {
    ...loc.table,
    headers,
    alignments,
    rows,
  };
}
