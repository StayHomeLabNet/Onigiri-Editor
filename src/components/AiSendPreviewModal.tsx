import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Send, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import type { Locale } from '../types';
import { detectAndRedactSecrets } from '../utils/aiPrivacy';

export interface AiSendPreviewRequest {
  title: string;
  providerLabel: string;
  modelLabel: string;
  scopeLabel: string;
  attachmentsLabel?: string;
  payloadText: string;
  onConfirm: (finalText: string) => void;
  onCancel?: () => void;
}

interface AiSendPreviewModalProps {
  request: AiSendPreviewRequest | null;
  locale: Locale;
  defaultAutoRedact: boolean;
  onClose: () => void;
}

export const AiSendPreviewModal: React.FC<AiSendPreviewModalProps> = ({
  request,
  locale,
  defaultAutoRedact,
  onClose,
}) => {
  const [redactEnabled, setRedactEnabled] = useState(defaultAutoRedact);
  const [editedText, setEditedText] = useState('');

  const detection = useMemo(
    () => detectAndRedactSecrets(request?.payloadText ?? ''),
    [request?.payloadText]
  );

  useEffect(() => {
    if (!request) return;
    setRedactEnabled(defaultAutoRedact);
    setEditedText(defaultAutoRedact ? detection.redactedText : request.payloadText);
  }, [request, defaultAutoRedact, detection.redactedText]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        request.onCancel?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request, onClose]);

  if (!request) return null;
  const ja = locale === 'ja';
  const estTokens = Math.max(1, Math.ceil(editedText.length / 3.5));

  const handleToggleRedact = (next: boolean) => {
    setRedactEnabled(next);
    setEditedText(next ? detectAndRedactSecrets(request.payloadText).redactedText : request.payloadText);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        request.onCancel?.();
        onClose();
      }}
    >
      <div
        className="modal-card ai-send-preview-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <Eye size={16} />
            <h3>{ja ? 'AI 送信内容プレビュー' : 'AI Send Payload Preview'}</h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              request.onCancel?.();
              onClose();
            }}
            aria-label={ja ? '閉じる' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body ai-send-preview-body">
          <div className="ai-send-meta-grid">
            <div className="ai-send-meta-item">
              <span className="ai-send-meta-label">{ja ? '実行操作' : 'Action'}</span>
              <span className="ai-send-meta-val">{request.title}</span>
            </div>
            <div className="ai-send-meta-item">
              <span className="ai-send-meta-label">{ja ? '送信先モデル' : 'Model'}</span>
              <span className="ai-send-meta-val">
                {request.providerLabel} / {request.modelLabel}
              </span>
            </div>
            <div className="ai-send-meta-item">
              <span className="ai-send-meta-label">{ja ? '送信範囲' : 'Scope'}</span>
              <span className="ai-send-meta-val">{request.scopeLabel}</span>
            </div>
            {request.attachmentsLabel && (
              <div className="ai-send-meta-item">
                <span className="ai-send-meta-label">{ja ? '添付コンテキスト' : 'Attachments'}</span>
                <span className="ai-send-meta-val">{request.attachmentsLabel}</span>
              </div>
            )}
          </div>

          <div className="ai-send-privacy-bar">
            <label className="check-row">
              <input
                type="checkbox"
                checked={redactEnabled}
                onChange={(e) => handleToggleRedact(e.target.checked)}
              />
              <span>
                {ja ? '機密情報（APIキー・トークン等）を伏せ字にする' : 'Mask detected secrets (API keys / tokens)'}
              </span>
            </label>
            {detection.count > 0 ? (
              <span className="ai-secret-badge is-warn">
                <ShieldAlert size={12} />
                <span>
                  {ja
                    ? `${detection.count} 件検出 (${detection.kinds.join(', ')})`
                    : `${detection.count} found (${detection.kinds.join(', ')})`}
                </span>
              </span>
            ) : (
              <span className="ai-secret-badge is-safe">
                <ShieldCheck size={12} />
                <span>{ja ? '機密パターン未検出' : 'No secrets detected'}</span>
              </span>
            )}
          </div>

          <textarea
            className="ai-send-preview-textarea"
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={10}
          />

          <div className="ai-send-stats">
            {ja
              ? `送信サイズ: ${editedText.length.toLocaleString()} 文字（推定 ~${estTokens.toLocaleString()} トークン）— 送信前にこの場で直接編集も可能です`
              : `Payload: ${editedText.length.toLocaleString()} chars (~${estTokens.toLocaleString()} tokens) — editable before sending`}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              request.onCancel?.();
              onClose();
            }}
          >
            {ja ? 'キャンセル' : 'Cancel'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              const payload = editedText;
              onClose();
              request.onConfirm(payload);
            }}
          >
            <Send size={13} />
            <span>{ja ? 'この内容で送信' : 'Send to AI'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
