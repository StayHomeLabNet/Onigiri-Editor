import React, { useEffect, useState } from 'react';
import { Clock, Download, FileText, RefreshCw, Rocket } from 'lucide-react';
import {
  addAiMemoryItem,
  loadAiMemoryItems,
  removeAiMemoryItem,
  subscribeAiMemory,
  toggleAiMemoryItem,
  type AiMemoryItem,
} from '../../utils/aiMemory';
import { formatUpdateCheckTime, isVersionSkipped } from '../UpdateModal';
import type { Translations } from '../../i18n/types';
import { SUPPORTED_LOCALES, localeNames } from '../../i18n';
import type {
  AppUpdateInfo,
  EditorSettings,
  InspectorTabStyle,
  Locale,
  PreviewTheme,
  ThemeId,
  UpdateAvailableBehavior,
} from '../../types';
import { formatShortcut, isTauri } from '../../utils/platform';

interface GeneralTabProps {
  t: Translations;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  updateInfo?: AppUpdateInfo | null;
  checkingUpdates?: boolean;
  onCheckUpdates?: () => void;
  onOpenExternalUrl?: (url: string) => void;
  onOpenUpdateModal?: () => void;
  onAutoUpdateNow?: () => void;
  isUpdatingApp?: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  t,
  locale,
  onLocaleChange,
  theme,
  onThemeChange,
  settings,
  onSettingsChange,
  updateInfo,
  checkingUpdates,
  onCheckUpdates,
  onOpenExternalUrl,
  onOpenUpdateModal,
  onAutoUpdateNow,
  isUpdatingApp,
}) => {
  const [memoryItems, setMemoryItems] = useState<AiMemoryItem[]>(() => loadAiMemoryItems());
  const [newMemoryText, setNewMemoryText] = useState('');

  useEffect(() => {
    return subscribeAiMemory(() => setMemoryItems(loadAiMemoryItems()));
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-grid-2">
        <div className="field-row">
          <label>{t.settingsModal.localeLabel}</label>
          <select
            className="select-input"
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value as Locale)}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {localeNames[loc]} ({loc})
              </option>
            ))}
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

      <div className="settings-card">
        <div className="field-row">
          <label>{t.inspector.settingsLabels.inspectorTabStyle}</label>
          <select
            className="select-input"
            value={settings.inspectorTabStyle ?? 'icons'}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                inspectorTabStyle: e.target.value as InspectorTabStyle,
              })
            }
          >
            <option value="icons">{t.inspector.settingsLabels.inspectorTabStyleIcons}</option>
            <option value="active-label">
              {t.inspector.settingsLabels.inspectorTabStyleActiveLabel}
            </option>
            <option value="labels">{t.inspector.settingsLabels.inspectorTabStyleLabels}</option>
          </select>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.embedImagesOnHtmlExport ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                embedImagesOnHtmlExport: e.target.checked,
              })
            }
          />
          <span>{t.inspector.settingsLabels.embedImagesOnHtmlExport}</span>
        </label>
      </div>

      <div className="settings-card settings-update-card">
        <div className="settings-data-card-header">
          <div className="settings-data-card-title">
            <RefreshCw size={14} className={checkingUpdates ? 'spin' : ''} />
            <span>{t.updates.sectionTitle}</span>
          </div>
          {updateInfo?.checkedAtMs ? (
            <span className="settings-update-last-checked">
              <Clock size={11} />
              <span>
                {t.updates.lastCheckedLabel.replace(
                  '{time}',
                  formatUpdateCheckTime(updateInfo.checkedAtMs, locale) || ''
                )}
              </span>
            </span>
          ) : null}
        </div>

        {isTauri() && onCheckUpdates && (
          <div className="about-update-row" style={{ marginTop: 4, marginBottom: 10 }}>
            <div className="about-update-status">
              {updateInfo?.hasUpdate ? (
                <span className="update-badge-new">
                  {t.updates.availableBannerTitle.replace('{version}', updateInfo.latestVersion)}
                </span>
              ) : updateInfo ? (
                <span className="about-update-ok">
                  {t.updates.upToDateLabel.replace('{version}', updateInfo.currentVersion)}
                </span>
              ) : (
                <span className="ai-hint-text">{t.updates.notCheckedYetLabel}</span>
              )}
            </div>
            <div className="about-update-actions">
              {updateInfo?.hasUpdate && onAutoUpdateNow && (
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  disabled={isUpdatingApp}
                  onClick={onAutoUpdateNow}
                >
                  <Rocket size={13} />
                  <span>{isUpdatingApp ? t.updates.updatingBtn : t.updates.autoUpdateNowBtn}</span>
                </button>
              )}
              {updateInfo?.hasUpdate && !onAutoUpdateNow && onOpenExternalUrl && (
                <button
                  type="button"
                  className="primary-btn compact-btn"
                  onClick={() => onOpenExternalUrl(updateInfo.downloadUrl || updateInfo.releaseUrl)}
                >
                  <Download size={13} />
                  <span>{t.updates.downloadBtn}</span>
                </button>
              )}
              {updateInfo && onOpenUpdateModal && (
                <button
                  type="button"
                  className="secondary-btn compact-btn"
                  onClick={onOpenUpdateModal}
                >
                  <FileText size={13} />
                  <span>{t.updates.openDetailsModalBtn}</span>
                </button>
              )}
              <button
                type="button"
                className="secondary-btn compact-btn"
                disabled={checkingUpdates}
                onClick={onCheckUpdates}
              >
                <RefreshCw size={13} className={checkingUpdates ? 'spin' : ''} />
                <span>{checkingUpdates ? t.updates.checkingBtn : t.updates.checkBtn}</span>
              </button>
            </div>
          </div>
        )}

        <div className="check-list">
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.checkUpdatesOnStartup ?? true}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  checkUpdatesOnStartup: e.target.checked,
                })
              }
            />
            <span>{t.inspector.settingsLabels.checkUpdatesOnStartup}</span>
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.autoUpdateEnabled ?? false}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  autoUpdateEnabled: e.target.checked,
                })
              }
            />
            <span>{t.inspector.settingsLabels.autoUpdateEnabled}</span>
          </label>
          <p className="field-hint">{t.inspector.settingsLabels.autoUpdateEnabledHint}</p>
        </div>

        <div className="settings-grid-2" style={{ marginTop: 8 }}>
          <div className="field-row">
            <label>{t.inspector.settingsLabels.updateCheckInterval}</label>
            <select
              className="select-input"
              disabled={settings.checkUpdatesOnStartup === false}
              value={String(settings.updateCheckIntervalHours ?? 6)}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  updateCheckIntervalHours: Number(e.target.value),
                })
              }
            >
              <option value="0">{t.inspector.settingsLabels.updateIntervalStartupOnly}</option>
              <option value="1">{t.inspector.settingsLabels.updateInterval1h}</option>
              <option value="6">{t.inspector.settingsLabels.updateInterval6h}</option>
              <option value="12">{t.inspector.settingsLabels.updateInterval12h}</option>
              <option value="24">{t.inspector.settingsLabels.updateInterval24h}</option>
            </select>
          </div>

          <div className="field-row">
            <label>{t.inspector.settingsLabels.updateAvailableBehavior}</label>
            <select
              className="select-input"
              value={settings.updateAvailableBehavior ?? 'banner'}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  updateAvailableBehavior: e.target.value as UpdateAvailableBehavior,
                })
              }
            >
              <option value="banner">{t.inspector.settingsLabels.updateBehaviorBanner}</option>
              <option value="modal">{t.inspector.settingsLabels.updateBehaviorModal}</option>
              <option value="badge-only">
                {t.inspector.settingsLabels.updateBehaviorBadgeOnly}
              </option>
              <option value="auto-install">
                {t.inspector.settingsLabels.updateBehaviorAutoInstall}
              </option>
            </select>
          </div>
        </div>

        {settings.skippedUpdateVersion &&
          isVersionSkipped(settings.skippedUpdateVersion, settings.skippedUpdateVersion) && (
            <div className="settings-skipped-version-row">
              <span>
                {t.updates.skippedVersionLabel.replace('{version}', settings.skippedUpdateVersion)}
              </span>
              <button
                type="button"
                className="mini-pill-btn"
                onClick={() =>
                  onSettingsChange({
                    ...settings,
                    skippedUpdateVersion: '',
                  })
                }
              >
                {t.updates.unskipVersionBtn}
              </button>
            </div>
          )}
      </div>

      <div className="settings-card">
        <div className="settings-card-title">
          {locale === 'ja' ? 'ツール・ユーティリティの ON / OFF' : 'Tools & Utilities'}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.customTooltipsEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, customTooltipsEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'カスタムツールチップ（0.15秒表示・ショートカットバッジ付き）を有効にする'
              : 'Enable instant custom tooltips (0.15s hover with shortcut badges)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.scratchpadEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, scratchpadEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'クイック・スクラッチパッド（保存不要メモ）をステータスバーに表示'
              : 'Enable Quick Scratchpad button in Status Bar'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.integratedTerminalEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                integratedTerminalEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? '軽量統合ターミナル（拡張モード下部ドロワー）を有効にする'
              : 'Enable Lightweight Integrated Terminal drawer (Advanced Mode)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings.aiSendPreviewEnabled)}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiSendPreviewEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'AI 送信前に送信内容プレビュー＆機密情報チェックを表示する'
              : 'Preview payload & check secrets before sending to AI'}
          </span>
        </label>

        {settings.aiSendPreviewEnabled && (
          <label className="check-row" style={{ marginLeft: 18 }}>
            <input
              type="checkbox"
              checked={settings.aiAutoRedactSecrets ?? true}
              onChange={(e) =>
                onSettingsChange({ ...settings, aiAutoRedactSecrets: e.target.checked })
              }
            />
            <span>
              {locale === 'ja'
                ? 'プレビュー時に検出された API キー等を自動で伏せ字にする'
                : 'Automatically mask detected API keys & tokens in preview'}
            </span>
          </label>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.aiProjectRulesEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiProjectRulesEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'プロジェクトの AI ルール（AGENTS.md / CLAUDE.md）を自動注入する'
              : 'Auto-inject project AI rules (AGENTS.md / CLAUDE.md) into prompts'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.aiCliDirectCheckpointEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiCliDirectCheckpointEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'CLI 直接編集（cli-direct）前に自動スナップショット＆ロールバックガードを有効にする'
              : 'Enable pre-run snapshot & rollback guard for CLI direct workspace edits'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.aiAuditLogEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiAuditLogEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'AI 実行履歴（マスク済みプロンプト・応答・再実行ログ）を記録する'
              : 'Record AI execution audit & replay log (with secret redaction)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.aiNoteSuggestEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiNoteSuggestEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'AI チャットで関連ノート（[[Wikiリンク]] / #タグ）を自動提案する'
              : 'Auto-suggest relevant workspace notes in AI Chat'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.aiMemoryEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, aiMemoryEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'ピン留め AI メモリー（文体・好みのルール記憶）をプロンプトに含める'
              : 'Include pinned AI memory rules in prompts'}
          </span>
        </label>

        {(settings.aiMemoryEnabled ?? true) && (
          <div
            style={{
              marginLeft: 18,
              marginBottom: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                className="text-input"
                style={{ flex: 1, fontSize: 12 }}
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                placeholder={
                  locale === 'ja'
                    ? '例：日本語の回答はです・ます調で、結論から簡潔に書く'
                    : 'e.g. Always respond concisely in Markdown bullet points'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMemoryText.trim()) {
                    e.preventDefault();
                    addAiMemoryItem(newMemoryText, 'global');
                    setNewMemoryText('');
                  }
                }}
              />
              <button
                type="button"
                className="mini-pill-btn is-active"
                disabled={!newMemoryText.trim()}
                onClick={() => {
                  if (!newMemoryText.trim()) return;
                  addAiMemoryItem(newMemoryText, 'global');
                  setNewMemoryText('');
                }}
              >
                {locale === 'ja' ? '追加' : 'Add'}
              </button>
            </div>
            {memoryItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {memoryItems.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      padding: '3px 6px',
                      borderRadius: 6,
                      background: 'var(--bg-app)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleAiMemoryItem(m.id)}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        color: 'var(--fg-muted)',
                      }}
                    >
                      {m.scope}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: m.enabled ? 1 : 0.5,
                      }}
                      title={m.text}
                    >
                      {m.text}
                    </span>
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => removeAiMemoryItem(m.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings.globalHotkeyEnabled)}
            onChange={(e) =>
              onSettingsChange({ ...settings, globalHotkeyEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? 'グローバル呼び出しショートカット（他アプリから最前面に表示）を有効にする'
              : 'Enable Global Hotkey to summon Onigiri Editor from any app'}
          </span>
        </label>

        {settings.globalHotkeyEnabled && (
          <div className="field-row" style={{ marginTop: 6 }}>
            <label>
              {locale === 'ja'
                ? 'グローバルショートカット（例: CommandOrControl+Shift+Space）'
                : 'Global Shortcut (e.g. CommandOrControl+Shift+Space)'}
            </label>
            <input
              type="text"
              className="text-input"
              value={settings.globalHotkeyShortcut ?? 'CommandOrControl+Shift+Space'}
              onChange={(e) =>
                onSettingsChange({ ...settings, globalHotkeyShortcut: e.target.value })
              }
              placeholder="CommandOrControl+Shift+Space"
            />
          </div>
        )}
      </div>

      <div className="field-row">
        <label>{t.inspector.settingsLabels.customCss}</label>
        <textarea
          rows={3}
          className="textarea-input"
          value={settings.customCss}
          onChange={(e) => onSettingsChange({ ...settings, customCss: e.target.value })}
          placeholder={t.inspector.settingsLabels.customCssPlaceholder}
        />
      </div>
    </div>
  );
};
