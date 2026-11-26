import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  FileJson,
  ListTree,
  Table2,
} from 'lucide-react';
import type { Locale } from '../../types';
import { writeClipboardText } from '../../utils/platform';
import {
  formatJsonPathString,
  parseTomlDocument,
  parseYamlDocument,
} from '../../utils/previewParsers';
import { jsonToYamlText } from '../../utils/structuredData';

interface YamlTomlPreviewPaneProps {
  locale: Locale;
  fileName: string;
  mode: 'yaml' | 'toml';
  content: string;
  onUpdateContent?: (nextContent: string) => void;
  onJumpToLine?: (line: number) => void;
  onCopyNotify: () => void;
}

function flattenToRows(
  value: unknown,
  prefix = ''
): Array<{ path: string; type: string; value: string }> {
  if (value === null || typeof value !== 'object') {
    return [{ path: prefix || '(root)', type: value === null ? 'null' : typeof value, value: String(value) }];
  }
  const rows: Array<{ path: string; type: string; value: string }> = [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ path: prefix || '[]', type: 'array(0)', value: '[]' }];
    value.forEach((item, idx) => {
      const nextKey = `${prefix}[${idx}]`;
      rows.push(...flattenToRows(item, nextKey));
    });
    return rows;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return [{ path: prefix || '{}', type: 'object(0)', value: '{}' }];
  for (const [k, v] of entries) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    rows.push(...flattenToRows(v, nextKey));
  }
  return rows;
}

export const YamlTomlPreviewPane: React.FC<YamlTomlPreviewPaneProps> = ({
  locale,
  mode,
  content,
  onUpdateContent,
  onJumpToLine,
  onCopyNotify,
}) => {
  const isJa = locale === 'ja';
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');

  const parsed = useMemo(
    () => (mode === 'yaml' ? parseYamlDocument(content) : parseTomlDocument(content)),
    [content, mode]
  );

  const flatRows = useMemo(() => {
    if (!parsed.ok) return [];
    const rows = flattenToRows(parsed.value);
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.path.toLowerCase().includes(q) || r.value.toLowerCase().includes(q)
    );
  }, [parsed, filter]);

  const toggleNode = (p: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const handleCopyJson = async () => {
    if (!parsed.ok) return;
    await writeClipboardText(`${JSON.stringify(parsed.value ?? null, null, 2)}\n`);
    onCopyNotify();
  };

  const handleConvertFromJson = () => {
    if (!onUpdateContent || mode !== 'yaml') return;
    try {
      const next = jsonToYamlText(content);
      onUpdateContent(next);
    } catch {
      // ignore if content is not JSON
    }
  };

  const renderTree = (
    keyLabel: string | number | null,
    val: unknown,
    path: Array<string | number>,
    depth: number
  ): React.ReactNode => {
    const pathStr = formatJsonPathString(path);
    const isObj = val !== null && typeof val === 'object';
    const isArr = Array.isArray(val);
    const q = filter.trim().toLowerCase();

    if (!isObj) {
      if (q) {
        const km = keyLabel !== null && String(keyLabel).toLowerCase().includes(q);
        const vm = String(val).toLowerCase().includes(q);
        if (!km && !vm) return null;
      }
      return (
        <div key={pathStr} className="ext-tree-row ext-tree-leaf" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          {keyLabel !== null && (
            <span className="ext-tree-key">
              {typeof keyLabel === 'number' ? `[${keyLabel}]` : keyLabel}
              <span className="ext-tree-colon">:</span>
            </span>
          )}
          <span
            className={`ext-tree-val ${
              val === null
                ? 'is-null'
                : typeof val === 'number'
                  ? 'is-number'
                  : typeof val === 'boolean'
                    ? 'is-boolean'
                    : 'is-string'
            }`}
          >
            {typeof val === 'string' ? `"${val}"` : String(val)}
          </span>
        </div>
      );
    }

    const entries = isArr
      ? (val as unknown[]).map((v, idx) => [idx, v] as const)
      : Object.entries(val as Record<string, unknown>);
    const isCollapsed = collapsed.has(pathStr);
    const children = isCollapsed
      ? null
      : entries.map(([k, c]) => renderTree(k, c, [...path, k], depth + 1)).filter(Boolean);

    if (q && !isCollapsed && children && children.length === 0) {
      const km = keyLabel !== null && String(keyLabel).toLowerCase().includes(q);
      if (!km) return null;
    }

    return (
      <div key={pathStr} className="ext-tree-branch">
        <div className="ext-tree-row" style={{ paddingLeft: `${depth * 16 + 4}px` }}>
          <button type="button" className="ext-tree-toggle" onClick={() => toggleNode(pathStr)}>
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
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
        </div>
        {!isCollapsed && <div className="ext-tree-children">{children}</div>}
      </div>
    );
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">{mode.toUpperCase()}</span>
          {parsed.ok ? (
            <span className="ext-status-pill is-ok">
              <CheckCircle2 size={12} />
              <span>{isJa ? '構文 OK' : 'Valid'}</span>
            </span>
          ) : (
            <span className="ext-status-pill is-err">
              <AlertTriangle size={12} />
              <span>{isJa ? '構文エラー' : 'Syntax Error'}</span>
            </span>
          )}
          <input
            type="text"
            className="ext-preview-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isJa ? 'キー / 値を検索...' : 'Filter keys or values...'}
          />
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className={`ext-tool-btn ${viewMode === 'tree' ? 'is-active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            <ListTree size={13} />
            <span>{isJa ? 'ツリー' : 'Tree'}</span>
          </button>
          <button
            type="button"
            className={`ext-tool-btn ${viewMode === 'table' ? 'is-active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            <Table2 size={13} />
            <span>{isJa ? 'キー表' : 'Table'}</span>
          </button>
          <button
            type="button"
            className="ext-tool-btn"
            disabled={!parsed.ok}
            onClick={() => void handleCopyJson()}
            title={isJa ? 'JSON としてコピー' : 'Copy as JSON'}
          >
            <ClipboardCopy size={13} />
            <span>{isJa ? 'JSONコピー' : 'Copy JSON'}</span>
          </button>
          {mode === 'yaml' && onUpdateContent && content.trim().startsWith('{') && (
            <button
              type="button"
              className="ext-tool-btn"
              onClick={handleConvertFromJson}
              title={isJa ? 'JSON から YAML に変換' : 'Convert JSON to YAML'}
            >
              <FileJson size={13} />
              <span>{isJa ? 'JSON→YAML' : 'JSON→YAML'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="ext-preview-body">
        {!parsed.ok ? (
          <div className="ext-error-box">
            <div className="ext-error-header">
              <AlertTriangle size={16} />
              <span>
                {mode.toUpperCase()} {isJa ? '構文エラー' : 'Syntax Error'}
                {parsed.error?.line ? ` (Line ${parsed.error.line})` : ''}
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
          </div>
        ) : viewMode === 'tree' ? (
          <div className="ext-tree-container">{renderTree(null, parsed.value, [], 0)}</div>
        ) : (
          <div className="ext-table-wrap">
            <table className="ext-table">
              <thead>
                <tr>
                  <th>{isJa ? 'キーパス' : 'Key Path'}</th>
                  <th>{isJa ? '型' : 'Type'}</th>
                  <th>{isJa ? '値' : 'Value'}</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((row, idx) => (
                  <tr key={`${row.path}-${idx}`}>
                    <td className="ext-mono-cell">{row.path}</td>
                    <td>
                      <span className="ext-type-tag">{row.type}</span>
                    </td>
                    <td className="ext-mono-cell">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
