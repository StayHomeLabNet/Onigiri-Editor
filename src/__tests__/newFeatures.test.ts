import { describe, expect, it } from 'vitest';
import {
  expandAiPromptVariables,
  hasClipboardVariable,
} from '../utils/aiCustomButtons';
import {
  applyMarkdownTableOperation,
  detectMarkdownTableAtLine,
  serializeMarkdownTable,
} from '../utils/markdownTable';
import {
  buildExportPageCss,
  DEFAULT_EXPORT_PAGE_SETTINGS,
} from '../utils/exportPresets';
import { splitTooltipAndShortcut } from '../components/TooltipLayer';

describe('AI Custom prompt variables', () => {
  it('detects {{clipboard}} variable and expands all tokens', () => {
    const template =
      'Compare {{selection}} with {{clipboard}} in {{fileName}} ({{language}}) on {{date}} {{time}}';
    expect(hasClipboardVariable(template)).toBe(true);
    expect(hasClipboardVariable('Translate this')).toBe(false);

    const expanded = expandAiPromptVariables(template, {
      selection: 'Hello',
      clipboard: 'World',
      fileName: 'notes.md',
      language: 'markdown',
      date: '2026-11-23',
      time: '16:40',
    });
    expect(expanded).toBe(
      'Compare Hello with World in notes.md (markdown) on 2026-11-23 16:40'
    );
  });

  it('preserves unknown {{placeholder}} tokens untouched', () => {
    expect(expandAiPromptVariables('Keep {{unknownVar}} as-is', {})).toBe(
      'Keep {{unknownVar}} as-is'
    );
  });
});

describe('Markdown Table GUI operations', () => {
  const sampleDoc = [
    '# Title',
    '',
    '| Name | Score |',
    '| --- | ---: |',
    '| Bob | 20 |',
    '| Alice | 100 |',
    '| Charlie | 5 |',
  ].join('\n');

  it('detects table bounds, row/column index, and alignments', () => {
    const loc = detectMarkdownTableAtLine(sampleDoc, 5, 10);
    expect(loc).not.toBeNull();
    expect(loc?.table.startLine).toBe(3);
    expect(loc?.table.endLine).toBe(7);
    expect(loc?.rowIndex).toBe(0);
    expect(loc?.colIndex).toBe(1);
    expect(loc?.table.alignments).toEqual(['left', 'right']);
  });

  it('sorts numeric column ascending & descending cleanly', () => {
    const loc = detectMarkdownTableAtLine(sampleDoc, 5, 10)!;
    const asc = applyMarkdownTableOperation(loc, 'sortAsc');
    expect(asc.rows.map((r) => r[0])).toEqual(['Charlie', 'Bob', 'Alice']);

    const desc = applyMarkdownTableOperation(loc, 'sortDesc');
    expect(desc.rows.map((r) => r[0])).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('adds/deletes rows & columns and changes alignment', () => {
    const loc = detectMarkdownTableAtLine(sampleDoc, 5, 3)!;
    const withRow = applyMarkdownTableOperation(loc, 'addRowBelow');
    expect(withRow.rows).toHaveLength(4);

    const withCol = applyMarkdownTableOperation(loc, 'addColRight');
    expect(withCol.headers).toHaveLength(3);

    const centered = applyMarkdownTableOperation(loc, 'alignCenter');
    expect(centered.alignments[0]).toBe('center');
    expect(serializeMarkdownTable(centered)).toContain(':-----:');
  });
});

describe('Export Page Settings CSS builder', () => {
  it('builds @page rules with paper size, orientation, margin, page numbers, and design theme', () => {
    const css = buildExportPageCss(
      {
        ...DEFAULT_EXPORT_PAGE_SETTINGS,
        paperSize: 'Letter',
        orientation: 'landscape',
        margin: 'wide',
        designTheme: 'business',
        showPageNumbers: true,
        headerText: '{{title}} — Draft',
        footerText: 'Confidential',
      },
      'Quarterly Plan'
    );
    expect(css).toContain('size: Letter landscape;');
    expect(css).toContain('margin: 28mm;');
    expect(css).toContain('Quarterly Plan — Draft');
    expect(css).toContain('Confidential');
    expect(css).toContain('counter(page) " / " counter(pages)');
    expect(css).toContain('.export-theme-business');
  });
});

describe('TooltipLayer shortcut splitting', () => {
  it('splits trailing shortcut parentheses into kbd badge', () => {
    expect(splitTooltipAndShortcut('保存 (⌘S)')).toEqual({ text: '保存', shortcut: '⌘S' });
    expect(splitTooltipAndShortcut('Find (Ctrl+F)')).toEqual({
      text: 'Find',
      shortcut: 'Ctrl+F',
    });
    expect(splitTooltipAndShortcut('Play (F8)')).toEqual({ text: 'Play', shortcut: 'F8' });
    expect(splitTooltipAndShortcut('Plain label')).toEqual({ text: 'Plain label' });
  });
});
