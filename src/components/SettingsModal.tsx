import React, { useState } from 'react';
import {
  X,
  Sliders,
  FileEdit,
  Palette,
  Globe,
  RotateCcw,
  ExternalLink,
  Square,
  Info,
  Copy,
} from 'lucide-react';
import type {
  AiFolderMode,
  EditorSettings,
  Locale,
  OeditLineCopyTrigger,
  PreviewTheme,
  SyntaxColorMap,
  SyntaxPresetId,
  TextEncodingId,
  ThemeId,
  WrapMode,
} from '../types';
import type { Translations } from '../i18n/types';
import { formatShortcut, getHostOs } from '../utils/platform';
import { TEXT_ENCODINGS } from '../utils/encodings';
import { getAutoPresetForTheme, resolveSyntaxColors, SYNTAX_PRESETS } from '../utils/syntaxThemes';

type SettingsTab = 'general' | 'editor' | 'syntax' | 'integrations';

interface SettingsModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  externalPreviewUrl: string | null;
  externalPreviewLanUrls?: string[];
  onToggleExternalPreview: () => void;
  onCopyLanUrl?: (url: string) => void;
}

const TOKEN_KEYS: Array<keyof SyntaxColorMap> = [
  'keyword',
  'string',
  'number',
  'comment',
  'function',
  'type',
  'variable',
  'operator',
  'tag',
  'property',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  t,
  open,
  onClose,
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  settings,
  onSettingsChange,
  externalPreviewUrl,
  externalPreviewLanUrls = [],
  onToggleExternalPreview,
  onCopyLanUrl,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (!open) return null;

  const resolvedColors = resolveSyntaxColors(
    settings.syntaxPreset,
    theme,
    settings.customSyntaxColors
  );

  const handlePresetChange = (preset: SyntaxPresetId) => {
    if (preset === 'custom') {
      onSettingsChange({
        ...settings,
        syntaxPreset: 'custom',
        customSyntaxColors: resolvedColors,
      });
    } else if (preset === 'auto') {
      onSettingsChange({
        ...settings,
        syntaxPreset: 'auto',
        customSyntaxColors: SYNTAX_PRESETS[getAutoPresetForTheme(theme)],
      });
    } else {
      onSettingsChange({
        ...settings,
        syntaxPreset: preset,
        customSyntaxColors: SYNTAX_PRESETS[preset],
      });
    }
  };

  const handleTokenColorChange = (token: keyof SyntaxColorMap, hex: string) => {
    onSettingsChange({
      ...settings,
      syntaxPreset: 'custom',
      customSyntaxColors: {
        ...resolvedColors,
        [token]: hex,
      },
    });
  };

  const handleResetSyntax = () => {
    onSettingsChange({
      ...settings,
      syntaxPreset: 'auto',
      customSyntaxColors: SYNTAX_PRESETS[getAutoPresetForTheme(theme)],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>{t.settingsModal.title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} title={t.actions.close}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-modal-body">
          <nav className="settings-nav">
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'general' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <Sliders size={14} />
              <span>{t.settingsModal.tabGeneral}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'editor' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              <FileEdit size={14} />
              <span>{t.settingsModal.tabEditor}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'syntax' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('syntax')}
            >
              <Palette size={14} />
              <span>{t.settingsModal.tabSyntax}</span>
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeTab === 'integrations' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('integrations')}
            >
              <Globe size={14} />
              <span>{t.settingsModal.tabIntegrations}</span>
            </button>
          </nav>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-section">
                <div className="settings-grid-2">
                  <div className="field-row">
                    <label>{t.settingsModal.localeLabel}</label>
                    <select
                      className="select-input"
                      value={locale}
                      onChange={(e) => onLocaleChange(e.target.value as Locale)}
                    >
                      <option value="ja">日本語 (Japanese)</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.settingsModal.themeLabel}</label>
                    <select
                      className="select-input"
                      value={theme}
                      onChange={(e) => onThemeChange(e.target.value as ThemeId)}
                    >
                      <option value="light">{t.themes.light}</option>
                      <option value="dark">{t.themes.dark}</option>
                      <option value="sepia">{t.themes.sepia}</option>
                      <option value="midnight">{t.themes.midnight}</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.previewTheme}</label>
                    <select
                      className="select-input"
                      value={settings.previewTheme}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          previewTheme: e.target.value as PreviewTheme,
                        })
                      }
                    >
                      <option value="editorial">{t.previewThemes.editorial}</option>
                      <option value="github">{t.previewThemes.github}</option>
                      <option value="notion">{t.previewThemes.notion}</option>
                      <option value="academic">{t.previewThemes.academic}</option>
                    </select>
                  </div>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.editorFont}</label>
                    <select
                      className="select-input"
                      value={settings.editorFont}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          editorFont: e.target.value as 'mono' | 'sans',
                        })
                      }
                    >
                      <option value="mono">{t.inspector.settingsLabels.fontMono}</option>
                      <option value="sans">{t.inspector.settingsLabels.fontSans}</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.fontSize}: {settings.fontSize}px
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, fontSize: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.lineHeight}: {settings.lineHeight}
                  </label>
                  <input
                    type="range"
                    min={1.3}
                    max={2.2}
                    step={0.05}
                    value={settings.lineHeight}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, lineHeight: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>
                    {t.inspector.settingsLabels.previewWidth}: {settings.previewWidth}px
                  </label>
                  <input
                    type="range"
                    min={600}
                    max={1100}
                    step={20}
                    value={settings.previewWidth}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, previewWidth: Number(e.target.value) })
                    }
                  />
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.wordGoal}</label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    className="text-input"
                    value={settings.wordGoal}
                    onChange={(e) =>
                      onSettingsChange({
                        ...settings,
                        wordGoal: Math.max(0, Number(e.target.value)),
                      })
                    }
                  />
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showTopBar ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showTopBar: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showTopBar}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFormatToolbar ?? true}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showFormatToolbar: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showFormatToolbar}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.hideTopBarInSimpleMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          hideTopBarInSimpleMode: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.hideTopBarInSimpleMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFormatToolbarInSimpleMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          showFormatToolbarInSimpleMode: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.showFormatToolbarInSimpleMode}</span>
                  </label>
                  <div className="ai-hint-text">
                    {formatShortcut(t.inspector.settingsLabels.hideTopBarInSimpleModeHint)}
                  </div>
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.customCss}</label>
                  <textarea
                    rows={3}
                    className="textarea-input"
                    value={settings.customCss}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, customCss: e.target.value })
                    }
                    placeholder={t.inspector.settingsLabels.customCssPlaceholder}
                  />
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.wrapMode}</label>
                      <select
                        className="select-input"
                        value={settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')}
                        onChange={(e) => {
                          const mode = e.target.value as WrapMode;
                          onSettingsChange({
                            ...settings,
                            wrapMode: mode,
                            wordWrap: mode !== 'none',
                          });
                        }}
                      >
                        <option value="window">{t.inspector.settingsLabels.wrapModeWindow}</option>
                        <option value="column">{t.inspector.settingsLabels.wrapModeColumn}</option>
                        <option value="none">{t.inspector.settingsLabels.wrapModeNone}</option>
                      </select>
                    </div>

                    {(settings.wrapMode ?? (settings.wordWrap ? 'window' : 'none')) === 'column' && (
                      <div className="field-row">
                        <label>{t.inspector.settingsLabels.wrapColumn}</label>
                        <input
                          type="number"
                          min={20}
                          max={240}
                          step={5}
                          className="text-input"
                          value={settings.wrapColumn ?? 80}
                          onChange={(e) =>
                            onSettingsChange({
                              ...settings,
                              wrapColumn: Math.max(20, Math.min(240, Number(e.target.value) || 80)),
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  <div className="check-list">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showRuler}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showRuler: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showRuler}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.lineNumbers}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, lineNumbers: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.lineNumbers}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showNewlineSymbols}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showNewlineSymbols: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showNewlineSymbols}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showWhitespaceSymbols}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            showWhitespaceSymbols: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showWhitespaceSymbols}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.bracketMatchingEnabled ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            bracketMatchingEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.bracketMatchingEnabled}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.codeFoldingEnabled ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            codeFoldingEnabled: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.codeFoldingEnabled}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.highlightSelectionMatches ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            highlightSelectionMatches: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.highlightSelectionMatches}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.autoCloseBrackets ?? true}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            autoCloseBrackets: e.target.checked,
                          })
                        }
                      />
                      <span>{t.inspector.settingsLabels.autoCloseBrackets}</span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={settings.showStatusBar ?? true}
                        onChange={(e) =>
                          onSettingsChange({ ...settings, showStatusBar: e.target.checked })
                        }
                      />
                      <span>{t.inspector.settingsLabels.showStatusBar}</span>
                    </label>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.defaultNewFileEncoding}</label>
                      <select
                        className="select-input"
                        value={settings.defaultNewFileEncoding ?? 'utf-8'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            defaultNewFileEncoding: e.target.value as TextEncodingId,
                          })
                        }
                      >
                        {TEXT_ENCODINGS.map((enc) => (
                          <option key={enc.id} value={enc.id}>
                            {enc.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.defaultNewFileEol}</label>
                      <select
                        className="select-input"
                        value={settings.defaultNewFileEol ?? '\n'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            defaultNewFileEol: e.target.value as '\n' | '\r\n',
                          })
                        }
                      >
                        <option value={'\n'}>LF (\n)</option>
                        <option value={'\r\n'}>CRLF (\r\n)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="check-list">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.activeLineSyncHighlight}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          activeLineSyncHighlight: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.activeLineSyncHighlight}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.syncScroll}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, syncScroll: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.syncScroll}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.typewriterMode}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, typewriterMode: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.typewriterMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.focusMode ?? false}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, focusMode: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.focusMode}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.smartPasteHtml}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, smartPasteHtml: e.target.checked })
                      }
                    />
                    <span>{t.inspector.settingsLabels.smartPasteHtml}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.showFrontmatterCard}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, showFrontmatterCard: e.target.checked })
                      }
                    />
                    <span>{t.inspector.frontmatterLabels.showCard}</span>
                  </label>
                </div>

                <div className="settings-card">
                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.imageAssetFolder}</label>
                      <input
                        type="text"
                        className="text-input"
                        value={settings.imageAssetFolder ?? 'assets'}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            imageAssetFolder: e.target.value,
                          })
                        }
                        placeholder="assets"
                      />
                    </div>
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.dailyNotesFolder}</label>
                      <input
                        type="text"
                        className="text-input"
                        value={settings.dailyNotesFolder ?? ''}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            dailyNotesFolder: e.target.value,
                          })
                        }
                        placeholder="daily"
                      />
                    </div>
                  </div>
                </div>

                <div className="ins-divider" />

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.restoreSessionEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          restoreSessionEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.restoreSessionEnabled}</span>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.autoSaveEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          autoSaveEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.autoSaveEnabled}</span>
                  </label>
                </div>

                <div className="ins-divider" />

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.oeditLineCopyEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.oeditLineCopyEnabled}</span>
                  </label>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.oeditLineCopyTrigger}</label>
                    <select
                      className="select-input"
                      disabled={!settings.oeditLineCopyEnabled}
                      value={settings.oeditLineCopyTrigger}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyTrigger: e.target.value as OeditLineCopyTrigger,
                        })
                      }
                    >
                      <option value="eol-only">{t.inspector.settingsLabels.triggerEolOnly}</option>
                      <option value="any-empty-sel">
                        {t.inspector.settingsLabels.triggerAnyEmptySel}
                      </option>
                    </select>
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      disabled={!settings.oeditLineCopyEnabled}
                      checked={settings.oeditLineCopyIncludeNewline}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          oeditLineCopyIncludeNewline: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.oeditLineCopyIncludeNewline}</span>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'syntax' && (
              <div className="settings-section">
                <div className="syntax-preset-row">
                  <div className="field-row" style={{ flex: 1 }}>
                    <label>{t.inspector.settingsLabels.syntaxPreset}</label>
                    <select
                      className="select-input"
                      value={settings.syntaxPreset}
                      onChange={(e) => handlePresetChange(e.target.value as SyntaxPresetId)}
                    >
                      <option value="auto">Auto (Theme Matched)</option>
                      <option value="github">GitHub</option>
                      <option value="one-dark">One Dark</option>
                      <option value="dracula">Dracula</option>
                      <option value="nord">Nord</option>
                      <option value="monokai">Monokai</option>
                      <option value="solarized">Solarized</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ alignSelf: 'flex-end' }}
                    onClick={handleResetSyntax}
                  >
                    <RotateCcw size={13} />
                    <span>{t.inspector.settingsLabels.syntaxResetBtn}</span>
                  </button>
                </div>

                <div className="field-row">
                  <label>{t.inspector.settingsLabels.syntaxColorsTitle}</label>
                  <div className="syntax-color-grid">
                    {TOKEN_KEYS.map((token) => (
                      <label key={token} className="syntax-color-item">
                        <input
                          type="color"
                          value={resolvedColors[token]}
                          onChange={(e) => handleTokenColorChange(token, e.target.value)}
                        />
                        <span className="syntax-color-label">
                          {t.inspector.settingsLabels.syntaxTokens[token]}
                        </span>
                        <code className="syntax-color-hex">{resolvedColors[token]}</code>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'integrations' && (
              <div className="settings-section">
                <div className="settings-card">
                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.aiFolderMode}</label>
                    <select
                      className="select-input"
                      value={settings.aiFolderMode}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          aiFolderMode: e.target.value as AiFolderMode,
                        })
                      }
                    >
                      <option value="disabled">
                        {t.inspector.settingsLabels.aiFolderModes.disabled}
                      </option>
                      <option value="read-only">
                        {t.inspector.settingsLabels.aiFolderModes.readOnly}
                      </option>
                      <option value="read-write-approve">
                        {t.inspector.settingsLabels.aiFolderModes.readWriteApprove}
                      </option>
                      <option value="cli-direct">
                        {t.inspector.settingsLabels.aiFolderModes.cliDirect}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.builtinBrowserEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          builtinBrowserEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.builtinBrowserEnabled}</span>
                  </label>

                  <div className="field-row">
                    <label>{t.inspector.settingsLabels.builtinBrowserDefaultUrl}</label>
                    <input
                      type="text"
                      className="text-input"
                      value={settings.builtinBrowserDefaultUrl}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          builtinBrowserDefaultUrl: e.target.value,
                        })
                      }
                      placeholder="https://www.google.com"
                    />
                  </div>

                  <div className="platform-hint-note">
                    <Info size={12} />
                    <span>
                      {getHostOs() === 'windows'
                        ? t.browser.platformNoteWebView2
                        : getHostOs() === 'linux'
                          ? t.browser.platformNoteWebKitGtk
                          : t.browser.platformNoteWebKit}
                    </span>
                  </div>
                </div>

                <div className="settings-card">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.externalBrowserPreviewEnabled}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          externalBrowserPreviewEnabled: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.externalBrowserPreviewEnabled}</span>
                  </label>

                  <div className="settings-grid-2">
                    <div className="field-row">
                      <label>{t.inspector.settingsLabels.externalBrowserPort}</label>
                      <input
                        type="number"
                        min={1024}
                        max={65535}
                        className="text-input"
                        value={settings.externalBrowserPort}
                        onChange={(e) =>
                          onSettingsChange({
                            ...settings,
                            externalBrowserPort: Math.max(1024, Math.min(65535, Number(e.target.value) || 49123)),
                          })
                        }
                      />
                    </div>
                    <div className="field-row" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className={externalPreviewUrl ? 'secondary-btn' : 'primary-btn'}
                        onClick={onToggleExternalPreview}
                      >
                        {externalPreviewUrl ? <Square size={13} /> : <ExternalLink size={13} />}
                        <span>
                          {externalPreviewUrl
                            ? t.browser.externalStopBtn
                            : t.browser.externalLiveBtn}
                        </span>
                      </button>
                    </div>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={settings.externalBrowserAllowLan}
                      onChange={(e) =>
                        onSettingsChange({
                          ...settings,
                          externalBrowserAllowLan: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.settingsLabels.externalBrowserAllowLan}</span>
                  </label>
                  <div className="ai-hint-text">
                    {t.inspector.settingsLabels.externalBrowserAllowLanHint}
                  </div>
                  {externalPreviewUrl && (
                    <div className="lan-url-list">
                      <div className="lan-url-row">
                        <span className="lan-url-badge">Local</span>
                        <code>{externalPreviewUrl}</code>
                      </div>
                      {settings.externalBrowserAllowLan &&
                        externalPreviewLanUrls.map((lanUrl) => (
                          <div key={lanUrl} className="lan-url-row">
                            <span className="lan-url-badge is-lan">LAN</span>
                            <code>{lanUrl}</code>
                            {onCopyLanUrl && (
                              <button
                                type="button"
                                className="mini-pill-btn"
                                onClick={() => onCopyLanUrl(lanUrl)}
                                title={t.actions.copyLanUrl}
                              >
                                <Copy size={11} />
                                <span>{t.actions.copyLanUrl}</span>
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="ai-hint-text">
                    {t.settingsModal.externalPreviewCrossPlatformNote}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="settings-modal-footer">
          <span className="ai-hint-text">{formatShortcut(t.settingsModal.openInSidebarHint)}</span>
          <button type="button" className="primary-btn" onClick={onClose}>
            {t.actions.close}
          </button>
        </div>
      </div>
    </div>
  );
};
