import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  FileCode,
  FilePlus2,
  FolderOpen,
  Save,
  Link,
  ImagePlus,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Table,
  Minus,
  Heading1,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  Sparkles,
  Sigma,
  GitFork,
  MessageSquareQuote,
  ClipboardCopy,
  Search,
  TextSelect,
  Copy,
  ClipboardPaste,
  ZoomOut,
  ZoomIn,
  Circle,
  Square,
  Play,
  Rows2,
  BookMarked,
  Loader2,
} from 'lucide-react';
import type { AiCustomButton, AiCustomSubmenuItem, AppMode } from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut } from '../utils/platform';
import { getActiveSubmenuItems } from '../utils/aiCustomButtons';
import {
  formatKeybindingForDisplay,
  getAiCustomButtonKeybindingId,
  getAiCustomSubmenuKeybindingId,
} from '../utils/keybindings';
import { AiCustomIcon } from './AiCustomIcon';

const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;

interface FormatToolbarProps {
  t: Translations;
  mode: AppMode;
  onAction: (action: string) => void;
  isDirty?: boolean;
  isEditorSplit?: boolean;
  isRecordingMacro?: boolean;
  isPlayingMacro?: boolean;
  hasMacro?: boolean;
  macroStepCount?: number;
  aiCustomButtons?: AiCustomButton[];
  runningAiCustomId?: string | null;
  runningAiCustomLabel?: string | null;
  onRunAiCustomButton?: (
    action: AiCustomButton | AiCustomSubmenuItem,
    parentButtonId?: string
  ) => void;
  onCancelAiCustom?: () => void;
  effectiveKeybindings?: Record<string, string>;
}

