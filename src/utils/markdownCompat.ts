import type { Locale, MarkdownCompatTarget } from '../types';

export interface MarkdownCompatIssue {
  id: string;
  line: number;
  severity: 'warning' | 'info';
  code:
    | 'single-line-break'
    | 'wikilink'
    | 'callout'
    | 'math'
    | 'mermaid'
    | 'footnote'
    | 'task-list'
    | 'table';
  title: string;
  detail: string;
}

/**
 * Checks Markdown text for syntax constructs whose rendering may differ
 * when pasted/published to the chosen target flavor (`github`, `commonmark`, or `onigiri`).
 */
export function checkMarkdownCompatibility(
  markdown: string,
  target: MarkdownCompatTarget,
  locale: Locale,
  previewSingleLineBreak = true
): MarkdownCompatIssue[] {
  if (!markdown) return [];
  const ja = locale === 'ja';
  const lines = markdown.split(/\r?\n/);
  const issues: MarkdownCompatIssue[] = [];

  let inFence = false;
  let fenceChar = '';
  let inFrontmatter = lines[0]?.trim() === '---';
  let frontmatterClosed = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (inFrontmatter && i > 0) {
      if (trimmed === '---') {
        inFrontmatter = false;
        frontmatterClosed = true;
      }
      continue;
    }
    if (i === 0 && inFrontmatter && !frontmatterClosed) continue;

    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
        const lang = fenceMatch[2].trim().toLowerCase();
        if (lang === 'mermaid' && target === 'commonmark') {
          issues.push({
            id: `mermaid-${lineNum}`,
            line: lineNum,
            severity: 'warning',
            code: 'mermaid',
            title: ja ? 'Mermaid 図ブロック' : 'Mermaid diagram block',
            detail: ja
              ? '標準 CommonMark 環境では図として描画されずコードブロックとして表示されます。'
              : 'Renders as a plain code block in strict CommonMark renderers.',
          });
        }
      } else if (marker === fenceChar) {
        inFence = false;
      }
      continue;
    }

    if (inFence) continue;

    // 1. WikiLinks [[...]]
    if (/\[\[[^\[\]\n]+\]\]/.test(raw) && target !== 'onigiri') {
      issues.push({
        id: `wiki-${lineNum}`,
        line: lineNum,
        severity: 'warning',
        code: 'wikilink',
        title: ja ? 'Wikiリンク [[...]]' : 'WikiLink [[...]] syntax',
        detail: ja
          ? `${target === 'github' ? 'GitHub' : '標準 CommonMark'} ではリンクとして解釈されず、そのまま [[...]] と表示されます。`
          : `Not supported as a link in ${target === 'github' ? 'GitHub' : 'CommonMark'}; displays as raw [[...]] text.`,
      });
    }

    // 2. GitHub Callouts > [!NOTE]
    if (/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(trimmed) && target === 'commonmark') {
      issues.push({
        id: `callout-${lineNum}`,
        line: lineNum,
        severity: 'info',
        code: 'callout',
        title: ja ? 'GitHub コールアウト構文' : 'GitHub Callout block',
        detail: ja
          ? '標準 CommonMark では装飾枠にならず通常の引用文として表示されます。'
          : 'Renders as a standard blockquote outside GitHub/GFM.',
      });
    }

    // 3. Math blocks / inline math
    if ((/\$\$[\s\S]*\$\$/.test(raw) || /^\s*\$\$\s*$/.test(raw)) && target === 'commonmark') {
      issues.push({
        id: `math-${lineNum}`,
        line: lineNum,
        severity: 'info',
        code: 'math',
        title: ja ? 'KaTeX / LaTeX 数式' : 'KaTeX / LaTeX math',
        detail: ja
          ? '標準 CommonMark では数式レンダリングされない場合があります。'
          : 'Math blocks are not part of core CommonMark.',
      });
    }

    // 4. Footnotes [^id]
    if (/\[\^[^\s\]]+\]/.test(raw) && target === 'commonmark') {
      issues.push({
        id: `fn-${lineNum}`,
        line: lineNum,
        severity: 'info',
        code: 'footnote',
        title: ja ? '脚注 [^...]' : 'Footnote [^...]',
        detail: ja
          ? '標準 CommonMark（GFM 非対応環境）では脚注リンクになりません。'
          : 'Footnotes require GFM or extension support.',
      });
    }

    // 5. Task list - [ ] / - [x]
    if (/^[-*+]\s+\[[ xX]\]\s+/.test(trimmed) && target === 'commonmark') {
      issues.push({
        id: `task-${lineNum}`,
        line: lineNum,
        severity: 'info',
        code: 'task-list',
        title: ja ? 'タスクリスト [ ] / [x]' : 'Task list checkbox',
        detail: ja
          ? '標準 CommonMark ではチェックボックスにならず文字のまま表示されます。'
          : 'Task checkboxes require GFM.',
      });
    }

    // 6. Single line break warning when previewSingleLineBreak is enabled and target is github/commonmark
    if (
      previewSingleLineBreak &&
      target !== 'onigiri' &&
      i + 1 < lines.length
    ) {
      const nextRaw = lines[i + 1];
      const nextTrimmed = nextRaw.trim();
      const isPlainParagraphLine =
        trimmed.length > 0 &&
        nextTrimmed.length > 0 &&
        !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\|)/.test(trimmed) &&
        !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\||```|~~~|---+$|\*\*\*+$)/.test(nextTrimmed) &&
        !raw.endsWith('  ') &&
        !raw.endsWith('\\');

      if (isPlainParagraphLine) {
        issues.push({
          id: `br-${lineNum}`,
          line: lineNum,
          severity: 'warning',
          code: 'single-line-break',
          title: ja ? '単一改行（行末スペース2つ無し）' : 'Single line break without trailing spaces',
          detail: ja
            ? '本アプリのプレビューでは改行されますが、GitHub や標準 Markdown では次の行と 1 行に繋がって表示されます。'
            : 'Renders as a line break here, but merges into one line on GitHub/CommonMark unless ending with two spaces.',
        });
      }
    }
  }

  return issues;
}

/**
 * Adds two trailing spaces to plain single-line-break paragraph lines so
 * GitHub and CommonMark render them with `<br>` matching single-line-break preview.
 */
export function convertSingleBreaksForStandardMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let fenceChar = '';

  const out = lines.map((raw, i) => {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      return raw;
    }
    if (inFence || i + 1 >= lines.length) return raw;

    const nextTrimmed = lines[i + 1].trim();
    const isPlainParagraphLine =
      trimmed.length > 0 &&
      nextTrimmed.length > 0 &&
      !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\|)/.test(trimmed) &&
      !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\||```|~~~|---+$|\*\*\*+$)/.test(nextTrimmed) &&
      !raw.endsWith('  ') &&
      !raw.endsWith('\\');

    return isPlainParagraphLine ? `${raw}  ` : raw;
  });

  return out.join('\n');
}
