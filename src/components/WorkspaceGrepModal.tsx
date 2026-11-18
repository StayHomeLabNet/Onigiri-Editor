import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  Replace,
  Search,
  Square,
  X,
} from 'lucide-react';
import type { WorkspaceGrepResult } from '../types';
import type { Translations } from '../i18n/types';
import { replaceInWorkspace, searchWorkspaceAdvanced } from '../utils/platform';

interface WorkspaceGrepModalProps {
  t: Translations;
  open: boolean;
  workspaceRoot: string | null;
  onClose: () => void;
  onOpenFileAtLine: (path: string, line: number) => void;
  onAfterReplace: (modifiedPaths: string[], count: number) => void;
}

export const WorkspaceGrepModal: React.FC<WorkspaceGrepModalProps> = ({
  t,
  open,
  workspaceRoot,
  onClose,
  onOpenFileAtLine,
  onAfterReplace,
}) => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<WorkspaceGrepResult | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const queryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    const id = window.setTimeout(() => {
      queryInputRef.current?.focus();
      queryInputRef.current?.select();
    }, 15);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedFilesList = useMemo(() => {
    if (!result) return [];
    return result.files.filter((f) => selectedPaths[f.path]);
  }, [result, selectedPaths]);

  const selectedMatchCount = useMemo(
    () => selectedFilesList.reduce((acc, f) => acc + f.totalMatches, 0),
    [selectedFilesList]
  );

  if (!open) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workspaceRoot || !query.trim() || searching) return;
    setSearching(true);
    setErrorMsg(null);
    try {
      const res = await searchWorkspaceAdvanced({
        rootPath: workspaceRoot,
        query: query.trim(),
        caseSensitive,
        useRegex,
      });
      setResult(res);
      const nextSelected: Record<string, boolean> = {};
      for (const f of res.files) {
        nextSelected[f.path] = true;
      }
      setSelectedPaths(nextSelected);
      setCollapsedFiles({});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (!result) return;
    const next: Record<string, boolean> = {};
    for (const f of result.files) {
      next[f.path] = checked;
    }
    setSelectedPaths(next);
  };

  const handleReplaceSelected = async () => {
    if (!workspaceRoot || !query.trim() || selectedFilesList.length === 0 || replacing) return;
    const msg = t.grepModal.confirmReplace
      .replace('{files}', String(selectedFilesList.length))
      .replace('{matches}', String(selectedMatchCount));
    if (!window.confirm(msg)) return;

    setReplacing(true);
    setErrorMsg(null);
    try {
      const res = await replaceInWorkspace({
        rootPath: workspaceRoot,
        query: query.trim(),
        replacement,
        caseSensitive,
        useRegex,
        includedPaths: selectedFilesList.map((f) => f.path),
      });
      onAfterReplace(res.modifiedPaths, res.replacements);
      await handleSearch();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="grep-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.grepModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <Search size={16} />
            <h3>{t.grepModal.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        {!workspaceRoot ? (
          <div className="grep-modal-empty">{t.grepModal.noFolderHint}</div>
        ) : (
          <div className="grep-modal-body">
            <form className="grep-controls" onSubmit={handleSearch}>
              <div className="grep-input-row">
                <div className="grep-input-wrap">
                  <Search size={14} />
                  <input
                    ref={queryInputRef}
                    type="text"
                    className="text-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.grepModal.queryPlaceholder}
                  />
                </div>
                <button
                  type="button"
                  className={`sidebar-flag-btn ${caseSensitive ? 'is-active' : ''}`}
                  onClick={() => setCaseSensitive((v) => !v)}
                  title={t.grepModal.caseSensitive}
                >
                  Aa
                </button>
                <button
                  type="button"
                  className={`sidebar-flag-btn ${useRegex ? 'is-active' : ''}`}
                  onClick={() => setUseRegex((v) => !v)}
                  title={t.grepModal.regex}
                >
                  .*
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={!query.trim() || searching}
                >
                  {searching ? <Loader2 size={13} className="spin" /> : <Search size={13} />}
                  <span>{searching ? t.grepModal.searching : t.grepModal.searchBtn}</span>
                </button>
              </div>

              <div className="grep-input-row">
                <div className="grep-input-wrap">
                  <Replace size={14} />
                  <input
                    type="text"
                    className="text-input"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    placeholder={t.grepModal.replacePlaceholder}
                  />
                </div>
                <button
                  type="button"
                  className="secondary-btn grep-replace-btn"
                  disabled={!result || selectedFilesList.length === 0 || !query.trim() || replacing}
                  onClick={handleReplaceSelected}
                >
                  {replacing ? <Loader2 size={13} className="spin" /> : <Replace size={13} />}
                  <span>
                    {replacing
                      ? t.grepModal.replacing
                      : t.grepModal.replaceSelectedBtn.replace(
                          '{files}',
                          String(selectedFilesList.length)
                        )}
                  </span>
                </button>
              </div>
            </form>

            {errorMsg && <div className="grep-error">{errorMsg}</div>}

            {result && (
              <div className="grep-toolbar">
                <span className="grep-summary">
                  {t.grepModal.summary
                    .replace('{files}', String(result.totalFiles))
                    .replace('{matches}', String(result.totalMatches))}
                </span>
                {result.files.length > 0 && (
                  <div className="grep-select-actions">
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => handleSelectAll(true)}
                    >
                      <CheckSquare size={12} />
                      <span>{t.grepModal.selectAll}</span>
                    </button>
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => handleSelectAll(false)}
                    >
                      <Square size={12} />
                      <span>{t.grepModal.deselectAll}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {result?.truncated && (
              <div className="grep-truncated-note">{t.grepModal.truncatedNotice}</div>
            )}

            <div className="grep-results">
              {result && result.files.length === 0 ? (
                <div className="muted-msg">{t.grepModal.noResults}</div>
              ) : (
                result?.files.map((file) => {
                  const checked = Boolean(selectedPaths[file.path]);
                  const collapsed = Boolean(collapsedFiles[file.path]);
                  return (
                    <div key={file.path} className="grep-file-group">
                      <div className="grep-file-header">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedPaths((prev) => ({
                              ...prev,
                              [file.path]: e.target.checked,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="grep-file-toggle"
                          onClick={() =>
                            setCollapsedFiles((prev) => ({
                              ...prev,
                              [file.path]: !prev[file.path],
                            }))
                          }
                        >
                          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                          <span className="grep-file-path">{file.relativePath}</span>
                          <span className="grep-file-count">{file.totalMatches}</span>
                        </button>
                      </div>
                      {!collapsed && (
                        <div className="grep-match-list">
                          {file.matches.map((m, idx) => (
                            <button
                              key={`${file.path}:${m.line}:${m.col}:${idx}`}
                              type="button"
                              className="grep-match-row"
                              onClick={() => {
                                onOpenFileAtLine(file.path, m.line);
                                onClose();
                              }}
                            >
                              <span className="grep-match-line">L{m.line}</span>
                              <span className="grep-match-snippet">{m.snippet}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
