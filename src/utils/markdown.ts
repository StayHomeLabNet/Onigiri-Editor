import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import yaml from 'js-yaml';
import TurndownService from 'turndown';
import { gfm as turndownGfm } from 'turndown-plugin-gfm';
import type { AiCleanOptions, DocumentStats, HeadingItem, ThemeId } from '../types';

const CALLOUT_TYPES = new Set(['note', 'tip', 'important', 'warning', 'caution']);

function extractText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
}

function rehypeMarkFlowPlugins() {
  return (tree: any) => {
    visit(tree, 'element', (node: any, index: number | undefined, parent: any) => {
      const tag = node.tagName;
      if (
        node.position?.start?.line &&
        ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr'].includes(tag)
      ) {
        node.properties = node.properties || {};
        node.properties['data-source-line'] = String(node.position.start.line);
      }

      // Add heading slug IDs for outline jump
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = extractText(node).trim();
        const slug = text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s-]/gu, '')
          .trim()
          .replace(/\s+/g, '-');
        const line = node.position?.start?.line || 0;
        node.properties = node.properties || {};
        node.properties.id = slug ? `${slug}-L${line}` : `heading-L${line}`;
      }

      // Interactive task list checkboxes
      if (tag === 'li' && Array.isArray(node.children)) {
        const line = node.position?.start?.line;
        const firstChild = node.children[0];
        const checkCandidate =
          firstChild?.tagName === 'input'
            ? firstChild
            : firstChild?.tagName === 'p' && firstChild.children?.[0]?.tagName === 'input'
              ? firstChild.children[0]
              : null;
        if (checkCandidate && checkCandidate.properties?.type === 'checkbox' && line) {
          checkCandidate.properties = checkCandidate.properties || {};
          delete checkCandidate.properties.disabled;
          checkCandidate.properties['data-task-line'] = String(line);
          checkCandidate.properties.className = ['mf-task-checkbox'];
        }
      }

      // Mermaid fenced code block -> custom placeholder container
      if (tag === 'pre' && Array.isArray(node.children) && node.children.length === 1) {
        const codeNode = node.children[0];
        const classes: string[] = Array.isArray(codeNode?.properties?.className)
          ? codeNode.properties.className
          : [];
        if (codeNode?.tagName === 'code' && classes.includes('language-mermaid')) {
          const codeText = extractText(codeNode).trim();
          const line = node.position?.start?.line;
          node.tagName = 'div';
          node.properties = {
            className: ['mf-mermaid-placeholder'],
            'data-mermaid-code': codeText,
            ...(line ? { 'data-source-line': String(line) } : {}),
          };
          node.children = [];
          return;
        }
      }

      // GitHub / AI Callouts: > [!NOTE] ...
      if (tag === 'blockquote' && Array.isArray(node.children)) {
        const firstP = node.children.find((c: any) => c.type === 'element' && c.tagName === 'p');
        if (firstP && Array.isArray(firstP.children) && firstP.children.length > 0) {
          const firstTextNode = firstP.children[0];
          if (firstTextNode?.type === 'text' && typeof firstTextNode.value === 'string') {
            const match = firstTextNode.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*\n|\s+|$)/i);
            if (match) {
              const kind = match[1].toLowerCase();
              if (CALLOUT_TYPES.has(kind)) {
                firstTextNode.value = firstTextNode.value.slice(match[0].length);
                if (!firstTextNode.value && firstP.children.length === 1) {
                  node.children = node.children.filter((c: any) => c !== firstP);
                } else if (firstP.children[0]?.type === 'text' && firstP.children[0].value === '' && firstP.children[1]?.tagName === 'br') {
                  firstP.children.splice(0, 2);
                }
                node.tagName = 'div';
                node.properties = {
                  ...(node.properties || {}),
                  className: ['mf-callout', `mf-callout-${kind}`],
                  'data-callout': kind,
                };
              }
            }
          }
        }
      }

      void index;
      void parent;
    });
  };
}

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'input'],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] || []),
      'className',
      'id',
      'dataSourceLine',
      'data-source-line',
    ],
    div: [
      ...(defaultSchema.attributes?.div || []),
      'dataMermaidCode',
      'data-mermaid-code',
      'dataCallout',
      'data-callout',
    ],
    input: ['type', 'checked', 'dataTaskLine', 'data-task-line', 'className'],
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className'],
  },
};

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeMarkFlowPlugins)
  .use(rehypeRaw)
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(rehypeStringify);

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const lines = markdown.split(/\r?\n/);
  const headings: HeadingItem[] = [];
  let inFence = false;
  let fenceChar = '';
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === '---' || line.trim() === '...') {
        inFrontmatter = false;
      }
      continue;
    }

    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;

    const hMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/[*_`~]/g, '').trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-');
      const lineNum = i + 1;
      headings.push({
        level,
        text,
        line: lineNum,
        id: slug ? `${slug}-L${lineNum}` : `heading-L${lineNum}`,
      });
    }
  }
  return headings;
}

export interface FrontmatterResult {
  data: Record<string, unknown> | null;
  raw: string;
  bodyStartLine: number;
  error?: string;
}

export function extractFrontmatter(markdown: string): FrontmatterResult {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { data: null, raw: '', bodyStartLine: 1 };
  }
  const raw = match[1];
  const bodyStartLine = match[0].split(/\r?\n/).length;
  try {
    const parsed = yaml.load(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, raw, bodyStartLine };
    }
    return { data: {}, raw, bodyStartLine };
  } catch (err) {
    return {
      data: null,
      raw,
      bodyStartLine,
      error: err instanceof Error ? err.message : 'Invalid YAML',
    };
  }
}

export function updateFrontmatter(markdown: string, data: Record<string, unknown>): string {
  const dumped = yaml.dump(data, { lineWidth: 100, noRefs: true }).trimEnd();
  const nextBlock = `---\n${dumped}\n---\n`;
  const existing = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
  if (existing) {
    return nextBlock + markdown.slice(existing[0].length);
  }
  return `${nextBlock}\n${markdown}`;
}

export function computeStats(markdown: string): DocumentStats {
  const chars = markdown.length;
  const charsNoSpaces = markdown.replace(/\s/g, '').length;
  const lines = markdown ? markdown.split(/\r?\n/).length : 0;

  // Smart word count: count CJK characters individually + Latin/numeric words
  const cjkMatches = markdown.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\uac00-\ud7af]/g) || [];
  const withoutCjk = markdown.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\uac00-\ud7af]/g, ' ');
  const latinWords = withoutCjk
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[\p{L}\p{N}]/u.test(w));
  const words = cjkMatches.length + latinWords.length;

  const paragraphs = markdown
    .split(/\r?\n\s*\r?\n/)
    .filter((p) => p.trim().length > 0).length;

  // Reading speed: ~500 CJK chars/min or ~220 Latin words/min
  const readingMinutes = Math.max(
    1,
    Math.ceil(cjkMatches.length / 500 + latinWords.length / 220)
  );

  // LLM token estimate: ~1.4 tokens per CJK char, ~1.35 tokens per Latin word + punctuation
  const otherChars = Math.max(0, chars - cjkMatches.length);
  const estimatedTokens = Math.max(
    0,
    Math.ceil(cjkMatches.length * 1.45 + otherChars / 3.8)
  );

  const headings = extractHeadings(markdown).length;
  const codeBlocks = Math.floor((markdown.match(/^\s*(`{3,}|~{3,})/gm) || []).length / 2);
  const tables = (markdown.match(/^\|.+\|\s*\r?\n\|[\s:|-]+\|/gm) || []).length;
  const links = (markdown.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;

  return {
    chars,
    charsNoSpaces,
    words,
    lines,
    paragraphs,
    readingMinutes,
    estimatedTokens,
    headings,
    codeBlocks,
    tables,
    links,
  };
}

function getVisualWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    if (
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x2e80 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0x1f300 && code <= 0x1f9ff)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function padVisualEnd(text: string, targetWidth: number): string {
  const diff = Math.max(0, targetWidth - getVisualWidth(text));
  return text + ' '.repeat(diff);
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let escaped = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      current += ch;
      escaped = false;
    } else if (ch === '\\') {
      current += ch;
      escaped = true;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function formatGfmTables(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    const isTableHeader =
      line.trim().startsWith('|') &&
      next &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(next.trim()) &&
      next.includes('-');

    if (!isTableHeader) {
      out.push(line);
      i++;
      continue;
    }

    const tableLines: string[] = [line, next];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      tableLines.push(lines[j]);
      j++;
    }

    const rows = tableLines.map(splitTableRow);
    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidths = new Array(colCount).fill(3);

    rows.forEach((row, rIdx) => {
      if (rIdx === 1) return; // separator
      for (let c = 0; c < colCount; c++) {
        const val = row[c] ?? '';
        colWidths[c] = Math.max(colWidths[c], getVisualWidth(val));
      }
    });

    rows.forEach((row, rIdx) => {
      const cells: string[] = [];
      for (let c = 0; c < colCount; c++) {
        const raw = row[c] ?? '';
        if (rIdx === 1) {
          const left = raw.startsWith(':');
          const right = raw.endsWith(':');
          const dashCount = Math.max(3, colWidths[c] - (left ? 1 : 0) - (right ? 1 : 0));
          cells.push(`${left ? ':' : ''}${'-'.repeat(dashCount)}${right ? ':' : ''}`);
        } else {
          cells.push(padVisualEnd(raw, colWidths[c]));
        }
      }
      out.push(`| ${cells.join(' | ')} |`);
    });

    i = j;
  }
  return out;
}

