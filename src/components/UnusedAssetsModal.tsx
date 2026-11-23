import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import type { Translations } from '../i18n/types';
import type { Locale, UnusedAssetEntry, WorkspaceEntry } from '../types';
import {
  deleteWorkspaceFiles,
  findUnusedWorkspaceAssets,
  resolveImageSrc,
} from '../utils/platform';

interface UnusedAssetsModalProps {
  t: Translations;
  locale: Locale;
  open: boolean;
  workspaceRoot: string | null;
  workspaceEntries?: WorkspaceEntry[];
  extraContents: string[];
  onClose: () => void;
  onDeleted: (count: number) => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const AssetThumbnail: React.FC<{
  assetPath: string;
  workspaceRoot: string | null;
  name: string;
}> = ({ assetPath, workspaceRoot, name }) => {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    resolveImageSrc(assetPath, workspaceRoot)
      .then((resolved) => {
        if (!cancelled) setSrc(resolved);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [assetPath, workspaceRoot]);

  if (!src) {
    return <div className="unused-asset-thumb placeholder" />;
  }
  return <img src={src} alt={name} className="unused-asset-thumb" loading="lazy" />;
};

export const UnusedAssetsModal: React.FC<UnusedAssetsModalProps> = ({
  t,
  locale,
  open,
  workspaceRoot,
  workspaceEntries = [],
  extraContents,
  onClose,
  onDeleted,
}) => {
  const [viewMode, setViewMode] = useState<'unused' | 'inventory'>('unused');
  const [assets, setAssets] = useState<UnusedAssetEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!workspaceRoot) {
      setAssets([]);
      setSelectedPaths(new Set());
      return;
    }
    setScanning(true);
    setErrorMsg(null);
    try {
      const found = await findUnusedWorkspaceAssets(workspaceRoot, extraContents);
      setAssets(found);
      setSelectedPaths(new Set(found.map((a) => a.path)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }, [workspaceRoot, extraContents]);

  useEffect(() => {
    if (!open) return;
    void runScan();
  }, [open, runScan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const totalBytes = useMemo(
    () => assets.reduce((acc, a) => acc + (a.size || 0), 0),
    [assets]
  );

  const allWorkspaceImages = useMemo(() => {
    return workspaceEntries
      .filter((e) => !e.isDir && /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(e.name))
      .sort((a, b) => (b.size || 0) - (a.size || 0));
  }, [workspaceEntries]);

  const allImagesTotalBytes = useMemo(
    () => allWorkspaceImages.reduce((acc, e) => acc + (e.size || 0), 0),
    [allWorkspaceImages]
  );

  const unusedPathSet = useMemo(() => new Set(assets.map((a) => a.path)), [assets]);

  if (!open) return null;

  const togglePath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!workspaceRoot || selectedPaths.size === 0 || deleting) return;
    const msg = t.unusedAssetsModal.confirmDelete.replace('{count}', String(selectedPaths.size));
    if (!window.confirm(msg)) return;
    setDeleting(true);
    setErrorMsg(null);
    try {
      const targets = Array.from(selectedPaths);
      const res = await deleteWorkspaceFiles(workspaceRoot, targets);
      onDeleted(res.removedFiles);
      await runScan();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="unused-assets-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.unusedAssetsModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <ImageOff size={16} />
            <h3>{t.unusedAssetsModal.title}</h3>
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

        <div className="unused-assets-body">
          <p className="unused-assets-desc">{t.unusedAssetsModal.desc}</p>

          {workspaceRoot && allWorkspaceImages.length > 0 && (
            <div className="unused-assets-view-tabs">
              <button
                type="button"
                className={`mini-pill-btn ${viewMode === 'unused' ? 'is-active' : ''}`}
                onClick={() => setViewMode('unused')}
              >
                {locale === 'ja' ? `未使用画像 (${assets.length})` : `Unused Images (${assets.length})`}
              </button>
              <button
                type="button"
                className={`mini-pill-btn ${viewMode === 'inventory' ? 'is-active' : ''}`}
                onClick={() => setViewMode('inventory')}
              >
                {locale === 'ja'
                  ? `全画像サイズ一覧 (${allWorkspaceImages.length} · ${formatBytes(allImagesTotalBytes)})`
                  : `All Images (${allWorkspaceImages.length} · ${formatBytes(allImagesTotalBytes)})`}
              </button>
            </div>
          )}

          {!workspaceRoot ? (
            <div className="unused-assets-empty">{t.unusedAssetsModal.noFolderHint}</div>
          ) : viewMode === 'inventory' ? (
            <div className="unused-assets-list">
              {allWorkspaceImages.map((img) => {
                const isUnused = unusedPathSet.has(img.path);
                return (
                  <div key={img.path} className="unused-asset-item">
                    <AssetThumbnail
                      assetPath={img.path}
                      workspaceRoot={workspaceRoot}
                      name={img.name}
                    />
                    <div className="unused-asset-info">
                      <div className="unused-asset-rel" title={img.path}>
                        {img.relativePath}
                      </div>
                      <div className="unused-asset-meta">
                        <span>{formatBytes(img.size)}</span>
                        <span>
                          {isUnused
                            ? locale === 'ja'
                              ? '未使用'
                              : 'Unused'
                            : locale === 'ja'
                              ? '使用中'
                              : 'In use'}
                        </span>
                        {img.modifiedMs > 0 && (
                          <span>{new Date(img.modifiedMs).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="unused-assets-toolbar">
                <div className="unused-assets-summary">
                  {scanning
                    ? t.unusedAssetsModal.scanning
                    : t.unusedAssetsModal.summary
                        .replace('{count}', String(assets.length))
                        .replace('{size}', formatBytes(totalBytes))}
                </div>
                <div className="unused-assets-toolbar-actions">
                  {assets.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="secondary-btn sm"
                        onClick={() => setSelectedPaths(new Set(assets.map((a) => a.path)))}
                      >
                        {t.unusedAssetsModal.selectAll}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn sm"
                        onClick={() => setSelectedPaths(new Set())}
                      >
                        {t.unusedAssetsModal.deselectAll}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="secondary-btn sm"
                    onClick={() => void runScan()}
                    disabled={scanning || deleting}
                  >
                    {scanning ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                    <span>{t.unusedAssetsModal.rescanBtn}</span>
                  </button>
                </div>
              </div>

              {errorMsg && <div className="grep-error">{errorMsg}</div>}

              {!scanning && assets.length === 0 ? (
                <div className="unused-assets-empty">{t.unusedAssetsModal.emptyState}</div>
              ) : (
                <div className="unused-assets-list">
                  {assets.map((asset) => {
                    const checked = selectedPaths.has(asset.path);
                    return (
                      <label
                        key={asset.path}
                        className={`unused-asset-item ${checked ? 'is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePath(asset.path)}
                        />
                        <AssetThumbnail
                          assetPath={asset.path}
                          workspaceRoot={workspaceRoot}
                          name={asset.name}
                        />
                        <div className="unused-asset-info">
                          <div className="unused-asset-rel" title={asset.path}>
                            {asset.relativePath}
                          </div>
                          <div className="unused-asset-meta">
                            <span>{formatBytes(asset.size)}</span>
                            {asset.modifiedMs > 0 && (
                              <span>{new Date(asset.modifiedMs).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="unused-assets-footer">
          <button type="button" className="secondary-btn" onClick={onClose}>
            {t.actions.close}
          </button>
          {workspaceRoot && assets.length > 0 && (
            <button
              type="button"
              className="danger-btn"
              disabled={selectedPaths.size === 0 || deleting || scanning}
              onClick={() => void handleDeleteSelected()}
            >
              {deleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
              <span>
                {deleting
                  ? t.unusedAssetsModal.deleting
                  : t.unusedAssetsModal.deleteSelectedBtn.replace(
                      '{count}',
                      String(selectedPaths.size)
                    )}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
