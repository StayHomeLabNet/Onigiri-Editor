import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Minimize2,
  Maximize2,
  ArrowDownAZ,
  Sparkles,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import type { Locale } from '../../types';
import { writeClipboardText } from '../../utils/platform';
import {
  formatJsonPathString,
  parseJsonOrJsonc,
  setValueAtJsonPath,
} from '../../utils/previewParsers';
import { formatJsonText, minifyJsonText, sortJsonKeysText } from '../../utils/structuredData';

interface JsonPreviewPaneProps {
  locale: Locale;
  fileName: string;
  content: string;
  onUpdateContent?: (nextContent: string) => void;
  onJumpToLine?: (line: number) => void;
  onCopyNotify: () => void;
}

function parseEditedPrimitive(rawInput: string, original: unknown): unknown {
  const trimmed = rawInput.trim();
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (typeof original === 'number' || /^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (trimmed !== '' && Number.isFinite(n)) return n;
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through as string
    }
  }
  return rawInput;
}

export const JsonPreviewPane: React.FC<JsonPreviewPaneProps> = ({
  locale,
  fileName,
  content,
  onUpdateContent,
  onJumpToLine,
  onCopyNotify,
}) => {
  const isJa = locale === 'ja';
  const isJsoncFile = /\.jsonc$/i.test(fileName);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const [filterQuery, setFilterQuery] = useState('');
  const [editingPathKey, setEditingPathKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const parsed = useMemo(() => parseJsonOrJsonc(content, true), [content]);

  const togglePath = (pathKey: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  };

  const handleCollapseAll = () => {
    if (!parsed.ok) return;
    const keys = new Set<string>();
    const walk = (val: unknown, path: Array<string | number>) => {
      if (val && typeof val === 'object') {
        if (path.length > 0) keys.add(formatJsonPathString(path));
        if (Array.isArray(val)) {
          val.forEach((v, idx) => walk(v, [...path, idx]));
        } else {
          Object.entries(val as Record<string, unknown>).forEach(([k, v]) => walk(v, [...path, k]));
        }
      }
    };
    walk(parsed.value, []);
    setCollapsedPaths(keys);
  };

  const handleExpandAll = () => {
    setCollapsedPaths(new Set());
  };

  const applyTransform = (fn: (src: string) => string) => {
    if (!onUpdateContent || !parsed.ok) return;
    try {
      const cleanJson = JSON.stringify(parsed.value, null, 2);
      onUpdateContent(fn(cleanJson));
    } catch {
      // ignore invalid
    }
  };

  const handleCopyPath = async (path: Array<string | number>) => {
    await writeClipboardText(formatJsonPathString(path));
    onCopyNotify();
  };

  const commitPrimitiveEdit = (path: Array<string | number>, original: unknown) => {
    if (!onUpdateContent || !parsed.ok) {
      setEditingPathKey(null);
      return;
    }
    const nextVal = parseEditedPrimitive(editingText, original);
    const updatedRoot = setValueAtJsonPath(parsed.value, path, nextVal);
    onUpdateContent(`${JSON.stringify(updatedRoot, null, 2)}\n`);
    setEditingPathKey(null);
  };

  const renderNode = (
    keyLabel: string | number | null,
    val: unknown,
    path: Array<string | number>,
    depth: number
  ): React.ReactNode => {
    const pathStr = formatJsonPathString(path);
    const isObj = val !== null && typeof val === 'object';
    const isArr = Array.isArray(val);
    const query = filterQuery.trim().toLowerCase();

    if (query && !isObj) {
      const keyMatch = keyLabel !== null && String(keyLabel).toLowerCase().includes(query);
      const valMatch = String(val).toLowerCase().includes(query);
      if (!keyMatch && !valMatch) return null;
    }

    if (!isObj) {
      const isEditing = editingPathKey === pathStr;
      const typeClass =
        val === null
          ? 'is-null'
          : typeof val === 'number'
            ? 'is-number'
            : typeof val === 'boolean'
              ? 'is-boolean'
              : 'is-string';

      return (
        <div
          key={pathStr}
          className="ext-tree-row ext-tree-leaf"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {keyLabel !== null && (
            <span className="ext-tree-key">
              {typeof keyLabel === 'number' ? `[${keyLabel}]` : keyLabel}
              <span className="ext-tree-colon">:</span>
            </span>
          )}
          {isEditing ? (
            <input
              type="text"
              className="ext-inline-input"
              value={editingText}
              autoFocus
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={() => commitPrimitiveEdit(path, val)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitPrimitiveEdit(path, val);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingPathKey(null);
                }
              }}
            />
          ) : (
            <span
              className={`ext-tree-val ${typeClass}`}
              title={isJa ? 'ダブルクリックで編集' : 'Double-click to edit'}
              onDoubleClick={() => {
                if (!onUpdateContent) return;
                setEditingPathKey(pathStr);
                setEditingText(val === null ? 'null' : String(val));
              }}
            >
              {typeof val === 'string' ? `"${val}"` : String(val)}
            </span>
          )}
          <button
            type="button"
            className="ext-path-copy-btn"
            title={`${isJa ? 'パスをコピー' : 'Copy path'}: ${pathStr}`}
            onClick={() => void handleCopyPath(path)}
          >
            <ClipboardCopy size={11} />
          </button>
        </div>
      );
    }

    const entries = isArr
      ? (val as unknown[]).map((v, idx) => [idx, v] as const)
      : Object.entries(val as Record<string, unknown>);
    const collapsed = collapsedPaths.has(pathStr);
    const children = collapsed
      ? null
      : entries.map(([k, child]) => renderNode(k, child, [...path, k], depth + 1)).filter(Boolean);

    if (query && !collapsed && children && children.length === 0) {
      const keyMatch = keyLabel !== null && String(keyLabel).toLowerCase().includes(query);
      if (!keyMatch) return null;
    }

    return (
      <div key={pathStr} className="ext-tree-branch">
        <div className="ext-tree-row" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
          <button
            type="button"
            className="ext-tree-toggle"
            onClick={() => togglePath(pathStr)}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          {keyLabel !== null && (
            <span className="ext-tree-key">
              {typeof keyLabel === 'number' ? `[${keyLabel}]` : keyLabel}
              <span className="ext-tree-colon">:</span>
            </span>
          )}
          <span className="ext-tree-badge">
            {isArr ? `Array(${entries.length})` : `Object(${entries.length})`}
          </span>
          <button
            type="button"
            className="ext-path-copy-btn"
            title={`${isJa ? 'パスをコピー' : 'Copy path'}: ${pathStr}`}
            onClick={() => void handleCopyPath(path)}
          >
            <ClipboardCopy size={11} />
          </button>
        </div>
        {!collapsed && <div className="ext-tree-children">{children}</div>}
      </div>
    );
  };

  const errorSnippetLines = useMemo(() => {
    if (parsed.ok || !parsed.error?.line) return [];
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const errLine = parsed.error.line;
    const start = Math.max(1, errLine - 2);
    const end = Math.min(lines.length, errLine + 2);
    const out: Array<{ line: number; text: string; isError: boolean }> = [];
    for (let l = start; l <= end; l++) {
      out.push({ line: l, text: lines[l - 1] ?? '', isError: l === errLine });
    }
    return out;
  }, [content, parsed]);

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">
            {isJsoncFile || parsed.isJsonc ? 'JSONC' : 'JSON'}
          </span>
          <input
            type="text"
            className="ext-preview-search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={isJa ? 'キー / 値を検索...' : 'Filter keys or values...'}
          />
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className="ext-tool-btn"
            onClick={handleExpandAll}
            title={isJa ? 'すべて展開' : 'Expand all'}
          >
            <ChevronsUpDown size={13} />
            <span>{isJa ? '全展開' : 'Expand'}</span>
          </button>
          <button
            type="button"
            className="ext-tool-btn"
            onClick={handleCollapseAll}
            title={isJa ? 'すべて折りたたむ' : 'Collapse all'}
          >
            <ChevronsDownUp size={13} />
            <span>{isJa ? '全折畳' : 'Collapse'}</span>
          </button>
          {onUpdateContent && (
            <>
              <button
                type="button"
                className="ext-tool-btn"
                disabled={!parsed.ok}
                onClick={() => applyTransform(formatJsonText)}
                title={isJa ? '整形 (Pretty)' : 'Format (Pretty)'}
              >
                <Maximize2 size={13} />
                <span>Pretty</span>
              </button>
              <button
                type="button"
                className="ext-tool-btn"
                disabled={!parsed.ok}
                onClick={() => applyTransform(minifyJsonText)}
                title={isJa ? '圧縮 (Minify)' : 'Minify'}
              >
                <Minimize2 size={13} />
                <span>Minify</span>
              </button>
              <button
                type="button"
                className="ext-tool-btn"
                disabled={!parsed.ok}
                onClick={() => applyTransform(sortJsonKeysText)}
                title={isJa ? 'キーを昇順ソート' : 'Sort keys'}
              >
                <ArrowDownAZ size={13} />
                <span>{isJa ? 'キー順' : 'Sort'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="ext-preview-body">
        {!parsed.ok ? (
          <div className="ext-error-box">
            <div className="ext-error-header">
              <AlertTriangle size={16} />
              <span>
                {isJa ? 'JSON 構文エラー' : 'JSON Syntax Error'}
                {parsed.error?.line ? ` (Line ${parsed.error.line}${parsed.error.column ? `:${parsed.error.column}` : ''})` : ''}
              </span>
              {parsed.error?.line && onJumpToLine && (
                <button
                  type="button"
                  className="ext-tool-btn"
                  onClick={() => onJumpToLine(parsed.error!.line!)}
                >
                  {isJa ? '該当行へ移動' : 'Jump to line'}
                </button>
              )}
            </div>
            <div className="ext-error-message">{parsed.error?.message}</div>
            {errorSnippetLines.length > 0 && (
              <div className="ext-error-snippet">
                {errorSnippetLines.map((item) => (
                  <div
                    key={item.line}
                    className={`ext-error-snippet-line ${item.isError ? 'is-error' : ''}`}
                  >
                    <span className="ext-snippet-ln">{item.line}</span>
                    <code>{item.text}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="ext-tree-container">
            <div className="ext-hint-bar">
              <Sparkles size={12} />
              <span>
                {isJa
                  ? '値をダブルクリックして直接編集 / 右側のアイコンで JSONPath をコピーできます'
                  : 'Double-click any primitive value to edit inline, or click the copy icon for its JSONPath.'}
              </span>
            </div>
            {renderNode(null, parsed.value, [], 0)}
          </div>
        )}
      </div>
    </div>
  );
};
