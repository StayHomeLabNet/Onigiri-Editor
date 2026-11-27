import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileCode2,
  KeyRound,
  Paperclip,
  Search,
  Send,
  Shield,
  Sparkles,
  Square,
  Star,
  Terminal,
  X,
} from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  AiCapabilities,
  AiProviderConfig,
  AiProviderId,
  HarnessPermissionMode,
} from '../../types';
import { formatShortcut } from '../../utils/platform';

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
  onSelectProviderAndModel: (provider: AiProviderId, model: string) => void;
  onChangePermissionMode: (mode: HarnessPermissionMode) => void;
  onSend: (content: string, contextFiles: string[]) => void;
  onStop: () => void;
}

interface ProviderMeta {
  id: AiProviderId;
  shortLabel: string;
  label: string;
  badge: string;
  kind: 'cli' | 'api' | 'local';
  defaultModels: string[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'claude-cli',
    shortLabel: 'Claude',
    label: 'Claude Code (CLI)',
    badge: 'CL',
    kind: 'cli',
    defaultModels: ['sonnet', 'opus', 'haiku', 'claude-sonnet-4-5', 'claude-opus-4-1'],
  },
  {
    id: 'codex-cli',
    shortLabel: 'Codex',
    label: 'Codex (CLI)',
    badge: 'CX',
    kind: 'cli',
    defaultModels: ['gpt-5.4', 'gpt-5.3-codex', 'o4-mini', 'o3'],
  },
  {
    id: 'gemini-cli',
    shortLabel: 'Gemini CLI',
    label: 'Gemini CLI',
    badge: 'GM',
    kind: 'cli',
    defaultModels: ['auto', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    id: 'antigravity-cli',
    shortLabel: 'Antigravity',
    label: 'Antigravity CLI',
    badge: 'AG',
    kind: 'cli',
    defaultModels: ['auto'],
  },
  {
    id: 'openai-api',
    shortLabel: 'OpenAI',
    label: 'OpenAI API',
    badge: 'OA',
    kind: 'api',
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini', 'o3'],
  },
  {
    id: 'anthropic-api',
    shortLabel: 'Anthropic',
    label: 'Anthropic API',
    badge: 'AN',
    kind: 'api',
    defaultModels: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
  },
  {
    id: 'gemini-api',
    shortLabel: 'Gemini API',
    label: 'Gemini API',
    badge: 'GA',
    kind: 'api',
    defaultModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  },
  {
    id: 'ollama',
    shortLabel: 'Ollama',
    label: 'Ollama (Local)',
    badge: 'OL',
    kind: 'local',
    defaultModels: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'],
  },
  {
    id: 'lmstudio',
    shortLabel: 'LM Studio',
    label: 'LM Studio (Local)',
    badge: 'LM',
    kind: 'local',
    defaultModels: ['local-model'],
  },
  {
    id: 'openai-compat',
    shortLabel: 'Compatible',
    label: 'OpenAI-Compatible',
    badge: 'OC',
    kind: 'local',
    defaultModels: ['local-model'],
  },
  {
    id: 'apple-foundation-models',
    shortLabel: 'Apple AI',
    label: 'Apple Intelligence',
    badge: 'AP',
    kind: 'local',
    defaultModels: ['apple-on-device'],
  },
  {
    id: 'custom-cli',
    shortLabel: 'Custom CLI',
    label: 'Custom CLI',
    badge: 'SH',
    kind: 'cli',
    defaultModels: [''],
  },
];

function getProviderModels(
  providerId: AiProviderId,
  capabilities: AiCapabilities | null
): string[] {
  const meta = PROVIDERS.find((p) => p.id === providerId);
  const defaults = meta?.defaultModels ?? [];
  if (!capabilities) return defaults;

  let detected: string[] = [];
  switch (providerId) {
    case 'codex-cli':
      detected = capabilities.codexModels;
      break;
    case 'claude-cli':
      detected = capabilities.claudeModels;
      break;
    case 'gemini-cli':
      detected = capabilities.geminiModels;
      break;
    case 'antigravity-cli':
      detected = capabilities.antigravityModels;
      break;
    case 'ollama':
      detected = capabilities.ollamaModels;
      break;
    case 'lmstudio':
      detected = capabilities.lmstudioModels;
      break;
  }

  const merged = [...detected];
  for (const d of defaults) {
    if (d && !merged.includes(d)) merged.push(d);
  }
  return merged.length > 0 ? merged : defaults;
}

function isProviderDetected(
  providerId: AiProviderId,
  capabilities: AiCapabilities | null,
  aiConfig: AiProviderConfig
): boolean {
  if (!capabilities) return true;
  switch (providerId) {
    case 'claude-cli':
      return Boolean(capabilities.claudeCli);
    case 'codex-cli':
      return Boolean(capabilities.codexCli);
    case 'gemini-cli':
      return Boolean(capabilities.geminiCli);
    case 'antigravity-cli':
      return Boolean(capabilities.antigravityCli);
    case 'ollama':
      return capabilities.ollamaRunning || capabilities.ollamaInstalled;
    case 'lmstudio':
      return capabilities.lmstudioRunning || capabilities.lmstudioInstalled;
    case 'apple-foundation-models':
      return Boolean(capabilities.appleFoundationModelsAvailable);
    case 'openai-api':
    case 'anthropic-api':
    case 'gemini-api':
      return Boolean(aiConfig.apiKeys?.[providerId]?.trim());
    default:
      return true;
  }
}

export const HarnessComposer: React.FC<HarnessComposerProps> = ({
  t,
  disabled,
  isRunning,
  provider,
  model,
  permissionMode,
  aiConfig,
  capabilities,
  activeEditorFilePath,
  activeEditorFileTitle,
  initialDraft,
  onClearInitialDraft,
  onSelectProviderAndModel,
  onChangePermissionMode,
  onSend,
  onStop,
}) => {
  const [text, setText] = useState('');
  const [attachActiveFile, setAttachActiveFile] = useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false);
  const [permPopoverOpen, setPermPopoverOpen] = useState(false);
  const [railFilter, setRailFilter] = useState<'all' | AiProviderId>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const permPickerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialDraft && initialDraft.trim().length > 0) {
      setText(initialDraft);
      onClearInitialDraft?.();
    }
  }, [initialDraft, onClearInitialDraft]);

  useEffect(() => {
    if (!modelPopoverOpen && !permPopoverOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelPopoverOpen && modelPickerRef.current && !modelPickerRef.current.contains(target)) {
        setModelPopoverOpen(false);
      }
      if (permPopoverOpen && permPickerRef.current && !permPickerRef.current.contains(target)) {
        setPermPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModelPopoverOpen(false);
        setPermPopoverOpen(false);
      }
    };
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modelPopoverOpen, permPopoverOpen]);

  useEffect(() => {
    if (modelPopoverOpen) {
      setSearchQuery('');
      setRailFilter(railFilter === 'all' ? 'all' : (provider as AiProviderId));
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [modelPopoverOpen]);

  const currentProviderMeta =
    PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  const railProviders = useMemo(() => {
    return PROVIDERS.filter(
      (p) => p.id === provider || isProviderDetected(p.id, capabilities, aiConfig)
    );
  }, [provider, capabilities, aiConfig]);

  const modelEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const targetProviders =
      railFilter === 'all'
        ? railProviders
        : PROVIDERS.filter((p) => p.id === railFilter);

    const rows: Array<{
      providerId: AiProviderId;
      providerShort: string;
      modelId: string;
      displayName: string;
    }> = [];

    for (const p of targetProviders) {
      const models = getProviderModels(p.id, capabilities);
      const savedModel = aiConfig.models?.[p.id]?.trim();
      const allForP = savedModel && !models.includes(savedModel) ? [savedModel, ...models] : models;

      for (const m of allForP) {
        const display = m || 'Default';
        if (
          q &&
          !display.toLowerCase().includes(q) &&
          !p.shortLabel.toLowerCase().includes(q) &&
          !p.label.toLowerCase().includes(q)
        ) {
          continue;
        }
        rows.push({
          providerId: p.id,
          providerShort: p.shortLabel,
          modelId: m,
          displayName: display,
        });
      }
    }
    return rows;
  }, [railFilter, railProviders, capabilities, aiConfig.models, searchQuery]);

  const permOptions: Array<{ id: HarnessPermissionMode; label: string }> = [
    { id: 'plan', label: t.harness.permPlan },
    { id: 'approve-edits', label: t.harness.permApprove },
    { id: 'auto-edits', label: t.harness.permAuto },
    { id: 'full-access', label: t.harness.permFull },
  ];
  const currentPermLabel =
    permOptions.find((o) => o.id === permissionMode)?.label ?? t.harness.permAuto;

  const currentModelDisplay = model.trim()
    ? model.trim()
    : `${currentProviderMeta.shortLabel} (Auto)`;

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isRunning) return;
    const files =
      attachActiveFile && activeEditorFilePath ? [activeEditorFilePath] : [];
    onSend(trimmed, files);
    setText('');
  };

  const renderProviderIcon = (kind: ProviderMeta['kind']) => {
    if (kind === 'cli') return <Terminal size={13} />;
    if (kind === 'api') return <KeyRound size={13} />;
    return <Cpu size={13} />;
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
          placeholder={formatShortcut(t.harness.composerPlaceholder)}
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
            {/* Compact Model & Provider Picker Pill */}
            <div className="harness-picker-wrap" ref={modelPickerRef}>
              <button
                type="button"
                className={`harness-picker-pill ${modelPopoverOpen ? 'is-open' : ''}`}
                disabled={disabled || isRunning}
                onClick={() => {
                  setPermPopoverOpen(false);
                  setModelPopoverOpen((v) => !v);
                }}
                title={`${currentProviderMeta.label}${model ? ` · ${model}` : ''}`}
              >
                <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="harness-picker-pill-label">{currentModelDisplay}</span>
                {modelPopoverOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {modelPopoverOpen && (
                <div className="harness-model-popover" role="dialog" aria-label="Select AI Model">
                  <div className="harness-model-rail">
                    <button
                      type="button"
                      className={`harness-rail-btn ${railFilter === 'all' ? 'is-active' : ''}`}
                      onClick={() => setRailFilter('all')}
                      title="All Available"
                    >
                      <Star size={14} />
                    </button>
                    {PROVIDERS.map((p) => {
                      const active = railFilter === p.id;
                      const detected = isProviderDetected(p.id, capabilities, aiConfig);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`harness-rail-btn ${active ? 'is-active' : ''} ${
                            !detected ? 'is-dim' : ''
                          }`}
                          onClick={() => setRailFilter(p.id)}
                          title={p.label}
                        >
                          <span className="harness-rail-badge">{p.badge}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="harness-model-panel">
                    <div className="harness-model-search-row">
                      <Search size={13} style={{ color: 'var(--fg-secondary)', flexShrink: 0 }} />
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="harness-model-search-input"
                        placeholder="Search models..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchQuery.trim()) {
                            e.preventDefault();
                            const targetProv =
                              railFilter === 'all' ? (provider as AiProviderId) : railFilter;
                            onSelectProviderAndModel(targetProv, searchQuery.trim());
                            setModelPopoverOpen(false);
                          }
                        }}
                      />
                    </div>

                    <div className="harness-model-list">
                      {searchQuery.trim() &&
                        !modelEntries.some(
                          (e) => e.modelId.toLowerCase() === searchQuery.trim().toLowerCase()
                        ) && (
                          <button
                            type="button"
                            className="harness-model-row"
                            onClick={() => {
                              const targetProv =
                                railFilter === 'all' ? (provider as AiProviderId) : railFilter;
                              onSelectProviderAndModel(targetProv, searchQuery.trim());
                              setModelPopoverOpen(false);
                            }}
                          >
                            <Bot size={13} />
                            <span className="harness-model-row-name">
                              Use &quot;{searchQuery.trim()}&quot;
                            </span>
                            <span className="harness-model-row-prov">
                              {railFilter === 'all'
                                ? currentProviderMeta.shortLabel
                                : PROVIDERS.find((p) => p.id === railFilter)?.shortLabel}
                            </span>
                          </button>
                        )}

                      {modelEntries.map((item) => {
                        const isSelected =
                          item.providerId === provider && item.modelId === model;
                        const pMeta = PROVIDERS.find((p) => p.id === item.providerId);
                        return (
                          <button
                            key={`${item.providerId}::${item.modelId || 'default'}`}
                            type="button"
                            className={`harness-model-row ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              onSelectProviderAndModel(item.providerId, item.modelId);
                              setModelPopoverOpen(false);
                            }}
                          >
                            {renderProviderIcon(pMeta?.kind ?? 'cli')}
                            <span className="harness-model-row-name">{item.displayName}</span>
                            {isSelected && <Check size={13} style={{ color: 'var(--accent)' }} />}
                            {railFilter === 'all' && (
                              <span className="harness-model-row-prov">{item.providerShort}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Permission Mode Pill */}
            <div className="harness-picker-wrap" ref={permPickerRef}>
              <button
                type="button"
                className={`harness-picker-pill is-subtle ${permPopoverOpen ? 'is-open' : ''}`}
                disabled={disabled || isRunning}
                onClick={() => {
                  setModelPopoverOpen(false);
                  setPermPopoverOpen((v) => !v);
                }}
              >
                <Shield size={12} />
                <span>{currentPermLabel}</span>
                {permPopoverOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {permPopoverOpen && (
                <div className="harness-perm-popover" role="menu">
                  {permOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`harness-model-row ${opt.id === permissionMode ? 'is-selected' : ''}`}
                      onClick={() => {
                        onChangePermissionMode(opt.id);
                        setPermPopoverOpen(false);
                      }}
                    >
                      <span className="harness-model-row-name">{opt.label}</span>
                      {opt.id === permissionMode && (
                        <Check size={13} style={{ color: 'var(--accent)' }} />
                      )}
                    </button>
                  ))}
                </div>
              )}
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
