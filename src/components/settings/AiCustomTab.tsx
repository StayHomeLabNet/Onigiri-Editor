import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Info,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AiCustomIcon } from '../AiCustomIcon';
import type { Translations } from '../../i18n/types';
import type {
  AiCapabilities,
  AiCustomButton,
  AiCustomButtonIconId,
  AiCustomSubmenuItem,
  AiProviderConfig,
  AiProviderId,
  EditorSettings,
  Locale,
} from '../../types';
import {
  AI_CUSTOM_ICON_OPTIONS,
  AI_CUSTOM_PROVIDER_GROUPS,
  AI_PROMPT_VARIABLE_TOKENS,
  AI_PROVIDER_LABELS,
  MAX_AI_CUSTOM_BUTTONS,
  MAX_AI_CUSTOM_SUBMENU_ITEMS,
  cloneDefaultAiCustomButtons,
  createNewAiCustomButton,
  createNewAiCustomSubmenuItem,
  getModelsForAiProvider,
} from '../../utils/aiCustomButtons';
import {
  formatKeybindingForDisplay,
  getAiCustomButtonKeybindingId,
  getAiCustomSubmenuKeybindingId,
} from '../../utils/keybindings';

interface AiCustomTabProps {
  t: Translations;
  locale: Locale;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  aiCustomButtons: AiCustomButton[];
  aiConfig?: AiProviderConfig;
  aiCapabilities: AiCapabilities | null;
  detectingAiModels: boolean;
  onRefreshAiCapabilities: () => Promise<void>;
  customKeybindings: Record<string, string>;
  onCustomKeybindingsChange?: (next: Record<string, string>) => void;
  recordingCmdId: string | null;
  setRecordingCmdId: (id: string | null) => void;
  effectiveKeybindings: Record<string, string>;
  keybindingConflicts: Record<string, string[]>;
  keybindingLabelById: Record<string, string>;
}

