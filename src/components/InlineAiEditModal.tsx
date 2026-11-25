import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkPlus, Loader2, Maximize2, Minimize2, RotateCcw, SlidersHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react';
import type { AiProviderConfig, AiProviderId, InlineAiPresetItem } from '../types';
import type { Translations } from '../i18n/types';
import { cancelAiChat, listenAiChatProgress, sendAiChat } from '../utils/platform';
import { formatAiErrorHint, type AiErrorInfo } from '../utils/aiErrorHint';
import { loadWorkspaceAiRules } from '../utils/aiProjectRules';
import { buildAiMemoryPromptBlock } from '../utils/aiMemory';
import { appendAiAuditEntry } from '../utils/aiAuditLog';

export const INLINE_AI_PRESETS_KEY = 'onigiri-markdown.inline-ai-presets.v1';
const INLINE_AI_MODAL_SIZE_KEY = 'onigiri-markdown.inline-ai-modal-size.v1';

interface ModalSize {
  width: number;
  height: number;
}

function loadSavedModalSize(): ModalSize | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INLINE_AI_MODAL_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ModalSize>;
    if (
      typeof parsed.width === 'number' &&
      Number.isFinite(parsed.width) &&
      typeof parsed.height === 'number' &&
      Number.isFinite(parsed.height)
    ) {
      return {
        width: Math.max(420, Math.round(parsed.width)),
        height: Math.max(360, Math.round(parsed.height)),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

const DEFAULT_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'https://api.openai.com/v1',
  'anthropic-api': 'https://api.anthropic.com',
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234/v1',
  'openai-compat': 'http://127.0.0.1:8080/v1',
};

const DEFAULT_MODELS: Partial<Record<AiProviderId, string>> = {
  'openai-api': 'gpt-4.1',
  'anthropic-api': 'claude-sonnet-4-5',
  'gemini-api': 'gemini-2.5-flash',
  'apple-foundation-models': 'default',
  ollama: 'llama3.2',
  lmstudio: 'local-model',
  'openai-compat': 'gpt-4.1-mini',
};

function stripSingleMarkdownFence(output: string, original: string): string {
  const trimmed = output.trim();
  if (!trimmed.startsWith('```') || original.trim().startsWith('```')) {
    return output;
  }
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (!match) return output;
  return match[1];
}

function buildBuiltinPresets(t: Translations): InlineAiPresetItem[] {
  const p = t.inlineAiModal.presets;
  return [
    { id: 'builtin-refactor', label: p.refactorLabel, prompt: p.refactorPrompt, isBuiltin: true },
    { id: 'builtin-comments', label: p.commentsLabel, prompt: p.commentsPrompt, isBuiltin: true },
    { id: 'builtin-fix', label: p.fixLabel, prompt: p.fixPrompt, isBuiltin: true },
    { id: 'builtin-concise', label: p.conciseLabel, prompt: p.concisePrompt, isBuiltin: true },
    { id: 'builtin-polite', label: p.politeLabel, prompt: p.politePrompt, isBuiltin: true },
    { id: 'builtin-to-ja', label: p.toJaLabel, prompt: p.toJaPrompt, isBuiltin: true },
    { id: 'builtin-to-en', label: p.toEnLabel, prompt: p.toEnPrompt, isBuiltin: true },
  ];
}

function loadSavedPresets(t: Translations): InlineAiPresetItem[] {
  const defaults = buildBuiltinPresets(t);
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(INLINE_AI_PRESETS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults;
    const valid = parsed.filter(
      (x): x is InlineAiPresetItem =>
        Boolean(x && typeof x.id === 'string' && typeof x.label === 'string' && typeof x.prompt === 'string')
    );
    return valid.length > 0 ? valid : defaults;
  } catch {
    return defaults;
  }
}

interface InlineAiEditModalProps {
  t: Translations;
  open: boolean;
  selectedText: string;
  fileName: string;
  languageLabel: string;
  aiConfig: AiProviderConfig;
  workspaceRoot: string | null;
  aiProjectRulesEnabled?: boolean;
  aiMemoryEnabled?: boolean;
  aiAuditLogEnabled?: boolean;
  onClose: () => void;
  onResultReady: (proposedText: string, instruction: string) => void;
}

const COMPARE_PROVIDER_OPTIONS: Array<{ id: AiProviderId; label: string }> = [
  { id: 'codex-cli', label: 'Codex CLI' },
  { id: 'claude-cli', label: 'Claude Code CLI' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'antigravity-cli', label: 'Antigravity CLI' },
  { id: 'apple-foundation-models', label: 'Apple Intelligence' },
  { id: 'openai-api', label: 'OpenAI API' },
  { id: 'anthropic-api', label: 'Anthropic API' },
  { id: 'gemini-api', label: 'Gemini API' },
  { id: 'ollama', label: 'Ollama' },
  { id: 'lmstudio', label: 'LM Studio' },
];

interface AbCompareCandidate {
  label: string;
  provider: AiProviderId;
  modelUsed?: string;
  durationMs: number;
  text?: string;
  error?: AiErrorInfo;
}

export const InlineAiEditModal: React.FC<InlineAiEditModalProps> = ({
  t,
  open,
  selectedText,
  fileName,
  languageLabel,
  aiConfig,
  workspaceRoot,
  aiProjectRulesEnabled = true,
  aiMemoryEnabled = true,
  aiAuditLogEnabled = true,
  onClose,
  onResultReady,
}) => {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<AiErrorInfo | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareProviderB, setCompareProviderB] = useState<AiProviderId>(() =>
    aiConfig.provider === 'claude-cli' ? 'codex-cli' : 'claude-cli'
  );
  const [compareModelB, setCompareModelB] = useState('');
  const [abResults, setAbResults] = useState<[AbCompareCandidate, AbCompareCandidate] | null>(null);
  const [presets, setPresets] = useState<InlineAiPresetItem[]>(() => loadSavedPresets(t));
  const [managingPresets, setManagingPresets] = useState(false);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [customSize, setCustomSize] = useState<ModalSize | null>(() => loadSavedModalSize());
  const [expanded, setExpanded] = useState(false);
  const requestIdRef = useRef<string | null>(null);
  const activeRequestIdsRef = useRef<string[]>([]);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const skipNextPersistRef = useRef(true);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const onReset = () => {
      skipNextPersistRef.current = true;
      setPresets(loadSavedPresets(t));
    };
    window.addEventListener('onigiri:inline-ai-presets-reset', onReset);
    return () => window.removeEventListener('onigiri:inline-ai-presets-reset', onReset);
  }, [t]);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(INLINE_AI_PRESETS_KEY, JSON.stringify(presets));
    } catch {
      // ignore
    }
  }, [presets]);

  useEffect(() => {
    if (!open) return;
    setErrorInfo(null);
    setProgressText(null);
    setElapsedSecs(0);
    setAbResults(null);
    setBusy(false);
    setAddingPreset(false);
    cancelledRef.current = false;
    requestIdRef.current = null;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onClose]);

  const selectionMetrics = useMemo(() => {
    const lines = selectedText ? selectedText.split(/\r?\n/).length : 0;
    const chars = selectedText.length;
    return t.inlineAiModal.selectionSummary
      .replace('{lines}', String(lines))
      .replace('{chars}', String(chars));
  }, [selectedText, t.inlineAiModal.selectionSummary]);

  if (!open) return null;

  const movePreset = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= presets.length) return;
    setPresets((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  };

  const deletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveNewPreset = () => {
    const label = newPresetLabel.trim();
    const prompt = instruction.trim();
    if (!label || !prompt) return;
    setPresets((prev) => [
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        prompt,
        isBuiltin: false,
      },
      ...prev,
    ]);
    setNewPresetLabel('');
    setAddingPreset(false);
  };

  const handleResetPresets = () => {
    skipNextPersistRef.current = true;
    setPresets(buildBuiltinPresets(t));
    try {
      localStorage.removeItem(INLINE_AI_PRESETS_KEY);
    } catch {
      // ignore
    }
  };

  const handleRun = async (overrideInstruction?: string) => {
    const trimmed = (overrideInstruction ?? instruction).trim();
    if (!trimmed || busy) return;

    const reqIdA = `inline-ai-a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const reqIdB = `inline-ai-b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    requestIdRef.current = reqIdA;
    activeRequestIdsRef.current = compareMode ? [reqIdA, reqIdB] : [reqIdA];
    cancelledRef.current = false;
    setBusy(true);
    setElapsedSecs(0);
    setProgressText(null);
    setErrorInfo(null);
    setAbResults(null);

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSecs(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    const unlisten = await listenAiChatProgress((ev) => {
      if (!activeRequestIdsRef.current.includes(ev.requestId)) return;
      if (ev.elapsedSecs > 0) {
        setElapsedSecs(ev.elapsedSecs);
      }
      const line = ev.text.trim().split(/\r?\n/).pop()?.trim();
      if (line) {
        setProgressText(line.slice(0, 110));
      }
    });

    const effectiveModelA =
      aiConfig.model.trim() || DEFAULT_MODELS[aiConfig.provider] || '';

    const rules = await loadWorkspaceAiRules(workspaceRoot, aiProjectRulesEnabled);
    const pinnedMemory = buildAiMemoryPromptBlock(workspaceRoot, aiMemoryEnabled);
    const baseSystemPrompt = [
      'You are performing an inline text/code transformation on a selected fragment inside an editor.',
      `File: ${fileName} (${languageLabel})`,
      'Return ONLY the replacement text for the selected fragment.',
      'Do not include explanations, preambles, or surrounding markdown code fences unless the original selection itself uses them.',
      'Preserve surrounding indentation and style conventions unless instructed otherwise.',
    ].join('\n');
    const systemParts = [baseSystemPrompt];
    if (pinnedMemory) systemParts.push(pinnedMemory);
    if (rules) systemParts.push(rules.promptBlock);
    const systemPrompt = systemParts.join('\n\n');

    const userPrompt = `Instruction:\n${trimmed}\n\nSelected text:\n<<<SELECTION\n${selectedText}\nSELECTION>>>`;

    const runOne = async (
      reqId: string,
      provider: AiProviderId,
      modelOverride?: string
    ): Promise<AbCompareCandidate> => {
      const t0 = Date.now();
      const model =
        (modelOverride && modelOverride.trim()) ||
        (provider === aiConfig.provider ? effectiveModelA : aiConfig.models?.[provider]?.trim()) ||
        DEFAULT_MODELS[provider] ||
        '';
      try {
        const res = await sendAiChat({
          requestId: reqId,
          provider,
          model: model || undefined,
          apiKey: aiConfig.apiKeys[provider],
          baseUrl: aiConfig.baseUrls[provider] || DEFAULT_BASE_URLS[provider],
          customCliCmd: aiConfig.customCliCmd,
          systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          workspaceDir: workspaceRoot,
          allowWorkspaceWrite: false,
        });
        const cleaned = stripSingleMarkdownFence(res.content, selectedText);
        const durationMs = Date.now() - t0;
        appendAiAuditEntry(
          {
            source: 'inline-edit',
            label: `${fileName} (${provider})`,
            provider,
            model: res.modelUsed || model || undefined,
            promptPreview: userPrompt,
            responsePreview: cleaned,
            durationMs,
            applied: !compareMode,
          },
          aiAuditLogEnabled
        );
        return {
          label: provider,
          provider,
          modelUsed: res.modelUsed || model || undefined,
          durationMs,
          text: cleaned,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const info = formatAiErrorHint(err, provider, isJa);
        const durationMs = Date.now() - t0;
        if (msg !== 'CLI_CANCELLED') {
          appendAiAuditEntry(
            {
              source: 'inline-edit',
              label: `${fileName} (${provider})`,
              provider,
              model: model || undefined,
              promptPreview: userPrompt,
              responsePreview: '',
              durationMs,
              error: info.message,
            },
            aiAuditLogEnabled
          );
        }
        return {
          label: provider,
          provider,
          durationMs,
          error: info,
        };
      }
    };

    try {
      if (compareMode) {
        const [resA, resB] = await Promise.all([
          runOne(reqIdA, aiConfig.provider, effectiveModelA),
          runOne(reqIdB, compareProviderB, compareModelB),
        ]);
        if (cancelledRef.current) return;
        setAbResults([resA, resB]);
      } else {
        const resA = await runOne(reqIdA, aiConfig.provider, effectiveModelA);
        if (cancelledRef.current) return;
        if (resA.error) {
          if (resA.error.message !== 'CLI_CANCELLED') {
            setErrorInfo(resA.error);
          }
          return;
        }
        onResultReady(resA.text ?? '', trimmed);
      }
    } finally {
      window.clearInterval(timer);
      unlisten();
      requestIdRef.current = null;
      activeRequestIdsRef.current = [];
      setBusy(false);
      setProgressText(null);
    }
  };

  const handleCancelRequest = async () => {
    cancelledRef.current = true;
    const ids = activeRequestIdsRef.current.length > 0
      ? [...activeRequestIdsRef.current]
      : requestIdRef.current
        ? [requestIdRef.current]
        : [];
    await Promise.all(ids.map((id) => cancelAiChat(id).catch(() => {})));
    setBusy(false);
  };

  const startResize = (axis: 'x' | 'y' | 'xy', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = modalRef.current;
    if (!el) return;
    resizeCleanupRef.current?.();
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    let latest: ModalSize = { width: Math.round(startW), height: Math.round(startH) };
    setExpanded(false);

    const onMove = (ev: MouseEvent) => {
      const maxW = Math.floor(window.innerWidth * 0.94);
      const maxH = Math.floor(window.innerHeight * 0.88);
      const nextW = axis.includes('x')
        ? Math.round(Math.max(420, Math.min(maxW, startW + (ev.clientX - startX) * 2)))
        : latest.width;
      const nextH = axis.includes('y')
        ? Math.round(Math.max(360, Math.min(maxH, startH + (ev.clientY - startY))))
        : latest.height;
      latest = { width: nextW, height: nextH };
      setCustomSize(latest);
    };

    const cleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      resizeCleanupRef.current = null;
    };

    const onUp = () => {
      cleanup();
      try {
        localStorage.setItem(INLINE_AI_MODAL_SIZE_KEY, JSON.stringify(latest));
      } catch {
        // ignore
      }
    };

    resizeCleanupRef.current = cleanup;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const isJa = t.actions.close === '閉じる';
  const modalStyle: React.CSSProperties | undefined = expanded
    ? { width: 'min(1040px, 94vw)', height: '84vh' }
    : customSize
      ? {
          width: `min(${customSize.width}px, 94vw)`,
          height: `min(${customSize.height}px, 88vh)`,
        }
      : undefined;
  const isResized = expanded || customSize !== null;

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        ref={modalRef}
        className={`inline-ai-modal ${isResized ? 'is-resized' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ai-diff-modal-header">
          <div className="ai-diff-modal-title-row">
            <Sparkles size={17} />
            <h3>{t.inlineAiModal.title}</h3>
          </div>
          <div className="ai-diff-modal-header-actions">
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setExpanded((v) => !v)}
              title={
                expanded
                  ? isJa
                    ? '元のサイズに戻す'
                    : 'Restore size'
                  : isJa
                    ? 'ウィンドウを拡大'
                    : 'Expand size'
              }
            >
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => !busy && onClose()}
              title={t.actions.close}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="inline-ai-body">
          <div className="inline-ai-meta">
            <span className="inline-ai-file-chip">
              {fileName} · {languageLabel}
            </span>
            <span className="inline-ai-stats">{selectionMetrics}</span>
          </div>

          <pre className="inline-ai-selection-preview">{selectedText}</pre>

          <div className="inline-ai-preset-header">
            <button
              type="button"
              className="mini-pill-btn"
              disabled={busy || !instruction.trim()}
              onClick={() => setAddingPreset((v) => !v)}
            >
              <BookmarkPlus size={12} />
              <span>{t.inlineAiModal.savePresetBtn}</span>
            </button>
            <div className="inline-ai-preset-header-right">
              {managingPresets && (
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={handleResetPresets}
                >
                  <RotateCcw size={11} />
                  <span>{t.inlineAiModal.resetPresetsBtn}</span>
                </button>
              )}
              <button
                type="button"
                className={`mini-pill-btn ${managingPresets ? 'is-active' : ''}`}
                onClick={() => setManagingPresets((v) => !v)}
              >
                <SlidersHorizontal size={11} />
                <span>
                  {managingPresets
                    ? t.inlineAiModal.doneManageBtn
                    : t.inlineAiModal.managePresetsBtn}
                </span>
              </button>
            </div>
          </div>

          {addingPreset && (
            <div className="inline-ai-add-preset-row">
              <input
                type="text"
                className="inline-ai-preset-name-input"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                placeholder={t.inlineAiModal.presetLabelPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNewPreset();
                  }
                }}
              />
              <button
                type="button"
                className="mini-pill-btn is-active"
                disabled={!newPresetLabel.trim() || !instruction.trim()}
                onClick={handleSaveNewPreset}
              >
                {t.actions.save}
              </button>
            </div>
          )}

          {managingPresets ? (
            <div className="inline-ai-manage-list">
              {presets.map((preset, idx) => (
                <div key={preset.id} className="inline-ai-manage-item">
                  <span className="inline-ai-manage-label">{preset.label}</span>
                  <div className="inline-ai-manage-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={idx === 0}
                      onClick={() => movePreset(idx, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={idx === presets.length - 1}
                      onClick={() => movePreset(idx, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn is-danger"
                      onClick={() => deletePreset(preset.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="inline-ai-presets">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`inline-ai-preset-btn ${!preset.isBuiltin ? 'is-custom' : ''}`}
                  disabled={busy}
                  onClick={() => setInstruction(preset.prompt)}
                  title={preset.prompt}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            className="inline-ai-textarea"
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t.inlineAiModal.instructionPlaceholder}
            disabled={busy}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void handleRun();
              }
            }}
          />

          <div className="inline-ai-compare-bar">
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={compareMode}
                disabled={busy}
                onChange={(e) => {
                  setCompareMode(e.target.checked);
                  setAbResults(null);
                }}
              />
              <span>
                {isJa ? '2モデル並列比較 (A/B)' : 'Compare 2 Models in Parallel (A/B)'}
              </span>
            </label>
            {compareMode && (
              <div className="inline-ai-compare-inputs">
                <span className="inline-ai-compare-tag">B:</span>
                <select
                  className="data-delimiter-select"
                  value={compareProviderB}
                  disabled={busy}
                  onChange={(e) => setCompareProviderB(e.target.value as AiProviderId)}
                >
                  {COMPARE_PROVIDER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="inline-ai-compare-model-input"
                  value={compareModelB}
                  disabled={busy}
                  onChange={(e) => setCompareModelB(e.target.value)}
                  placeholder={isJa ? 'モデル指定 (任意)' : 'Model (optional)'}
                />
              </div>
            )}
          </div>

          {busy && (
            <div className="inline-ai-progress-box" role="status" aria-live="polite">
              <div className="inline-ai-progress-row">
                <Loader2 size={13} className="spin-icon" />
                <span>
                  {compareMode
                    ? isJa
                      ? `${aiConfig.provider} と ${compareProviderB} を並列生成中… (${elapsedSecs}秒)`
                      : `Generating A/B (${aiConfig.provider} vs ${compareProviderB})… (${elapsedSecs}s)`
                    : isJa
                      ? `${aiConfig.provider} で生成中… (${elapsedSecs}秒)`
                      : `Generating with ${aiConfig.provider}… (${elapsedSecs}s)`}
                </span>
              </div>
              {progressText && (
                <div className="inline-ai-progress-detail">{progressText}</div>
              )}
              <div className="inline-ai-progress-bar">
                <div className="inline-ai-progress-bar-fill" />
              </div>
            </div>
          )}

          {abResults && (
            <div className="inline-ai-ab-grid">
              {abResults.map((cand, idx) => (
                <div key={idx} className="inline-ai-ab-card">
                  <div className="inline-ai-ab-head">
                    <span className="inline-ai-ab-badge">
                      {idx === 0 ? 'A' : 'B'}: {cand.provider}
                      {cand.modelUsed ? ` (${cand.modelUsed})` : ''}
                    </span>
                    <span className="inline-ai-ab-time">
                      {(cand.durationMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  {cand.error ? (
                    <div className="inline-ai-error">
                      <div>{cand.error.message}</div>
                      {cand.error.hint && (
                        <div className="inline-ai-error-hint">{cand.error.hint}</div>
                      )}
                    </div>
                  ) : (
                    <>
                      <pre className="inline-ai-ab-pre">{cand.text}</pre>
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ alignSelf: 'flex-end', padding: '4px 10px', fontSize: 12 }}
                        onClick={() => onResultReady(cand.text ?? '', instruction.trim())}
                      >
                        <Sparkles size={12} />
                        <span>{isJa ? 'この案を Diff で適用' : 'Apply with Diff'}</span>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {errorInfo && (
            <div className="inline-ai-error">
              <div>{errorInfo.message}</div>
              {errorInfo.hint && (
                <div className="inline-ai-error-hint">{errorInfo.hint}</div>
              )}
            </div>
          )}
        </div>

        <div className="ai-diff-modal-footer">
          <button
            type="button"
            className="secondary-btn"
            onClick={busy ? () => void handleCancelRequest() : onClose}
          >
            {busy && <Square size={12} />}
            <span>{t.actions.cancel}</span>
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={busy || !instruction.trim()}
            onClick={() => void handleRun()}
          >
            {busy ? <Loader2 size={14} className="spin-icon" /> : <Sparkles size={14} />}
            <span>{busy ? t.inlineAiModal.runningBtn : t.inlineAiModal.runBtn}</span>
          </button>
        </div>

        <div
          className="inline-ai-resize-edge-r"
          onMouseDown={(e) => startResize('x', e)}
          aria-hidden="true"
        />
        <div
          className="inline-ai-resize-edge-b"
          onMouseDown={(e) => startResize('y', e)}
          aria-hidden="true"
        />
        <div
          className="inline-ai-resize-corner"
          onMouseDown={(e) => startResize('xy', e)}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
