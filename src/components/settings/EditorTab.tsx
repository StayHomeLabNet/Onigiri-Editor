import React from 'react';
import { FileCode } from 'lucide-react';
import type { Translations } from '../../i18n/types';
import type {
  EditorSettings,
  Locale,
  OeditLineCopyTrigger,
  TextEncodingId,
  WrapMode,
} from '../../types';
import { TEXT_ENCODINGS } from '../../utils/encodings';

export interface ProjectConfigInfo {
  hasEditorConfig: boolean;
  hasOnigiriJson: boolean;
  onigiriJsonPath: string | null;
  resolvedSummary: string;
}

interface EditorTabProps {
  t: Translations;
  locale: Locale;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  workspaceRoot?: string | null;
  projectConfigInfo?: ProjectConfigInfo;
  onCreateOnigiriJson?: () => Promise<void> | void;
  onOpenProjectConfigFile?: (path: string) => void;
  onClose: () => void;
}

export const EditorTab: React.FC<EditorTabProps> = ({
  t,
  locale,
  settings,
  onSettingsChange,
  workspaceRoot,
  projectConfigInfo,
  onCreateOnigiriJson,
  onOpenProjectConfigFile,
  onClose,
}) => {
  return (
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
            checked={settings.previewSelectionSyncHighlight ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                previewSelectionSyncHighlight: e.target.checked,
              })
            }
          />
          <span>{t.inspector.settingsLabels.previewSelectionSyncHighlight}</span>
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
            checked={settings.autoTitleOnUrlPaste ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                autoTitleOnUrlPaste: e.target.checked,
              })
            }
          />
          <span>{t.inspector.settingsLabels.autoTitleOnUrlPaste}</span>
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

      {workspaceRoot && projectConfigInfo && (
        <div className="settings-card">
          <div className="settings-data-card-header">
            <div className="settings-data-card-title">
              <FileCode size={14} />
              <span>{t.inspector.settingsLabels.projectConfigTitle}</span>
            </div>
            <div className="settings-data-quick-links">
              {projectConfigInfo.hasOnigiriJson &&
              projectConfigInfo.onigiriJsonPath &&
              onOpenProjectConfigFile ? (
                <button
                  type="button"
                  className="mini-pill-btn"
                  onClick={() => {
                    onOpenProjectConfigFile(projectConfigInfo.onigiriJsonPath!);
                    onClose();
                  }}
                >
                  {t.projectConfig.openConfigBtn}
                </button>
              ) : (
                onCreateOnigiriJson && (
                  <button
                    type="button"
                    className="mini-pill-btn"
                    onClick={() => void onCreateOnigiriJson()}
                  >
                    {t.projectConfig.createOnigiriJsonBtn}
                  </button>
                )
              )}
            </div>
          </div>
          <div className="ai-hint-text" style={{ marginTop: 4 }}>
            {projectConfigInfo.hasEditorConfig || projectConfigInfo.hasOnigiriJson
              ? projectConfigInfo.resolvedSummary
              : t.projectConfig.noneActive}
          </div>
        </div>
      )}

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
            <option value="any-empty-sel">{t.inspector.settingsLabels.triggerAnyEmptySel}</option>
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

      <div className="settings-card">
        <div className="settings-card-title">
          {locale === 'ja'
            ? '執筆アシスト・AI 補完・テーブル操作'
            : 'Writing Assist, AI Autocomplete & Table Bar'}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.previewSingleLineBreak ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                previewSingleLineBreak: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? 'Enter 1 回の改行をそのままプレビューに反映する（単一改行を <br> として表示）'
              : 'Render single line breaks as <br> in Preview (GitHub / Notion style)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.selectionBubbleMenuEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                selectionBubbleMenuEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? '選択範囲フローティングミニバー（太字・コード・リンク・AI編集）を表示'
              : 'Show Selection Floating Bubble Menu (Format & Quick AI)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.markdownTableBarEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                markdownTableBarEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? 'Markdown テーブル GUI 編集バー（行・列操作＆ソート）を表示'
              : 'Show Markdown Table GUI Toolbar (Rows, Columns, Align & Sort)'}
          </span>
        </label>

        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings.aiGhostTextEnabled)}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                aiGhostTextEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? 'AI ゴーストテキスト補完（入力停止後に薄字表示・Tab で確定 / Esc で却下）'
              : 'Enable AI Ghost Text Autocomplete (Tab to accept, Esc to dismiss)'}
          </span>
        </label>

        {settings.aiGhostTextEnabled && (
          <div className="field-row" style={{ marginTop: 6 }}>
            <label>
              {locale === 'ja'
                ? `補完トリガー待ち時間: ${settings.aiGhostTextDelayMs ?? 900} ms`
                : `Autocomplete trigger delay: ${settings.aiGhostTextDelayMs ?? 900} ms`}
            </label>
            <input
              type="range"
              min={400}
              max={2500}
              step={100}
              value={settings.aiGhostTextDelayMs ?? 900}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  aiGhostTextDelayMs: Number(e.target.value),
                })
              }
            />
          </div>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.autoSnapshotEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({ ...settings, autoSnapshotEnabled: e.target.checked })
            }
          />
          <span>
            {locale === 'ja'
              ? '自動スナップショットのタイムライン（定期・保存前バックアップ）を有効にする'
              : 'Enable Auto Snapshot Timeline (periodic & pre-save backups)'}
          </span>
        </label>

        {(settings.autoSnapshotEnabled ?? true) && (
          <div className="field-row" style={{ marginLeft: 18 }}>
            <label>
              {locale === 'ja' ? '自動スナップショット間隔' : 'Auto Snapshot Interval'}
            </label>
            <select
              className="select-input"
              value={settings.autoSnapshotIntervalSec ?? 180}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  autoSnapshotIntervalSec: Number(e.target.value),
                })
              }
            >
              <option value={60}>{locale === 'ja' ? '1分ごと' : 'Every 1 min'}</option>
              <option value={180}>{locale === 'ja' ? '3分ごと (既定)' : 'Every 3 min (Default)'}</option>
              <option value={300}>{locale === 'ja' ? '5分ごと' : 'Every 5 min'}</option>
              <option value={600}>{locale === 'ja' ? '10分ごと' : 'Every 10 min'}</option>
            </select>
          </div>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.markdownCompatCheckEnabled ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                markdownCompatCheckEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? '校正タブで Markdown 互換性チェック（GitHub / CommonMark）を表示'
              : 'Show Markdown Compatibility Check in Review tab'}
          </span>
        </label>
      </div>

      <div className="settings-card">
        <div className="settings-card-title">
          {locale === 'ja'
            ? '画像の最適化と整理（貼り付け・ドロップ時）'
            : 'Image Optimization & Naming (On Paste / Drop)'}
        </div>

        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings.imageOptimizeOnPasteEnabled)}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                imageOptimizeOnPasteEnabled: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? '貼り付け時に画像を自動リサイズ＆軽量化（WebP変換）する'
              : 'Resize & compress pasted images automatically (WebP)'}
          </span>
        </label>

        {settings.imageOptimizeOnPasteEnabled && (
          <div className="settings-grid-2" style={{ marginTop: 6 }}>
            <div className="field-row">
              <label>{locale === 'ja' ? '最大横幅 (px)' : 'Max Width (px)'}</label>
              <select
                className="select-input"
                value={settings.imageMaxWidth ?? 1600}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    imageMaxWidth: Number(e.target.value),
                  })
                }
              >
                <option value={1280}>1280 px</option>
                <option value={1600}>1600 px</option>
                <option value={1920}>1920 px</option>
                <option value={2560}>2560 px</option>
              </select>
            </div>
            <div className="field-row">
              <label>
                {locale === 'ja'
                  ? `圧縮品質: ${settings.imageQuality ?? 85}%`
                  : `Quality: ${settings.imageQuality ?? 85}%`}
              </label>
              <input
                type="range"
                min={50}
                max={95}
                step={5}
                value={settings.imageQuality ?? 85}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    imageQuality: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        )}

        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.imageAutoOrganizeNames ?? true}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                imageAutoOrganizeNames: e.target.checked,
              })
            }
          />
          <span>
            {locale === 'ja'
              ? '画像ファイル名を日時ベース（YYYYMMDD-HHmmss）で自動整理する'
              : 'Auto-organize pasted image filenames with timestamp'}
          </span>
        </label>

        {settings.imageOptimizeOnPasteEnabled && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.imageKeepOriginal ?? true}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  imageKeepOriginal: e.target.checked,
                })
              }
            />
            <span>
              {locale === 'ja'
                ? '最適化前の元画像を originals/ に残す'
                : 'Keep original unoptimized image in originals/'}
            </span>
          </label>
        )}
      </div>
    </div>
  );
};
