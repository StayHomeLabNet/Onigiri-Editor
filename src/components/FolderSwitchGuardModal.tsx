import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Translations } from '../i18n/types';

export type FolderSwitchGuardMode = 'server-running' | 'setup-busy';

interface FolderSwitchGuardModalProps {
  t: Translations;
  mode: FolderSwitchGuardMode | null;
  externalServer?: boolean;
  commandLabel?: string | null;
  serverUrl?: string | null;
  rootPath?: string | null;
  stopping?: boolean;
  onClose: () => void;
  onConfirmStopAndSwitch: () => void;
}

export const FolderSwitchGuardModal: React.FC<FolderSwitchGuardModalProps> = ({
  t,
  mode,
  externalServer = false,
  commandLabel,
  serverUrl,
  rootPath,
  stopping = false,
  onClose,
  onConfirmStopAndSwitch,
}) => {
  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !stopping) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [mode, stopping, onClose]);

  if (!mode) return null;

  const isSetupBusy = mode === 'setup-busy';
  const title = isSetupBusy
    ? t.folderGuardModal.setupBusyTitle
    : t.folderGuardModal.serverRunningTitle;
  const description = isSetupBusy
    ? t.folderGuardModal.setupBusyDesc
    : externalServer
      ? t.folderGuardModal.externalServerDesc
      : t.folderGuardModal.serverRunningDesc;

  const folderName = rootPath ? rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath : null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!stopping) onClose();
      }}
    >
      <div
        className="folder-guard-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <AlertTriangle size={16} className="folder-guard-icon" />
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={stopping}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="folder-guard-body">
          <p className="folder-guard-desc">{description}</p>

          {!isSetupBusy && (folderName || commandLabel || serverUrl) && (
            <div className="folder-guard-meta">
              {folderName && (
                <div className="folder-guard-meta-row">
                  <span className="folder-guard-meta-key">{t.folderGuardModal.folderLabel}</span>
                  <code className="folder-guard-meta-val" title={rootPath || undefined}>
                    {folderName}
                  </code>
                </div>
              )}
              {commandLabel && (
                <div className="folder-guard-meta-row">
                  <span className="folder-guard-meta-key">{t.folderGuardModal.commandLabel}</span>
                  <code className="folder-guard-meta-val">{commandLabel}</code>
                </div>
              )}
              {serverUrl && (
                <div className="folder-guard-meta-row">
                  <span className="folder-guard-meta-key">{t.folderGuardModal.urlLabel}</span>
                  <code className="folder-guard-meta-val">{serverUrl}</code>
                </div>
              )}
            </div>
          )}

          <div className="folder-guard-actions">
            {isSetupBusy ? (
              <button type="button" className="primary-btn" onClick={onClose} autoFocus>
                {t.folderGuardModal.okBtn}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={onClose}
                  disabled={stopping}
                >
                  {t.actions.cancel}
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={onConfirmStopAndSwitch}
                  disabled={stopping}
                  autoFocus
                >
                  {stopping
                    ? t.folderGuardModal.stoppingBtn
                    : externalServer
                      ? t.folderGuardModal.disconnectAndSwitchBtn
                      : t.folderGuardModal.stopAndSwitchBtn}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
