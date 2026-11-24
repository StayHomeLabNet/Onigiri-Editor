import { useCallback } from 'react';
import type React from 'react';
import type { EditorHandle } from '../components/EditorPane';
import type { DiagramExportNotifyKind } from '../components/PreviewPane';
import type { Translations } from '../i18n/types';
import type { DocumentTab, EditorSettings, ThemeId } from '../types';
import { inlineLocalImagesInHtml } from '../utils/exportHelpers';
import { buildExportPageCss, DEFAULT_EXPORT_PAGE_SETTINGS } from '../utils/exportPresets';
import { exportStandaloneHtml, htmlToMarkdown, renderMarkdownToHtml } from '../utils/markdown';
import {
  saveBinaryExportFile,
  saveExportFile,
  writeClipboardText,
} from '../utils/platform';
import { buildRichClipboardPayload } from '../utils/richTextCopy';

interface UseExportActionsParams {
  t: Translations;
  theme: ThemeId;
  activeTab: DocumentTab;
  sideTab: DocumentTab | null;
  workspaceRoot: string | null;
  settings: EditorSettings;
  effectiveSettings: EditorSettings;
  editorRef: React.MutableRefObject<EditorHandle | null>;
  isSideEditorActive: () => boolean;
  getActiveEditorTarget: () => EditorHandle | null;
  runWithHiddenNativeBrowser: <T>(fn: () => Promise<T>) => Promise<T>;
  setPrintMode: React.Dispatch<React.SetStateAction<'preview' | 'source'>>;
  notify: (msg: string) => void;
  formatErrorMessage: (err: unknown) => string;
}

