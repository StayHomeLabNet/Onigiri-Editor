import React, { useEffect, useState } from 'react';
import {
  FileCode2,
  Paperclip,
  Send,
  Shield,
  Square,
  X,
} from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  AiCapabilities,
  AiProviderConfig,
  AiProviderId,
  HarnessPermissionMode,
} from '../../types';

interface HarnessComposerProps {
  t: Translations;
  disabled: boolean;
  isRunning: boolean;
  provider: string;
  model: string;
  permissionMode: HarnessPermissionMode;
  aiConfig: AiProviderConfig;
  capabilities: AiCapabilities | null;
  activeEditorFilePath?: string | null;
  activeEditorFileTitle?: string;
  initialDraft?: string;
  onClearInitialDraft?: () => void;
  onChangeProvider: (provider: AiProviderId) => void;
  onChangeModel: (model: string) => void;
  onChangePermissionMode: (mode: HarnessPermissionMode) => void;
  onSend: (content: string, contextFiles: string[]) => void;
  onStop: () => void;
}

const PROVIDER_OPTIONS: Array<{ id: AiProviderId; label: string }> = [
  { id: 'claude-cli', label: 'Claude Code (CLI)' },
  { id: 'codex-cli', label: 'Codex (CLI)' },
  { id: 'gemini-cli', label: 'Gemini CLI' },
  { id: 'antigravity-cli', label: 'Antigravity CLI' },
  { id: 'openai-api', label: 'OpenAI API' },
  { id: 'anthropic-api', label: 'Anthropic API' },
  { id: 'gemini-api', label: 'Gemini API' },
  { id: 'ollama', label: 'Ollama (Local)' },
  { id: 'lmstudio', label: 'LM Studio (Local)' },
  { id: 'openai-compat', label: 'OpenAI-Compatible' },
  { id: 'apple-foundation-models', label: 'Apple Intelligence' },
  { id: 'custom-cli', label: 'Custom CLI' },
];

export const HarnessComposer: React.FC<HarnessComposerProps> = ({
  t,
  disabled,
  isRunning,
  provider,
  model,
  permissionMode,
  capabilities,
  activeEditorFilePath,
  activeEditorFileTitle,
  initialDraft,
  onClearInitialDraft,
  onChangeProvider,
  onChangeModel,
  onChangePermissionMode,
  onSend,
  onStop,
}) => {
  const [text, setText] = useState('');
  const [attachActiveFile, setAttachActiveFile] = useState(false);

  useEffect(() => {
    if (initialDraft && initialDraft.trim().length > 0) {
      setText(initialDraft);
      onClearInitialDraft?.();
    }
  }, [initialDraft, onClearInitialDraft]);

  const suggestedModels = (() => {
    if (!capabilities) return [];
    switch (provider) {
      case 'codex-cli':
        return capabilities.codexModels;
      case 'claude-cli':
        return capabilities.claudeModels;
      case 'gemini-cli':
        return capabilities.geminiModels;
      case 'antigravity-cli':
        return capabilities.antigravityModels;
      case 'ollama':
        return capabilities.ollamaModels;
      case 'lmstudio':
        return capabilities.lmstudioModels;
      default:
        return [];
    }
  })();

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isRunning) return;
    const files =
      attachActiveFile && activeEditorFilePath ? [activeEditorFilePath] : [];
    onSend(trimmed, files);
    setText('');
  };

  return (
    <div className="harness-composer-wrap">
      <div className="harness-composer-box">
        {attachActiveFile && activeEditorFilePath && (
          <div className="harness-context-chips" style={{ marginTop: 0 }}>
            <span className="harness-file-chip">
              <FileCode2 size={11} />
              <span>{activeEditorFileTitle || activeEditorFilePath.split(/[/\\]/).pop()}</span>
              <button
                type="button"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                }}
                onClick={() => setAttachActiveFile(false)}
              >
                <X size={11} />
              </button>
            </span>
          </div>
        )}

        <textarea
          className="harness-composer-textarea"
          value={text}
          disabled={disabled}
          placeholder={t.harness.composerPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        <div className="harness-composer-footer">
          <div className="harness-composer-controls">
            <select
              className="harness-select"
              value={provider}
              disabled={disabled || isRunning}
              onChange={(e) => onChangeProvider(e.target.value as AiProviderId)}
              aria-label="AI Provider"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              list="harness-model-suggestions"
              className="harness-model-input"
              value={model}
              disabled={disabled || isRunning}
              placeholder="model (auto)"
              onChange={(e) => onChangeModel(e.target.value)}
              aria-label="Model"
            />
            <datalist id="harness-model-suggestions">
              {suggestedModels.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Shield size={12} style={{ color: 'var(--fg-muted)' }} />
              <select
                className="harness-select"
                value={permissionMode}
                disabled={disabled || isRunning}
                onChange={(e) =>
                  onChangePermissionMode(e.target.value as HarnessPermissionMode)
                }
                aria-label="Permission Mode"
              >
                <option value="plan">{t.harness.permPlan}</option>
                <option value="approve-edits">{t.harness.permApprove}</option>
                <option value="auto-edits">{t.harness.permAuto}</option>
                <option value="full-access">{t.harness.permFull}</option>
              </select>
            </div>

            {activeEditorFilePath && (
              <button
                type="button"
                className={`mini-pill-btn ${attachActiveFile ? 'is-active' : ''}`}
                disabled={disabled}
                onClick={() => setAttachActiveFile((v) => !v)}
                title={activeEditorFilePath}
              >
                <Paperclip size={11} />
                <span>{t.harness.attachActiveFile}</span>
              </button>
            )}
          </div>

          <div>
            {isRunning ? (
              <button type="button" className="harness-stop-btn" onClick={onStop}>
                <Square size={12} />
                <span>{t.harness.stopBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                className="harness-send-btn"
                disabled={disabled || !text.trim()}
                onClick={handleSubmit}
              >
                <Send size={12} />
                <span>{t.harness.sendBtn}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
