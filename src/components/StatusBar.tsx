import React from 'react';
import type { AppMode, DocumentStats } from '../types';
import type { Translations } from '../i18n/types';

interface StatusBarProps {
  t: Translations;
  mode: AppMode;
  isDirty: boolean;
  filePath?: string;
  autoSaveEnabled?: boolean;
  stats: DocumentStats;
  cursorLine: number;
  cursorCol: number;
  syncScroll: boolean;
  onToggleSyncScroll: () => void;
  wordGoal: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  t,
  mode,
  isDirty,
  filePath,
  autoSaveEnabled,
  stats,
  cursorLine,
  cursorCol,
  syncScroll,
  onToggleSyncScroll,
  wordGoal,
}) => {
  const goalPct = wordGoal > 0 ? Math.min(100, Math.round((stats.words / wordGoal) * 100)) : 0;

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className={`status-badge ${isDirty ? 'is-dirty' : 'is-saved'}`}>
          <span className="status-dot" />
          {isDirty ? t.status.unsaved : filePath ? t.status.saved : t.status.draft}
        </span>

        {autoSaveEnabled && filePath && (
          <span className="status-autosave-pill">{t.status.autoSaveOn}</span>
        )}

        {mode === 'advanced' && filePath && (
          <span className="status-path" title={filePath}>
            {filePath}
          </span>
        )}
      </div>

      <div className="status-right">
        {mode === 'advanced' && wordGoal > 0 && (
          <span className="status-goal" title={t.inspector.statsLabels.goalProgress}>
            {stats.words}/{wordGoal} ({goalPct}%)
          </span>
        )}

        <span>
          {stats.words.toLocaleString()} {t.status.words}
        </span>
        <span>
          {stats.chars.toLocaleString()} {t.status.chars}
        </span>

        {mode === 'advanced' && (
          <>
            <span className="status-tokens">
              ~{stats.estimatedTokens.toLocaleString()} {t.status.tokens}
            </span>
            <button
              type="button"
              className="status-btn"
              onClick={onToggleSyncScroll}
            >
              {syncScroll ? t.status.syncOn : t.status.syncOff}
            </button>
          </>
        )}

        <span>
          {t.status.line} {cursorLine}, {t.status.col} {cursorCol}
        </span>
      </div>
    </footer>
  );
};
