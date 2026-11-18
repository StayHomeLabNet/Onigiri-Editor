import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileStack, Plus, Trash2, X } from 'lucide-react';
import type { DocumentTemplate, Locale } from '../types';
import type { Translations } from '../i18n/types';
import {
  BUILTIN_TEMPLATES,
  expandTemplateVariables,
  formatLocalDateYmd,
  loadCustomTemplates,
  saveCustomTemplates,
} from '../utils/templates';

interface TemplatePickerModalProps {
  t: Translations;
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onOpenDailyNote: () => void;
  onCreateFromTemplate: (payload: {
    title: string;
    fileName: string;
    content: string;
  }) => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  t,
  locale,
  open,
  onClose,
  onOpenDailyNote,
  onCreateFromTemplate,
}) => {
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplate[]>(() =>
    loadCustomTemplates()
  );
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [editingNew, setEditingNew] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftFileName, setDraftFileName] = useState('{{date}}-note.md');
  const [draftContent, setDraftContent] = useState('# {{title}}\n\n- Date: {{date}}\n');

  useEffect(() => {
    if (!open) return;
    setCustomTemplates(loadCustomTemplates());
    setEditingNew(false);
  }, [open]);

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

  const allTemplates = useMemo(
    () => [...customTemplates, ...BUILTIN_TEMPLATES],
    [customTemplates]
  );

  const selectedTemplate = useMemo(
    () => allTemplates.find((item) => item.id === selectedId) || allTemplates[0] || null,
    [allTemplates, selectedId]
  );

  const todayYmd = formatLocalDateYmd();

  const expandedPreview = useMemo(() => {
    if (!selectedTemplate) return '';
    const title =
      locale === 'ja' && selectedTemplate.titleJa
        ? selectedTemplate.titleJa
        : selectedTemplate.title;
    return expandTemplateVariables(selectedTemplate.content, { title });
  }, [selectedTemplate, locale]);

  if (!open) return null;

  const handleUseSelected = () => {
    if (!selectedTemplate) return;
    const title =
      locale === 'ja' && selectedTemplate.titleJa
        ? selectedTemplate.titleJa
        : selectedTemplate.title;
    const fileNameRaw = expandTemplateVariables(selectedTemplate.fileNamePattern, { title });
    const fileName = fileNameRaw.toLowerCase().endsWith('.md')
      ? fileNameRaw
      : `${fileNameRaw}.md`;
    const content = expandTemplateVariables(selectedTemplate.content, { title });
    onCreateFromTemplate({ title, fileName, content });
    onClose();
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftContent.trim()) return;
    const newTpl: DocumentTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: draftTitle.trim(),
      description: draftDesc.trim(),
      fileNamePattern: draftFileName.trim() || '{{date}}-note.md',
      content: draftContent,
      isBuiltin: false,
    };
    const next = [newTpl, ...customTemplates];
    setCustomTemplates(next);
    saveCustomTemplates(next);
    setSelectedId(newTpl.id);
    setEditingNew(false);
    setDraftTitle('');
    setDraftDesc('');
  };

  const handleDeleteCustom = (id: string) => {
    const next = customTemplates.filter((item) => item.id !== id);
    setCustomTemplates(next);
    saveCustomTemplates(next);
    if (selectedId === id) {
      setSelectedId(next[0]?.id || BUILTIN_TEMPLATES[0].id);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="template-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.templateModal.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encoding-modal-header">
          <div className="encoding-modal-title">
            <FileStack size={16} />
            <h3>{t.templateModal.title}</h3>
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

        <div className="template-modal-top">
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              onOpenDailyNote();
              onClose();
            }}
          >
            <CalendarDays size={14} />
            <span>{t.templateModal.dailyNoteQuickBtn.replace('{date}', todayYmd)}</span>
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => setEditingNew((v) => !v)}
          >
            <Plus size={14} />
            <span>{t.templateModal.newCustomBtn}</span>
          </button>
        </div>

        <div className="template-modal-body">
          <div className="template-list-col">
            {allTemplates.map((tpl) => {
              const title = locale === 'ja' && tpl.titleJa ? tpl.titleJa : tpl.title;
              const desc = locale === 'ja' && tpl.descriptionJa ? tpl.descriptionJa : tpl.description;
              return (
                <div
                  key={tpl.id}
                  className={`template-list-item ${
                    !editingNew && selectedTemplate?.id === tpl.id ? 'is-active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="template-item-btn"
                    onClick={() => {
                      setEditingNew(false);
                      setSelectedId(tpl.id);
                    }}
                  >
                    <div className="template-item-title">{title}</div>
                    {desc && <div className="template-item-desc">{desc}</div>}
                  </button>
                  {!tpl.isBuiltin && (
                    <button
                      type="button"
                      className="icon-btn-sm is-danger"
                      title={t.templateModal.deleteBtn}
                      onClick={() => handleDeleteCustom(tpl.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="template-detail-col">
            {editingNew ? (
              <form className="template-create-form" onSubmit={handleSaveCustom}>
                <div className="field-row">
                  <label>{t.templateModal.titleLabel}</label>
                  <input
                    type="text"
                    className="text-input"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="field-row">
                  <label>{t.templateModal.descLabel}</label>
                  <input
                    type="text"
                    className="text-input"
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                  />
                </div>
                <div className="field-row">
                  <label>{t.templateModal.fileNameLabel}</label>
                  <input
                    type="text"
                    className="text-input"
                    value={draftFileName}
                    onChange={(e) => setDraftFileName(e.target.value)}
                  />
                </div>
                <div className="field-row" style={{ flex: 1 }}>
                  <label>{t.templateModal.contentLabel}</label>
                  <textarea
                    rows={10}
                    className="textarea-input template-content-input"
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    required
                  />
                </div>
                <div className="ai-hint-text">{t.templateModal.varsHint}</div>
                <div className="template-form-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setEditingNew(false)}
                  >
                    {t.actions.cancel}
                  </button>
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={!draftTitle.trim() || !draftContent.trim()}
                  >
                    {t.templateModal.saveCustomBtn}
                  </button>
                </div>
              </form>
            ) : selectedTemplate ? (
              <div className="template-preview-wrap">
                <div className="template-preview-meta">
                  <strong>
                    {locale === 'ja' && selectedTemplate.titleJa
                      ? selectedTemplate.titleJa
                      : selectedTemplate.title}
                  </strong>
                  <code>{expandTemplateVariables(selectedTemplate.fileNamePattern)}</code>
                </div>
                <pre className="template-preview-code">{expandedPreview}</pre>
                <div className="template-form-actions">
                  <button type="button" className="secondary-btn" onClick={onClose}>
                    {t.actions.close}
                  </button>
                  <button type="button" className="primary-btn" onClick={handleUseSelected}>
                    {t.templateModal.useTemplateBtn}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
