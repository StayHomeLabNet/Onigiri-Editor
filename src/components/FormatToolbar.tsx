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
  ChevronLeft,
  ChevronRight,
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
import {
  computeNextFormatToolbarLevel,
  DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS,
  type FormatToolbarCollapseLevel,
  type FormatToolbarSavedWidths,
} from '../utils/toolbarLayout';
import { AiCustomIcon } from './AiCustomIcon';

const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;

interface FormatToolbarProps {
  t: Translations;
  mode: AppMode;
  /** Show New/Open/Save buttons in the format toolbar (only needed when TopBar is hidden) */
  showFileActions?: boolean;
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
  showFileActions = false,
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

  const toolbarRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const aiCleanBtnRef = useRef<HTMLButtonElement>(null);
  const copyRichBtnRef = useRef<HTMLButtonElement>(null);

  const [collapseLevel, setCollapseLevel] = useState<FormatToolbarCollapseLevel>(0);
  const savedWidthsRef = useRef<FormatToolbarSavedWidths>({
    ...DEFAULT_FORMAT_TOOLBAR_SAVED_WIDTHS,
  });
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < maxScroll - 2);
  }, []);

  const evaluateLayout = useCallback(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const isOverflowing = el.scrollWidth > el.clientWidth + 1;
    const spacerWidth = spacerRef.current?.offsetWidth ?? 0;

    if (mode === 'advanced') {
      setCollapseLevel((prev) => {
        const next = computeNextFormatToolbarLevel(
          prev,
          isOverflowing,
          spacerWidth,
          savedWidthsRef.current
        );

        // Cache actual width freed right before collapsing each stage
        if (next > prev) {
          if (prev === 0 && next >= 1 && copyRichBtnRef.current) {
            const delta = copyRichBtnRef.current.getBoundingClientRect().width - 26;
            if (delta > 16) savedWidthsRef.current[1] = Math.ceil(delta);
          }
          if (prev <= 1 && next >= 2 && aiCleanBtnRef.current) {
            const delta = aiCleanBtnRef.current.getBoundingClientRect().width - 26;
            if (delta > 16) savedWidthsRef.current[2] = Math.ceil(delta);
          }
        }

        return next;
      });
    } else if (collapseLevel !== 0) {
      setCollapseLevel(0);
    }

    updateScrollIndicators();
  }, [mode, collapseLevel, updateScrollIndicators]);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const rafId = window.requestAnimationFrame(evaluateLayout);

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => evaluateLayout());
      ro.observe(el);
      return () => {
        window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }

    window.addEventListener('resize', evaluateLayout);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', evaluateLayout);
    };
  }, [evaluateLayout]);

  // Re-evaluate after collapse level or toolbar contents change
  useEffect(() => {
    const rafId = window.requestAnimationFrame(evaluateLayout);
    return () => window.cancelAnimationFrame(rafId);
  }, [collapseLevel, mode, showFileActions, aiCustomButtons.length, evaluateLayout]);

  const handleWheelScroll = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = toolbarRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
    }
  }, []);

  const scrollToolbarBy = useCallback((delta: number) => {
    const el = toolbarRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const isCopyRichIconOnly = collapseLevel >= 1;
  const isAiCleanIconOnly = collapseLevel >= 2;

  return (
    <div className="format-toolbar-wrap">
      {canScrollLeft && (
        <div className="tb-scroll-edge is-left">
          <button
            type="button"
            className="tb-scroll-arrow"
            onMouseDown={keepFocusMouseDown}
            onClick={() => scrollToolbarBy(-180)}
            aria-label="Scroll toolbar left"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      )}

      <div
        className="format-toolbar format-toolbar-scroll"
        ref={toolbarRef}
        onScroll={updateScrollIndicators}
        onWheel={handleWheelScroll}
      >
        {showFileActions && (
          <>
            <div className="tb-group">
              <button
                type="button"
                className="tb-btn"
                onMouseDown={keepFocusMouseDown}
                onClick={() => onAction('newFile')}
                data-tooltip={t.actions.newFile}
                data-tooltip-shortcut={formatShortcut('⌘N')}
                aria-label={t.actions.newFile}
              >
                <FilePlus2 size={15} />
              </button>
              <button
                type="button"
                className="tb-btn"
                onMouseDown={keepFocusMouseDown}
                onClick={() => onAction('openFile')}
                data-tooltip={t.actions.openFile}
                data-tooltip-shortcut={formatShortcut('⌘O')}
                aria-label={t.actions.openFile}
              >
                <FolderOpen size={15} />
              </button>
              <button
                type="button"
                className={`tb-btn ${isDirty ? 'is-accent' : ''}`}
                onMouseDown={keepFocusMouseDown}
                onClick={() => onAction('save')}
                data-tooltip={t.actions.save}
                data-tooltip-shortcut={formatShortcut('⌘S')}
                aria-label={t.actions.save}
              >
                <Save size={15} />
              </button>
            </div>
            <span className="tb-sep" />
          </>
        )}

        <div className="tb-group">
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('undo')}
            data-tooltip={t.actions.undo}
            data-tooltip-shortcut={formatShortcut('⌘Z')}
            aria-label={t.actions.undo}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('redo')}
            data-tooltip={t.actions.redo}
            data-tooltip-shortcut={formatShortcut('⌘⇧Z')}
            aria-label={t.actions.redo}
          >
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
            data-tooltip={t.actions.selectAll}
            data-tooltip-shortcut={formatShortcut('⌘A')}
            aria-label={t.actions.selectAll}
          >
            <TextSelect size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onMouseDown={keepFocusMouseDown}
            onClick={() => onAction('copy')}
            data-tooltip={t.actions.copy}
            data-tooltip-shortcut={formatShortcut('⌘C')}
            aria-label={t.actions.copy}
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onMouseDown={keepFocusMouseDown}
            onClick={() => onAction('paste')}
            data-tooltip={t.actions.paste}
            data-tooltip-shortcut={formatShortcut('⌘V')}
            aria-label={t.actions.paste}
          >
            <ClipboardPaste size={15} />
          </button>
        </div>

        <span className="tb-sep" />

        <div className="tb-group">
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('h1')}
            data-tooltip={t.toolbar.heading1}
            aria-label={t.toolbar.heading1}
          >
            <Heading1 size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('h2')}
            data-tooltip={t.toolbar.heading2}
            aria-label={t.toolbar.heading2}
          >
            <Heading2 size={15} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="tb-btn"
              onClick={() => onAction('h3')}
              data-tooltip={t.toolbar.heading3}
              aria-label={t.toolbar.heading3}
            >
              <Heading3 size={15} />
            </button>
          )}
        </div>

        <span className="tb-sep" />

        <div className="tb-group">
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('bold')}
            data-tooltip={t.toolbar.bold}
            data-tooltip-shortcut={formatShortcut('⌘B')}
            aria-label={t.toolbar.bold}
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('italic')}
            data-tooltip={t.toolbar.italic}
            data-tooltip-shortcut={formatShortcut('⌘I')}
            aria-label={t.toolbar.italic}
          >
            <Italic size={15} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="tb-btn"
              onClick={() => onAction('strike')}
              data-tooltip={t.toolbar.strikethrough}
              aria-label={t.toolbar.strikethrough}
            >
              <Strikethrough size={15} />
            </button>
          )}
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('code')}
            data-tooltip={t.toolbar.inlineCode}
            aria-label={t.toolbar.inlineCode}
          >
            <Code size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('codeblock')}
            data-tooltip={t.toolbar.codeBlock}
            aria-label={t.toolbar.codeBlock}
          >
            <FileCode size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('link')}
            data-tooltip={t.toolbar.link}
            aria-label={t.toolbar.link}
          >
            <Link size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('image')}
            data-tooltip={t.toolbar.image}
            aria-label={t.toolbar.image}
          >
            <ImagePlus size={15} />
          </button>
        </div>

        <span className="tb-sep" />

        <div className="tb-group">
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('ul')}
            data-tooltip={t.toolbar.bulletList}
            aria-label={t.toolbar.bulletList}
          >
            <List size={15} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="tb-btn"
              onClick={() => onAction('ol')}
              data-tooltip={t.toolbar.numberedList}
              aria-label={t.toolbar.numberedList}
            >
              <ListOrdered size={15} />
            </button>
          )}
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('task')}
            data-tooltip={t.toolbar.taskList}
            aria-label={t.toolbar.taskList}
          >
            <ListTodo size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('quote')}
            data-tooltip={t.toolbar.quote}
            aria-label={t.toolbar.quote}
          >
            <Quote size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onClick={() => onAction('table')}
            data-tooltip={t.toolbar.table}
            aria-label={t.toolbar.table}
          >
            <Table size={15} />
          </button>
          {mode === 'advanced' && (
            <button
              type="button"
              className="tb-btn"
              onClick={() => onAction('hr')}
              data-tooltip={t.toolbar.hr}
              aria-label={t.toolbar.hr}
            >
              <Minus size={15} />
            </button>
          )}
        </div>

        {mode === 'advanced' && (
          <>
            <span className="tb-sep" />
            <div className="tb-group">
              <button
                type="button"
                className="tb-btn"
                onClick={() => onAction('math')}
                data-tooltip={t.toolbar.math}
                aria-label={t.toolbar.math}
              >
                <Sigma size={15} />
              </button>
              <button
                type="button"
                className="tb-btn"
                onClick={() => onAction('mermaid')}
                data-tooltip={t.toolbar.mermaid}
                aria-label={t.toolbar.mermaid}
              >
                <GitFork size={15} />
              </button>
              <button
                type="button"
                className="tb-btn"
                onClick={() => onAction('callout')}
                data-tooltip={t.toolbar.callout}
                aria-label={t.toolbar.callout}
              >
                <MessageSquareQuote size={15} />
              </button>
              <button
                type="button"
                className="tb-btn"
                onClick={() => onAction('citation')}
                data-tooltip={t.actions.insertCitation}
                aria-label={t.actions.insertCitation}
              >
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
                const tooltipText = isRunning
                  ? `${runningName}${t.settingsModal.aiCustom.runningTooltipSuffix}`
                  : hasSubmenu
                    ? `${label}${t.settingsModal.aiCustom.submenuTooltipHint}`
                    : label;
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
                    data-tooltip={tooltipText}
                    data-tooltip-shortcut={!isRunning && btnShortcut ? btnShortcut : undefined}
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
                    data-tooltip={subLabel}
                    data-tooltip-shortcut={subShortcut || undefined}
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

        <div className="tb-spacer" ref={spacerRef} />

        <div className="tb-group">
          {mode === 'advanced' && (
            <>
              <button
                ref={aiCleanBtnRef}
                type="button"
                className={`tb-pill tb-ai-clean-btn ${isAiCleanIconOnly ? 'is-icon-only' : ''}`}
                onClick={() => onAction('aiClean')}
                data-tooltip={t.toolbar.aiClean}
                aria-label={t.toolbar.aiClean}
              >
                <Sparkles size={13} />
                <span className="tb-btn-label tb-ai-clean-label">{t.toolbar.aiClean}</span>
              </button>
              <button
                ref={copyRichBtnRef}
                type="button"
                className={`tb-pill tb-copy-rich-btn ${isCopyRichIconOnly ? 'is-icon-only' : ''}`}
                onClick={() => onAction('copyRich')}
                data-tooltip={t.actions.copyRichText}
                aria-label={t.actions.copyRichText}
              >
                <ClipboardCopy size={13} />
                <span className="tb-btn-label tb-copy-rich-label">{t.actions.copyRichText}</span>
              </button>
              <span className="tb-sep" />
            </>
          )}
          <button
            type="button"
            className="tb-btn"
            onMouseDown={keepFocusMouseDown}
            onClick={() => onAction('zoomOut')}
            data-tooltip={t.actions.zoomOut}
            data-tooltip-shortcut={formatShortcut('⌘-')}
            aria-label={t.actions.zoomOut}
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            className="tb-btn"
            onMouseDown={keepFocusMouseDown}
            onClick={() => onAction('zoomIn')}
            data-tooltip={t.actions.zoomIn}
            data-tooltip-shortcut={formatShortcut('⌘+')}
            aria-label={t.actions.zoomIn}
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
            data-tooltip={t.actions.toggleEditorSplit}
            aria-label={t.actions.toggleEditorSplit}
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
            data-tooltip={isRecordingMacro ? t.actions.macroStop : t.actions.macroRecord}
            data-tooltip-shortcut={formatShortcut('⌘⇧M')}
            aria-label={isRecordingMacro ? t.actions.macroStop : t.actions.macroRecord}
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
            data-tooltip={
              hasMacro
                ? `${t.actions.macroPlay} · ${macroStepCount ?? 0}`
                : t.actions.macroPlay
            }
            data-tooltip-shortcut="F8"
            aria-label={t.actions.macroPlay}
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
            data-tooltip={t.actions.findReplace}
            data-tooltip-shortcut={formatShortcut('⌘F')}
            aria-label={t.actions.findReplace}
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      {canScrollRight && (
        <div className="tb-scroll-edge is-right">
          <button
            type="button"
            className="tb-scroll-arrow"
            onMouseDown={keepFocusMouseDown}
            onClick={() => scrollToolbarBy(180)}
            aria-label="Scroll toolbar right"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
