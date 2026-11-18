import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardCopy, Code2, Search, Table2 } from 'lucide-react';
import type { Translations } from '../i18n/types';
import {
  parseCsvTsvTable,
  tableRowsToDelimited,
  tableRowsToMarkdown,
} from '../utils/structuredData';
import { writeClipboardText } from '../utils/platform';

interface DataPreviewPaneProps {
  t: Translations;
  fileName: string;
  languageOverride?: string | null;
  content: string;
  activeLine: number;
  onJumpToLine?: (line: number) => void;
  onCopyNotify: () => void;
}

export const DataPreviewPane: React.FC<DataPreviewPaneProps> = ({
  t,
  fileName,
  languageOverride,
  content,
  activeLine,
  onJumpToLine,
  onCopyNotify,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');

  const isTsv =
    languageOverride === 'tsv' ||
    (!languageOverride && fileName.toLowerCase().endsWith('.tsv'));

  const parsed = useMemo(() => {
    const forced = languageOverride === 'tsv' ? '\t' : languageOverride === 'csv' ? ',' : isTsv ? '\t' : undefined;
    return parseCsvTsvTable(content, forced);
  }, [content, isTsv, languageOverride]);

  const indexedRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const mapped = parsed.rows.map((cells, idx) => ({
      cells,
      sourceLine: idx + 2,
    }));

    const filtered = q
      ? mapped.filter((r) => r.cells.some((c) => c.toLowerCase().includes(q)))
      : mapped;

    if (sortCol === null || sortCol < 0 || sortCol >= parsed.headers.length) {
      return filtered;
    }

    const dirMul = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a.cells[sortCol] ?? '';
      const bv = b.cells[sortCol] ?? '';
      const an = Number(av.replace(/,/g, ''));
      const bn = Number(bv.replace(/,/g, ''));
      if (av !== '' && bv !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
        return (an - bn) * dirMul;
      }
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dirMul;
    });
  }, [parsed.rows, parsed.headers.length, filterText, sortCol, sortDir]);

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
      parsed.headers,
      indexedRows.map((r) => r.cells)
    );
    const ok = await writeClipboardText(md);
    if (ok) onCopyNotify();
  };

  const handleCopyCsv = async () => {
    const csv = tableRowsToDelimited(
      parsed.headers,
      indexedRows.map((r) => r.cells),
      ','
    );
    const ok = await writeClipboardText(csv);
    if (ok) onCopyNotify();
  };

  const rawLines = useMemo(() => content.split(/\r?\n/), [content]);

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
        </div>

        <div className="data-preview-actions">
          {viewMode === 'table' && (
            <div className="data-filter-box">
              <Search size={12} />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={t.dataPreview.filterPlaceholder}
              />
            </div>
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
        <div className="code-preview-body">
          {rawLines.map((line, idx) => {
            const lineNum = idx + 1;
            const isActive = lineNum === activeLine;
            return (
              <div
                key={lineNum}
                className={`code-preview-line ${isActive ? 'is-active' : ''}`}
                onClick={() => onJumpToLine?.(lineNum)}
              >
                <span className="code-preview-ln">{lineNum}</span>
                <span className="code-preview-text">{line || ' '}</span>
              </div>
            );
          })}
        </div>
      ) : parsed.headers.length === 0 ? (
        <div className="data-preview-empty">{t.dataPreview.emptyTable}</div>
      ) : (
        <div className="data-preview-table-wrap">
          <table className="data-preview-table">
            <thead>
              <tr>
                <th className="data-row-num-col">#</th>
                {parsed.headers.map((h, cIdx) => {
                  const isSorted = sortCol === cIdx;
                  return (
                    <th key={cIdx}>
                      <button
                        type="button"
                        className={`data-sort-th-btn ${isSorted ? 'is-sorted' : ''}`}
                        onClick={() => toggleSort(cIdx)}
                      >
                        <span>{h}</span>
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
              {indexedRows.map((row) => {
                const isActive = row.sourceLine === activeLine;
                return (
                  <tr
                    key={row.sourceLine}
                    className={isActive ? 'is-active' : ''}
                    onClick={() => onJumpToLine?.(row.sourceLine)}
                  >
                    <td className="data-row-num-col">{row.sourceLine}</td>
                    {parsed.headers.map((_, cIdx) => (
                      <td key={cIdx}>{row.cells[cIdx] ?? ''}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
