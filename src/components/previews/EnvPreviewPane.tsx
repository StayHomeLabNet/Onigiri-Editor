import React, { useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Plus, Sparkles } from 'lucide-react';
import type { Locale } from '../../types';
import { parseEnvEntries, updateEnvLine } from '../../utils/previewParsers';

interface EnvPreviewPaneProps {
  locale: Locale;
  fileName: string;
  content: string;
  onUpdateContent?: (nextContent: string) => void;
  onJumpToLine?: (line: number) => void;
}

export const EnvPreviewPane: React.FC<EnvPreviewPaneProps> = ({
  locale,
  fileName,
  content,
  onUpdateContent,
  onJumpToLine,
}) => {
  const isJa = locale === 'ja';
  const [maskValues, setMaskValues] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{
    line: number;
    field: 'key' | 'value';
    key: string;
    value: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = useMemo(() => parseEnvEntries(content), [content]);
  const duplicateCount = useMemo(
    () => entries.filter((e) => e.isDuplicate).length,
    [entries]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.value.toLowerCase().includes(q) ||
        e.section.toLowerCase().includes(q)
    );
  }, [entries, filter]);

  const badgeLabel = /\.ini$/i.test(fileName)
    ? 'INI'
    : /\.properties$/i.test(fileName)
      ? 'PROPERTIES'
      : 'ENV';

  const commitEdit = () => {
    if (!editing || !onUpdateContent) {
      setEditing(null);
      return;
    }
    const nextContent = updateEnvLine(content, editing.line, editing.key, editing.value);
    onUpdateContent(nextContent);
    setEditing(null);
  };

  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateContent || !newKey.trim()) return;
    const val = /\s|#/.test(newValue) ? `"${newValue.replace(/"/g, '\\"')}"` : newValue;
    const base = content.replace(/\n+$/, '');
    const next = base ? `${base}\n${newKey.trim()}=${val}\n` : `${newKey.trim()}=${val}\n`;
    onUpdateContent(next);
    setNewKey('');
    setNewValue('');
    setAdding(false);
  };

  const toggleRevealRow = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">{badgeLabel}</span>
          {duplicateCount > 0 && (
            <span className="ext-status-pill is-warn">
              <AlertTriangle size={12} />
              <span>
                {isJa ? `重複キー ${duplicateCount} 件` : `${duplicateCount} duplicate keys`}
              </span>
            </span>
          )}
          <input
            type="text"
            className="ext-preview-search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={isJa ? 'キー / 値で絞り込み...' : 'Filter keys or values...'}
          />
        </div>
        <div className="ext-preview-toolbar-right">
          <button
            type="button"
            className={`ext-tool-btn ${maskValues ? 'is-active' : ''}`}
            onClick={() => setMaskValues((prev) => !prev)}
          >
            {maskValues ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>{maskValues ? (isJa ? 'マスク中' : 'Masked') : isJa ? '表示中' : 'Visible'}</span>
          </button>
          {onUpdateContent && (
            <button
              type="button"
              className="ext-tool-btn"
              onClick={() => setAdding((prev) => !prev)}
            >
              <Plus size={13} />
              <span>{isJa ? '行を追加' : 'Add Entry'}</span>
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form className="ext-inline-add-bar" onSubmit={handleAddRow}>
          <input
            type="text"
            className="ext-inline-input"
            placeholder="KEY_NAME"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            autoFocus
          />
          <span>=</span>
          <input
            type="text"
            className="ext-inline-input"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <button type="submit" className="ext-tool-btn is-primary">
            {isJa ? '追加' : 'Add'}
          </button>
        </form>
      )}

      <div className="ext-preview-body">
        <div className="ext-hint-bar">
          <Sparkles size={12} />
          <span>
            {isJa
              ? 'KEY または VALUE をダブルクリックして編集できます'
              : 'Double-click KEY or VALUE to edit inline'}
          </span>
        </div>
        <div className="ext-table-wrap">
          <table className="ext-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>KEY</th>
                <th>VALUE</th>
                <th style={{ width: '44px' }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const isMasked =
                  maskValues && !revealedIds.has(entry.id) && entry.value.length > 0;
                const isEditingKey =
                  editing?.line === entry.line && editing.field === 'key';
                const isEditingVal =
                  editing?.line === entry.line && editing.field === 'value';

                return (
                  <tr
                    key={entry.id}
                    className={entry.isDuplicate ? 'ext-row-duplicate' : undefined}
                  >
                    <td
                      className="ext-line-num-cell"
                      onClick={() => onJumpToLine?.(entry.line)}
                      title={isJa ? 'エディタの該当行へジャンプ' : 'Jump to line'}
                    >
                      {entry.line}
                    </td>
                    <td
                      className="ext-mono-cell"
                      onDoubleClick={() => {
                        if (!onUpdateContent) return;
                        setEditing({
                          line: entry.line,
                          field: 'key',
                          key: entry.key,
                          value: entry.value,
                        });
                      }}
                    >
                      {isEditingKey ? (
                        <input
                          type="text"
                          className="ext-inline-input"
                          value={editing.key}
                          autoFocus
                          onChange={(e) =>
                            setEditing((prev) => (prev ? { ...prev, key: e.target.value } : null))
                          }
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEdit();
                            } else if (e.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                        />
                      ) : (
                        <span className="ext-env-key-wrap">
                          {entry.section && (
                            <span className="ext-type-tag">[{entry.section}]</span>
                          )}
                          <span>{entry.key}</span>
                          {entry.isDuplicate && (
                            <span className="ext-dup-badge">
                              {isJa ? '重複' : 'DUP'}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td
                      className="ext-mono-cell"
                      onDoubleClick={() => {
                        if (!onUpdateContent) return;
                        setEditing({
                          line: entry.line,
                          field: 'value',
                          key: entry.key,
                          value: entry.value,
                        });
                      }}
                    >
                      {isEditingVal ? (
                        <input
                          type="text"
                          className="ext-inline-input"
                          value={editing.value}
                          autoFocus
                          onChange={(e) =>
                            setEditing((prev) =>
                              prev ? { ...prev, value: e.target.value } : null
                            )
                          }
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitEdit();
                            } else if (e.key === 'Escape') {
                              setEditing(null);
                            }
                          }}
                        />
                      ) : (
                        <span className={isMasked ? 'ext-masked-val' : undefined}>
                          {isMasked ? '••••••••••••' : entry.value}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ext-icon-btn"
                        onClick={() => toggleRevealRow(entry.id)}
                        title={isMasked ? (isJa ? '表示' : 'Show') : isJa ? '隠す' : 'Hide'}
                      >
                        {isMasked ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="ext-empty-cell">
                    {isJa ? 'エントリが見つかりません' : 'No entries found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
