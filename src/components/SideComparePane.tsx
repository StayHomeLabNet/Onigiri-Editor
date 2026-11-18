import React, { useMemo } from 'react';
import { diffLines } from 'diff';
import { ArrowLeftRight, Columns2, GitCompare, X } from 'lucide-react';
import type { DocumentTab, EditorSettings, Locale, ThemeId } from '../types';
import type { Translations } from '../i18n/types';
import { resolveEffectiveLanguageId } from '../utils/language';
import { EditorPane, type EditorHandle, type WorkspaceNoteItem } from './EditorPane';

export interface GitHeadComparisonState {
  tabId: string;
  title: string;
  branch: string | null;
  existsInHead: boolean;
  headContent: string;
}

interface SideComparePaneProps {
  t: Translations;
  locale?: Locale;
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
  gitHeadComparison?: GitHeadComparisonState | null;
  onClearGitHeadComparison?: () => void;
  sideEditorRef?: React.Ref<EditorHandle>;
  focusedPane?: 'main' | 'side';
  onFocusSidePane?: () => void;
  workspaceRoot?: string | null;
  workspaceNotes?: WorkspaceNoteItem[];
  onOpenWikiLink?: (target: string) => void;
  onBookmarksChange?: (tabId: string, lines: number[]) => void;
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
  locale = 'ja',
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
  gitHeadComparison,
  onClearGitHeadComparison,
  sideEditorRef,
  focusedPane = 'main',
  onFocusSidePane,
  workspaceRoot,
  workspaceNotes,
  onOpenWikiLink,
  onBookmarksChange,
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

  const isGitHeadDiff = Boolean(mode === 'diff' && gitHeadComparison);
  const workingTabForGitHead = useMemo(() => {
    if (!gitHeadComparison) return activeTab;
    return tabs.find((tb) => tb.id === gitHeadComparison.tabId) || activeTab;
  }, [gitHeadComparison, tabs, activeTab]);

  const diffData = useMemo(() => {
    if (mode !== 'diff') {
      return { lines: [] as DiffDisplayLine[], additions: 0, deletions: 0 };
    }
    const leftText = gitHeadComparison ? gitHeadComparison.headContent : activeTab.content;
    const rightText = gitHeadComparison ? workingTabForGitHead.content : sideTab.content;
    const parts = diffLines(leftText, rightText);
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
  }, [mode, gitHeadComparison, activeTab.content, workingTabForGitHead.content, sideTab.content]);

  const leftLabel = isGitHeadDiff
    ? `HEAD${gitHeadComparison?.branch ? ` (${gitHeadComparison.branch})` : ''}: ${gitHeadComparison?.title}${gitHeadComparison?.existsInHead ? '' : ' [untracked]'}`
    : activeTab.title;
  const rightLabel = isGitHeadDiff ? workingTabForGitHead.title : sideTab.title;

  return (
    <div
      className={`side-compare-pane ${mode === 'edit' && focusedPane === 'side' ? 'is-focused' : ''}`}
      onMouseDown={() => {
        if (mode === 'edit') onFocusSidePane?.();
      }}
    >
      <div className="side-compare-header">
        <div className="side-compare-title-group">
          <div className="segmented-control">
            <button
              type="button"
              className={`seg-btn ${mode === 'edit' ? 'is-active' : ''}`}
              onClick={() => {
                onClearGitHeadComparison?.();
                onChangeMode('edit');
              }}
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

          {isGitHeadDiff ? (
            <div className="side-compare-git-pill">
              <span className="git-head-badge">
                Git HEAD{gitHeadComparison?.branch ? ` (${gitHeadComparison.branch})` : ''}
              </span>
              {tabs.length > 1 && onClearGitHeadComparison && (
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={onClearGitHeadComparison}
                >
                  {t.sideSplit.compareTitle}
                </button>
              )}
            </div>
          ) : (
            <select
              className="side-compare-select"
              value={sideTab.id}
              onChange={(e) => {
                onClearGitHeadComparison?.();
                onSelectSideTab(e.target.value);
              }}
              aria-label={t.sideSplit.selectTabPlaceholder}
            >
              {tabs.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.dirty ? '● ' : ''}
                  {tb.title}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="side-compare-actions">
          {!isGitHeadDiff && (
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
          )}
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
            ref={sideEditorRef}
            t={t}
            locale={locale}
            docId={`side:${sideTab.id}`}
            fileName={sideTab.title}
            filePath={sideTab.filePath}
            workspaceRoot={workspaceRoot}
            languageOverride={sideTab.languageOverride}
            detectedLanguageId={sideDetectedLanguageId}
            value={sideTab.content}
            initialCursor={{ line: sideTab.cursorLine, col: sideTab.cursorCol }}
            initialScrollTop={sideTab.scrollTop}
            initialFoldedLines={sideTab.foldedLines}
            initialBookmarks={sideTab.bookmarks}
            onChange={(nextContent) => onChangeTabContent(sideTab.id, nextContent)}
            onBookmarksChange={(lines) => onBookmarksChange?.(sideTab.id, lines)}
            onCursorChange={() => {}}
            onFocusPane={onFocusSidePane}
            onStatusNotify={onStatusNotify}
            workspaceNotes={workspaceNotes}
            onOpenWikiLink={onOpenWikiLink}
            theme={theme}
            settings={settings}
          />
        </div>
      ) : (
        <div className="side-compare-diff-host">
          <div className="side-compare-diff-meta">
            <div className="ai-diff-legend side-compare-legend">
              <span className="ai-diff-legend-old">− {leftLabel}</span>
              <span className="ai-diff-legend-new">+ {rightLabel}</span>
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
