import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, X, FileText, Pin } from 'lucide-react';
import type { DocumentTab } from '../types';
import type { Translations } from '../i18n/types';

interface TabBarProps {
  t: Translations;
  tabs: DocumentTab[];
  activeTabId: string;
  sideTabId?: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onReorderTabs?: (draggedId: string, targetId: string) => void;
  onTogglePinTab?: (id: string) => void;
  onOpenTabToSide?: (id: string) => void;
  onCompareTabWithActive?: (id: string) => void;
  onCloseOtherTabs?: (id: string) => void;
  onCloseTabsToRight?: (id: string) => void;
  onCopyTabPath?: (path: string) => void;
  onRevealTabPath?: (path: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  t,
  tabs,
  activeTabId,
  sideTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
  onTogglePinTab,
  onOpenTabToSide,
  onCompareTabWithActive,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCopyTabPath,
  onRevealTabPath,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!ctxMenu || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let left = ctxMenu.x;
    let top = ctxMenu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    setMenuPos({ left, top });
  }, [ctxMenu]);

  useEffect(() => {
    if (!ctxMenu) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCtxMenu(null);
      }
    };
    const onBlur = () => setCtxMenu(null);
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [ctxMenu]);

  const ctxTabIndex = ctxMenu ? tabs.findIndex((tb) => tb.id === ctxMenu.tabId) : -1;
  const ctxTab = ctxTabIndex >= 0 ? tabs[ctxTabIndex] : null;
  const hasOtherCloseable = ctxTab
    ? tabs.some((tb) => tb.id !== ctxTab.id && !tb.pinned)
    : false;
  const hasRightCloseable =
    ctxTab && ctxTabIndex >= 0
      ? tabs.slice(ctxTabIndex + 1).some((tb) => !tb.pinned)
      : false;

  return (
    <div className="tabbar">
      <div className="tabbar-scroll">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const isSide = tab.id === sideTabId;
          const isDragging = draggedId === tab.id;
          const isDragOver = dragOverId === tab.id && draggedId !== tab.id;
          return (
            <div
              key={tab.id}
              draggable
              className={`tab-item ${active ? 'is-active' : ''} ${tab.pinned ? 'is-pinned' : ''} ${isSide ? 'is-side' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
              onClick={() => onSelectTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1 && tabs.length > 1 && !tab.pinned) {
                  e.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
              }}
              onDragStart={(e) => {
                setDraggedId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
                try {
                  e.dataTransfer.setData('text/plain', tab.id);
                } catch {
                  // ignore
                }
              }}
              onDragOver={(e) => {
                if (!draggedId || draggedId === tab.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverId !== tab.id) {
                  setDragOverId(tab.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === tab.id) {
                  setDragOverId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const srcId = draggedId || e.dataTransfer.getData('text/plain');
                if (srcId && srcId !== tab.id) {
                  onReorderTabs?.(srcId, tab.id);
                }
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              title={tab.filePath || tab.title}
            >
              <FileText size={13} className="tab-icon" />
              <span className="tab-title">{tab.title}</span>
              {tab.externalStatus ? (
                <span
                  className="tab-conflict-dot"
                  title={tab.externalStatus === 'deleted' ? 'Deleted on disk' : 'Modified on disk'}
                />
              ) : (
                tab.dirty && <span className="tab-dirty-dot" />
              )}
              {tab.pinned ? (
                <button
                  type="button"
                  className="tab-pin-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePinTab?.(tab.id);
                  }}
                  title={t.tabMenu.unpin}
                  aria-label={t.tabMenu.unpin}
                >
                  <Pin size={11} />
                </button>
              ) : (
                tabs.length > 1 && (
                  <button
                    type="button"
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    aria-label={t.tabMenu.close}
                  >
                    <X size={12} />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="tab-add-btn" onClick={onNewTab} title={t.actions.newFile}>
        <Plus size={14} />
      </button>

      {ctxMenu && ctxTab && (
        <div
          ref={menuRef}
          className="editor-ctx-menu tab-ctx-menu"
          style={{ left: menuPos.left, top: menuPos.top }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="editor-ctx-item"
            onClick={() => {
              onTogglePinTab?.(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">
              {ctxTab.pinned ? t.tabMenu.unpin : t.tabMenu.pin}
            </span>
          </button>

          <button
            type="button"
            className="editor-ctx-item"
            onClick={() => {
              onOpenTabToSide?.(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.openSide}</span>
          </button>

          <button
            type="button"
            className={`editor-ctx-item ${ctxTab.id === activeTabId ? 'is-disabled' : ''}`}
            disabled={ctxTab.id === activeTabId}
            onClick={() => {
              onCompareTabWithActive?.(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.compareWithActive}</span>
          </button>

          <div className="editor-ctx-sep" />

          <button
            type="button"
            className={`editor-ctx-item ${tabs.length <= 1 || ctxTab.pinned ? 'is-disabled' : ''}`}
            disabled={tabs.length <= 1 || Boolean(ctxTab.pinned)}
            onClick={() => {
              onCloseTab(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.close}</span>
          </button>

          <button
            type="button"
            className={`editor-ctx-item ${!hasOtherCloseable ? 'is-disabled' : ''}`}
            disabled={!hasOtherCloseable}
            onClick={() => {
              onCloseOtherTabs?.(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.closeOthers}</span>
          </button>

          <button
            type="button"
            className={`editor-ctx-item ${!hasRightCloseable ? 'is-disabled' : ''}`}
            disabled={!hasRightCloseable}
            onClick={() => {
              onCloseTabsToRight?.(ctxTab.id);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.closeRight}</span>
          </button>

          <div className="editor-ctx-sep" />

          <button
            type="button"
            className={`editor-ctx-item ${!ctxTab.filePath ? 'is-disabled' : ''}`}
            disabled={!ctxTab.filePath}
            onClick={() => {
              if (ctxTab.filePath) onCopyTabPath?.(ctxTab.filePath);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.copyPath}</span>
          </button>

          <button
            type="button"
            className={`editor-ctx-item ${!ctxTab.filePath ? 'is-disabled' : ''}`}
            disabled={!ctxTab.filePath}
            onClick={() => {
              if (ctxTab.filePath) onRevealTabPath?.(ctxTab.filePath);
              setCtxMenu(null);
            }}
          >
            <span className="editor-ctx-label">{t.tabMenu.reveal}</span>
          </button>
        </div>
      )}
    </div>
  );
};