export const AiCustomTab: React.FC<AiCustomTabProps> = ({
  t,
  locale,
  settings,
  onSettingsChange,
  aiCustomButtons,
  aiConfig,
  aiCapabilities,
  detectingAiModels,
  onRefreshAiCapabilities,
  customKeybindings,
  onCustomKeybindingsChange,
  recordingCmdId,
  setRecordingCmdId,
  effectiveKeybindings,
  keybindingConflicts,
  keybindingLabelById,
}) => {
  const [openIconPickerId, setOpenIconPickerId] = useState<string | null>(null);

  const updateAiCustomButtons = (next: AiCustomButton[]) => {
    onSettingsChange({
      ...settings,
      aiCustomButtons: next.slice(0, MAX_AI_CUSTOM_BUTTONS),
    });
  };

  const handleAddAiCustomButton = () => {
    if (aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS) return;
    const created = createNewAiCustomButton(aiCustomButtons.length, locale);
    updateAiCustomButtons([...aiCustomButtons, created]);
  };

  const handlePatchAiCustomButton = (id: string, patch: Partial<AiCustomButton>) => {
    updateAiCustomButtons(
      aiCustomButtons.map((btn) => (btn.id === id ? { ...btn, ...patch } : btn))
    );
  };

  const handleMoveAiCustomButton = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= aiCustomButtons.length) return;
    const next = [...aiCustomButtons];
    const [moved] = next.splice(index, 1);
    next.splice(nextIdx, 0, moved);
    updateAiCustomButtons(next);
  };

  const handleDeleteAiCustomButton = (id: string) => {
    if (openIconPickerId === id || openIconPickerId?.startsWith(`${id}::`)) {
      setOpenIconPickerId(null);
    }
    updateAiCustomButtons(aiCustomButtons.filter((btn) => btn.id !== id));
  };

  const handleToggleAiCustomSubmenu = (btn: AiCustomButton, enabled: boolean) => {
    const existing = btn.submenuItems ?? [];
    const nextItems =
      enabled && existing.length === 0 ? [createNewAiCustomSubmenuItem(0, locale)] : existing;
    handlePatchAiCustomButton(btn.id, {
      submenuEnabled: enabled,
      submenuItems: nextItems,
    });
  };

  const handleAddAiCustomSubmenuItem = (btn: AiCustomButton) => {
    const existing = btn.submenuItems ?? [];
    if (existing.length >= MAX_AI_CUSTOM_SUBMENU_ITEMS) return;
    handlePatchAiCustomButton(btn.id, {
      submenuItems: [...existing, createNewAiCustomSubmenuItem(existing.length, locale)],
    });
  };

  const handlePatchAiCustomSubmenuItem = (
    btn: AiCustomButton,
    subId: string,
    patch: Partial<AiCustomSubmenuItem>
  ) => {
    const existing = btn.submenuItems ?? [];
    handlePatchAiCustomButton(btn.id, {
      submenuItems: existing.map((item) => (item.id === subId ? { ...item, ...patch } : item)),
    });
  };

  const handleMoveAiCustomSubmenuItem = (
    btn: AiCustomButton,
    subIndex: number,
    delta: -1 | 1
  ) => {
    const existing = btn.submenuItems ?? [];
    const nextIdx = subIndex + delta;
    if (nextIdx < 0 || nextIdx >= existing.length) return;
    const next = [...existing];
    const [moved] = next.splice(subIndex, 1);
    next.splice(nextIdx, 0, moved);
    handlePatchAiCustomButton(btn.id, { submenuItems: next });
  };

  const handleDeleteAiCustomSubmenuItem = (btn: AiCustomButton, subId: string) => {
    const pickerKey = `${btn.id}::${subId}`;
    if (openIconPickerId === pickerKey) setOpenIconPickerId(null);
    const existing = btn.submenuItems ?? [];
    handlePatchAiCustomButton(btn.id, {
      submenuItems: existing.filter((item) => item.id !== subId),
    });
  };

  const handleResetAiCustomButtons = () => {
    setOpenIconPickerId(null);
    updateAiCustomButtons(cloneDefaultAiCustomButtons(locale));
  };

  const renderAiModelOverrideRow = (
    currentProvider: AiProviderId | undefined,
    currentModel: string | undefined,
    onPatch: (patch: { aiProvider?: AiProviderId; aiModel?: string }) => void
  ) => {
    const models = currentProvider
      ? getModelsForAiProvider(currentProvider, aiCapabilities, aiConfig)
      : [];
    const curModel = currentModel ?? '';
    const isCustomVal = curModel !== '' && !models.includes(curModel);
    return (
      <div className="field-row">
        <label>{t.settingsModal.aiCustom.aiModelOverrideLabel}</label>
        <div className="ai-custom-model-grid">
          <select
            className="select-input"
            value={currentProvider ?? ''}
            onChange={(e) => {
              const nextProv = (e.target.value || undefined) as AiProviderId | undefined;
              if (!nextProv) {
                onPatch({ aiProvider: undefined, aiModel: undefined });
              } else {
                const candidates = getModelsForAiProvider(nextProv, aiCapabilities, aiConfig);
                onPatch({ aiProvider: nextProv, aiModel: candidates[0] || '' });
              }
            }}
          >
            <option value="">
              {t.settingsModal.aiCustom.followAiChatOption}
              {aiConfig
                ? ` (${AI_PROVIDER_LABELS[aiConfig.provider] || aiConfig.provider}${
                    aiConfig.model ? ` / ${aiConfig.model}` : ''
                  })`
                : ''}
            </option>
            {AI_CUSTOM_PROVIDER_GROUPS.map((grp) => {
              const groupLabel =
                grp.group === 'subscription'
                  ? t.settingsModal.aiCustom.providerGroupSubscription
                  : grp.group === 'api'
                    ? t.settingsModal.aiCustom.providerGroupApi
                    : t.settingsModal.aiCustom.providerGroupLocal;
              return (
                <optgroup key={grp.group} label={groupLabel}>
                  {grp.providers.map((pid) => (
                    <option key={pid} value={pid}>
                      {AI_PROVIDER_LABELS[pid]}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>

          {currentProvider && (
            <div className="ai-custom-model-picker">
              {models.length > 0 && (
                <select
                  className="select-input"
                  value={
                    currentProvider === 'apple-foundation-models'
                      ? curModel === 'permissive'
                        ? 'permissive'
                        : 'default'
                      : isCustomVal
                        ? '__custom__'
                        : curModel || models[0] || ''
                  }
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      onPatch({ aiModel: curModel || '' });
                    } else {
                      onPatch({ aiModel: e.target.value });
                    }
                  }}
                  aria-label={t.settingsModal.aiCustom.modelSelectLabel}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {currentProvider === 'apple-foundation-models'
                        ? m === 'permissive'
                          ? t.aiChat.appleFmModelPermissive
                          : t.aiChat.appleFmModelDefault
                        : m}
                    </option>
                  ))}
                  {currentProvider !== 'apple-foundation-models' && (
                    <option value="__custom__">
                      {t.settingsModal.aiCustom.customModelOption}
                    </option>
                  )}
                </select>
              )}
              {currentProvider !== 'apple-foundation-models' &&
                (models.length === 0 || isCustomVal) && (
                  <input
                    type="text"
                    className="text-input"
                    value={curModel}
                    placeholder={t.settingsModal.aiCustom.customModelPlaceholder}
                    onChange={(e) => onPatch({ aiModel: e.target.value })}
                  />
                )}
            </div>
          )}
        </div>
        {currentProvider &&
          ['openai-api', 'anthropic-api', 'gemini-api'].includes(currentProvider) &&
          !aiConfig?.apiKeys?.[currentProvider] && (
            <div className="ai-hint-text" style={{ marginTop: 4 }}>
              {t.settingsModal.aiCustom.apiKeyMissingHint}
            </div>
          )}
        {currentProvider === 'ollama' &&
          aiCapabilities &&
          (!aiCapabilities.ollamaRunning || aiCapabilities.ollamaModels.length === 0) && (
            <div className="ai-hint-text" style={{ marginTop: 4 }}>
              {t.settingsModal.aiCustom.localServerOfflineHint}
            </div>
          )}
        {currentProvider === 'lmstudio' &&
          aiCapabilities &&
          (!aiCapabilities.lmstudioRunning || aiCapabilities.lmstudioModels.length === 0) && (
            <div className="ai-hint-text" style={{ marginTop: 4 }}>
              {t.settingsModal.aiCustom.localServerOfflineHint}
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="ai-custom-top-header">
          <div>
            <div className="settings-data-card-title">
              <Wand2 size={14} />
              <span>{t.settingsModal.aiCustom.title}</span>
              <span className="ai-custom-count-badge">
                {aiCustomButtons.length} / {MAX_AI_CUSTOM_BUTTONS}
              </span>
            </div>
            <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
              {t.settingsModal.aiCustom.desc}
            </p>
          </div>
          <div className="ai-custom-top-actions">
            <button
              type="button"
              className="secondary-btn compact-btn"
              disabled={detectingAiModels}
              onClick={() => void onRefreshAiCapabilities()}
            >
              <RefreshCw size={12} className={detectingAiModels ? 'spin' : ''} />
              <span>{t.settingsModal.aiCustom.refreshModelsBtn}</span>
            </button>
            <button
              type="button"
              className="secondary-btn compact-btn"
              onClick={handleResetAiCustomButtons}
            >
              <RotateCcw size={12} />
              <span>{t.settingsModal.aiCustom.resetDefaultsBtn}</span>
            </button>
            <button
              type="button"
              className="primary-btn compact-btn"
              disabled={aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS}
              onClick={handleAddAiCustomButton}
              title={
                aiCustomButtons.length >= MAX_AI_CUSTOM_BUTTONS
                  ? t.settingsModal.aiCustom.maxReachedHint
                  : undefined
              }
            >
              <Plus size={13} />
              <span>{t.settingsModal.aiCustom.addBtn}</span>
            </button>
          </div>
        </div>
        <div className="platform-hint-note">
          <Info size={12} />
          <span>{t.settingsModal.aiCustom.providerHint}</span>
        </div>
      </div>

      {aiCustomButtons.length === 0 ? (
        <div className="settings-card ai-custom-empty">
          <p className="ai-hint-text" style={{ margin: 0 }}>
            {t.settingsModal.aiCustom.emptyState}
          </p>
        </div>
      ) : (
        aiCustomButtons.map((btn, idx) => {
          const iconPickerOpen = openIconPickerId === btn.id;
          const noOutputSelected = !btn.copyToClipboard && !btn.replaceContent;
          return (
            <div key={btn.id} className="settings-card ai-custom-card">
              <div className="ai-custom-card-header">
                <div className="ai-custom-card-title">
                  <span className="ai-custom-slot-badge">
                    {t.settingsModal.aiCustom.slotLabel.replace('{n}', String(idx + 1))}
                  </span>
                  <span className="ai-custom-preview-chip" title={btn.name || undefined}>
                    <AiCustomIcon icon={btn.icon} size={14} />
                    <span>{btn.name.trim() || t.settingsModal.aiCustom.defaultButtonName}</span>
                  </span>
                </div>
                <div className="ai-custom-card-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={idx === 0}
                    onClick={() => handleMoveAiCustomButton(idx, -1)}
                    title={t.settingsModal.aiCustom.moveUpTitle}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={idx === aiCustomButtons.length - 1}
                    onClick={() => handleMoveAiCustomButton(idx, 1)}
                    title={t.settingsModal.aiCustom.moveDownTitle}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn is-danger"
                    onClick={() => handleDeleteAiCustomButton(btn.id)}
                    title={t.settingsModal.aiCustom.deleteTitle}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="ai-custom-row-main">
                <div className="field-row ai-custom-icon-field">
                  <label>{t.settingsModal.aiCustom.iconLabel}</label>
                  <button
                    type="button"
                    className={`ai-custom-icon-trigger ${iconPickerOpen ? 'is-open' : ''}`}
                    onClick={() => setOpenIconPickerId((cur) => (cur === btn.id ? null : btn.id))}
                    title={t.settingsModal.aiCustom.chooseIconTitle}
                  >
                    <AiCustomIcon icon={btn.icon} size={15} />
                    <ChevronDown size={12} />
                  </button>
                </div>

                <div className="field-row ai-custom-name-field">
                  <label>{t.settingsModal.aiCustom.nameLabel}</label>
                  <input
                    type="text"
                    className="text-input"
                    value={btn.name}
                    placeholder={t.settingsModal.aiCustom.namePlaceholder}
                    onChange={(e) => handlePatchAiCustomButton(btn.id, { name: e.target.value })}
                  />
                </div>
              </div>

              {iconPickerOpen && (
                <div className="ai-custom-icon-grid" role="listbox">
                  {AI_CUSTOM_ICON_OPTIONS.map((opt) => {
                    const selected = btn.icon === opt.id;
                    const optLabel = locale === 'ja' ? opt.labelJa : opt.labelEn;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`ai-custom-icon-option ${selected ? 'is-selected' : ''}`}
                        title={optLabel}
                        aria-label={optLabel}
                        aria-selected={selected}
                        onClick={() => {
                          handlePatchAiCustomButton(btn.id, {
                            icon: opt.id as AiCustomButtonIconId,
                          });
                          setOpenIconPickerId(null);
                        }}
                      >
                        <AiCustomIcon icon={opt.id} size={15} />
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="field-row">
                <label>{t.settingsModal.aiCustom.promptLabel}</label>
                <textarea
                  className="text-input ai-custom-prompt-textarea"
                  rows={4}
                  value={btn.prompt}
                  placeholder={t.settingsModal.aiCustom.promptPlaceholder}
                  onChange={(e) => handlePatchAiCustomButton(btn.id, { prompt: e.target.value })}
                />
                <div className="ai-prompt-vars-row">
                  <span className="ai-prompt-vars-label">
                    {locale === 'ja' ? '変数挿入:' : 'Variables:'}
                  </span>
                  {AI_PROMPT_VARIABLE_TOKENS.map((v) => (
                    <button
                      key={v.token}
                      type="button"
                      className="ai-prompt-var-chip"
                      onClick={() =>
                        handlePatchAiCustomButton(btn.id, {
                          prompt: `${btn.prompt}${btn.prompt && !btn.prompt.endsWith(' ') && !btn.prompt.endsWith('\n') ? ' ' : ''}${v.token}`,
                        })
                      }
                      title={locale === 'ja' ? `${v.labelJa} を挿入` : `Insert ${v.labelEn}`}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-row">
                <label>{t.settingsModal.aiCustom.outputHandlingLabel}</label>
                <div className="ai-custom-output-checks">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={btn.copyToClipboard}
                      onChange={(e) =>
                        handlePatchAiCustomButton(btn.id, {
                          copyToClipboard: e.target.checked,
                        })
                      }
                    />
                    <span>{t.settingsModal.aiCustom.copyToClipboardLabel}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={btn.replaceContent}
                      onChange={(e) =>
                        handlePatchAiCustomButton(btn.id, {
                          replaceContent: e.target.checked,
                        })
                      }
                    />
                    <span>{t.settingsModal.aiCustom.replaceContentLabel}</span>
                  </label>
                </div>
                {noOutputSelected && (
                  <div className="ai-custom-warn">
                    <AlertTriangle size={12} />
                    <span>{t.settingsModal.aiCustom.noOutputWarning}</span>
                  </div>
                )}
              </div>

              {renderAiModelOverrideRow(btn.aiProvider, btn.aiModel, (patch) =>
                handlePatchAiCustomButton(btn.id, patch)
              )}

              {onCustomKeybindingsChange &&
                (() => {
                  const kbId = getAiCustomButtonKeybindingId(btn.id);
                  const currentBinding = effectiveKeybindings[kbId] || '';
                  const isRecording = recordingCmdId === kbId;
                  const conflictIds = keybindingConflicts[kbId] || [];
                  const conflictNames = conflictIds
                    .map((cid) => keybindingLabelById[cid] || cid)
                    .join(', ');
                  return (
                    <div className="field-row">
                      <label>{t.settingsModal.aiCustom.shortcutLabel}</label>
                      <div
                        className={`ai-custom-shortcut-row ${isRecording ? 'is-recording' : ''} ${
                          conflictIds.length > 0 ? 'has-conflict' : ''
                        }`}
                      >
                        <div className="ai-custom-shortcut-controls">
                          <kbd className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}>
                            {isRecording
                              ? t.settingsModal.keybindings.pressKeysPrompt
                              : currentBinding
                                ? formatKeybindingForDisplay(currentBinding)
                                : t.settingsModal.keybindings.unassigned}
                          </kbd>
                          {conflictIds.length > 0 && (
                            <span className="keybinding-conflict">
                              <AlertTriangle size={11} />
                              {t.settingsModal.keybindings.conflictWarning.replace(
                                '{others}',
                                conflictNames
                              )}
                            </span>
                          )}
                        </div>
                        <div className="ai-custom-shortcut-controls">
                          <button
                            type="button"
                            className="mini-pill-btn"
                            onClick={() => setRecordingCmdId(isRecording ? null : kbId)}
                          >
                            {isRecording
                              ? t.settingsModal.keybindings.cancelRecordBtn
                              : t.settingsModal.keybindings.editBtn}
                          </button>
                          {currentBinding && (
                            <button
                              type="button"
                              className="mini-pill-btn"
                              onClick={() => {
                                setRecordingCmdId(null);
                                const next = { ...customKeybindings };
                                delete next[kbId];
                                onCustomKeybindingsChange(next);
                              }}
                            >
                              {t.settingsModal.keybindings.clearBtn}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <div className="ai-custom-submenu-section">
                <div className="ai-custom-submenu-toggle-row">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(btn.submenuEnabled)}
                      onChange={(e) => handleToggleAiCustomSubmenu(btn, e.target.checked)}
                    />
                    <span>{t.settingsModal.aiCustom.submenuEnableLabel}</span>
                  </label>
                  {btn.submenuEnabled && (
                    <div className="ai-custom-submenu-header-actions">
                      <span className="ai-custom-count-badge">
                        {(btn.submenuItems ?? []).length} / {MAX_AI_CUSTOM_SUBMENU_ITEMS}
                      </span>
                      <button
                        type="button"
                        className="secondary-btn compact-btn"
                        disabled={(btn.submenuItems ?? []).length >= MAX_AI_CUSTOM_SUBMENU_ITEMS}
                        onClick={() => handleAddAiCustomSubmenuItem(btn)}
                        title={
                          (btn.submenuItems ?? []).length >= MAX_AI_CUSTOM_SUBMENU_ITEMS
                            ? t.settingsModal.aiCustom.submenuMaxReachedHint
                            : undefined
                        }
                      >
                        <Plus size={12} />
                        <span>{t.settingsModal.aiCustom.submenuAddBtn}</span>
                      </button>
                    </div>
                  )}
                </div>

                {btn.submenuEnabled && (
                  <div className="ai-custom-submenu-list">
                    {(btn.submenuItems ?? []).length === 0 ? (
                      <div className="ai-custom-submenu-empty">
                        <span className="ai-hint-text">
                          {t.settingsModal.aiCustom.submenuEmptyState}
                        </span>
                      </div>
                    ) : (
                      (btn.submenuItems ?? []).map((sub, subIdx) => {
                        const subPickerKey = `${btn.id}::${sub.id}`;
                        const subIconPickerOpen = openIconPickerId === subPickerKey;
                        const subNoOutputSelected = !sub.copyToClipboard && !sub.replaceContent;
                        return (
                          <div key={sub.id} className="ai-custom-submenu-card">
                            <div className="ai-custom-card-header">
                              <div className="ai-custom-card-title">
                                <span className="ai-custom-slot-badge">
                                  {t.settingsModal.aiCustom.submenuSlotLabel.replace(
                                    '{n}',
                                    String(subIdx + 1)
                                  )}
                                </span>
                                <span
                                  className="ai-custom-preview-chip"
                                  title={sub.name || undefined}
                                >
                                  <AiCustomIcon icon={sub.icon} size={13} />
                                  <span>
                                    {sub.name.trim() || t.settingsModal.aiCustom.submenuDefaultName}
                                  </span>
                                </span>
                              </div>
                              <div className="ai-custom-card-actions">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={subIdx === 0}
                                  onClick={() => handleMoveAiCustomSubmenuItem(btn, subIdx, -1)}
                                  title={t.settingsModal.aiCustom.moveUpTitle}
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  disabled={subIdx === (btn.submenuItems ?? []).length - 1}
                                  onClick={() => handleMoveAiCustomSubmenuItem(btn, subIdx, 1)}
                                  title={t.settingsModal.aiCustom.moveDownTitle}
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn is-danger"
                                  onClick={() => handleDeleteAiCustomSubmenuItem(btn, sub.id)}
                                  title={t.settingsModal.aiCustom.deleteTitle}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div className="ai-custom-row-main">
                              <div className="field-row ai-custom-icon-field">
                                <label>{t.settingsModal.aiCustom.iconLabel}</label>
                                <button
                                  type="button"
                                  className={`ai-custom-icon-trigger ${subIconPickerOpen ? 'is-open' : ''}`}
                                  onClick={() =>
                                    setOpenIconPickerId((cur) =>
                                      cur === subPickerKey ? null : subPickerKey
                                    )
                                  }
                                  title={t.settingsModal.aiCustom.chooseIconTitle}
                                >
                                  <AiCustomIcon icon={sub.icon} size={15} />
                                  <ChevronDown size={12} />
                                </button>
                              </div>

                              <div className="field-row ai-custom-name-field">
                                <label>{t.settingsModal.aiCustom.submenuNameLabel}</label>
                                <input
                                  type="text"
                                  className="text-input"
                                  value={sub.name}
                                  placeholder={t.settingsModal.aiCustom.submenuNamePlaceholder}
                                  onChange={(e) =>
                                    handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {subIconPickerOpen && (
                              <div className="ai-custom-icon-grid" role="listbox">
                                {AI_CUSTOM_ICON_OPTIONS.map((opt) => {
                                  const selected = sub.icon === opt.id;
                                  const optLabel = locale === 'ja' ? opt.labelJa : opt.labelEn;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      className={`ai-custom-icon-option ${selected ? 'is-selected' : ''}`}
                                      title={optLabel}
                                      aria-label={optLabel}
                                      aria-selected={selected}
                                      onClick={() => {
                                        handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                          icon: opt.id as AiCustomButtonIconId,
                                        });
                                        setOpenIconPickerId(null);
                                      }}
                                    >
                                      <AiCustomIcon icon={opt.id} size={15} />
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            <div className="field-row">
                              <label>{t.settingsModal.aiCustom.promptLabel}</label>
                              <textarea
                                className="text-input ai-custom-prompt-textarea is-compact"
                                rows={3}
                                value={sub.prompt}
                                placeholder={t.settingsModal.aiCustom.promptPlaceholder}
                                onChange={(e) =>
                                  handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                    prompt: e.target.value,
                                  })
                                }
                              />
                              <div className="ai-prompt-vars-row">
                                <span className="ai-prompt-vars-label">
                                  {locale === 'ja' ? '変数:' : 'Vars:'}
                                </span>
                                {AI_PROMPT_VARIABLE_TOKENS.map((v) => (
                                  <button
                                    key={v.token}
                                    type="button"
                                    className="ai-prompt-var-chip"
                                    onClick={() =>
                                      handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                        prompt: `${sub.prompt}${sub.prompt && !sub.prompt.endsWith(' ') && !sub.prompt.endsWith('\n') ? ' ' : ''}${v.token}`,
                                      })
                                    }
                                    title={
                                      locale === 'ja'
                                        ? `${v.labelJa} を挿入`
                                        : `Insert ${v.labelEn}`
                                    }
                                  >
                                    {v.token}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="field-row">
                              <label>{t.settingsModal.aiCustom.outputHandlingLabel}</label>
                              <div className="ai-custom-output-checks">
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={sub.copyToClipboard}
                                    onChange={(e) =>
                                      handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                        copyToClipboard: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>{t.settingsModal.aiCustom.copyToClipboardLabel}</span>
                                </label>
                                <label className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={sub.replaceContent}
                                    onChange={(e) =>
                                      handlePatchAiCustomSubmenuItem(btn, sub.id, {
                                        replaceContent: e.target.checked,
                                      })
                                    }
                                  />
                                  <span>{t.settingsModal.aiCustom.replaceContentLabel}</span>
                                </label>
                              </div>
                              {subNoOutputSelected && (
                                <div className="ai-custom-warn">
                                  <AlertTriangle size={12} />
                                  <span>{t.settingsModal.aiCustom.noOutputWarning}</span>
                                </div>
                              )}
                            </div>

                            {renderAiModelOverrideRow(sub.aiProvider, sub.aiModel, (patch) =>
                              handlePatchAiCustomSubmenuItem(btn, sub.id, patch)
                            )}

                            {onCustomKeybindingsChange &&
                              (() => {
                                const subKbId = getAiCustomSubmenuKeybindingId(btn.id, sub.id);
                                const currentBinding = effectiveKeybindings[subKbId] || '';
                                const isRecording = recordingCmdId === subKbId;
                                const conflictIds = keybindingConflicts[subKbId] || [];
                                const conflictNames = conflictIds
                                  .map((cid) => keybindingLabelById[cid] || cid)
                                  .join(', ');
                                return (
                                  <div className="field-row">
                                    <label>{t.settingsModal.aiCustom.shortcutLabel}</label>
                                    <div
                                      className={`ai-custom-shortcut-row ${isRecording ? 'is-recording' : ''} ${
                                        conflictIds.length > 0 ? 'has-conflict' : ''
                                      }`}
                                    >
                                      <div className="ai-custom-shortcut-controls">
                                        <kbd
                                          className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}
                                        >
                                          {isRecording
                                            ? t.settingsModal.keybindings.pressKeysPrompt
                                            : currentBinding
                                              ? formatKeybindingForDisplay(currentBinding)
                                              : t.settingsModal.keybindings.unassigned}
                                        </kbd>
                                        {conflictIds.length > 0 && (
                                          <span className="keybinding-conflict">
                                            <AlertTriangle size={11} />
                                            {t.settingsModal.keybindings.conflictWarning.replace(
                                              '{others}',
                                              conflictNames
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <div className="ai-custom-shortcut-controls">
                                        <button
                                          type="button"
                                          className="mini-pill-btn"
                                          onClick={() =>
                                            setRecordingCmdId(isRecording ? null : subKbId)
                                          }
                                        >
                                          {isRecording
                                            ? t.settingsModal.keybindings.cancelRecordBtn
                                            : t.settingsModal.keybindings.editBtn}
                                        </button>
                                        {currentBinding && (
                                          <button
                                            type="button"
                                            className="mini-pill-btn"
                                            onClick={() => {
                                              setRecordingCmdId(null);
                                              const next = { ...customKeybindings };
                                              delete next[subKbId];
                                              onCustomKeybindingsChange(next);
                                            }}
                                          >
                                            {t.settingsModal.keybindings.clearBtn}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
