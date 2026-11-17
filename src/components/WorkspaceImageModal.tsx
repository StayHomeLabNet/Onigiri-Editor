import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, PlusCircle, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { WorkspaceEntry } from '../types';
import { resolveImageSrc } from '../utils/platform';

const RASTER_IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|avif)$/i;

function normPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function parentFolderKey(relPath: string): string {
  const norm = normPath(relPath);
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(0, idx) : '';
}

function computeRelativeLink(
  imageAbsPath: string,
  activeDocPath?: string,
  workspaceRoot?: string | null
): string {
  const imgNorm = normPath(imageAbsPath);
  const baseDir = activeDocPath
    ? normPath(activeDocPath).replace(/\/[^/]+$/, '')
    : workspaceRoot
      ? normPath(workspaceRoot).replace(/\/+$/, '')
      : '';
  if (!baseDir) return imageAbsPath;

  const imgParts = imgNorm.split('/').filter(Boolean);
  const baseParts = baseDir.split('/').filter(Boolean);
  // Ensure drive letters / root match cleanly (case-insensitive on Windows drives)
  if (
    imgParts.length === 0 ||
    baseParts.length === 0 ||
    imgParts[0].toLowerCase() !== baseParts[0].toLowerCase()
  ) {
    return imageAbsPath;
  }

  let common = 0;
  while (
    common < imgParts.length &&
    common < baseParts.length &&
    imgParts[common] === baseParts[common]
  ) {
    common++;
  }
  const ups = Array(baseParts.length - common).fill('..');
  const downs = imgParts.slice(common);
  const joined = [...ups, ...downs].join('/');
  return joined || imgParts[imgParts.length - 1];
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface WorkspaceImageModalProps {
  t: Translations;
  imagePath: string | null;
  workspaceRoot: string | null;
  entries: WorkspaceEntry[];
  activeDocPath?: string;
  onSelectImagePath: (path: string) => void;
  onClose: () => void;
  onInsertToEditor?: (src: string, alt: string) => void;
}

export const WorkspaceImageModal: React.FC<WorkspaceImageModalProps> = ({
  t,
  imagePath,
  workspaceRoot,
  entries,
  activeDocPath,
  onSelectImagePath,
  onClose,
  onInsertToEditor,
}) => {
  const [srcUrl, setSrcUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  const siblings = useMemo(() => {
    if (!imagePath) return [];
    const currentEntry = entries.find((e) => !e.isDir && e.path === imagePath);
    const targetFolder = currentEntry
      ? parentFolderKey(currentEntry.relativePath)
      : parentFolderKey(imagePath);

    const list = entries.filter((e) => {
      if (e.isDir || !RASTER_IMAGE_EXT_RE.test(e.name)) return false;
      const folder = currentEntry ? parentFolderKey(e.relativePath) : parentFolderKey(e.path);
      return folder === targetFolder;
    });

    list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    return list.length > 0
      ? list
      : [
          {
            name: imagePath.split(/[/\\]/).pop() || imagePath,
            path: imagePath,
            relativePath: imagePath,
            isDir: false,
            size: 0,
            modifiedMs: 0,
          },
        ];
  }, [imagePath, entries]);

  const currentIdx = useMemo(() => {
    if (!imagePath) return -1;
    return siblings.findIndex((s) => s.path === imagePath);
  }, [imagePath, siblings]);

  const currentEntry = currentIdx >= 0 ? siblings[currentIdx] : siblings[0] || null;

  const goPrev = useCallback(() => {
    if (siblings.length <= 1 || currentIdx < 0) return;
    const prevIdx = (currentIdx - 1 + siblings.length) % siblings.length;
    onSelectImagePath(siblings[prevIdx].path);
  }, [siblings, currentIdx, onSelectImagePath]);

  const goNext = useCallback(() => {
    if (siblings.length <= 1 || currentIdx < 0) return;
    const nextIdx = (currentIdx + 1) % siblings.length;
    onSelectImagePath(siblings[nextIdx].path);
  }, [siblings, currentIdx, onSelectImagePath]);

  useEffect(() => {
    if (!imagePath) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setDimensions(null);
    setSrcUrl('');

    resolveImageSrc(imagePath, workspaceRoot)
      .then((resolved) => {
        if (cancelled) return;
        setSrcUrl(resolved);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [imagePath, workspaceRoot]);

  useEffect(() => {
    if (!imagePath) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [imagePath, onClose, goPrev, goNext]);

  if (!imagePath || !currentEntry) return null;

  const titleText = currentEntry.relativePath || currentEntry.name;
  const sizeText = formatBytes(currentEntry.size);

  const handleInsert = () => {
    if (!onInsertToEditor) return;
    const rel = computeRelativeLink(currentEntry.path, activeDocPath, workspaceRoot);
    const alt = currentEntry.name.replace(/\.[^.]+$/, '');
    onInsertToEditor(rel, alt);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="workspace-image-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.workspaceImageModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title workspace-image-title-wrap">
            <ImageIcon size={16} />
            <h3 title={currentEntry.path}>{titleText}</h3>
            {siblings.length > 1 && (
              <span className="workspace-image-counter">
                {currentIdx + 1} / {siblings.length}
              </span>
            )}
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="workspace-image-stage">
          {siblings.length > 1 && (
            <button
              type="button"
              className="workspace-image-nav is-prev"
              onClick={goPrev}
              title={t.workspaceImageModal.prev}
              aria-label={t.workspaceImageModal.prev}
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {loading ? (
            <div className="workspace-image-status">{t.workspaceImageModal.loading}</div>
          ) : loadError || !srcUrl ? (
            <div className="workspace-image-status is-error">
              {t.workspaceImageModal.loadError}
            </div>
          ) : (
            <img
              src={srcUrl}
              alt={currentEntry.name}
              className="workspace-image-img"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
                }
              }}
              onError={() => setLoadError(true)}
            />
          )}

          {siblings.length > 1 && (
            <button
              type="button"
              className="workspace-image-nav is-next"
              onClick={goNext}
              title={t.workspaceImageModal.next}
              aria-label={t.workspaceImageModal.next}
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {siblings.length > 1 && (
          <div className="workspace-image-strip">
            {siblings.map((item, idx) => (
              <button
                key={item.path}
                type="button"
                className={`workspace-image-chip ${idx === currentIdx ? 'is-active' : ''}`}
                onClick={() => onSelectImagePath(item.path)}
                title={item.name}
              >
                {item.name}
              </button>
            ))}
          </div>
        )}

        <div className="workspace-image-footer">
          <div className="workspace-image-meta">
            {dimensions && (
              <span>
                {dimensions.w} × {dimensions.h}
              </span>
            )}
            {sizeText && <span>{sizeText}</span>}
          </div>
          <div className="workspace-image-actions">
            {onInsertToEditor && (
              <button type="button" className="secondary-btn" onClick={handleInsert}>
                <PlusCircle size={14} />
                <span>{t.workspaceImageModal.insertBtn}</span>
              </button>
            )}
            <button type="button" className="primary-btn" onClick={onClose}>
              {t.actions.close}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
