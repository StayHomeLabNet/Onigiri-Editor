import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Link2, Upload, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import { openImageFileDialog, resolveImageSrc, saveImageAsset } from '../utils/platform';

interface ImageModalProps {
  t: Translations;
  open: boolean;
  docPath?: string;
  workspaceRoot?: string | null;
  imageAssetFolder?: string;
  onClose: () => void;
  onInsert: (src: string, alt: string) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  t,
  open,
  docPath,
  workspaceRoot,
  imageAssetFolder,
  onClose,
  onInsert,
}) => {
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [src, setSrc] = useState('');
  const [alt, setAlt] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (open) {
      setSrc('');
      setAlt('');
      setPreviewUrl('');
      setFileName('');
      setTab('file');
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    if (!src.trim()) {
      setPreviewUrl('');
      return;
    }
    resolveImageSrc(src.trim(), docPath || workspaceRoot).then((resolved) => {
      if (active) setPreviewUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [src, docPath, workspaceRoot]);

  if (!open) return null;

  const handleChooseFile = async () => {
    const picked = await openImageFileDialog();
    if (!picked) return;
    let finalSrc = picked.path;
    if (!picked.dataUrl) {
      try {
        finalSrc = await saveImageAsset(picked.path, docPath, workspaceRoot, imageAssetFolder);
      } catch {
        finalSrc = picked.path;
      }
    }
    setSrc(finalSrc);
    setFileName(picked.name);
    if (!alt) {
      setAlt(picked.name.replace(/\.[^.]+$/, ''));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = src.trim();
    if (!cleaned) return;
    onInsert(cleaned, alt.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="image-modal" onClick={(e) => e.stopPropagation()}>
        <div className="image-modal-header">
          <div className="image-modal-title">
            <ImageIcon size={16} />
            <span>{t.imageModal.title}</span>
          </div>
          <button type="button" className="icon-btn-sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="image-modal-tabs">
          <button
            type="button"
            className={`image-tab-btn ${tab === 'file' ? 'is-active' : ''}`}
            onClick={() => setTab('file')}
          >
            <Upload size={13} />
            <span>{t.imageModal.tabFile}</span>
          </button>
          <button
            type="button"
            className={`image-tab-btn ${tab === 'url' ? 'is-active' : ''}`}
            onClick={() => setTab('url')}
          >
            <Link2 size={13} />
            <span>{t.imageModal.tabUrl}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="image-modal-form">
          {tab === 'file' ? (
            <div className="field-row">
              <button
                type="button"
                className="secondary-btn"
                onClick={handleChooseFile}
              >
                <Upload size={14} />
                <span>{t.imageModal.chooseFile}</span>
              </button>
              {fileName && (
                <div className="image-selected-info">
                  <span className="muted-label">{t.imageModal.selectedFile}:</span>{' '}
                  <code>{src}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="field-row">
              <label>{t.imageModal.urlLabel}</label>
              <input
                type="text"
                className="text-input"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                placeholder={t.imageModal.urlPlaceholder}
                autoFocus
              />
            </div>
          )}

          <div className="field-row">
            <label>{t.imageModal.altLabel}</label>
            <input
              type="text"
              className="text-input"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={t.imageModal.altPlaceholder}
            />
          </div>

          {previewUrl && (
            <div className="image-modal-preview">
              <img src={previewUrl} alt={alt || 'Preview'} />
            </div>
          )}

          <p className="image-modal-tip">{t.imageModal.dropTip}</p>

          <div className="image-modal-footer">
            <button type="button" className="secondary-btn" onClick={onClose}>
              {t.actions.cancel}
            </button>
            <button type="submit" className="primary-btn" disabled={!src.trim()}>
              {t.imageModal.insertBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