export function cleanAiMarkdown(markdown: string, options: AiCleanOptions): string {
  let text = markdown.replace(/\r\n/g, '\n');

  if (options.removeZeroWidth) {
    text = text.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, (m) => (m === '\u00A0' ? ' ' : ''));
  }

  if (options.normalizeQuotes) {
    text = text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  }

  let lines = text.split('\n');
  let inFence = false;
  let fenceChar = '';

  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
      }
      processedLines.push(options.trimTrailingSpaces ? line.replace(/[ \t]+$/, '') : line);
      continue;
    }

    if (inFence) {
      processedLines.push(line);
      continue;
    }

    if (options.trimTrailingSpaces) {
      line = line.replace(/[ \t]+$/, '');
    }

    if (options.normalizeBullets) {
      line = line.replace(/^(\s*)[*+]\s+/, '$1- ');
    }

    if (options.fixHeadingSpacing) {
      // Fix `#Heading` -> `# Heading`
      line = line.replace(/^(#{1,6})([^\s#])/, '$1 $2');
      const prev = processedLines[processedLines.length - 1];
      if (/^#{1,6}\s+/.test(line) && prev !== undefined && prev.trim() !== '' && prev.trim() !== '---') {
        processedLines.push('');
      }
    }

    processedLines.push(line);
  }

  let finalLines = options.formatTables ? formatGfmTables(processedLines) : processedLines;

  let result = finalLines.join('\n');
  if (options.collapseBlankLines) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  return result.trimEnd() + '\n';
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndown.use(turndownGfm);

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export function toggleTaskCheckboxAtLine(markdown: string, lineNumber: number): string {
  const lines = markdown.split(/\r?\n/);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) return markdown;
  const line = lines[idx];
  const toggled = line.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/, (_, pre, state, post) => {
    const next = state === ' ' ? 'x' : ' ';
    return `${pre}${next}${post}`;
  });
  if (toggled === line) return markdown;
  lines[idx] = toggled;
  return lines.join('\n');
}

export function exportStandaloneHtml(
  title: string,
  bodyHtml: string,
  theme: ThemeId,
  customCss: string
): string {
  const isDark = theme === 'dark' || theme === 'midnight';
  const bg = theme === 'sepia' ? '#f8f2e4' : isDark ? '#0f172a' : '#ffffff';
  const fg = theme === 'sepia' ? '#3b2f23' : isDark ? '#e2e8f0' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';
  const border = isDark ? '#334155' : '#e2e8f0';
  const codeBg = isDark ? '#1e293b' : '#f1f5f9';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title.replace(/</g, '&lt;')}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css" />
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      background: ${bg};
      color: ${fg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
      line-height: 1.75;
    }
    .markdown-body { max-width: 820px; margin: 0 auto; }
    h1, h2, h3, h4 { line-height: 1.3; margin-top: 1.6em; }
    h1, h2 { border-bottom: 1px solid ${border}; padding-bottom: 0.3em; }
    a { color: #6366f1; }
    code { background: ${codeBg}; padding: 0.18em 0.4em; border-radius: 5px; font-size: 0.9em; }
    pre { background: ${codeBg}; padding: 14px 16px; border-radius: 10px; overflow-x: auto; border: 1px solid ${border}; }
    pre code { background: transparent; padding: 0; }
    blockquote { margin: 1em 0; padding: 0.4em 1em; border-left: 4px solid #6366f1; color: ${muted}; }
    table { border-collapse: collapse; width: 100%; margin: 1.2em 0; }
    th, td { border: 1px solid ${border}; padding: 8px 12px; text-align: left; }
    th { background: ${codeBg}; }
    .mf-callout { padding: 12px 16px; border-radius: 10px; border-left: 4px solid #3b82f6; background: ${codeBg}; margin: 1em 0; }
    .mf-callout-tip { border-left-color: #10b981; }
    .mf-callout-important { border-left-color: #8b5cf6; }
    .mf-callout-warning { border-left-color: #f59e0b; }
    .mf-callout-caution { border-left-color: #ef4444; }
    ${customCss}
  </style>
</head>
<body>
  <article class="markdown-body">
    ${bodyHtml}
  </article>
</body>
</html>`;
}