interface OpenSubmenuState {
  buttonId: string;
  top: number;
  left: number;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({
  t,
  mode,
  onAction,
  isDirty,
  isEditorSplit,
  isRecordingMacro,
  isPlayingMacro,
  hasMacro,
  macroStepCount,
  aiCustomButtons = [],
  runningAiCustomId = null,
  runningAiCustomLabel = null,
  onRunAiCustomButton,
  onCancelAiCustom,
  effectiveKeybindings,
}) => {
  const [openSubmenu, setOpenSubmenu] = useState<OpenSubmenuState | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  const triggerBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const openSubmenuForButton = useCallback((buttonId: string, anchorEl: HTMLButtonElement) => {
    const rect = anchorEl.getBoundingClientRect();
    const estimatedWidth = 220;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - estimatedWidth - 8));
    const top = Math.min(rect.bottom + 4, window.innerHeight - 48);
    setOpenSubmenu({ buttonId, top, left });
  }, []);

  useEffect(() => {
    if (!openSubmenu) return;
    const onMouseDownOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (submenuRef.current?.contains(target)) return;
      const triggerEl = triggerBtnRefs.current[openSubmenu.buttonId];
      if (triggerEl?.contains(target)) return;
      setOpenSubmenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenSubmenu(null);
      }
    };
    const onViewportChange = () => setOpenSubmenu(null);
    window.addEventListener('mousedown', onMouseDownOutside, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      window.removeEventListener('mousedown', onMouseDownOutside, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [openSubmenu]);

  // Close submenu if the button or its submenu items disappear or another action starts running
  useEffect(() => {
    if (!openSubmenu) return;
    const btn = aiCustomButtons.find((b) => b.id === openSubmenu.buttonId);
    if (!btn || getActiveSubmenuItems(btn).length === 0 || runningAiCustomId) {
      setOpenSubmenu(null);
    }
  }, [openSubmenu, aiCustomButtons, runningAiCustomId]);

  const activeSubmenuButton = openSubmenu
    ? aiCustomButtons.find((b) => b.id === openSubmenu.buttonId) ?? null
    : null;
  const activeSubmenuItems = activeSubmenuButton
    ? getActiveSubmenuItems(activeSubmenuButton)
    : [];
  const keepFocusMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  return (
    <div className="format-toolbar">
      <div className="tb-group">
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('newFile')}
          title={`${t.actions.newFile} (${formatShortcut('⌘N')})`}
        >
          <FilePlus2 size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('openFile')}
          title={`${t.actions.openFile} (${formatShortcut('⌘O')})`}
        >
          <FolderOpen size={15} />
        </button>
        <button
          type="button"
          className={`tb-btn ${isDirty ? 'is-accent' : ''}`}
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('save')}
          title={`${t.actions.save} (${formatShortcut('⌘S')})`}
        >
          <Save size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('undo')} title={t.actions.undo}>
          <Undo2 size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('redo')} title={t.actions.redo}>
          <Redo2 size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('selectAll')}
          title={`${t.actions.selectAll} (${formatShortcut('⌘A')})`}
        >
          <TextSelect size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('copy')}
          title={`${t.actions.copy} (${formatShortcut('⌘C')})`}
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('paste')}
          title={`${t.actions.paste} (${formatShortcut('⌘V')})`}
        >
          <ClipboardPaste size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('h1')} title={t.toolbar.heading1}>
          <Heading1 size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('h2')} title={t.toolbar.heading2}>
          <Heading2 size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('h3')} title={t.toolbar.heading3}>
            <Heading3 size={15} />
          </button>
        )}
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('bold')} title={`${t.toolbar.bold} (${formatShortcut('⌘B')})`}>
          <Bold size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('italic')} title={`${t.toolbar.italic} (${formatShortcut('⌘I')})`}>
          <Italic size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('strike')} title={t.toolbar.strikethrough}>
            <Strikethrough size={15} />
          </button>
        )}
        <button type="button" className="tb-btn" onClick={() => onAction('code')} title={t.toolbar.inlineCode}>
          <Code size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('codeblock')} title={t.toolbar.codeBlock}>
          <FileCode size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('link')} title={t.toolbar.link}>
          <Link size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('image')} title={t.toolbar.image}>
          <ImagePlus size={15} />
        </button>
      </div>

      <span className="tb-sep" />

      <div className="tb-group">
        <button type="button" className="tb-btn" onClick={() => onAction('ul')} title={t.toolbar.bulletList}>
          <List size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('ol')} title={t.toolbar.numberedList}>
            <ListOrdered size={15} />
          </button>
        )}
        <button type="button" className="tb-btn" onClick={() => onAction('task')} title={t.toolbar.taskList}>
          <ListTodo size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('quote')} title={t.toolbar.quote}>
          <Quote size={15} />
        </button>
        <button type="button" className="tb-btn" onClick={() => onAction('table')} title={t.toolbar.table}>
          <Table size={15} />
        </button>
        {mode === 'advanced' && (
          <button type="button" className="tb-btn" onClick={() => onAction('hr')} title={t.toolbar.hr}>
            <Minus size={15} />
          </button>
        )}
      </div>

      {mode === 'advanced' && (
        <>
          <span className="tb-sep" />
          <div className="tb-group">
            <button type="button" className="tb-btn" onClick={() => onAction('math')} title={t.toolbar.math}>
              <Sigma size={15} />
            </button>
            <button type="button" className="tb-btn" onClick={() => onAction('mermaid')} title={t.toolbar.mermaid}>
              <GitFork size={15} />
            </button>
            <button type="button" className="tb-btn" onClick={() => onAction('callout')} title={t.toolbar.callout}>
              <MessageSquareQuote size={15} />
            </button>
            <button type="button" className="tb-btn" onClick={() => onAction('citation')} title={t.actions.insertCitation}>
              <BookMarked size={15} />
            </button>
          </div>
        </>
      )}

      {aiCustomButtons.length > 0 && (
        <>
          <span className="tb-sep" />
          <div className="tb-group">
            {aiCustomButtons.map((btn) => {
              const isRunning = runningAiCustomId === btn.id;
              const isDisabled = Boolean(runningAiCustomId) && !isRunning;
              const submenuItems = getActiveSubmenuItems(btn);
              const hasSubmenu = submenuItems.length > 0;
              const isSubmenuOpen = openSubmenu?.buttonId === btn.id;
              const label = btn.name.trim() || t.settingsModal.aiCustom.defaultButtonName;
              const runningName = runningAiCustomLabel?.trim() || label;
              const btnShortcut = formatKeybindingForDisplay(
                effectiveKeybindings?.[getAiCustomButtonKeybindingId(btn.id)]
              );
              const labelWithShortcut = btnShortcut ? `${label} (${btnShortcut})` : label;
              const tooltip = isRunning
                ? `${runningName}${t.settingsModal.aiCustom.runningTooltipSuffix}`
                : hasSubmenu
                  ? `${labelWithShortcut}${t.settingsModal.aiCustom.submenuTooltipHint}`
                  : labelWithShortcut;
              return (
                <button
                  key={btn.id}
                  ref={(el) => {
                    triggerBtnRefs.current[btn.id] = el;
                  }}
                  type="button"
                  className={`tb-btn ${isRunning ? 'is-ai-running' : ''} ${hasSubmenu ? 'has-submenu' : ''} ${isSubmenuOpen ? 'is-submenu-open' : ''}`}
                  disabled={isDisabled}
                  aria-haspopup={hasSubmenu ? 'menu' : undefined}
                  aria-expanded={hasSubmenu ? isSubmenuOpen : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (e.button !== 0) return;
                    longPressTriggeredRef.current = false;
                    clearLongPressTimer();
                    if (!hasSubmenu || isRunning || isDisabled) return;
                    const anchor = e.currentTarget;
                    pressStartRef.current = { x: e.clientX, y: e.clientY };
                    longPressTimerRef.current = window.setTimeout(() => {
                      longPressTimerRef.current = null;
                      pressStartRef.current = null;
                      longPressTriggeredRef.current = true;
                      openSubmenuForButton(btn.id, anchor);
                    }, LONG_PRESS_MS);
                  }}
                  onMouseMove={(e) => {
                    if (!pressStartRef.current) return;
                    const dx = e.clientX - pressStartRef.current.x;
                    const dy = e.clientY - pressStartRef.current.y;
                    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD_PX) {
                      clearLongPressTimer();
                    }
                  }}
                  onMouseUp={() => {
                    clearLongPressTimer();
                  }}
                  onMouseLeave={() => {
                    clearLongPressTimer();
                  }}
                  onContextMenu={(e) => {
                    if (!hasSubmenu || isRunning || isDisabled) return;
                    e.preventDefault();
                    e.stopPropagation();
                    clearLongPressTimer();
                    longPressTriggeredRef.current = false;
                    if (isSubmenuOpen) {
                      setOpenSubmenu(null);
                    } else {
                      openSubmenuForButton(btn.id, e.currentTarget);
                    }
                  }}
                  onClick={() => {
                    clearLongPressTimer();
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    setOpenSubmenu(null);
                    if (isRunning) {
                      onCancelAiCustom?.();
                    } else {
                      onRunAiCustomButton?.(btn, btn.id);
                    }
                  }}
                  title={tooltip}
                  aria-label={label}
                >
                  {isRunning ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <AiCustomIcon icon={btn.icon} size={15} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {openSubmenu &&
        activeSubmenuButton &&
        activeSubmenuItems.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={submenuRef}
            className="tb-ai-submenu-popover"
            role="menu"
            style={{ top: openSubmenu.top, left: openSubmenu.left }}
          >
            {activeSubmenuItems.map((sub) => {
              const subLabel =
                sub.name.trim() || t.settingsModal.aiCustom.submenuDefaultName;
              const subShortcut = formatKeybindingForDisplay(
                effectiveKeybindings?.[
                  getAiCustomSubmenuKeybindingId(activeSubmenuButton.id, sub.id)
                ]
              );
              return (
                <button
                  key={sub.id}
                  type="button"
                  role="menuitem"
                  className="tb-ai-submenu-item"
                  onMouseDown={keepFocusMouseDown}
                  onClick={() => {
                    setOpenSubmenu(null);
                    onRunAiCustomButton?.(sub, activeSubmenuButton.id);
                  }}
                  title={subShortcut ? `${subLabel} (${subShortcut})` : subLabel}
                >
                  <span className="tb-ai-submenu-item-icon">
                    <AiCustomIcon icon={sub.icon} size={14} />
                  </span>
                  <span className="tb-ai-submenu-item-label">{subLabel}</span>
                  {subShortcut && <kbd className="tb-ai-submenu-kbd">{subShortcut}</kbd>}
                </button>
              );
            })}
          </div>,
          document.body
        )}

      <div className="tb-spacer" />

      <div className="tb-group">
        {mode === 'advanced' && (
          <>
            <button
              type="button"
              className="tb-pill"
              onClick={() => onAction('aiClean')}
              title={t.toolbar.aiClean}
            >
              <Sparkles size={13} />
              <span>{t.toolbar.aiClean}</span>
            </button>
            <button
              type="button"
              className="tb-pill"
              onClick={() => onAction('copyRich')}
              title={t.actions.copyRichText}
            >
              <ClipboardCopy size={13} />
              <span className="hide-md">{t.actions.copyRichText}</span>
            </button>
            <span className="tb-sep" />
          </>
        )}
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('zoomOut')}
          title={`${t.actions.zoomOut} (${formatShortcut('⌘-')})`}
        >
          <ZoomOut size={15} />
        </button>
        <button
          type="button"
          className="tb-btn"
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('zoomIn')}
          title={`${t.actions.zoomIn} (${formatShortcut('⌘+')})`}
        >
          <ZoomIn size={15} />
        </button>
        <span className="tb-sep" />
        <button
          type="button"
          className={`tb-btn ${isEditorSplit ? 'is-accent is-active-tool' : ''}`}
          aria-pressed={Boolean(isEditorSplit)}
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('toggleEditorSplit')}
          title={t.actions.toggleEditorSplit}
        >
          <Rows2 size={15} />
        </button>
        <span className="tb-sep" />
        <button
          type="button"
          className={`tb-btn ${isRecordingMacro ? 'is-recording' : ''}`}
          aria-pressed={Boolean(isRecordingMacro)}
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('macroToggleRecord')}
          title={
            isRecordingMacro
              ? `${t.actions.macroStop} (${formatShortcut('⌘⇧M')})`
              : `${t.actions.macroRecord} (${formatShortcut('⌘⇧M')})`
          }
        >
          {isRecordingMacro ? (
            <Square size={12} className="macro-stop-icon" />
          ) : (
            <Circle size={13} className="macro-record-icon" />
          )}
        </button>
        <button
          type="button"
          className="tb-btn"
          disabled={!hasMacro || Boolean(isRecordingMacro) || Boolean(isPlayingMacro)}
          onMouseDown={keepFocusMouseDown}
          onClick={() => onAction('macroPlay')}
          title={
            hasMacro
              ? `${t.actions.macroPlay} (F8 · ${macroStepCount ?? 0})`
              : `${t.actions.macroPlay} (F8)`
          }
        >
          <Play
            size={14}
            className={hasMacro && !isRecordingMacro ? 'macro-play-icon is-ready' : 'macro-play-icon'}
          />
        </button>
        <span className="tb-sep" />
        <button
          type="button"
          className="tb-btn"
          onClick={() => onAction('find')}
          title={`${t.actions.findReplace} (${formatShortcut('⌘F')})`}
        >
          <Search size={15} />
        </button>
      </div>
    </div>
  );
};
