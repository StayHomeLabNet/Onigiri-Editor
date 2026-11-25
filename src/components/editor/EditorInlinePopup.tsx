import React from 'react';
import type { Locale } from '../../types';
import type { CustomSnippetRecord } from '../../utils/snippets';

export interface SlashPopupItem {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  insertText?: string;
  action?: 'toc';
  isCustom?: boolean;
}

export function buildSlashItems(locale: Locale, customSnippets: CustomSnippetRecord[]): SlashPopupItem[] {
  const isJa = locale === 'ja';
  const builtins: SlashPopupItem[] = [
    {
      id: 'h1',
      label: isJa ? '見出し 1 (H1)' : 'Heading 1',
      hint: '# Heading',
      keywords: 'h1 heading 1 見出し',
      insertText: '# ',
    },
    {
      id: 'h2',
      label: isJa ? '見出し 2 (H2)' : 'Heading 2',
      hint: '## Heading',
      keywords: 'h2 heading 2 見出し',
      insertText: '## ',
    },
    {
      id: 'h3',
      label: isJa ? '見出し 3 (H3)' : 'Heading 3',
      hint: '### Heading',
      keywords: 'h3 heading 3 見出し',
      insertText: '### ',
    },
    {
      id: 'todo',
      label: isJa ? 'タスクリスト / チェックボックス' : 'Task Checklist',
      hint: '- [ ] Task',
      keywords: 'todo task checklist チェック タスク',
      insertText: '- [ ] ',
    },
    {
      id: 'table',
      label: isJa ? 'Markdown テーブル (3列)' : 'Markdown Table (3 cols)',
      hint: '| Col1 | Col2 | Col3 |',
      keywords: 'table grid 表 テーブル',
      insertText: '| Column 1 | Column 2 | Column 3 |\n| :--- | :--- | :--- |\n|  |  |  |\n',
    },
    {
      id: 'code',
      label: isJa ? 'コードブロック' : 'Code Block',
      hint: '```lang ... ```',
      keywords: 'code block fence コード',
      insertText: '```ts\n\n```\n',
    },
    {
      id: 'mermaid',
      label: isJa ? 'Mermaid フローチャート図' : 'Mermaid Flowchart',
      hint: '```mermaid',
      keywords: 'mermaid diagram chart 図 フロー',
      insertText: '```mermaid\nflowchart TD\n  Start["Start"] --> End["Done"]\n```\n',
    },
    {
      id: 'math',
      label: isJa ? 'KaTeX 数式ブロック' : 'KaTeX Math Block',
      hint: '$$ ... $$',
      keywords: 'math katex latex 数式',
      insertText: '$$\n\\sum_{i=1}^{n} x_i\n$$\n',
    },
    {
      id: 'callout',
      label: isJa ? 'コールアウト [!NOTE]' : 'Callout Block [!NOTE]',
      hint: '> [!NOTE]',
      keywords: 'callout note tip warning コールアウト 注記',
      insertText: '> [!NOTE]\n> ',
    },
    {
      id: 'toc',
      label: isJa ? '目次 (TOC) を自動挿入 / 更新' : 'Insert / Update Table of Contents (TOC)',
      hint: '<!-- TOC -->',
      keywords: 'toc table of contents 目次',
      action: 'toc',
    },
  ];
  const customs: SlashPopupItem[] = customSnippets.map((cs) => ({
    id: `custom:${cs.id}`,
    label: cs.title,
    hint: cs.description || 'Custom',
    keywords: `${cs.title} ${cs.description} custom スニペット`,
    insertText: cs.content,
    isCustom: true,
  }));
  return [...customs, ...builtins];
}

export type InlinePopupState =
  | {
      kind: 'slash';
      from: number;
      to: number;
      query: string;
      left: number;
      top: number;
    }
  | {
      kind: 'wiki';
      from: number;
      to: number;
      query: string;
      left: number;
      top: number;
    };

export interface InlinePopupNoteItem {
  name: string;
  relPath: string;
  path: string;
}

export type InlinePopupItem =
  | { kind: 'slash'; item: SlashPopupItem }
  | { kind: 'wiki'; item: InlinePopupNoteItem };

export function filterInlinePopupItems(
  popup: InlinePopupState | null,
  slashCandidates: SlashPopupItem[],
  workspaceNotes: InlinePopupNoteItem[]
): InlinePopupItem[] {
  if (!popup) return [];
  const q = popup.query.trim().toLowerCase();
  if (popup.kind === 'slash') {
    return slashCandidates
      .filter((item) => {
        if (!q) return true;
        return (
          item.label.toLowerCase().includes(q) ||
          item.keywords.toLowerCase().includes(q) ||
          item.hint.toLowerCase().includes(q)
        );
      })
      .map((item) => ({ kind: 'slash' as const, item }));
  }
  return workspaceNotes
    .filter((note) => {
      if (!q) return true;
      return (
        note.name.toLowerCase().includes(q) ||
        note.relPath.toLowerCase().includes(q)
      );
    })
    .slice(0, 20)
    .map((item) => ({ kind: 'wiki' as const, item }));
}

interface EditorInlinePopupProps {
  popup: InlinePopupState | null;
  items: InlinePopupItem[];
  activeIndex: number;
  locale: Locale;
  popupRef: React.RefObject<HTMLDivElement | null>;
  onHoverIndex: (idx: number) => void;
  onSelectItem: (entry: InlinePopupItem) => void;
}

export const EditorInlinePopup: React.FC<EditorInlinePopupProps> = ({
  popup,
  items,
  activeIndex,
  locale,
  popupRef,
  onHoverIndex,
  onSelectItem,
}) => {
  if (!popup || items.length === 0) return null;

  return (
    <div
      ref={popupRef}
      className="editor-inline-popup"
      style={{ left: popup.left, top: popup.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="editor-inline-popup-header">
        {popup.kind === 'slash'
          ? locale === 'ja'
            ? 'スラッシュコマンド'
            : 'Slash Commands'
          : locale === 'ja'
            ? 'Wiki リンク (ノート)'
            : 'Wiki Link Note'}
      </div>
      <div className="editor-inline-popup-list">
        {items.map((entry, idx) => {
          const isActive = idx === activeIndex;
          const key =
            entry.kind === 'slash' ? `slash:${entry.item.id}` : `wiki:${entry.item.path}`;
          return (
            <button
              key={key}
              type="button"
              className={`editor-inline-popup-item ${isActive ? 'is-active' : ''}`}
              onMouseEnter={() => onHoverIndex(idx)}
              onClick={() => onSelectItem(entry)}
            >
              <span className="editor-inline-popup-title">
                {entry.kind === 'slash' ? (
                  <>
                    {entry.item.isCustom && (
                      <span className="editor-inline-popup-badge">★</span>
                    )}
                    {entry.item.label}
                  </>
                ) : (
                  entry.item.name
                )}
              </span>
              <span className="editor-inline-popup-hint">
                {entry.kind === 'slash' ? entry.item.hint : entry.item.relPath}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
