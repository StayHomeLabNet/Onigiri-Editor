import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import type { Translations } from '../i18n/types';
import { formatShortcut, isMacOs } from '../utils/platform';

export type EditorContextAction =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'delete'
  | 'selectAll'
  | 'rectangularSelection'
  | 'indentTab'
  | 'unindentTab'
  | 'indentSpace'
  | 'unindentSpace'
  | 'insertComment'
  | 'removeComment'
  | 'spacesToTabs'
  | 'tabsToSpaces'
  | 'toLowerCase'
  | 'toUpperCase'
  | 'reverseLines'
  | 'sortLinesAsc'
  | 'sortLinesDesc'
  | 'dedupeLines'
  | 'removeEmptyLines'
  | 'trimLeading'
  | 'trimTrailing'
  | 'insertQuote'
  | 'removeQuote'
  | 'insertWrapLineBreaks'
  | 'removeLineBreaks'
  | 'formatMarkdownTables'
  | 'formatJson'
  | 'minifyJson'
  | 'sortJsonKeys'
  | 'jsonToYaml'
  | 'yamlToJson'
  | 'formatEnv'
  | 'to-full'
  | 'to-full-kana'
  | 'to-full-alnum'
  | 'to-half'
  | 'to-half-kana'
  | 'to-half-alnum'
  | 'toggleBookmark'
  | 'nextBookmark'
  | 'prevBookmark'
  | 'clearBookmarks'
  | 'aiEditSelection';

export interface EditorContextMenuState {
  x: number;
  y: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  canCopy: boolean;
  isRectMode: boolean;
  hasBookmarks: boolean;
}

interface EditorContextMenuProps {
  t: Translations;
  menu: EditorContextMenuState | null;
  onClose: () => void;
  onAction: (action: EditorContextAction) => void;
}

type SubmenuId = 'advanced' | 'width' | 'bookmarks' | 'data' | null;

