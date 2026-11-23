import type { ExportPageSettings } from '../types';

export const DEFAULT_EXPORT_PAGE_SETTINGS: ExportPageSettings = {
  paperSize: 'A4',
  orientation: 'portrait',
  margin: 'normal',
  designTheme: 'modern',
  showPageNumbers: true,
  headerText: '',
  footerText: '',
};

const MARGIN_MM: Record<ExportPageSettings['margin'], string> = {
  narrow: '12mm',
  normal: '20mm',
  wide: '28mm',
};

function escapeCssString(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

/**
 * Generates `@page` and design-theme CSS rules for HTML export and PDF printing.
 */
export function buildExportPageCss(
  settings: ExportPageSettings,
  docTitle?: string
): string {
  const margin = MARGIN_MM[settings.margin] || '20mm';
  const sizeDecl = `${settings.paperSize} ${settings.orientation}`;
  const headerResolved = (settings.headerText || '').replace(/\{\{title\}\}/gi, docTitle || '').trim();
  const footerResolved = (settings.footerText || '').replace(/\{\{title\}\}/gi, docTitle || '').trim();

  const pageMarginBoxes: string[] = [];
  if (headerResolved) {
    pageMarginBoxes.push(
      `@top-center { content: "${escapeCssString(headerResolved)}"; font-size: 9pt; color: #64748b; }`
    );
  }
  if (footerResolved) {
    pageMarginBoxes.push(
      `@bottom-left { content: "${escapeCssString(footerResolved)}"; font-size: 9pt; color: #64748b; }`
    );
  }
  if (settings.showPageNumbers) {
    pageMarginBoxes.push(
      `@bottom-right { content: counter(page) " / " counter(pages); font-size: 9pt; color: #64748b; }`
    );
  }

  const themeCss =
    settings.designTheme === 'business'
      ? `
body.export-theme-business, .export-theme-business .md-preview {
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1e293b;
  line-height: 1.7;
}
.export-theme-business h1 {
  border-bottom: 2.5px solid #1d4ed8;
  padding-bottom: 6px;
  color: #0f172a;
}
.export-theme-business h2 {
  border-left: 4px solid #1d4ed8;
  padding-left: 10px;
  color: #1e3a8a;
}
.export-theme-business table th {
  background: #eff6ff;
  color: #1e3a8a;
}
`
      : settings.designTheme === 'academic'
        ? `
body.export-theme-academic, .export-theme-academic .md-preview {
  font-family: "Hiragino Mincho ProN", "Yu Mincho", Georgia, "Times New Roman", serif;
  color: #111827;
  line-height: 1.85;
  text-align: justify;
}
.export-theme-academic h1 {
  text-align: center;
  border-bottom: 1px solid #374151;
  padding-bottom: 10px;
}
.export-theme-academic h2 {
  border-bottom: 1px solid #d1d5db;
  padding-bottom: 4px;
}
.export-theme-academic blockquote {
  border-left: 3px solid #4b5563;
  font-style: italic;
}
`
        : `
body.export-theme-modern, .export-theme-modern .md-preview {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif;
  line-height: 1.75;
}
`;

  return `
@page {
  size: ${sizeDecl};
  margin: ${margin};
  ${pageMarginBoxes.join('\n  ')}
}
${themeCss}
`;
}