export function useExportActions({
  t,
  theme,
  activeTab,
  sideTab,
  workspaceRoot,
  settings,
  effectiveSettings,
  editorRef,
  isSideEditorActive,
  getActiveEditorTarget,
  runWithHiddenNativeBrowser,
  setPrintMode,
  notify,
  formatErrorMessage,
}: UseExportActionsParams) {
  const handleCopyRichText = useCallback(async () => {
    const ed = getActiveEditorTarget();
    const selected = ed?.getSelectedText() || '';
    const targetTab = isSideEditorActive() && sideTab ? sideTab : activeTab;
    const sourceMd = selected.trim() ? selected : targetTab.content;
    const { html, plain } = await buildRichClipboardPayload(sourceMd);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await writeClipboardText(plain);
      }
      notify(t.toasts.copiedRichText);
    } catch {
      await writeClipboardText(plain);
      notify(t.toasts.copiedRichText);
    }
  }, [
    activeTab,
    sideTab,
    isSideEditorActive,
    getActiveEditorTarget,
    notify,
    t.toasts.copiedRichText,
  ]);

  const handleCopyHtml = useCallback(async () => {
    const htmlStr = await renderMarkdownToHtml(activeTab.content, {
      breaks: Boolean(effectiveSettings.previewSingleLineBreak),
    });
    await navigator.clipboard.writeText(htmlStr);
    notify(t.toasts.copiedHtml);
  }, [activeTab.content, effectiveSettings.previewSingleLineBreak, notify, t.toasts.copiedHtml]);

  const handlePasteHtmlAsMd = useCallback(async () => {
    try {
      if (navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const htmlText = await blob.text();
            const md = htmlToMarkdown(htmlText);
            editorRef.current?.insertText(md);
            notify(t.toasts.htmlPasted);
            return;
          }
        }
      }
      notify(t.toasts.noClipboardHtml);
    } catch {
      notify(t.toasts.noClipboardHtml);
    }
  }, [editorRef, notify, t.toasts.htmlPasted, t.toasts.noClipboardHtml]);

  const handleExportHtml = useCallback(
    async (overridePageSettings?: typeof DEFAULT_EXPORT_PAGE_SETTINGS) => {
      const rawHtmlBody = await renderMarkdownToHtml(activeTab.content, {
        breaks: Boolean(effectiveSettings.previewSingleLineBreak),
      });
      const docBaseDir = activeTab.filePath || workspaceRoot || undefined;
      const htmlBody =
        effectiveSettings.embedImagesOnHtmlExport !== false
          ? await inlineLocalImagesInHtml(rawHtmlBody, docBaseDir)
          : rawHtmlBody;
      const pageOpts = {
        ...DEFAULT_EXPORT_PAGE_SETTINGS,
        ...(settings.exportPageSettings ?? {}),
        ...(overridePageSettings ?? {}),
      };
      const pageCss = buildExportPageCss(pageOpts, activeTab.title);
      const combinedCss = [pageCss, settings.customCss || ''].filter(Boolean).join('\n');
      const themedBody = `<div class="export-theme-${pageOpts.designTheme}">${htmlBody}</div>`;
      const full = exportStandaloneHtml(activeTab.title, themedBody, theme, combinedCss);
      const baseName = activeTab.title.replace(/\.(md|markdown|txt)$/i, '');
      const ok = await runWithHiddenNativeBrowser(() =>
        saveExportFile(full, `${baseName}.html`, 'HTML', ['html'], 'text/html')
      );
      if (ok) notify(t.toasts.exportedSuccess);
    },
    [
      activeTab.content,
      activeTab.title,
      activeTab.filePath,
      workspaceRoot,
      effectiveSettings.previewSingleLineBreak,
      effectiveSettings.embedImagesOnHtmlExport,
      theme,
      settings.customCss,
      settings.exportPageSettings,
      runWithHiddenNativeBrowser,
      notify,
      t.toasts.exportedSuccess,
    ]
  );

  const handleExportDocx = useCallback(async () => {
    try {
      const { exportMarkdownToDocxBytes } = await import('../utils/docxExport');
      const docBaseDir = activeTab.filePath || workspaceRoot || undefined;
      const bytes = await exportMarkdownToDocxBytes(activeTab.content, { baseDir: docBaseDir });
      const baseName = activeTab.title.replace(/\.(md|markdown|txt)$/i, '') || 'document';
      const ok = await runWithHiddenNativeBrowser(() =>
        saveBinaryExportFile(
          bytes,
          `${baseName}.docx`,
          'Word Document',
          ['docx'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      );
      if (ok) notify(t.toasts.exportedSuccess);
    } catch (err) {
      notify(`${t.toasts.errorPrefix} ${formatErrorMessage(err)}`);
    }
  }, [
    activeTab.content,
    activeTab.title,
    activeTab.filePath,
    workspaceRoot,
    runWithHiddenNativeBrowser,
    notify,
    t.toasts.exportedSuccess,
    t.toasts.errorPrefix,
    formatErrorMessage,
  ]);

  const handleDiagramExportNotify = useCallback(
    (kind: DiagramExportNotifyKind) => {
      if (kind === 'saved-svg') notify(t.diagramExport.savedSvgToast);
      else if (kind === 'saved-png') notify(t.diagramExport.savedPngToast);
      else if (kind === 'copied-latex') notify(t.diagramExport.copiedLatexToast);
      else notify(t.diagramExport.exportFailedToast);
    },
    [
      notify,
      t.diagramExport.savedSvgToast,
      t.diagramExport.savedPngToast,
      t.diagramExport.copiedLatexToast,
      t.diagramExport.exportFailedToast,
    ]
  );

  const handleExportPdf = useCallback(
    (overridePageSettings?: typeof DEFAULT_EXPORT_PAGE_SETTINGS) => {
      const pageOpts = {
        ...DEFAULT_EXPORT_PAGE_SETTINGS,
        ...(settings.exportPageSettings ?? {}),
        ...(overridePageSettings ?? {}),
      };
      const styleId = 'onigiri-export-page-style';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `@media print {\n${buildExportPageCss(pageOpts, activeTab.title)}\n}`;
      document.body.classList.remove(
        'export-theme-modern',
        'export-theme-business',
        'export-theme-academic'
      );
      document.body.classList.add(`export-theme-${pageOpts.designTheme}`);

      setPrintMode('preview');
      requestAnimationFrame(() => {
        window.print();
      });
    },
    [settings.exportPageSettings, activeTab.title, setPrintMode]
  );

  const handlePrintSource = useCallback(() => {
    setPrintMode('source');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  }, [setPrintMode]);

  return {
    handleCopyRichText,
    handleCopyHtml,
    handlePasteHtmlAsMd,
    handleExportHtml,
    handleExportDocx,
    handleDiagramExportNotify,
    handleExportPdf,
    handlePrintSource,
  };
}
