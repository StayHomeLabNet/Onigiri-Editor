import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FileCode2, FileText, FolderOpen, Hash, Search } from 'lucide-react';
import type { DocumentTab, HeadingItem, WorkspaceEntry } from '../types';
import type { Translations } from '../i18n/types';

interface QuickOpenModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  tabs: DocumentTab[];
  activeTabId: string;
  workspaceEntries: WorkspaceEntry[];
  recentFiles: string[];
  headings: HeadingItem[];
  onSelectTab: (tabId: string) => void;
  onOpenFilePath: (filePath: string) => void;
  onJumpToLine: (line: number) => void;
}

interface QuickOpenItem {
  id: string;
  kind: 'heading' | 'tab' | 'workspace' | 'recent';
  title: string;
  subtitle?: string;
  badge: string;
  score: number;
  line?: number;
  level?: number;
  tabId?: string;
  filePath?: string;
}

function fuzzyMatchScore(text: string, query: string): number {
  if (!query) return 1;
  const tLower = text.toLowerCase();
  const qLower = query.toLowerCase();
  if (tLower === qLower) return 200;
  if (tLower.startsWith(qLower)) return 140;
  const idx = tLower.indexOf(qLower);
  if (idx >= 0) return 100 - Math.min(idx, 50);

  // Subsequence fuzzy match
  let qi = 0;
  let gap = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < tLower.length && qi < qLower.length; ti++) {
    if (tLower[ti] === qLower[qi]) {
      if (lastMatch >= 0) {
        gap += ti - lastMatch - 1;
      }
      lastMatch = ti;
      qi += 1;
    }
  }
  if (qi === qLower.length) {
    return Math.max(10, 60 - gap);
  }
  return -1;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  t,
  open,
  onClose,
  tabs,
  activeTabId,
  workspaceEntries,
  recentFiles,
  headings,
  onSelectTab,
  onOpenFilePath,
  onJumpToLine,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo((): QuickOpenItem[] => {
    const trimmed = query.trim();
    if (trimmed.startsWith('@')) {
      const hQuery = trimmed.slice(1).trim();
      const matched: QuickOpenItem[] = [];
      for (const h of headings) {
        const s = fuzzyMatchScore(h.text, hQuery);
        if (s > 0) {
          matched.push({
            id: `h-${h.id}`,
            kind: 'heading',
            title: h.text,
            subtitle: `L${h.line}`,
            badge: `H${h.level}`,
            score: s,
            line: h.line,
            level: h.level,
          });
        }
      }
      if (hQuery) {
        matched.sort((a, b) => b.score - a.score || (a.line || 0) - (b.line || 0));
      }
      return matched;
    }

    const results: QuickOpenItem[] = [];
    const seenPaths = new Set<string>();

    // 1. Open tabs (active tab slightly prioritized or placed after other tabs)
    for (const tab of tabs) {
      const targetPath = tab.filePath?.toLowerCase();
      if (targetPath) seenPaths.add(targetPath);
      const hay = tab.filePath ? `${tab.title} ${tab.filePath}` : tab.title;
      const s = fuzzyMatchScore(hay, trimmed);
      if (s > 0) {
        results.push({
          id: `tab-${tab.id}`,
          kind: 'tab',
          title: `${tab.dirty ? '● ' : ''}${tab.title}`,
          subtitle: tab.filePath,
          badge: t.quickOpen.badgeOpenTab,
          score: s + (tab.id === activeTabId ? 5 : 25),
          tabId: tab.id,
        });
      }
    }

    // 2. Workspace files
    for (const entry of workspaceEntries) {
      if (entry.isDir) continue;
      if (seenPaths.has(entry.path.toLowerCase())) continue;
      seenPaths.add(entry.path.toLowerCase());
      const s = fuzzyMatchScore(`${entry.name} ${entry.relativePath}`, trimmed);
      if (s > 0) {
        results.push({
          id: `ws-${entry.path}`,
          kind: 'workspace',
          title: entry.name,
          subtitle: entry.relativePath,
          badge: t.quickOpen.badgeWorkspace,
          score: s + 10,
          filePath: entry.path,
        });
      }
    }

    // 3. Recent files
    for (const fp of recentFiles) {
      if (seenPaths.has(fp.toLowerCase())) continue;
      seenPaths.add(fp.toLowerCase());
      const name = fp.split(/[/\\]/).pop() || fp;
      const s = fuzzyMatchScore(`${name} ${fp}`, trimmed);
      if (s > 0) {
        results.push({
          id: `rec-${fp}`,
          kind: 'recent',
          title: name,
          subtitle: fp,
          badge: t.quickOpen.badgeRecent,
          score: s,
          filePath: fp,
        });
      }
    }

    if (trimmed) {
      results.sort((a, b) => b.score - a.score);
    }
    return results.slice(0, 80);
  }, [query, headings, tabs, activeTabId, workspaceEntries, recentFiles, t.quickOpen]);

  useEffect(() => {
    setSelectedIdx((idx) => Math.min(idx, Math.max(0, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    const activeEl = listRef.current?.querySelector('.palette-item.is-selected') as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  const activateItem = (item?: QuickOpenItem) => {
    if (!item) return;
    onClose();
    if (item.kind === 'heading' && item.line) {
      onJumpToLine(item.line);
    } else if (item.kind === 'tab' && item.tabId) {
      onSelectTab(item.tabId);
    } else if (item.filePath) {
      onOpenFilePath(item.filePath);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="palette-modal quick-open-modal" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-row">
          <Search size={16} className="palette-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                activateItem(items[selectedIdx]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder={t.quickOpen.placeholder}
          />
          <button
            type="button"
            className={`mini-pill-btn ${query.startsWith('@') ? 'is-active' : ''}`}
            onClick={() => {
              setQuery((q) => (q.startsWith('@') ? q.slice(1) : `@${q}`));
              setSelectedIdx(0);
              inputRef.current?.focus();
            }}
            title="@"
          >
            @
          </button>
        </div>

        <div ref={listRef} className="palette-list">
          {items.length === 0 ? (
            <div className="palette-empty">{t.quickOpen.noResults}</div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`palette-item quick-open-item ${idx === selectedIdx ? 'is-selected' : ''}`}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => activateItem(item)}
              >
                <span className="quick-open-icon">
                  {item.kind === 'heading' ? (
                    <Hash size={14} />
                  ) : item.kind === 'recent' ? (
                    <Clock size={14} />
                  ) : item.kind === 'workspace' ? (
                    <FolderOpen size={14} />
                  ) : /\.(ts|tsx|js|jsx|py|rs|php|cs|go|json|yaml|yml)$/i.test(item.title) ? (
                    <FileCode2 size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                </span>
                <span className="quick-open-main">
                  <span
                    className="palette-label"
                    style={
                      item.kind === 'heading' && item.level
                        ? { paddingLeft: `${Math.max(0, item.level - 1) * 10}px` }
                        : undefined
                    }
                  >
                    {item.title}
                  </span>
                  {item.subtitle && <span className="quick-open-sub">{item.subtitle}</span>}
                </span>
                <span className={`palette-cat quick-open-badge is-${item.kind}`}>{item.badge}</span>
              </button>
            ))
          )}
        </div>
        <div className="quick-open-footer">{t.quickOpen.hint}</div>
      </div>
    </div>
  );
};
