import React, { useState } from 'react';
import { Copy, ExternalLink, Info, QrCode, Square } from 'lucide-react';
import { QrCodeCard } from '../LanUrlList';
import type { Translations } from '../../i18n/types';
import type { AiFolderMode, EditorSettings, ProjectServerStatus } from '../../types';
import { getHostOs } from '../../utils/platform';

interface IntegrationsTabProps {
  t: Translations;
  settings: EditorSettings;
  onSettingsChange: (next: EditorSettings) => void;
  externalPreviewUrl: string | null;
  externalPreviewLanUrls: string[];
  onToggleExternalPreview: () => void;
  onCopyLanUrl?: (url: string) => void;
  projectServer?: ProjectServerStatus | null;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  t,
  settings,
  onSettingsChange,
  externalPreviewUrl,
  externalPreviewLanUrls,
  onToggleExternalPreview,
  onCopyLanUrl,
  projectServer,
}) => {
  const [activeLanQrUrl, setActiveLanQrUrl] = useState<string | null>(null);

  return (
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
            <option value="disabled">{t.inspector.settingsLabels.aiFolderModes.disabled}</option>
            <option value="read-only">{t.inspector.settingsLabels.aiFolderModes.readOnly}</option>
            <option value="read-write-approve">
              {t.inspector.settingsLabels.aiFolderModes.readWriteApprove}
            </option>
            <option value="cli-direct">{t.inspector.settingsLabels.aiFolderModes.cliDirect}</option>
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
        <div className="ai-hint-text">
          {t.inspector.settingsLabels.builtinBrowserDefaultUrlHint}
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
                  externalBrowserPort: Math.max(
                    1024,
                    Math.min(65535, Number(e.target.value) || 49123)
                  ),
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
                {externalPreviewUrl ? t.browser.externalStopBtn : t.browser.externalLiveBtn}
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
                  <button
                    type="button"
                    className={`mini-pill-btn ${activeLanQrUrl === lanUrl ? 'is-active' : ''}`}
                    onClick={() =>
                      setActiveLanQrUrl((cur) => (cur === lanUrl ? null : lanUrl))
                    }
                    title={
                      activeLanQrUrl === lanUrl ? t.project.qrHideTitle : t.project.qrShowTitle
                    }
                  >
                    <QrCode size={11} />
                  </button>
                </div>
              ))}
            {activeLanQrUrl && externalPreviewLanUrls.includes(activeLanQrUrl) && (
              <QrCodeCard
                url={activeLanQrUrl}
                scanHint={t.project.qrScanHint}
                copyTitle={t.actions.copyLanUrl}
                closeTitle={t.project.qrHideTitle}
                onCopyUrl={onCopyLanUrl}
                onClose={() => setActiveLanQrUrl(null)}
              />
            )}
          </div>
        )}
        <div className="ai-hint-text">{t.settingsModal.externalPreviewCrossPlatformNote}</div>
      </div>

      <div className="settings-card">
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(settings.projectServerAllowLan)}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                projectServerAllowLan: e.target.checked,
              })
            }
          />
          <span>{t.inspector.settingsLabels.projectServerAllowLan}</span>
        </label>
        <div className="ai-hint-text">
          {t.inspector.settingsLabels.projectServerAllowLanHint}
        </div>
        {projectServer?.running && projectServer.url && (
          <div className="lan-url-list">
            <div className="lan-url-row">
              <span className="lan-url-badge">Local</span>
              <code>{projectServer.url}</code>
            </div>
            {settings.projectServerAllowLan &&
              (projectServer.lanUrls ?? []).map((lanUrl) => (
                <div key={lanUrl} className="lan-url-row">
                  <span className="lan-url-badge is-lan">LAN</span>
                  <code>{lanUrl}</code>
                  {onCopyLanUrl && (
                    <button
                      type="button"
                      className="mini-pill-btn"
                      onClick={() => onCopyLanUrl(lanUrl)}
                      title={t.project.lanUrlCopyTitle}
                    >
                      <Copy size={11} />
                      <span>{t.actions.copyLanUrl}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`mini-pill-btn ${activeLanQrUrl === lanUrl ? 'is-active' : ''}`}
                    onClick={() =>
                      setActiveLanQrUrl((cur) => (cur === lanUrl ? null : lanUrl))
                    }
                    title={
                      activeLanQrUrl === lanUrl ? t.project.qrHideTitle : t.project.qrShowTitle
                    }
                  >
                    <QrCode size={11} />
                  </button>
                </div>
              ))}
            {activeLanQrUrl && (projectServer.lanUrls ?? []).includes(activeLanQrUrl) && (
              <QrCodeCard
                url={activeLanQrUrl}
                scanHint={t.project.qrScanHint}
                copyTitle={t.project.lanUrlCopyTitle}
                closeTitle={t.project.qrHideTitle}
                onCopyUrl={onCopyLanUrl}
                onClose={() => setActiveLanQrUrl(null)}
              />
            )}
            {settings.projectServerAllowLan &&
              projectServer.external &&
              (!projectServer.lanUrls || projectServer.lanUrls.length === 0) && (
                <div className="ai-hint-text">{t.project.externalLanUnavailableHint}</div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
