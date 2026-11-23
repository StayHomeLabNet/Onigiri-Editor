import { describe, expect, it } from 'vitest';
import {
  computeStats,
  extractHeadings,
  preprocessMarkdownImageDestinations,
  renderMarkdownToEditableHtml,
  renderMarkdownToHtml,
} from '../utils/markdown';

describe('markdown utilities', () => {
  it('normalizes Windows paths and spaced image destinations before parsing', () => {
    const input = '![KIWI WHITE](C:\\Users\\Administrator\\Desktop\\素材\\KIWI WHITE.png)';
    const pre = preprocessMarkdownImageDestinations(input);
    expect(pre).toBe('![KIWI WHITE](<C:/Users/Administrator/Desktop/素材/KIWI WHITE.png>)');
  });

  it('renders Markdown with spaced image paths, GFM tables, and task lists', async () => {
    const md = [
      '# Title',
      '',
      '![KIWI WHITE](C:\\Users\\Alice\\Desktop\\素材\\KIWI WHITE.png)',
      '',
      '- [x] Done task',
      '- [ ] Pending task',
    ].join('\n');

    const html = await renderMarkdownToHtml(md);
    expect(html).toContain('<h1');
    expect(html).toContain('<img');
    expect(html).toContain('KIWI%20WHITE.png');
    expect(html).toContain('type="checkbox"');
  });

  it('extracts headings outside fenced code blocks and computes document stats', () => {
    const md = [
      '# Main Heading',
      '',
      '```markdown',
      '# Ignored Code Heading',
      '```',
      '',
      '## Sub Heading',
      'Hello world!',
    ].join('\n');

    const headings = extractHeadings(md);
    expect(headings.map((h) => `${h.level}:${h.text}`)).toEqual([
      '1:Main Heading',
      '2:Sub Heading',
    ]);

    const stats = computeStats(md);
    expect(stats.lines).toBe(8);
    expect(stats.words).toBeGreaterThan(0);
    expect(stats.chars).toBe(md.length);
  });

  it('converts single line breaks to <br> only when breaks option is enabled, preserving code blocks', async () => {
    const md = [
      'いつもお世話になっております。',
      '早速',
      '',
      '```txt',
      'line1',
      'line2',
      '```',
    ].join('\n');

    const defaultHtml = await renderMarkdownToHtml(md, { breaks: false });
    expect(defaultHtml).not.toContain('<br>');

    const breaksHtml = await renderMarkdownToHtml(md, { breaks: true });
    expect(breaksHtml).toContain('いつもお世話になっております。<br>');
    expect(breaksHtml).toContain('line1\nline2');

    const editableBreaksHtml = await renderMarkdownToEditableHtml(md, { breaks: true });
    expect(editableBreaksHtml).toContain('いつもお世話になっております。<br>');
  });
});
