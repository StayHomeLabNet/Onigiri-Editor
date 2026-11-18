import React, { useMemo } from 'react';
import { diffLines } from 'diff';
import { ArrowLeftRight, Columns2, GitCompare, X } from 'lucide-react';
import type { DocumentTab, EditorSettings, ThemeId } from '../types';
import type { Translations } from '../i18n/types';
import { resolveEffectiveLanguageId } from '../utils/language';
import { EditorPane } from './EditorPane';

interface SideComparePaneProps {
  t: Translations;
  mode: 'edit' | 'diff';
  onChangeMode: (mode: 'edit' | 'diff') => void;
  tabs: DocumentTab[];
  activeTab: DocumentTab;
  sideTab: DocumentTab;
  onSelectSideTab: (tabId: string) => void;
  onSwapTabs: () => void;
  onClose: () => void;
  onChangeTabContent: (tabId: string, nextContent: string) => void;
  onStatusNotify?: (message: string) => void;
  theme: ThemeId;
  settings: EditorSettings;
}

interface DiffDisplayLine {
  kind: 'added' | 'removed' | 'same';
  text: string;
  oldLine?: number;
  newLine?: number;
}

export const SideComparePane: React.FC<SideComparePaneProps> = ({
  t,
  mode,
  onChangeMode,
  tabs,
  activeTab,
  sideTab,
  onSelectSideTab,
  onSwapTabs,
  onClose,
  onChangeTabContent,
  onStatusNotify,
  theme,
  settings,
}) => {
  const sideDetectedLanguageId = useMemo(
    () =>
      resolveEffectiveLanguageId({
        fileName: sideTab.title,
        filePath: sideTab.filePath,
        content: sideTab.content,
        languageOverride: sideTab.languageOverride,
      }),
    [sideTab.title, sideTab.filePath, sideTab.content, sideTab.languageOverride]
  );

  const diffData = useMemo(() => {
    if (mode !== 'diff') {
      return { lines: [] as DiffDisplayLine[], additions: 0, deletions: 0 };
    }
    const parts = diffLines(activeTab.content, sideTab.content);
    const lines: DiffDisplayLine[] = [];
    let additions = 0;
    let deletions = 0;
    let oldNum = 1;
    let newNum = 1;

    for (const part of parts) {
      const rawLines = part.value.split('\n');
      if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
      }
      if (rawLines.length === 0 && part.value === '\n') {
        rawLines.push('');
      }
      for (const line of rawLines) {
        if (part.added) {
          additions += 1;
          lines.push({ kind: 'added', text: line, newLine: newNum++ });
        } else if (part.removed) {
          deletions += 1;
          lines.push({ kind: 'removed', text: line, oldLine: oldNum++ });
        } else {
          lines.push({ kind: 'same', text: line, oldLine: oldNum++, newLine: newNum++ });
        }
      }
    }

    return { lines, additions, deletions };
  }, [mode, activeTab.content, sideTab.content]);

  return (
    <div className="side-compare-pane">
      <div className="side-compare-header">
        <div className="side-compare-title-group">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${mode === 'edit' ? 'is-active' : ''}`}
              onClick={() => onChangeMode('edit')}
              title={t.sideSplit.title}
            >
              <Columns2 size={13} />
              <span>{t.sideSplit.modeEdit}</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${mode === 'diff' ? 'is-active' : ''}`}
              onClick={() => onChangeMode('diff')}
              title={t.sideSplit.compareTitle}
            >
              <GitCompare size={13} />
              <span>{t.sideSplit.modeDiff}</span>
            </button>
          </div>

          <select
            className="side-compare-select"
            value={sideTab.id}
            onChange={(e) => onSelectSideTab(e.target.value)}
            aria-label={t.sideSplit.selectTabPlaceholder}
          >
            {tabs.map((tb) => (
              <option key={tb.id} value={tb.id}>
                {tb.dirty ? '● ' : ''}
                {tb.title}
              </option>
            ))}
          </select>
        </div>

        <div className="side-compare-actions">
          <button
            type="button"
            className="mini-pill-btn"
            onClick={onSwapTabs}
            disabled={activeTab.id === sideTab.id}
            title={t.sideSplit.swapBtn}
          >
            <ArrowLeftRight size={12} />
            <span>{t.sideSplit.swapBtn}</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title={t.sideSplit.closeBtn}
            aria-label={t.sideSplit.closeBtn}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <div className="side-compare-editor-host">
          <EditorPane
            t={t}
            docId={`side:${sideTab.id}`}
            fileName={sideTab.title}
            languageOverride={sideTab.languageOverride}
            detectedLanguageId={sideDetectedLanguageId}
            value={sideTab.content}
            onChange={(nextContent) => onChangeTabContent(sideTab.id, nextContent)}
            onCursorChange={() => {}}
            onStatusNotify={onStatusNotify}
            theme={theme}
            settings={settings}
          />
        </div>
      ) : (
        <div className="side-compare-diff-host">
          <div className="side-compare-diff-meta">
            <div className="ai-diff-legend side-compare-legend">
              <span className="ai-diff-legend-old">− {activeTab.title}</span>
              <span className="ai-diff-legend-new">+ {sideTab.title}</span>
            </div>
            <div className="diff-summary">
              <span className="diff-add">
                +{diffData.additions} {t.inspector.diffLabels.additions}
              </span>
              <span className="diff-del">
                -{diffData.deletions} {t.inspector.diffLabels.deletions}
              </span>
            </div>
          </div>

          <div className="ai-diff-viewer side-compare-diff-viewer">
            {diffData.additions === 0 && diffData.deletions === 0 ? (
              <div className="ai-diff-empty">{t.aiDiffModal.noChanges}</div>
            ) : (
              diffData.lines.map((line, idx) => {
                const cls =
                  line.kind === 'added'
                    ? 'is-added'
                    : line.kind === 'removed'
                      ? 'is-removed'
                      : 'is-same';
                const marker = line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' ';
                return (
                  <div key={idx} className={`ai-diff-line ${cls}`}>
                    <span className="ai-diff-ln">{line.oldLine ?? ''}</span>
                    <span className="ai-diff-ln">{line.newLine ?? ''}</span>
                    <span className="ai-diff-sign">{marker}</span>
                    <span className="ai-diff-code">{line.text || ' '}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
