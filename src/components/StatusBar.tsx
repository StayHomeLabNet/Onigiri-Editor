import React, { useEffect, useRef, useState } from 'react';
import { Check, FilePlus2, RefreshCw, Save, Settings } from 'lucide-react';
import type { AppMode, DocumentStats, Locale, TextEncodingId } from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut } from '../utils/platform';
import { getEncodingShortLabel, TEXT_ENCODINGS } from '../utils/encodings';

interface StatusBarProps {
  t: Translations;
  locale: Locale;
  mode: AppMode;
  isDirty: boolean;
  filePath?: string;
  activeTitle?: string;
  autoSaveEnabled?: boolean;
  stats: DocumentStats;
  cursorLine: number;
  cursorCol: number;
  encoding: TextEncodingId;
  eol: '\n' | '\r\n';
  onToggleEol: () => void;
  onChangeSaveEncoding: (enc: TextEncodingId) => void;
  onReopenWithEncoding: (enc: TextEncodingId) => void;
  onOpenNewWithEncodingModal: () => void;
  syncScroll: boolean;
  onToggleSyncScroll: () => void;
  wordGoal: number;
  topBarHidden?: boolean;
  onSwitchToBasic?: () => void;
  onOpenSettings?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  t,
  locale,
  mode,
  isDirty,
  filePath,
  activeTitle,
  autoSaveEnabled,
  stats,
  cursorLine,
  cursorCol,
  encoding,
  eol,
  onToggleEol,
  onChangeSaveEncoding,
  onReopenWithEncoding,
  onOpenNewWithEncodingModal,
  syncScroll,
  onToggleSyncScroll,
  wordGoal,
  topBarHidden,
  onSwitchToBasic,
  onOpenSettings,
}) => {
  const goalPct = wordGoal > 0 ? Math.min(100, Math.round((stats.words / wordGoal) * 100)) : 0;
  const [encMenuOpen, setEncMenuOpen] = useState(false);
  const [encMenuAction, setEncMenuAction] = useState<'save' | 'reopen'>(
    filePath ? 'reopen' : 'save'
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!filePath && encMenuAction === 'reopen') {
      setEncMenuAction('save');
    }
  }, [filePath, encMenuAction]);

  useEffect(() => {
    if (!encMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEncMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEncMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [encMenuOpen]);

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

        {topBarHidden && activeTitle && (
          <span className="status-path" title={filePath || activeTitle}>
            {activeTitle}
          </span>
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

        <button
          type="button"
          className="status-btn status-eol-btn"
          onClick={onToggleEol}
          title={t.encoding.eolLabel}
        >
          {eol === '\r\n' ? 'CRLF' : 'LF'}
        </button>

        <div className="status-encoding-wrap" ref={popoverRef}>
          <button
            type="button"
            className={`status-btn status-encoding-btn ${encMenuOpen ? 'is-open' : ''}`}
            onClick={() => {
              setEncMenuAction(filePath ? 'reopen' : 'save');
              setEncMenuOpen((v) => !v);
            }}
            title={
              filePath
                ? `${t.actions.reopenWithEncoding} / ${t.actions.changeEncoding}`
                : t.actions.changeEncoding
            }
          >
            {getEncodingShortLabel(encoding)}
          </button>

          {encMenuOpen && (
            <div className="status-encoding-popover" role="dialog">
              {filePath && (
                <div className="status-encoding-tabs">
                  <button
                    type="button"
                    className={`status-encoding-tab ${encMenuAction === 'reopen' ? 'is-active' : ''}`}
                    onClick={() => setEncMenuAction('reopen')}
                  >
                    <RefreshCw size={11} />
                    <span>{locale === 'ja' ? '再読み込み' : 'Reopen'}</span>
                  </button>
                  <button
                    type="button"
                    className={`status-encoding-tab ${encMenuAction === 'save' ? 'is-active' : ''}`}
                    onClick={() => setEncMenuAction('save')}
                  >
                    <Save size={11} />
                    <span>{locale === 'ja' ? '保存時変更' : 'Save As'}</span>
                  </button>
                </div>
              )}

              <div className="status-encoding-subtitle">
                {encMenuAction === 'reopen' && filePath
                  ? t.encoding.reopenSectionTitle
                  : t.encoding.saveEncodingSectionTitle}
              </div>

              <div className="status-encoding-list">
                {TEXT_ENCODINGS.map((enc) => {
                  const isCurrent = enc.id === encoding;
                  return (
                    <button
                      key={enc.id}
                      type="button"
                      className={`status-encoding-item ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => {
                        setEncMenuOpen(false);
                        if (encMenuAction === 'reopen' && filePath) {
                          onReopenWithEncoding(enc.id);
                        } else {
                          onChangeSaveEncoding(enc.id);
                        }
                      }}
                    >
                      <span className="status-encoding-check">
                        {isCurrent ? <Check size={12} /> : null}
                      </span>
                      <span className="status-encoding-item-label">{enc.label}</span>
                      <span className="status-encoding-item-note">
                        {locale === 'ja' ? enc.noteJa : enc.noteEn}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="status-encoding-footer">
                <button
                  type="button"
                  className="status-encoding-new-btn"
                  onClick={() => {
                    setEncMenuOpen(false);
                    onOpenNewWithEncodingModal();
                  }}
                >
                  <FilePlus2 size={12} />
                  <span>{t.encoding.newTabWithEncodingBtn}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <span>
          {t.status.line} {cursorLine}, {t.status.col} {cursorCol}
        </span>

        {topBarHidden && (
          <>
            {onSwitchToBasic && (
              <button
                type="button"
                className="status-btn"
                onClick={onSwitchToBasic}
                title={`${t.modes.basic} (${formatShortcut('⌘+\\')})`}
              >
                {t.modes.simple} → {t.modes.basic}
              </button>
            )}
            {onOpenSettings && (
              <button
                type="button"
                className="status-btn"
                onClick={onOpenSettings}
                title={`${t.actions.settings} (${formatShortcut('⌘+,')})`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Settings size={12} />
                <span>{t.actions.settings}</span>
              </button>
            )}
          </>
        )}
      </div>
    </footer>
  );
};
