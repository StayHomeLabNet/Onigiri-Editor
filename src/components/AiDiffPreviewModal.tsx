import React, { useEffect, useMemo, useState } from 'react';
import { diffLines } from 'diff';
import { Check, FileDiff, FilePlus2, X } from 'lucide-react';
import type { Translations } from '../i18n/types';

export interface DiffPreviewRequest {
  title: string;
  targetPath?: string;
  isNewFile?: boolean;
  originalText: string;
  proposedText: string;
  originalLabel?: string;
  proposedLabel?: string;
  showSnapshotOption?: boolean;
  defaultCreateSnapshot?: boolean;
  confirmLabel: string;
  secondaryActionLabel?: string;
  onConfirm: (createSnapshot: boolean) => void | Promise<void>;
  onSecondaryAction?: () => void | Promise<void>;
}

interface AiDiffPreviewModalProps {
  t: Translations;
  request: DiffPreviewRequest | null;
  onClose: () => void;
}

interface DiffDisplayLine {
  kind: 'added' | 'removed' | 'same';
  text: string;
  oldLine?: number;
  newLine?: number;
}

export const AiDiffPreviewModal: React.FC<AiDiffPreviewModalProps> = ({
  t,
  request,
  onClose,
}) => {
  const [createSnapshot, setCreateSnapshot] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request) {
      setCreateSnapshot(request.defaultCreateSnapshot ?? true);
      setBusy(false);
    }
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, busy, onClose]);

  const diffData = useMemo(() => {
    if (!request) return { lines: [] as DiffDisplayLine[], additions: 0, deletions: 0 };
    const parts = diffLines(request.originalText, request.proposedText);
    const lines: DiffDisplayLine[] = [];
    let additions = 0;
    let deletions = 0;
    let oldNum = 1;
    let newNum = 1;

    for (const part of parts) {
      const rawLines = part.value.split('\n');
      if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
      }
      if (rawLines.length === 0 && part.value === '\n') {
        rawLines.push('');
      }
      for (const line of rawLines) {
        if (part.added) {
          additions += 1;
          lines.push({ kind: 'added', text: line, newLine: newNum++ });
        } else if (part.removed) {
          deletions += 1;
          lines.push({ kind: 'removed', text: line, oldLine: oldNum++ });
        } else {
          lines.push({ kind: 'same', text: line, oldLine: oldNum++, newLine: newNum++ });
        }
      }
    }

    return { lines, additions, deletions };
  }, [request]);

  if (!request) return null;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await request.onConfirm(createSnapshot);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleSecondary = async () => {
    if (!request.onSecondaryAction || busy) return;
    setBusy(true);
    try {
      await request.onSecondaryAction();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="ai-diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-diff-modal-header">
          <div className="ai-diff-modal-title-row">
            {request.isNewFile ? <FilePlus2 size={17} /> : <FileDiff size={17} />}
            <h3>{request.title}</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={() => !busy && onClose()}
            title={t.actions.close}
          >
            <X size={16} />
          </button>
        </div>

        <div className="ai-diff-modal-meta">
          <div className="ai-diff-target">
            {request.targetPath && <code className="ai-diff-path">{request.targetPath}</code>}
            {request.isNewFile && (
              <span className="ai-diff-new-badge">{t.aiDiffModal.newFileBadge}</span>
            )}
          </div>
          <div className="diff-summary">
            <span className="diff-add">
              +{diffData.additions} {t.inspector.diffLabels.additions}
            </span>
            <span className="diff-del">
              -{diffData.deletions} {t.inspector.diffLabels.deletions}
            </span>
          </div>
        </div>

        {(request.originalLabel || request.proposedLabel) && (
          <div className="ai-diff-legend">
            <span className="ai-diff-legend-old">− {request.originalLabel || t.aiDiffModal.beforeLabel}</span>
            <span className="ai-diff-legend-new">+ {request.proposedLabel || t.aiDiffModal.afterLabel}</span>
          </div>
        )}

        <div className="ai-diff-viewer">
          {diffData.additions === 0 && diffData.deletions === 0 && !request.isNewFile ? (
            <div className="ai-diff-empty">{t.aiDiffModal.noChanges}</div>
          ) : (
            diffData.lines.map((line, idx) => {
              const cls =
                line.kind === 'added'
                  ? 'is-added'
                  : line.kind === 'removed'
                    ? 'is-removed'
                    : 'is-same';
              const marker = line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' ';
              return (
                <div key={idx} className={`ai-diff-line ${cls}`}>
                  <span className="ai-diff-ln">{line.oldLine ?? ''}</span>
                  <span className="ai-diff-ln">{line.newLine ?? ''}</span>
                  <span className="ai-diff-sign">{marker}</span>
                  <span className="ai-diff-code">{line.text || ' '}</span>
                </div>
              );
            })
          )}
        </div>

        {request.showSnapshotOption && (
          <label className="check-row ai-diff-snapshot-check">
            <input
              type="checkbox"
              checked={createSnapshot}
              onChange={(e) => setCreateSnapshot(e.target.checked)}
              disabled={busy}
            />
            <span>{t.aiDiffModal.saveSnapshotLabel}</span>
          </label>
        )}

        <div className="ai-diff-modal-footer">
          <button
            type="button"
            className="secondary-btn"
            onClick={onClose}
            disabled={busy}
          >
            {t.actions.cancel}
          </button>
          <div className="ai-diff-modal-actions-right">
            {request.secondaryActionLabel && request.onSecondaryAction && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleSecondary}
                disabled={busy}
              >
                {request.secondaryActionLabel}
              </button>
            )}
            <button
              type="button"
              className="primary-btn"
              onClick={handleConfirm}
              disabled={busy}
            >
              <Check size={14} />
              <span>{request.confirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
