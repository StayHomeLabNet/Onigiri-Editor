import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FilePlus2,
  Globe,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Settings,
  Square,
  StickyNote,
  Terminal,
} from 'lucide-react';
import type {
  AppMode,
  DocumentStats,
  Locale,
  ProjectServerStatus,
  TextEncodingId,
} from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut } from '../utils/platform';
import { getEncodingShortLabel, TEXT_ENCODINGS } from '../utils/encodings';
import { LANGUAGE_OPTIONS } from '../utils/language';
import { extractPortFromUrl } from './ProjectPortInput';
import { getRunningTargetsList } from './ProjectTargetControls';
import { getTargetErrorCount } from './ProjectServerLogs';

const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200] as const;

function clampZoomValue(val: number): number {
  return Math.max(25, Math.min(400, Math.round(val)));
}

export function getNextStatusBarMode(mode: AppMode): AppMode {
  if (mode === 'simple') return 'basic';
  if (mode === 'basic') return 'advanced';
  return 'basic';
}

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
  languageLabel: string;
  languageOverride?: string | null;
  onChangeLanguageOverride?: (langId: string | null) => void;
  zoomPercent: number;
  onChangeZoom: (nextZoom: number) => void;
  topBarHidden?: boolean;
  onChangeMode?: (mode: AppMode) => void;
  onOpenSettings?: () => void;
  onOpenGoToLine?: () => void;
  isRecordingMacro?: boolean;
  macroStepCount?: number;
  onToggleMacroRecording?: () => void;
  updateAvailableVersion?: string | null;
  updateReadyToInstall?: boolean;
  onOpenUpdateModal?: () => void;
  projectServer?: ProjectServerStatus | null;
  onSelectTargetRoot?: (targetRoot: string) => void;
  onOpenProjectUrl?: (url: string, target: 'builtin' | 'external') => void;
  onRestartProjectServer?: (targetRoot?: string) => void;
  onStopProjectServer?: (targetRoot?: string) => void;
  onStopAllProjectTargets?: () => void;
  showScratchpadButton?: boolean;
  onOpenScratchpad?: () => void;
  showTerminalButton?: boolean;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
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
  languageLabel,
  languageOverride,
  onChangeLanguageOverride,
  zoomPercent,
  onChangeZoom,
  topBarHidden,
  onChangeMode,
  onOpenSettings,
  onOpenGoToLine,
  isRecordingMacro,
  macroStepCount,
  onToggleMacroRecording,
  updateAvailableVersion,
  updateReadyToInstall,
  onOpenUpdateModal,
  projectServer,
  onSelectTargetRoot,
  onOpenProjectUrl,
  onRestartProjectServer,
  onStopProjectServer,
  onStopAllProjectTargets,
  showScratchpadButton,
  onOpenScratchpad,
  showTerminalButton,
  terminalOpen,
  onToggleTerminal,
}) => {
  const goalPct = wordGoal > 0 ? Math.min(100, Math.round((stats.words / wordGoal) * 100)) : 0;
  const [encMenuOpen, setEncMenuOpen] = useState(false);
  const [encMenuAction, setEncMenuAction] = useState<'save' | 'reopen'>(
    filePath ? 'reopen' : 'save'
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langPopoverRef = useRef<HTMLDivElement | null>(null);

  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const [zoomDraft, setZoomDraft] = useState(String(zoomPercent));
  const zoomPopoverRef = useRef<HTMLDivElement | null>(null);
  const zoomInputRef = useRef<HTMLInputElement | null>(null);

  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const serverPopoverRef = useRef<HTMLDivElement | null>(null);

  const runningTargets = useMemo(
    () => getRunningTargetsList(projectServer),
    [projectServer]
  );
  const totalServerErrors = useMemo(
    () => runningTargets.reduce((sum, rt) => sum + getTargetErrorCount(rt), 0),
    [runningTargets]
  );

  useEffect(() => {
    if (runningTargets.length === 0 && serverMenuOpen) {
      setServerMenuOpen(false);
    }
  }, [runningTargets.length, serverMenuOpen]);

  useEffect(() => {
    if (!serverMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (serverPopoverRef.current && !serverPopoverRef.current.contains(e.target as Node)) {
        setServerMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setServerMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [serverMenuOpen]);

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

  useEffect(() => {
    if (!langMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (langPopoverRef.current && !langPopoverRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLangMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [langMenuOpen]);

  useEffect(() => {
    setZoomDraft(String(zoomPercent));
  }, [zoomPercent]);

  useEffect(() => {
    if (!zoomMenuOpen) return;
    setZoomDraft(String(zoomPercent));
    const focusTimer = window.setTimeout(() => {
      zoomInputRef.current?.focus();
      zoomInputRef.current?.select();
    }, 0);
    const onPointerDown = (e: MouseEvent) => {
      if (zoomPopoverRef.current && !zoomPopoverRef.current.contains(e.target as Node)) {
        setZoomMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [zoomMenuOpen, zoomPercent]);

  const applyZoomDraft = () => {
    const parsed = Number(zoomDraft.trim());
    if (!Number.isFinite(parsed) || zoomDraft.trim() === '') {
      setZoomDraft(String(zoomPercent));
      zoomInputRef.current?.focus();
      zoomInputRef.current?.select();
      return;
    }
    const clamped = clampZoomValue(parsed);
    onChangeZoom(clamped);
    setZoomDraft(String(clamped));
    setZoomMenuOpen(false);
  };

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className={`status-badge ${isDirty ? 'is-dirty' : 'is-saved'}`}>
          <span className="status-dot" />
          {isDirty ? t.status.unsaved : filePath ? t.status.saved : t.status.draft}
        </span>

        {isRecordingMacro && (
          <button
            type="button"
            className="status-macro-rec"
            onClick={onToggleMacroRecording}
            title={`${t.actions.macroStop} (${formatShortcut('⌘⇧M')})`}
          >
            <span className="status-macro-dot" />
            <span>
              {t.status.macroRecording}
              {typeof macroStepCount === 'number' ? ` (${macroStepCount})` : ''}
            </span>
          </button>
        )}

        {autoSaveEnabled && filePath && (
          <span className="status-autosave-pill">{t.status.autoSaveOn}</span>
        )}

        {updateAvailableVersion && onOpenUpdateModal && (
          <button
            type="button"
            className={`status-update-pill ${updateReadyToInstall ? 'is-ready' : ''}`}
            onClick={onOpenUpdateModal}
            title={t.updates.availableBannerTitle.replace('{version}', updateAvailableVersion)}
          >
            <Download size={11} />
            <span>
              {updateReadyToInstall
                ? t.updates.statusBadgeReady.replace('{version}', updateAvailableVersion)
                : t.updates.statusBadgeAvailable.replace('{version}', updateAvailableVersion)}
            </span>
          </button>
        )}

        {runningTargets.length > 0 && (
          <div className="status-servers-wrap" ref={serverPopoverRef}>
            <button
              type="button"
              className={`status-servers-pill ${totalServerErrors > 0 ? 'has-error' : ''} ${
                serverMenuOpen ? 'is-open' : ''
              }`}
              onClick={() => {
                setEncMenuOpen(false);
                setLangMenuOpen(false);
                setZoomMenuOpen(false);
                setServerMenuOpen((v) => !v);
              }}
              title={t.project.statusServersPopoverTitle}
              aria-expanded={serverMenuOpen}
            >
              <span
                className={`project-status-dot ${
                  runningTargets.some((rt) => rt.starting) ? 'is-starting' : 'is-running'
                }`}
              />
              <Server size={11} />
              <span>
                {runningTargets.length === 1
                  ? (() => {
                      const rt = runningTargets[0];
                      const p = extractPortFromUrl(rt.url);
                      return p ? `${rt.name} :${p}` : rt.name;
                    })()
                  : t.project.statusServersRunning.replace(
                      '{count}',
                      String(runningTargets.length)
                    )}
              </span>
              {totalServerErrors > 0 && (
                <span className="project-logs-err-badge">
                  <AlertTriangle size={8} />
                  <span>{totalServerErrors}</span>
                </span>
              )}
            </button>

            {serverMenuOpen && (
              <div
                className="status-servers-popover"
                role="dialog"
                aria-label={t.project.statusServersPopoverTitle}
              >
                <div className="status-servers-popover-head">
                  <span>
                    {t.project.statusServersPopoverTitle} ({runningTargets.length})
                  </span>
                  {runningTargets.length > 1 && onStopAllProjectTargets && (
                    <button
                      type="button"
                      className="status-servers-stop-all"
                      onClick={() => {
                        setServerMenuOpen(false);
                        onStopAllProjectTargets();
                      }}
                    >
                      <Square size={9} />
                      <span>{t.project.stopAllTargetsBtn}</span>
                    </button>
                  )}
                </div>
                <div className="status-servers-popover-list">
                  {runningTargets.map((rt) => {
                    const p = extractPortFromUrl(rt.url);
                    const errCnt = getTargetErrorCount(rt);
                    return (
                      <div key={rt.rootPath} className="status-servers-popover-row">
                        <span
                          className={`project-status-dot ${
                            rt.starting ? 'is-starting' : 'is-running'
                          }`}
                        />
                        <div className="status-servers-popover-info">
                          <div className="status-servers-popover-name">
                            <span>{rt.name}</span>
                            {p && <span className="project-running-target-port">:{p}</span>}
                            {errCnt > 0 && (
                              <span className="project-logs-err-badge">
                                <AlertTriangle size={8} />
                                <span>{errCnt}</span>
                              </span>
                            )}
                          </div>
                          {rt.url && (
                            <div className="status-servers-popover-url">{rt.url}</div>
                          )}
                        </div>
                        <div className="status-servers-popover-actions">
                          {rt.url && onOpenProjectUrl && (
                            <button
                              type="button"
                              className="icon-btn-sm"
                              title={t.project.openInBuiltin}
                              onClick={() => {
                                onSelectTargetRoot?.(rt.rootPath);
                                onOpenProjectUrl(rt.url!, 'builtin');
                                setServerMenuOpen(false);
                              }}
                            >
                              <Globe size={11} />
                            </button>
                          )}
                          {onRestartProjectServer && !projectServer?.external && (
                            <button
                              type="button"
                              className="icon-btn-sm"
                              title={t.project.restartTargetTitle.replace('{name}', rt.name)}
                              onClick={() => {
                                onRestartProjectServer(rt.rootPath);
                              }}
                            >
                              <RotateCw size={11} />
                            </button>
                          )}
                          {onStopProjectServer && (
                            <button
                              type="button"
                              className="icon-btn-sm"
                              title={t.project.stopTargetTitle.replace('{name}', rt.name)}
                              onClick={() => {
                                onStopProjectServer(rt.rootPath);
                              }}
                            >
                              <Square size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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

        <div className="status-lang-wrap" ref={langPopoverRef}>
          <button
            type="button"
            className={`status-btn status-lang ${languageOverride ? 'is-overridden' : ''} ${langMenuOpen ? 'is-open' : ''}`}
            onClick={() => {
              setEncMenuOpen(false);
              setZoomMenuOpen(false);
              setLangMenuOpen((v) => !v);
            }}
            title={
              languageOverride
                ? `${t.status.languageSelectTitle}: ${languageLabel}`
                : `${t.status.languageAuto}: ${languageLabel} — ${t.status.languageSelectTitle}`
            }
            aria-label={t.status.languageSelectTitle}
          >
            {languageLabel}
          </button>

          {langMenuOpen && (
            <div className="status-lang-popover" role="dialog" aria-label={t.status.languageSelectTitle}>
              <div className="status-encoding-subtitle">{t.status.languageSelectTitle}</div>
              <div className="status-lang-list">
                <button
                  type="button"
                  className={`status-encoding-item ${!languageOverride ? 'is-current' : ''}`}
                  onClick={() => {
                    onChangeLanguageOverride?.(null);
                    setLangMenuOpen(false);
                  }}
                >
                  <span className="status-encoding-check">
                    {!languageOverride ? <Check size={12} /> : null}
                  </span>
                  <span className="status-encoding-item-label">{t.status.languageAuto}</span>
                </button>
                {LANGUAGE_OPTIONS.map((opt) => {
                  const isCurrent = languageOverride === opt.id;
                  const display = locale === 'ja' && opt.labelJa ? opt.labelJa : opt.label;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`status-encoding-item ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => {
                        onChangeLanguageOverride?.(opt.id);
                        setLangMenuOpen(false);
                      }}
                    >
                      <span className="status-encoding-check">
                        {isCurrent ? <Check size={12} /> : null}
                      </span>
                      <span className="status-encoding-item-label">{display}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
              setLangMenuOpen(false);
              setZoomMenuOpen(false);
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

        <button
          type="button"
          className="status-btn"
          onClick={onOpenGoToLine}
          title={`${t.actions.goToLine} (${formatShortcut('⌘L')})`}
        >
          {t.status.line} {cursorLine}, {t.status.col} {cursorCol}
        </button>

        <div className="status-zoom-wrap" ref={zoomPopoverRef}>
          <button
            type="button"
            className={`status-btn status-zoom-btn ${zoomMenuOpen ? 'is-open' : ''}`}
            onClick={() => {
              setEncMenuOpen(false);
              setLangMenuOpen(false);
              setZoomMenuOpen((v) => !v);
            }}
            title={t.status.zoomTitle}
            aria-label={t.status.zoomTitle}
          >
            {zoomPercent}%
          </button>

          {zoomMenuOpen && (
            <div className="status-zoom-popover" role="dialog" aria-label={t.status.zoomTitle}>
              <div className="status-zoom-header">
                <span className="status-zoom-title">{t.status.zoomTitle}</span>
                <button
                  type="button"
                  className="status-zoom-reset-btn"
                  disabled={zoomPercent === 100}
                  onClick={() => {
                    onChangeZoom(100);
                    setZoomDraft('100');
                    setZoomMenuOpen(false);
                  }}
                >
                  {t.status.zoomResetBtn}
                </button>
              </div>

              <form
                className="status-zoom-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyZoomDraft();
                }}
              >
                <div className="status-zoom-stepper">
                  <button
                    type="button"
                    className="status-zoom-step-btn"
                    title={t.actions.zoomOut}
                    onClick={() => {
                      const next = clampZoomValue(zoomPercent - 10);
                      onChangeZoom(next);
                      setZoomDraft(String(next));
                    }}
                  >
                    <Minus size={12} />
                  </button>
                  <div className="status-zoom-input-wrap">
                    <input
                      ref={zoomInputRef}
                      type="number"
                      min={25}
                      max={400}
                      step={5}
                      className="status-zoom-input"
                      aria-label={t.status.zoomInputLabel}
                      value={zoomDraft}
                      onChange={(e) => setZoomDraft(e.target.value)}
                    />
                    <span className="status-zoom-unit">%</span>
                  </div>
                  <button
                    type="button"
                    className="status-zoom-step-btn"
                    title={t.actions.zoomIn}
                    onClick={() => {
                      const next = clampZoomValue(zoomPercent + 10);
                      onChangeZoom(next);
                      setZoomDraft(String(next));
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <button type="submit" className="status-zoom-apply-btn">
                  {t.actions.apply}
                </button>
              </form>

              <div className="status-zoom-presets">
                {ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`status-zoom-preset ${zoomPercent === preset ? 'is-current' : ''}`}
                    onClick={() => {
                      onChangeZoom(preset);
                      setZoomDraft(String(preset));
                      setZoomMenuOpen(false);
                    }}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              <div className="status-zoom-hint">{t.status.zoomRangeHint}</div>
            </div>
          )}
        </div>

        {showScratchpadButton && onOpenScratchpad && (
          <button
            type="button"
            className="status-btn"
            onClick={onOpenScratchpad}
            title={locale === 'ja' ? 'クイック・スクラッチパッドを開く' : 'Open Quick Scratchpad'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <StickyNote size={12} />
            <span>{locale === 'ja' ? 'メモ' : 'Scratchpad'}</span>
          </button>
        )}

        {showTerminalButton && onToggleTerminal && (
          <button
            type="button"
            className={`status-btn ${terminalOpen ? 'is-active' : ''}`}
            onClick={onToggleTerminal}
            title={locale === 'ja' ? '統合ターミナルを開閉' : 'Toggle Integrated Terminal'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Terminal size={12} />
            <span>{locale === 'ja' ? 'ターミナル' : 'Terminal'}</span>
          </button>
        )}

        {topBarHidden && (
          <>
            {onChangeMode && (() => {
              const nextMode = getNextStatusBarMode(mode);
              const currentLabel = t.modes[mode];
              const nextLabel = t.modes[nextMode];
              return (
                <button
                  type="button"
                  className="status-btn status-mode-switch-btn"
                  onClick={() => onChangeMode(nextMode)}
                  title={`${t.status.switchModeTitle.replace('{mode}', nextLabel)} (${formatShortcut('⌘+\\')})`}
                  aria-label={`${currentLabel} → ${nextLabel}`}
                >
                  <span className="status-mode-current">{currentLabel}</span>
                  <span className="status-mode-arrow" aria-hidden="true">→</span>
                  <span className="status-mode-next">{nextLabel}</span>
                </button>
              );
            })()}
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
