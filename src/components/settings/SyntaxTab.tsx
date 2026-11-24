import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type { EditorSettings, SyntaxColorMap, SyntaxPresetId, ThemeId } from '../../types';
import { getAutoPresetForTheme, resolveSyntaxColors, SYNTAX_PRESETS } from '../../utils/syntaxThemes';

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

interface SyntaxTabProps {
  t: Translations;
  theme: ThemeId;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
}

export const SyntaxTab: React.FC<SyntaxTabProps> = ({
  t,
  theme,
  settings,
  onSettingsChange,
}) => {
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
  );
};
