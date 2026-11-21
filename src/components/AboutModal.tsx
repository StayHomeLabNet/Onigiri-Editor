import React from 'react';
import { Download, FileText, RefreshCw, Rocket, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { AppUpdateInfo } from '../types';
import { formatShortcut, isTauri } from '../utils/platform';

interface AboutModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
  updateInfo?: AppUpdateInfo | null;
  checkingUpdates?: boolean;
  onCheckUpdates?: () => void;
  onOpenExternalUrl?: (url: string) => void;
  onOpenUpdateModal?: () => void;
  onAutoUpdateNow?: () => void;
  isUpdatingApp?: boolean;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  t,
  open,
  onClose,
  updateInfo,
  checkingUpdates,
  onCheckUpdates,
  onOpenExternalUrl,
  onOpenUpdateModal,
  onAutoUpdateNow,
  isUpdatingApp,
}) => {
  if (!open) return null;

  const currentVersion = t.versionLabel.replace(/^v/i, '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close-btn" onClick={onClose}>
          <X size={16} />
        </button>

        <div className="about-hero">
          <img src="/icon.png" alt="Onigiri Editor" className="about-logo" />
          <div>
            <h2>
              {t.appName} <span className="version-pill">{t.versionLabel}</span>
            </h2>
            <p className="about-desc">{t.dialogs.aboutDesc}</p>
          </div>
        </div>

        {isTauri() && onCheckUpdates && (
          <div className="about-update-row">
            <div className="about-update-status">
              {updateInfo?.hasUpdate ? (
                <span className="update-badge-new">
                  {t.updates.availableBannerTitle.replace('{version}', updateInfo.latestVersion)}
                </span>
              ) : updateInfo ? (
                <span className="about-update-ok">
                  {t.updates.upToDateLabel.replace('{version}', updateInfo.currentVersion || currentVersion)}
                </span>
              ) : null}
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
                  <span>
                    {isUpdatingApp ? t.updates.updatingBtn : t.updates.autoUpdateNowBtn}
                  </span>
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
                  onClick={() => {
                    onClose();
                    onOpenUpdateModal();
                  }}
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

        <h4 className="shortcuts-heading">{t.dialogs.shortcutsTitle}</h4>
        <div className="shortcuts-grid">
          {t.dialogs.shortcuts.map((s) => (
            <div key={s.keys} className="shortcut-row">
              <kbd>{formatShortcut(s.keys)}</kbd>
              <span>{s.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

