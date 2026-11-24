import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { getMarkdownBlockLineRanges } from '../utils/markdown';
import {
  computePreviewSelectionDecorations,
  markdownFragmentToPlainText,
} from '../utils/previewSelectionSync';

const testSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    heading: {
      group: 'block',
      attrs: { level: { default: 1 } },
      content: 'inline*',
    },
    text: { group: 'inline' },
    hardBreak: { group: 'inline', inline: true },
  },
});

describe('previewSelectionSync', () => {
  it('strips common markdown syntax cleanly in markdownFragmentToPlainText', () => {
    expect(markdownFragmentToPlainText('# Title')).toBe('Title');
    expect(markdownFragmentToPlainText('## **Bold** and `code`')).toBe('Bold and code');
    expect(markdownFragmentToPlainText('[Link Text](https://example.com)')).toBe('Link Text');
    expect(markdownFragmentToPlainText('- [x] Done task')).toBe('Done task');
  });

  it('maps inline selection in heading and paragraph to exact ProseMirror positions', () => {
    const markdown = '# Heading One\n\nHello **world**, hello again.';
    const blockRanges = getMarkdownBlockLineRanges(markdown);
    const pmDoc = testSchema.node('doc', null, [
      testSchema.node('heading', { level: 1 }, [testSchema.text('Heading One')]),
      testSchema.node('paragraph', null, [testSchema.text('Hello world, hello again.')]),
    ]);

    // Select "One" in "# Heading One"
    const hFrom = markdown.indexOf('One');
    const hTo = hFrom + 'One'.length;
    const hDecos = computePreviewSelectionDecorations(
      markdown,
      { from: hFrom, to: hTo },
      blockRanges,
      pmDoc
    );
    expect(hDecos).toHaveLength(1);
    expect(pmDoc.textBetween(hDecos[0].from, hDecos[0].to)).toBe('One');

    // Select second "hello" in paragraph ("hello again.")
    const secondHelloFrom = markdown.indexOf('hello again');
    const secondHelloTo = secondHelloFrom + 'hello'.length;
    const pDecos = computePreviewSelectionDecorations(
      markdown,
      { from: secondHelloFrom, to: secondHelloTo },
      blockRanges,
      pmDoc
    );
    expect(pDecos).toHaveLength(1);
    expect(pmDoc.textBetween(pDecos[0].from, pDecos[0].to)).toBe('hello');
    // Must match the second "hello", not the first "Hello"
    expect(pDecos[0].from).toBeGreaterThan(20);
  });

  it('maps multi-block selection across heading and paragraph', () => {
    const markdown = '# Title\n\nSecond paragraph';
    const blockRanges = getMarkdownBlockLineRanges(markdown);
    const pmDoc = testSchema.node('doc', null, [
      testSchema.node('heading', { level: 1 }, [testSchema.text('Title')]),
      testSchema.node('paragraph', null, [testSchema.text('Second paragraph')]),
    ]);

    const from = markdown.indexOf('Title');
    const to = markdown.indexOf('Second') + 'Second'.length;
    const decos = computePreviewSelectionDecorations(
      markdown,
      { from, to },
      blockRanges,
      pmDoc
    );
    expect(decos).toHaveLength(2);
    expect(pmDoc.textBetween(decos[0].from, decos[0].to)).toBe('Title');
    expect(pmDoc.textBetween(decos[1].from, decos[1].to)).toBe('Second');
  });

  it('returns empty array when selection is collapsed or null', () => {
    const markdown = '# Title';
    const blockRanges = getMarkdownBlockLineRanges(markdown);
    const pmDoc = testSchema.node('doc', null, [
      testSchema.node('heading', { level: 1 }, [testSchema.text('Title')]),
    ]);

    expect(computePreviewSelectionDecorations(markdown, null, blockRanges, pmDoc)).toEqual([]);
    expect(
      computePreviewSelectionDecorations(markdown, { from: 3, to: 3 }, blockRanges, pmDoc)
    ).toEqual([]);
  });
});
