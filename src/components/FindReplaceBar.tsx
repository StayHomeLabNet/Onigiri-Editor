import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronUp,
  ChevronDown,
  X,
  Replace,
  ReplaceAll,
  RefreshCw,
  AlertCircle,
  GripVertical,
} from 'lucide-react';
import type { Translations } from '../i18n/types';
import {
  computeReplacementForMatch,
  findAllMatches,
  getLineRangeForOffsets,
  pickInitialMatchIndex,
  pickNextMatchAfterReplace,
  replaceAllInText,
  type FindMatch,
  type FindOptions,
  type TextRange,
} from '../utils/findReplace';

export const FIND_OPTS_STORAGE_KEY = 'onigiri-markdown.findOpts';

interface PersistedFindOpts {
  caseSensitive: boolean;
  widthSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

function loadFindOpts(): PersistedFindOpts {
  try {
    const raw = localStorage.getItem(FIND_OPTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedFindOpts>;
      return {
        caseSensitive: Boolean(parsed.caseSensitive),
        widthSensitive: Boolean(parsed.widthSensitive),
        wholeWord: Boolean(parsed.wholeWord),
        useRegex: Boolean(parsed.useRegex),
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    caseSensitive: false,
    widthSensitive: false,
    wholeWord: false,
    useRegex: false,
  };
}

export interface FindReplaceBarHandle {
  openWithSeed: (opts: {
    target?: 'find' | 'replace';
    selectedText: string;
    selectionRange: TextRange | null;
  }) => void;
  findNext: () => void;
  findPrevious: () => void;
  onEditorSelection: (range: TextRange) => void;
  onScopeMapped: (scope: TextRange | null) => void;
}

interface FindReplaceBarProps {
  t: Translations;
  open: boolean;
  docId: string;
  onClose: () => void;
  documentText: string;
  getEditorSelection: () => TextRange | null;
  getCursorOffset: () => number;
  onSelectMatch: (from: number, to: number, options?: { focus?: boolean }) => void;
  onReplaceRange: (from: number, to: number, replacement: string) => void;
  onReplaceAll: (result: {
    scopeFrom: number;
    scopeTo: number;
    replacedSlice: string;
    nextText: string;
    count: number;
  }) => void;
  onSyncScope: (scope: TextRange | null) => void;
  onSyncHighlights: (payload: { matches: FindMatch[]; activeIndex: number } | null) => void;
  getAnchorRect?: () => DOMRect | null;
  onBrowserOverlapChange?: (overlaps: boolean) => void;
}

export const FindReplaceBar = forwardRef<FindReplaceBarHandle, FindReplaceBarProps>(
  (
    {
      t,
      open,
      docId,
      onClose,
      documentText,
      getEditorSelection,
      getCursorOffset,
      onSelectMatch,
      onReplaceRange,
      onReplaceAll,
      onSyncScope,
      onSyncHighlights,
      getAnchorRect,
      onBrowserOverlapChange,
    },
    ref
  ) => {
    const initialOpts = useMemo(() => loadFindOpts(), []);
    const [query, setQuery] = useState('');
    const [replacement, setReplacement] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(initialOpts.caseSensitive);
    const [widthSensitive, setWidthSensitive] = useState(initialOpts.widthSensitive);
    const [wholeWord, setWholeWord] = useState(initialOpts.wholeWord);
    const [useRegex, setUseRegex] = useState(initialOpts.useRegex);
    const [inSelection, setInSelection] = useState(false);
    const [selectionScope, setSelectionScope] = useState<TextRange | null>(null);
    const [activeIdx, setActiveIdx] = useState(0);

    const findInputRef = useRef<HTMLInputElement | null>(null);
    const replaceInputRef = useRef<HTMLInputElement | null>(null);
    const barRef = useRef<HTMLDivElement | null>(null);
    const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
    const [defaultPos, setDefaultPos] = useState<{ left: number; top: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const pendingAfterReplacePosRef = useRef<number | null>(null);
    const shouldJumpOnCriteriaChangeRef = useRef(false);
    const seededFocusRef = useRef(false);

    useEffect(() => {
      const onCleared = () => {
        setCaseSensitive(false);
        setWidthSensitive(false);
        setWholeWord(false);
        setUseRegex(false);
      };
      window.addEventListener('onigiri:find-opts-cleared', onCleared);
      return () => window.removeEventListener('onigiri:find-opts-cleared', onCleared);
    }, []);

    // Persist toggle options
    useEffect(() => {
      try {
        if (!caseSensitive && !widthSensitive && !wholeWord && !useRegex) {
          localStorage.removeItem(FIND_OPTS_STORAGE_KEY);
          return;
        }
        localStorage.setItem(
          FIND_OPTS_STORAGE_KEY,
          JSON.stringify({ caseSensitive, widthSensitive, wholeWord, useRegex })
        );
      } catch {
        // ignore
      }
    }, [caseSensitive, widthSensitive, wholeWord, useRegex]);

    // Clear selection scope when switching documents
    useEffect(() => {
      setSelectionScope(null);
      setInSelection(false);
      onSyncScope(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId]);

    // Clean up editor decorations when closed
    useEffect(() => {
      if (open) {
        setTimeout(() => {
          if (seededFocusRef.current) {
            seededFocusRef.current = false;
            return;
          }
          findInputRef.current?.focus();
          findInputRef.current?.select();
        }, 20);
      } else {
        seededFocusRef.current = false;
        onSyncHighlights(null);
        onSyncScope(null);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const options: FindOptions = useMemo(
      () => ({ caseSensitive, widthSensitive, wholeWord, useRegex }),
      [caseSensitive, widthSensitive, wholeWord, useRegex]
    );

    const { matches, error: regexError } = useMemo(() => {
      if (!open || !query) return { matches: [] as FindMatch[], error: null as string | null };
      if (inSelection && !selectionScope) {
        return { matches: [] as FindMatch[], error: null as string | null };
      }
      return findAllMatches(
        documentText,
        query,
        options,
        inSelection ? selectionScope : null
      );
    }, [open, query, documentText, options, inSelection, selectionScope]);

    // Handle post-replace match advancement
    useEffect(() => {
      if (!open) {
        pendingAfterReplacePosRef.current = null;
        return;
      }
      if (pendingAfterReplacePosRef.current !== null) {
        const afterPos = pendingAfterReplacePosRef.current;
        pendingAfterReplacePosRef.current = null;
        if (matches.length > 0) {
          const nextIdx = pickNextMatchAfterReplace(matches, afterPos);
          setActiveIdx(nextIdx);
          const nextMatch = matches[nextIdx];
          onSelectMatch(nextMatch.from, nextMatch.to, { focus: false });
        } else {
          setActiveIdx(0);
        }
      }
    }, [open, documentText, matches, onSelectMatch]);

    // Incremental jump when query or search criteria changes
    useEffect(() => {
      if (!open || !shouldJumpOnCriteriaChangeRef.current) return;
      shouldJumpOnCriteriaChangeRef.current = false;
      if (matches.length > 0) {
        const idx = pickInitialMatchIndex(matches, getCursorOffset());
        setActiveIdx(idx);
        const m = matches[idx];
        onSelectMatch(m.from, m.to, { focus: false });
      } else {
        setActiveIdx(0);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, query, options, inSelection, selectionScope, matches]);

    // Clamp activeIdx when matches shrink
    useEffect(() => {
      if (matches.length > 0) {
        if (activeIdx >= matches.length) {
          setActiveIdx(matches.length - 1);
        }
      } else if (activeIdx !== 0) {
        setActiveIdx(0);
      }
    }, [matches.length, activeIdx]);

    // Push highlight decorations to editor
    useEffect(() => {
      if (!open || !query || matches.length === 0) {
        onSyncHighlights(null);
        return;
      }
      onSyncHighlights({
        matches,
        activeIndex: Math.min(activeIdx, matches.length - 1),
      });
    }, [open, query, matches, activeIdx, onSyncHighlights]);

    const jump = useCallback(
      (delta: number) => {
        if (matches.length === 0) return;
        const safeCurrent = Math.min(activeIdx, matches.length - 1);
        const next = (safeCurrent + delta + matches.length) % matches.length;
        setActiveIdx(next);
        const m = matches[next];
        onSelectMatch(m.from, m.to, { focus: false });
      },
      [matches, activeIdx, onSelectMatch]
    );

    const handleReplaceOne = useCallback(() => {
      if (matches.length === 0 || regexError) return;
      const safeIdx = Math.min(activeIdx, matches.length - 1);
      const m = matches[safeIdx] || matches[0];
      const actualReplacement = computeReplacementForMatch(
        documentText,
        m,
        query,
        replacement,
        options
      );
      pendingAfterReplacePosRef.current = m.from + actualReplacement.length;
      onReplaceRange(m.from, m.to, actualReplacement);
    }, [matches, regexError, activeIdx, documentText, query, replacement, options, onReplaceRange]);

    const handleReplaceAll = useCallback(() => {
      if (!query || regexError) return;
      if (inSelection && !selectionScope) return;
      const res = replaceAllInText(
        documentText,
        query,
        replacement,
        options,
        inSelection ? selectionScope : null
      );
      if (res.error || res.count === 0) return;
      setActiveIdx(0);
      onReplaceAll({
        scopeFrom: res.scopeFrom,
        scopeTo: res.scopeTo,
        replacedSlice: res.replacedSlice,
        nextText: res.nextText,
        count: res.count,
      });
    }, [query, regexError, inSelection, selectionScope, documentText, replacement, options, onReplaceAll]);

    const handleToggleInSelection = () => {
      if (inSelection) {
        setInSelection(false);
        setSelectionScope(null);
        onSyncScope(null);
        shouldJumpOnCriteriaChangeRef.current = true;
      } else {
        const sel = getEditorSelection();
        const validScope = sel && sel.to > sel.from ? sel : null;
        setInSelection(true);
        setSelectionScope(validScope);
        onSyncScope(validScope);
        shouldJumpOnCriteriaChangeRef.current = true;
      }
    };

    const handleRefreshSelectionScope = () => {
      const sel = getEditorSelection();
      if (sel && sel.to > sel.from) {
        setInSelection(true);
        setSelectionScope(sel);
        onSyncScope(sel);
        shouldJumpOnCriteriaChangeRef.current = true;
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        openWithSeed: ({ target = 'find', selectedText, selectionRange }) => {
          if (selectedText.includes('\n') && selectionRange && selectionRange.to > selectionRange.from) {
            setInSelection(true);
            setSelectionScope(selectionRange);
            onSyncScope(selectionRange);
            shouldJumpOnCriteriaChangeRef.current = true;
          } else if (selectedText.length > 0) {
            setQuery(selectedText);
            shouldJumpOnCriteriaChangeRef.current = true;
          } else if (inSelection && selectionScope) {
            onSyncScope(selectionScope);
          }

          seededFocusRef.current = true;
          setTimeout(() => {
            seededFocusRef.current = false;
            const el = target === 'replace' ? replaceInputRef.current : findInputRef.current;
            el?.focus();
            el?.select();
          }, 20);
        },
        findNext: () => jump(1),
        findPrevious: () => jump(-1),
        onEditorSelection: (range: TextRange) => {
          if (inSelection && !selectionScope && range.to > range.from) {
            setSelectionScope(range);
            onSyncScope(range);
            shouldJumpOnCriteriaChangeRef.current = true;
          }
        },
        onScopeMapped: (scope: TextRange | null) => {
          setSelectionScope(scope);
        },
      }),
      [inSelection, selectionScope, jump, onSyncScope]
    );

    const computeDefaultPos = useCallback(() => {
      const barEl = barRef.current;
      const barWidth = barEl?.offsetWidth || Math.min(520, window.innerWidth - 32);
      const barHeight = barEl?.offsetHeight || 110;
      const anchor = getAnchorRect?.();
      if (anchor && anchor.width > 0 && anchor.height > 0) {
        const left = Math.min(
          Math.max(8, window.innerWidth - barWidth - 8),
          Math.max(8, anchor.right - barWidth - 16)
        );
        const top = Math.min(
          Math.max(8, window.innerHeight - barHeight - 8),
          Math.max(8, anchor.top + 10)
        );
        setDefaultPos({ left, top });
      } else {
        setDefaultPos({
          left: Math.max(8, window.innerWidth - barWidth - 16),
          top: 56,
        });
      }
    }, [getAnchorRect]);

    useEffect(() => {
      if (!open || dragPos !== null) return;
      const raf = window.requestAnimationFrame(computeDefaultPos);
      window.addEventListener('resize', computeDefaultPos);
      return () => {
        window.cancelAnimationFrame(raf);
        window.removeEventListener('resize', computeDefaultPos);
      };
    }, [open, dragPos, computeDefaultPos]);

    useEffect(() => {
      if (!open) {
        onBrowserOverlapChange?.(false);
        return;
      }
      const checkOverlap = () => {
        const barEl = barRef.current;
        const browserHost = document.querySelector('.native-browser-host') as HTMLElement | null;
        if (!barEl || !browserHost) {
          onBrowserOverlapChange?.(false);
          return;
        }
        const a = barEl.getBoundingClientRect();
        const b = browserHost.getBoundingClientRect();
        if (b.width <= 0 || b.height <= 0) {
          onBrowserOverlapChange?.(false);
          return;
        }
        const overlaps =
          a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
        onBrowserOverlapChange?.(overlaps);
      };
      const raf = window.requestAnimationFrame(checkOverlap);
      return () => window.cancelAnimationFrame(raf);
    }, [open, dragPos, defaultPos, onBrowserOverlapChange]);

    const handleBarPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, button, label, select, textarea, a')) return;
      const barEl = barRef.current;
      if (!barEl) return;

      e.preventDefault();
      const barRect = barEl.getBoundingClientRect();
      const startLeft = barRect.left;
      const startTop = barRect.top;
      const startX = e.clientX;
      const startY = e.clientY;
      const maxLeft = Math.max(4, window.innerWidth - barRect.width - 4);
      const maxTop = Math.max(4, window.innerHeight - barRect.height - 4);

      setIsDragging(true);

      const onMove = (ev: PointerEvent) => {
        const nextLeft = Math.min(maxLeft, Math.max(4, startLeft + (ev.clientX - startX)));
        const nextTop = Math.min(maxTop, Math.max(4, startTop + (ev.clientY - startY)));
        setDragPos({ left: nextLeft, top: nextTop });
      };

      const onUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }, []);

    if (!open) return null;

    const scopeLineInfo =
      inSelection && selectionScope
        ? getLineRangeForOffsets(documentText, selectionScope.from, selectionScope.to)
        : null;

    const canSearch = Boolean(query) && !regexError && (!inSelection || Boolean(selectionScope));
    const hasMatches = canSearch && matches.length > 0;

    const resolvedPos = dragPos ?? defaultPos;

    return (
      <div
        ref={barRef}
        className={`find-bar ${isDragging ? 'is-dragging' : ''}`}
        role="dialog"
        aria-label={t.actions.findReplace}
        style={resolvedPos ? { left: resolvedPos.left, top: resolvedPos.top, right: 'auto' } : undefined}
        onPointerDown={handleBarPointerDown}
      >
        {/* Row 1: Drag handle + Find input + count + Prev / Next + Close */}
        <div className="find-row">
          <span
            className="find-drag-handle"
            onDoubleClick={() => setDragPos(null)}
            aria-hidden="true"
          >
            <GripVertical size={13} />
          </span>
          <input
            ref={findInputRef}
            type="text"
            className={`find-input ${regexError ? 'is-error' : ''}`}
            value={query}
            onChange={(e) => {
              shouldJumpOnCriteriaChangeRef.current = true;
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter') {
                e.preventDefault();
                jump(e.shiftKey ? -1 : 1);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder={t.find.findPlaceholder}
            aria-label={t.find.findPlaceholder}
          />

          <span
            className={`find-count ${regexError ? 'is-error' : ''}`}
            title={regexError || undefined}
          >
            {regexError ? (
              <span className="find-err-inline">
                <AlertCircle size={12} />
                <span>{t.find.invalidRegex}</span>
              </span>
            ) : query ? (
              inSelection && !selectionScope ? (
                '0/0'
              ) : matches.length > 0 ? (
                `${Math.min(activeIdx, matches.length - 1) + 1}/${matches.length}`
              ) : (
                t.find.noMatches
              )
            ) : (
              ''
            )}
          </span>

          <button
            type="button"
            className="find-nav-btn"
            onClick={() => jump(-1)}
            disabled={!hasMatches}
            title={`${t.find.previous} (Shift+Enter / Shift+F3)`}
            aria-label={t.find.previous}
          >
            <ChevronUp size={13} />
            <span>{t.find.previous}</span>
          </button>

          <button
            type="button"
            className="find-nav-btn"
            onClick={() => jump(1)}
            disabled={!hasMatches}
            title={`${t.find.next} (Enter / F3)`}
            aria-label={t.find.next}
          >
            <ChevronDown size={13} />
            <span>{t.find.next}</span>
          </button>

          <button
            type="button"
            className="icon-btn-sm"
            onClick={onClose}
            title={`${t.actions.close} (Esc)`}
            aria-label={t.actions.close}
          >
            <X size={14} />
          </button>
        </div>

        {/* Row 2: Replace input + Replace / Replace All */}
        <div className="find-row">
          <input
            ref={replaceInputRef}
            type="text"
            className="find-input"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleReplaceAll();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                handleReplaceOne();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder={t.find.replacePlaceholder}
            aria-label={t.find.replacePlaceholder}
          />
          <button
            type="button"
            className="find-action-btn"
            onClick={handleReplaceOne}
            disabled={!hasMatches}
            title={t.find.replace}
          >
            <Replace size={13} />
            <span>{t.find.replace}</span>
          </button>
          <button
            type="button"
            className="find-action-btn is-primary"
            onClick={handleReplaceAll}
            disabled={!hasMatches}
            title={t.find.replaceAll}
          >
            <ReplaceAll size={13} />
            <span>{t.find.replaceAll}</span>
          </button>
        </div>

        {/* Row 3: Search options (In Selection, Case Sensitive, Full/Half-Width, Whole Word, Regex) */}
        <div className="find-options-row">
          <label
            className={`find-opt-pill ${caseSensitive ? 'is-active' : ''}`}
            title={t.find.caseSensitive}
          >
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => {
                shouldJumpOnCriteriaChangeRef.current = true;
                setCaseSensitive(e.target.checked);
              }}
            />
            <span>{t.find.caseSensitiveShort}</span>
          </label>

          <label
            className={`find-opt-pill ${widthSensitive ? 'is-active' : ''}`}
            title={t.find.widthSensitive}
          >
            <input
              type="checkbox"
              checked={widthSensitive}
              onChange={(e) => {
                shouldJumpOnCriteriaChangeRef.current = true;
                setWidthSensitive(e.target.checked);
              }}
            />
            <span>{t.find.widthSensitiveShort}</span>
          </label>

          <label
            className={`find-opt-pill ${inSelection ? 'is-active' : ''}`}
            title={t.find.inSelection}
          >
            <input
              type="checkbox"
              checked={inSelection}
              onChange={handleToggleInSelection}
            />
            <span>{t.find.inSelection}</span>
            {inSelection && scopeLineInfo && (
              <span className="find-scope-badge">
                L{scopeLineInfo.startLine}–L{scopeLineInfo.endLine}
              </span>
            )}
          </label>

          {inSelection && (
            <button
              type="button"
              className="find-opt-refresh"
              onClick={handleRefreshSelectionScope}
              title={t.find.refreshSelection}
              aria-label={t.find.refreshSelection}
            >
              <RefreshCw size={11} />
            </button>
          )}

          <div className="find-opt-spacer" />

          <button
            type="button"
            className={`find-opt ${wholeWord ? 'is-active' : ''}`}
            onClick={() => {
              shouldJumpOnCriteriaChangeRef.current = true;
              setWholeWord((v) => !v);
            }}
            title={t.find.wholeWord}
            aria-pressed={wholeWord}
          >
            \b
          </button>
          <button
            type="button"
            className={`find-opt ${useRegex ? 'is-active' : ''}`}
            onClick={() => {
              shouldJumpOnCriteriaChangeRef.current = true;
              setUseRegex((v) => !v);
            }}
            title={t.find.regex}
            aria-pressed={useRegex}
          >
            .*
          </button>
        </div>

        {inSelection && !selectionScope && (
          <div className="find-scope-hint">{t.find.noSelectionHint}</div>
        )}
      </div>
    );
  }
);

FindReplaceBar.displayName = 'FindReplaceBar';
