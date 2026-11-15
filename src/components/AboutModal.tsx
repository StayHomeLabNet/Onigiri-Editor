import React from 'react';
import { X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import { formatShortcut } from '../utils/platform';

interface AboutModalProps {
  t: Translations;
  open: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ t, open, onClose }) => {
  if (!open) return null;

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