export const EditorContextMenu: React.FC<EditorContextMenuProps> = ({
  t,
  menu,
  onClose,
  onAction,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const subRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [openSub, setOpenSub] = useState<SubmenuId>(null);
  const [subAnchorRect, setSubAnchorRect] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null>(null);
  const [subPos, setSubPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setOpenSub(null);
    setSubAnchorRect(null);
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > vw - pad) {
      left = Math.max(pad, menu.x - rect.width);
    }
    if (top + rect.height > vh - pad) {
      top = Math.max(pad, vh - rect.height - pad);
    }
    setPos({ left, top });
  }, [menu]);

  useLayoutEffect(() => {
    if (!openSub || !subAnchorRect || !subRef.current) return;
    const rect = subRef.current.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = subAnchorRect.right - 2;
    if (left + rect.width > vw - pad) {
      left = Math.max(pad, subAnchorRect.left - rect.width + 2);
    }
    let top = subAnchorRect.top - 4;
    if (top + rect.height > vh - pad) {
      top = Math.max(pad, vh - rect.height - pad);
    }
    setSubPos({ left, top });
  }, [openSub, subAnchorRect]);

  useEffect(() => {
    if (!menu) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || subRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const onBlur = () => onClose();
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [menu, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  if (!menu) return null;

  const isMac = isMacOs();
  const cm = t.contextMenu;

  const trigger = (action: EditorContextAction, disabled = false) => {
    if (disabled) return;
    onClose();
    onAction(action);
  };

  const handleOpenSub = (id: SubmenuId, el: HTMLElement) => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    const r = el.getBoundingClientRect();
    setSubAnchorRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
    setOpenSub(id);
  };

  const scheduleCloseSub = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setOpenSub(null);
    }, 140);
  };

  const cancelCloseSub = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const renderItem = (
    label: string,
    action: EditorContextAction,
    opts?: { shortcut?: string; disabled?: boolean; checked?: boolean }
  ) => {
    const disabled = Boolean(opts?.disabled);
    return (
      <button
        key={action}
        type="button"
        className={`editor-ctx-item ${disabled ? 'is-disabled' : ''}`}
        disabled={disabled}
        onClick={() => trigger(action, disabled)}
      >
        <span className="editor-ctx-check">{opts?.checked ? <Check size={13} /> : null}</span>
        <span className="editor-ctx-label">{label}</span>
        {opts?.shortcut ? <span className="editor-ctx-shortcut">{opts.shortcut}</span> : null}
      </button>
    );
  };

  return (
    <>
      <div
        ref={rootRef}
        className="editor-ctx-menu"
        style={{ left: pos.left, top: pos.top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {renderItem(cm.undo, 'undo', {
          shortcut: formatShortcut('⌘+Z'),
          disabled: !menu.canUndo,
        })}
        {renderItem(cm.redo, 'redo', {
          shortcut: isMac ? '⌘+⇧+Z' : 'Ctrl+Y',
          disabled: !menu.canRedo,
        })}

        <div className="editor-ctx-sep" />

        {renderItem(cm.cut, 'cut', {
          shortcut: formatShortcut('⌘+X'),
          disabled: !menu.hasSelection,
        })}
        {renderItem(cm.copy, 'copy', {
          shortcut: formatShortcut('⌘+C'),
          disabled: !menu.canCopy,
        })}
        {renderItem(cm.paste, 'paste', {
          shortcut: formatShortcut('⌘+V'),
        })}
        {renderItem(cm.del, 'delete', {
          shortcut: 'Delete',
          disabled: !menu.hasSelection,
        })}

        <div className="editor-ctx-sep" />

        {renderItem(cm.selectAll, 'selectAll', {
          shortcut: formatShortcut('⌘+A'),
        })}
        {renderItem(cm.rectangularSelection, 'rectangularSelection', {
          shortcut: isMac ? '⌥+Drag' : 'Alt+Drag',
          checked: menu.isRectMode,
        })}

        <div className="editor-ctx-sep" />

        {renderItem(cm.aiEditSelection, 'aiEditSelection', {
          shortcut: formatShortcut('⌘+⇧+E'),
          disabled: !menu.hasSelection,
        })}

        <div className="editor-ctx-sep" />

        <div
          className={`editor-ctx-item has-sub ${openSub === 'advanced' ? 'is-open' : ''}`}
          onMouseEnter={(e) => handleOpenSub('advanced', e.currentTarget)}
          onMouseLeave={scheduleCloseSub}
          onClick={(e) => handleOpenSub('advanced', e.currentTarget)}
        >
          <span className="editor-ctx-check" />
          <span className="editor-ctx-label">{cm.advanced}</span>
          <ChevronRight size={13} className="editor-ctx-arrow" />
        </div>

        <div
          className={`editor-ctx-item has-sub ${openSub === 'width' ? 'is-open' : ''}`}
          onMouseEnter={(e) => handleOpenSub('width', e.currentTarget)}
          onMouseLeave={scheduleCloseSub}
          onClick={(e) => handleOpenSub('width', e.currentTarget)}
        >
          <span className="editor-ctx-check" />
          <span className="editor-ctx-label">{cm.widthConvert}</span>
          <ChevronRight size={13} className="editor-ctx-arrow" />
        </div>

        <div
          className={`editor-ctx-item has-sub ${openSub === 'bookmarks' ? 'is-open' : ''}`}
          onMouseEnter={(e) => handleOpenSub('bookmarks', e.currentTarget)}
          onMouseLeave={scheduleCloseSub}
          onClick={(e) => handleOpenSub('bookmarks', e.currentTarget)}
        >
          <span className="editor-ctx-check" />
          <span className="editor-ctx-label">{cm.bookmarks}</span>
          <ChevronRight size={13} className="editor-ctx-arrow" />
        </div>

        <div
          className={`editor-ctx-item has-sub ${openSub === 'data' ? 'is-open' : ''}`}
          onMouseEnter={(e) => handleOpenSub('data', e.currentTarget)}
          onMouseLeave={scheduleCloseSub}
          onClick={(e) => handleOpenSub('data', e.currentTarget)}
        >
          <span className="editor-ctx-check" />
          <span className="editor-ctx-label">JSON / YAML / Table</span>
          <ChevronRight size={13} className="editor-ctx-arrow" />
        </div>
      </div>

      {openSub && (
        <div
          ref={subRef}
          className="editor-ctx-menu editor-ctx-submenu"
          style={{ left: subPos.left, top: subPos.top }}
          onMouseEnter={cancelCloseSub}
          onMouseLeave={scheduleCloseSub}
          onContextMenu={(e) => e.preventDefault()}
        >
          {openSub === 'advanced' && (
            <>
              {renderItem(cm.indentTab, 'indentTab', { shortcut: 'Tab' })}
              {renderItem(cm.unindentTab, 'unindentTab', { shortcut: 'Shift+Tab' })}
              <div className="editor-ctx-sep" />
              {renderItem(cm.indentSpace, 'indentSpace')}
              {renderItem(cm.unindentSpace, 'unindentSpace')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.insertComment, 'insertComment')}
              {renderItem(cm.removeComment, 'removeComment')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.spacesToTabs, 'spacesToTabs')}
              {renderItem(cm.tabsToSpaces, 'tabsToSpaces')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.toLowerCase, 'toLowerCase', {
                shortcut: formatShortcut('⌘+U'),
              })}
              {renderItem(cm.toUpperCase, 'toUpperCase', {
                shortcut: formatShortcut('⌘+⇧+U'),
              })}
              <div className="editor-ctx-sep" />
              {renderItem(cm.reverseLines, 'reverseLines')}
              {renderItem(cm.sortLinesAsc, 'sortLinesAsc')}
              {renderItem(cm.sortLinesDesc, 'sortLinesDesc')}
              {renderItem(cm.dedupeLines, 'dedupeLines')}
              {renderItem(cm.removeEmptyLines, 'removeEmptyLines')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.trimLeading, 'trimLeading', {
                shortcut: formatShortcut('⌘+⇧+Space'),
              })}
              {renderItem(cm.trimTrailing, 'trimTrailing')}
              {renderItem(cm.insertQuote, 'insertQuote', {
                shortcut: formatShortcut('⌘+⇧+R'),
              })}
              {renderItem(cm.removeQuote, 'removeQuote')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.insertWrapLineBreaks, 'insertWrapLineBreaks')}
              {renderItem(cm.removeLineBreaks, 'removeLineBreaks')}
            </>
          )}

          {openSub === 'width' && (
            <>
              {renderItem(cm.toFull, 'to-full')}
              {renderItem(cm.toFullKana, 'to-full-kana')}
              {renderItem(cm.toFullAlnum, 'to-full-alnum')}
              <div className="editor-ctx-sep" />
              {renderItem(cm.toHalf, 'to-half')}
              {renderItem(cm.toHalfKana, 'to-half-kana')}
              {renderItem(cm.toHalfAlnum, 'to-half-alnum')}
            </>
          )}

          {openSub === 'bookmarks' && (
            <>
              {renderItem(cm.toggleBookmark, 'toggleBookmark', {
                shortcut: formatShortcut('⌘+F2'),
              })}
              {renderItem(cm.nextBookmark, 'nextBookmark', {
                shortcut: 'F2',
                disabled: !menu.hasBookmarks,
              })}
              {renderItem(cm.prevBookmark, 'prevBookmark', {
                shortcut: 'Shift+F2',
                disabled: !menu.hasBookmarks,
              })}
              <div className="editor-ctx-sep" />
              {renderItem(cm.clearBookmarks, 'clearBookmarks', {
                disabled: !menu.hasBookmarks,
              })}
            </>
          )}

          {openSub === 'data' && (
            <>
              {renderItem(t.actions.formatMarkdownTables, 'formatMarkdownTables')}
              <div className="editor-ctx-sep" />
              {renderItem(t.actions.formatJson, 'formatJson')}
              {renderItem(t.actions.minifyJson, 'minifyJson')}
              {renderItem(t.actions.sortJsonKeys, 'sortJsonKeys')}
              <div className="editor-ctx-sep" />
              {renderItem(t.actions.jsonToYaml, 'jsonToYaml')}
              {renderItem(t.actions.yamlToJson, 'yamlToJson')}
              <div className="editor-ctx-sep" />
              {renderItem(t.actions.formatEnv, 'formatEnv')}
            </>
          )}
        </div>
      )}
    </>
  );
};
