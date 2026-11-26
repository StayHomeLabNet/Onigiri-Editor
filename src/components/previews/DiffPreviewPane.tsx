import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Columns2, List } from 'lucide-react';
import type { Locale } from '../../types';
import { parseUnifiedDiff, type DiffLine } from '../../utils/previewParsers';

interface DiffPreviewPaneProps {
  locale: Locale;
  content: string;
}

interface SideBySideRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

function buildSideBySideRows(lines: DiffLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === 'meta' || line.type === 'hunk') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    if (line.type === 'context') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'del') {
      dels.push(lines[i]);
      i++;
    }
    while (i < lines.length && lines[i].type === 'add') {
      adds.push(lines[i]);
      i++;
    }
    const maxLen = Math.max(dels.length, adds.length);
    for (let k = 0; k < maxLen; k++) {
      rows.push({
        left: dels[k] ?? null,
        right: adds[k] ?? null,
      });
    }
  }
  return rows;
}

export const DiffPreviewPane: React.FC<DiffPreviewPaneProps> = ({ locale, content }) => {
  const isJa = locale === 'ja';
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const files = useMemo(() => parseUnifiedDiff(content), [content]);

  const totals = useMemo(
    () =>
      files.reduce(
        (acc, f) => ({
          additions: acc.additions + f.additions,
          deletions: acc.deletions + f.deletions,
        }),
        { additions: 0, deletions: 0 }
      ),
    [files]
  );

  const toggleSection = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">DIFF</span>
          <span className="ext-meta-pill">
            {files.length} {isJa ? 'ファイル' : 'files'}
          </span>
          <span className="ext-diff-stat-add">+{totals.additions}</span>
          <span className="ext-diff-stat-del">-{totals.deletions}</span>
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className={`ext-tool-btn ${viewMode === 'unified' ? 'is-active' : ''}`}
            onClick={() => setViewMode('unified')}
          >
            <List size={13} />
            <span>Unified</span>
          </button>
          <button
            type="button"
            className={`ext-tool-btn ${viewMode === 'split' ? 'is-active' : ''}`}
            onClick={() => setViewMode('split')}
          >
            <Columns2 size={13} />
            <span>{isJa ? '左右比較' : 'Side-by-Side'}</span>
          </button>
        </div>
      </div>

      <div className="ext-preview-body">
        {files.length === 0 ? (
          <div className="ext-empty-cell">{isJa ? '差分データがありません' : 'No diff content'}</div>
        ) : (
          <div className="ext-diff-list">
            {files.map((sec) => {
              const collapsed = collapsedIds.has(sec.id);
              return (
                <div key={sec.id} className="ext-diff-file-card">
                  <button
                    type="button"
                    className="ext-diff-file-header"
                    onClick={() => toggleSection(sec.id)}
                  >
                    <span className="ext-diff-file-title">
                      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span>{sec.header}</span>
                    </span>
                    <span className="ext-diff-file-counts">
                      <span className="ext-diff-stat-add">+{sec.additions}</span>
                      <span className="ext-diff-stat-del">-{sec.deletions}</span>
                    </span>
                  </button>

                  {!collapsed && viewMode === 'unified' && (
                    <div className="ext-diff-lines">
                      {sec.lines.map((line, idx) => (
                        <div key={idx} className={`ext-diff-row is-${line.type}`}>
                          <span className="ext-diff-ln">{line.oldLine ?? ''}</span>
                          <span className="ext-diff-ln">{line.newLine ?? ''}</span>
                          <span className="ext-diff-sign">
                            {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                          </span>
                          <code className="ext-diff-code">{line.content}</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {!collapsed && viewMode === 'split' && (
                    <div className="ext-diff-split">
                      {buildSideBySideRows(sec.lines).map((pair, idx) => {
                        if (pair.left?.type === 'hunk' || pair.left?.type === 'meta') {
                          return (
                            <div key={idx} className={`ext-diff-split-banner is-${pair.left.type}`}>
                              <code>{pair.left.content}</code>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="ext-diff-split-row">
                            <div
                              className={`ext-diff-split-cell ${
                                pair.left ? `is-${pair.left.type}` : 'is-empty'
                              }`}
                            >
                              <span className="ext-diff-ln">{pair.left?.oldLine ?? ''}</span>
                              <code className="ext-diff-code">{pair.left?.content ?? ''}</code>
                            </div>
                            <div
                              className={`ext-diff-split-cell ${
                                pair.right ? `is-${pair.right.type}` : 'is-empty'
                              }`}
                            >
                              <span className="ext-diff-ln">{pair.right?.newLine ?? ''}</span>
                              <code className="ext-diff-code">{pair.right?.content ?? ''}</code>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
