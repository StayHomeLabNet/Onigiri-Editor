import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkPlus, Loader2, RotateCcw, SlidersHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react';
import type { AiProviderConfig, AiProviderId, InlineAiPresetItem } from '../types';
import type { Translations } from '../i18n/types';
import { cancelAiChat, sendAiChat } from '../utils/platform';

export const INLINE_AI_PRESETS_KEY = 'onigiri-markdown.inline-ai-presets.v1';

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
  onClose: () => void;
  onResultReady: (proposedText: string, instruction: string) => void;
}

export const InlineAiEditModal: React.FC<InlineAiEditModalProps> = ({
  t,
  open,
  selectedText,
  fileName,
  languageLabel,
  aiConfig,
  workspaceRoot,
  onClose,
  onResultReady,
}) => {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [presets, setPresets] = useState<InlineAiPresetItem[]>(() => loadSavedPresets(t));
  const [managingPresets, setManagingPresets] = useState(false);
  const [addingPreset, setAddingPreset] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const requestIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const skipNextPersistRef = useRef(true);

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
    setErrorMsg(null);
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

    const reqId = `inline-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    requestIdRef.current = reqId;
    cancelledRef.current = false;
    setBusy(true);
    setErrorMsg(null);

    const effectiveModel =
      aiConfig.model.trim() || DEFAULT_MODELS[aiConfig.provider] || '';

    const systemPrompt = [
      'You are performing an inline text/code transformation on a selected fragment inside an editor.',
      `File: ${fileName} (${languageLabel})`,
      'Return ONLY the replacement text for the selected fragment.',
      'Do not include explanations, preambles, or surrounding markdown code fences unless the original selection itself uses them.',
      'Preserve surrounding indentation and style conventions unless instructed otherwise.',
    ].join('\n');

    const userPrompt = `Instruction:\n${trimmed}\n\nSelected text:\n<<<SELECTION\n${selectedText}\nSELECTION>>>`;

    try {
      const res = await sendAiChat({
        requestId: reqId,
        provider: aiConfig.provider,
        model: effectiveModel || undefined,
        apiKey: aiConfig.apiKeys[aiConfig.provider],
        baseUrl:
          aiConfig.baseUrls[aiConfig.provider] || DEFAULT_BASE_URLS[aiConfig.provider],
        customCliCmd: aiConfig.customCliCmd,
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        workspaceDir: workspaceRoot,
        allowWorkspaceWrite: false,
      });

      if (cancelledRef.current) return;
      const cleaned = stripSingleMarkdownFence(res.content, selectedText);
      onResultReady(cleaned, trimmed);
    } catch (err) {
      if (cancelledRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg !== 'CLI_CANCELLED') {
        setErrorMsg(msg);
      }
    } finally {
      requestIdRef.current = null;
      setBusy(false);
    }
  };

  const handleCancelRequest = async () => {
    cancelledRef.current = true;
    const reqId = requestIdRef.current;
    if (reqId) {
      await cancelAiChat(reqId).catch(() => {});
    }
    setBusy(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="inline-ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-diff-modal-header">
          <div className="ai-diff-modal-title-row">
            <Sparkles size={17} />
            <h3>{t.inlineAiModal.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => !busy && onClose()}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
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

          {errorMsg && <div className="inline-ai-error">{errorMsg}</div>}
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
      </div>
    </div>
  );
};
