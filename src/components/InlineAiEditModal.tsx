import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles, Square, X } from 'lucide-react';
import type { AiProviderConfig, AiProviderId } from '../types';
import type { Translations } from '../i18n/types';
import { cancelAiChat, sendAiChat } from '../utils/platform';

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
  const requestIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setBusy(false);
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

  const presets = useMemo(
    () => [
      { label: t.inlineAiModal.presets.refactorLabel, prompt: t.inlineAiModal.presets.refactorPrompt },
      { label: t.inlineAiModal.presets.commentsLabel, prompt: t.inlineAiModal.presets.commentsPrompt },
      { label: t.inlineAiModal.presets.fixLabel, prompt: t.inlineAiModal.presets.fixPrompt },
      { label: t.inlineAiModal.presets.conciseLabel, prompt: t.inlineAiModal.presets.concisePrompt },
      { label: t.inlineAiModal.presets.politeLabel, prompt: t.inlineAiModal.presets.politePrompt },
      { label: t.inlineAiModal.presets.toJaLabel, prompt: t.inlineAiModal.presets.toJaPrompt },
      { label: t.inlineAiModal.presets.toEnLabel, prompt: t.inlineAiModal.presets.toEnPrompt },
    ],
    [t.inlineAiModal.presets]
  );

  if (!open) return null;

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

          <div className="inline-ai-presets">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="inline-ai-preset-btn"
                disabled={busy}
                onClick={() => setInstruction(preset.prompt)}
              >
                {preset.label}
              </button>
            ))}
          </div>

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
