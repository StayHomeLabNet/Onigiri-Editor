import React, { useState } from 'react';
import { AlertTriangle, Keyboard, RotateCcw } from 'lucide-react';
import type { Translations } from '../../i18n/types';
import { formatKeybindingForDisplay, type KeybindingDef } from '../../utils/keybindings';

interface KeybindingsTabProps {
  t: Translations;
  customKeybindings: Record<string, string>;
  onCustomKeybindingsChange?: (next: Record<string, string>) => void;
  recordingCmdId: string | null;
  setRecordingCmdId: (id: string | null) => void;
  allKeybindingDefs: KeybindingDef[];
  keybindingLabelById: Record<string, string>;
  keybindingCategories: string[];
  effectiveKeybindings: Record<string, string>;
  keybindingConflicts: Record<string, string[]>;
  onResetFeedback: (msg: string) => void;
}

export const KeybindingsTab: React.FC<KeybindingsTabProps> = ({
  t,
  customKeybindings,
  onCustomKeybindingsChange,
  recordingCmdId,
  setRecordingCmdId,
  allKeybindingDefs,
  keybindingLabelById,
  keybindingCategories,
  effectiveKeybindings,
  keybindingConflicts,
  onResetFeedback,
}) => {
  const [kbFilter, setKbFilter] = useState('');
  const [kbCategory, setKbCategory] = useState<string>('ALL');

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-data-card-header">
          <div>
            <div className="settings-data-card-title">
              <Keyboard size={14} />
              <span>{t.settingsModal.keybindings.title}</span>
            </div>
            <p className="ai-hint-text" style={{ margin: '4px 0 0' }}>
              {t.settingsModal.keybindings.desc}
            </p>
          </div>
          {onCustomKeybindingsChange && (
            <button
              type="button"
              className="mini-pill-btn"
              onClick={() => {
                setRecordingCmdId(null);
                onCustomKeybindingsChange({});
                onResetFeedback(t.settingsModal.keybindings.resetDoneToast);
              }}
            >
              <RotateCcw size={11} />
              <span>{t.settingsModal.keybindings.resetAllBtn}</span>
            </button>
          )}
        </div>

        <input
          type="text"
          className="text-input"
          value={kbFilter}
          onChange={(e) => setKbFilter(e.target.value)}
          placeholder={t.settingsModal.keybindings.searchPlaceholder}
        />

        <div className="keybindings-category-chips" role="tablist">
          <button
            type="button"
            className={`mini-pill-btn ${kbCategory === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setKbCategory('ALL')}
          >
            {t.settingsModal.keybindings.allCategories}
          </button>
          {keybindingCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`mini-pill-btn ${kbCategory === cat ? 'is-active' : ''}`}
              onClick={() => setKbCategory(cat)}
            >
              {t.settingsModal.keybindings.categories[cat] || cat}
            </button>
          ))}
        </div>

        <div className="keybindings-list">
          {allKeybindingDefs
            .filter((def) => {
              if (kbCategory !== 'ALL' && def.category !== kbCategory) return false;
              const q = kbFilter.trim().toLowerCase();
              if (!q) return true;
              const label = (keybindingLabelById[def.id] || def.id).toLowerCase();
              const cat = (
                t.settingsModal.keybindings.categories[def.category] || def.category
              ).toLowerCase();
              const binding = (effectiveKeybindings[def.id] || '').toLowerCase();
              const disp = formatKeybindingForDisplay(effectiveKeybindings[def.id]).toLowerCase();
              return (
                label.includes(q) ||
                cat.includes(q) ||
                def.id.toLowerCase().includes(q) ||
                binding.includes(q) ||
                disp.includes(q)
              );
            })
            .map((def) => {
              const currentBinding = effectiveKeybindings[def.id] || '';
              const isModified = customKeybindings[def.id] !== undefined;
              const isRecording = recordingCmdId === def.id;
              const conflictIds = keybindingConflicts[def.id] || [];
              const conflictNames = conflictIds
                .map((cid) => keybindingLabelById[cid] || cid)
                .join(', ');
              const catLabel =
                t.settingsModal.keybindings.categories[def.category] || def.category;
              const cmdLabel = keybindingLabelById[def.id] || def.id;

              return (
                <div
                  key={def.id}
                  className={`keybinding-row ${isRecording ? 'is-recording' : ''} ${
                    conflictIds.length > 0 ? 'has-conflict' : ''
                  }`}
                >
                  <div className="keybinding-meta">
                    <span className="keybinding-cat">{catLabel}</span>
                    <span className="keybinding-label">{cmdLabel}</span>
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
                  <div className="keybinding-actions">
                    <kbd className={`keybinding-kbd ${!currentBinding ? 'is-empty' : ''}`}>
                      {isRecording
                        ? t.settingsModal.keybindings.pressKeysPrompt
                        : currentBinding
                          ? formatKeybindingForDisplay(currentBinding)
                          : t.settingsModal.keybindings.unassigned}
                    </kbd>
                    {onCustomKeybindingsChange && (
                      <>
                        <button
                          type="button"
                          className="mini-pill-btn"
                          onClick={() => setRecordingCmdId(isRecording ? null : def.id)}
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
                              onCustomKeybindingsChange({
                                ...customKeybindings,
                                [def.id]: '',
                              });
                            }}
                          >
                            {t.settingsModal.keybindings.clearBtn}
                          </button>
                        )}
                        {isModified && (
                          <button
                            type="button"
                            className="mini-pill-btn"
                            onClick={() => {
                              setRecordingCmdId(null);
                              const next = { ...customKeybindings };
                              delete next[def.id];
                              onCustomKeybindingsChange(next);
                            }}
                          >
                            {t.settingsModal.keybindings.resetOneBtn}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
