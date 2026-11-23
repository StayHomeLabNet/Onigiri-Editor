import React, { useState } from 'react';
import { Download, FileCode, Printer, X } from 'lucide-react';
import type {
  ExportDesignTheme,
  ExportMarginPreset,
  ExportOrientation,
  ExportPageSettings,
  ExportPaperSize,
  Locale,
} from '../types';
import { DEFAULT_EXPORT_PAGE_SETTINGS } from '../utils/exportPresets';

interface ExportOptionsModalProps {
  open: boolean;
  locale: Locale;
  initialMode: 'html' | 'pdf';
  settings: ExportPageSettings;
  onSaveSettings: (next: ExportPageSettings) => void;
  onExportHtml: (settings: ExportPageSettings) => void;
  onExportPdf: (settings: ExportPageSettings) => void;
  onClose: () => void;
}

export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
  open,
  locale,
  initialMode,
  settings,
  onSaveSettings,
  onExportHtml,
  onExportPdf,
  onClose,
}) => {
  const [draft, setDraft] = useState<ExportPageSettings>({
    ...DEFAULT_EXPORT_PAGE_SETTINGS,
    ...settings,
  });

  if (!open) return null;
  const ja = locale === 'ja';

  const update = <K extends keyof ExportPageSettings>(key: K, value: ExportPageSettings[K]) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    onSaveSettings(next);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card export-options-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            {initialMode === 'pdf' ? <Printer size={16} /> : <FileCode size={16} />}
            <h3>
              {ja
                ? initialMode === 'pdf'
                  ? 'PDF / 印刷 ページ設定＆書き出し'
                  : 'HTML デザイン＆ページ設定して書き出し'
                : initialMode === 'pdf'
                  ? 'PDF / Print Page Settings & Export'
                  : 'HTML Design & Page Settings Export'}
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label={ja ? '閉じる' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body export-options-body">
          <div className="export-opt-grid">
            <label className="export-opt-field">
              <span>{ja ? 'デザインテーマ' : 'Design Theme'}</span>
              <select
                value={draft.designTheme}
                onChange={(e) => update('designTheme', e.target.value as ExportDesignTheme)}
              >
                <option value="modern">{ja ? 'モダン（標準・バランス重視）' : 'Modern (Clean Default)'}</option>
                <option value="business">{ja ? 'ビジネス（青い見出し・提案書向け）' : 'Business (Blue Accents / Proposals)'}</option>
                <option value="academic">{ja ? '学術・レポート（明朝・両端揃え）' : 'Academic (Serif / Justified)'}</option>
              </select>
            </label>

            <label className="export-opt-field">
              <span>{ja ? '用紙サイズ' : 'Paper Size'}</span>
              <select
                value={draft.paperSize}
                onChange={(e) => update('paperSize', e.target.value as ExportPaperSize)}
              >
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">Letter (8.5 × 11 in)</option>
                <option value="B5">B5 (176 × 250 mm)</option>
              </select>
            </label>

            <label className="export-opt-field">
              <span>{ja ? '用紙の向き' : 'Orientation'}</span>
              <select
                value={draft.orientation}
                onChange={(e) => update('orientation', e.target.value as ExportOrientation)}
              >
                <option value="portrait">{ja ? '縦向き (Portrait)' : 'Portrait'}</option>
                <option value="landscape">{ja ? '横向き (Landscape)' : 'Landscape'}</option>
              </select>
            </label>

            <label className="export-opt-field">
              <span>{ja ? '余白' : 'Page Margins'}</span>
              <select
                value={draft.margin}
                onChange={(e) => update('margin', e.target.value as ExportMarginPreset)}
              >
                <option value="narrow">{ja ? '狭い (12mm)' : 'Narrow (12mm)'}</option>
                <option value="normal">{ja ? '標準 (20mm)' : 'Normal (20mm)'}</option>
                <option value="wide">{ja ? '広い (28mm)' : 'Wide (28mm)'}</option>
              </select>
            </label>
          </div>

          <label className="export-opt-checkbox">
            <input
              type="checkbox"
              checked={draft.showPageNumbers}
              onChange={(e) => update('showPageNumbers', e.target.checked)}
            />
            <span>{ja ? 'ページ番号を表示する（例: 1 / 10）' : 'Show page numbers (e.g. 1 / 10)'}</span>
          </label>

          <label className="export-opt-field">
            <span>{ja ? 'ヘッダー文字列（任意・{{title}} で文書名）' : 'Header Text (optional, {{title}} for doc title)'}</span>
            <input
              type="text"
              value={draft.headerText}
              onChange={(e) => update('headerText', e.target.value)}
              placeholder={ja ? '例: {{title}} — 社外秘' : 'e.g. {{title}} — Confidential'}
            />
          </label>

          <label className="export-opt-field">
            <span>{ja ? 'フッター文字列（任意）' : 'Footer Text (optional)'}</span>
            <input
              type="text"
              value={draft.footerText}
              onChange={(e) => update('footerText', e.target.value)}
              placeholder={ja ? '例: © 2026 StayHomeLabNet' : 'e.g. © 2026 StayHomeLabNet'}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const reset = { ...DEFAULT_EXPORT_PAGE_SETTINGS };
              setDraft(reset);
              onSaveSettings(reset);
            }}
          >
            {ja ? '既定に戻す' : 'Reset'}
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className={initialMode === 'html' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              onClose();
              onExportHtml(draft);
            }}
          >
            <Download size={14} />
            <span>{ja ? 'HTML 書き出し' : 'Export HTML'}</span>
          </button>
          <button
            type="button"
            className={initialMode === 'pdf' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => {
              onClose();
              onExportPdf(draft);
            }}
          >
            <Printer size={14} />
            <span>{ja ? 'PDF / 印刷' : 'Export PDF / Print'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
