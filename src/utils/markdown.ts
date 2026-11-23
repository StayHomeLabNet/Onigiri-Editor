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
import { resolveEffectiveLanguageId } from './language';
import {
  decodeLocalHrefIfNeeded,
  formatMarkdownImageSyntax,
  formatMarkdownLinkDestination,
} from './paths';

const CALLOUT_TYPES = new Set(['note', 'tip', 'important', 'warning', 'caution']);

function extractText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
}

function rehypeStaticExportPlugins() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const tag = node.tagName;
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
    });
  };
}

function rehypeEditableTransform() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      const tag = node.tagName;
      const classes: string[] = Array.isArray(node.properties?.className)
        ? node.properties.className
        : [];

      // Heading IDs
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

      // Math display block: <pre><code class="language-math math-display">...</code></pre>
      if (tag === 'pre' && Array.isArray(node.children) && node.children.length === 1) {
        const codeNode = node.children[0];
        const codeCls: string[] = Array.isArray(codeNode?.properties?.className)
          ? codeNode.properties.className
          : [];
        if (codeNode?.tagName === 'code' && codeCls.includes('math-display')) {
          const latex = extractText(codeNode).trim();
          node.tagName = 'div';
          node.properties = {
            'data-type': 'math-block',
            'data-latex': latex,
          };
          node.children = latex ? [{ type: 'text', value: latex }] : [];
          return;
        }
      }

      // Inline math: <code class="language-math math-inline">...</code>
      if (tag === 'code' && classes.includes('math-inline')) {
        const latex = extractText(node).trim();
        node.tagName = 'span';
        node.properties = {
          'data-type': 'math-inline',
          'data-latex': latex,
        };
        node.children = latex ? [{ type: 'text', value: latex }] : [];
        return;
      }

      // Task lists for TipTap TaskList / TaskItem
      if (tag === 'ul' && classes.includes('contains-task-list')) {
        node.properties = {
          ...(node.properties || {}),
          'data-type': 'taskList',
        };
      }

      if (tag === 'li' && classes.includes('task-list-item') && Array.isArray(node.children)) {
        let checked = false;
        const cleanChildren: any[] = [];
        for (const child of node.children) {
          if (child?.type === 'element' && child.tagName === 'input' && child.properties?.type === 'checkbox') {
            checked = Boolean(child.properties.checked);
            continue;
          }
          if (child?.type === 'element' && child.tagName === 'p' && Array.isArray(child.children)) {
            const filtered = child.children.filter((gc: any) => {
              if (gc?.type === 'element' && gc.tagName === 'input' && gc.properties?.type === 'checkbox') {
                checked = Boolean(gc.properties.checked);
                return false;
              }
              return true;
            });
            // Strip leading whitespace text node left right after checkbox
            if (filtered[0]?.type === 'text' && typeof filtered[0].value === 'string') {
              filtered[0] = { ...filtered[0], value: filtered[0].value.replace(/^\s+/, '') };
            }
            cleanChildren.push({ ...child, children: filtered });
            continue;
          }
          cleanChildren.push(child);
        }
        node.children = cleanChildren;
        node.properties = {
          ...(node.properties || {}),
          'data-type': 'taskItem',
          'data-checked': checked ? 'true' : 'false',
        };
      }

      // GitHub Callouts: > [!NOTE] ...
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
    });
  };
}

const WINDOWS_DRIVE_SCHEMES = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const editableSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'input', 'div', 'span'],
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https', 'data', 'blob', 'file', ...WINDOWS_DRIVE_SCHEMES],
    href: [
      ...(defaultSchema.protocols?.href || ['http', 'https', 'irc', 'ircs', 'mailto', 'xmpp']),
      'file',
      ...WINDOWS_DRIVE_SCHEMES,
    ],
  },
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'id'],
    ul: [...(defaultSchema.attributes?.ul || []), 'dataType', 'data-type'],
    li: [...(defaultSchema.attributes?.li || []), 'dataType', 'data-type', 'dataChecked', 'data-checked'],
    div: [
      ...(defaultSchema.attributes?.div || []),
      'dataType',
      'data-type',
      'dataLatex',
      'data-latex',
      'dataCallout',
      'data-callout',
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      'dataType',
      'data-type',
      'dataLatex',
      'data-latex',
    ],
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    img: ['src', 'alt', 'title', 'width', 'height'],
  },
};

function isEscapedAt(line: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && line[i] === '\\'; i--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function shouldNormalizeRawImageDest(dest: string): boolean {
  if (!dest || dest.startsWith('<')) return false;
  if (/^(?:https?:|data:|blob:)/i.test(dest)) return false;
  if (!/[\s\\()]/.test(dest)) return false;
  return (
    /^(?:[A-Za-z]:[\\/]|\\\\|file:\/\/|\.{0,2}[\\/]|\/)/.test(dest) ||
    dest.includes('\\') ||
    /\.(?:png|jpe?g|gif|webp|svg|bmp|ico|avif|tiff?)$/i.test(dest)
  );
}

function normalizeImageDestinationsInLine(line: string): string {
  if (!line.includes('![')) return line;
  let out = '';
  let i = 0;
  while (i < line.length) {
    // Skip inline code spans
    if (line[i] === '`') {
      let tickLen = 1;
      while (i + tickLen < line.length && line[i + tickLen] === '`') tickLen++;
      const closeIdx = line.indexOf('`'.repeat(tickLen), i + tickLen);
      if (closeIdx >= 0) {
        out += line.slice(i, closeIdx + tickLen);
        i = closeIdx + tickLen;
        continue;
      }
      out += line.slice(i, i + tickLen);
      i += tickLen;
      continue;
    }

    if (line[i] === '!' && line[i + 1] === '[' && !isEscapedAt(line, i)) {
      let j = i + 2;
      let bracketDepth = 1;
      while (j < line.length && bracketDepth > 0) {
        if (line[j] === '\\') {
          j += 2;
          continue;
        }
        if (line[j] === '[') bracketDepth++;
        else if (line[j] === ']') bracketDepth--;
        j++;
      }
      if (bracketDepth === 0 && line[j] === '(') {
        let k = j + 1;
        let parenDepth = 1;
        while (k < line.length && parenDepth > 0) {
          const ch = line[k];
          if (ch === '(') parenDepth++;
          else if (ch === ')') parenDepth--;
          k++;
        }
        if (parenDepth === 0) {
          const inner = line.slice(j + 1, k - 1);
          const trimmed = inner.trim();
          const titleMatch = trimmed.match(/^(.+?)\s+("[^"]*"|'[^']*')$/);
          const urlCandidate = (titleMatch ? titleMatch[1] : trimmed).trim();
          const titleSuffix = titleMatch ? ` ${titleMatch[2]}` : '';
          if (shouldNormalizeRawImageDest(urlCandidate)) {
            const formatted = formatMarkdownLinkDestination(urlCandidate);
            out += line.slice(i, j + 1) + formatted + titleSuffix + ')';
            i = k;
            continue;
          }
        }
      }
    }

    out += line[i];
    i++;
  }
  return out;
}

export function preprocessMarkdownImageDestinations(markdown: string): string {
  if (!markdown || !markdown.includes('![')) return markdown;
  const lines = markdown.split(/\r?\n/);
  let inFrontmatter = false;
  let inFence = false;
  let fenceChar = '';
  let changed = false;

  const processed = lines.map((line, idx) => {
    if (idx === 0 && line.trim() === '---') {
      inFrontmatter = true;
      return line;
    }
    if (inFrontmatter) {
      if (line.trim() === '---' || line.trim() === '...') {
        inFrontmatter = false;
      }
      return line;
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
      return line;
    }
    if (inFence) return line;
    const next = normalizeImageDestinationsInLine(line);
    if (next !== line) changed = true;
    return next;
  });

  return changed ? processed.join('\n') : markdown;
}

function remarkSoftBreaksToHardBreaks() {
  return (tree: any) => {
    visit(tree, 'text', (node: any, index: number | undefined, parent: any) => {
      if (index === undefined || !parent || !Array.isArray(parent.children)) return;
      if (typeof node.value !== 'string' || !node.value.includes('\n')) return;
      const parts = node.value.split(/\r?\n/);
      const replacement: any[] = [];
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].length > 0) {
          replacement.push({ type: 'text', value: parts[i] });
        }
        if (i < parts.length - 1) {
          replacement.push({ type: 'break' });
        }
      }
      parent.children.splice(index, 1, ...replacement);
      return index + replacement.length;
    });
  };
}

const staticProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStaticExportPlugins)
  .use(rehypeRaw)
  .use(rehypeSanitize, editableSanitizeSchema)
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(rehypeStringify);

const staticProcessorWithBreaks = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkSoftBreaksToHardBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStaticExportPlugins)
  .use(rehypeRaw)
  .use(rehypeSanitize, editableSanitizeSchema)
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: false, ignoreMissing: true })
  .use(rehypeStringify);

const editableProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeEditableTransform)
  .use(rehypeRaw)
  .use(rehypeSanitize, editableSanitizeSchema)
  .use(rehypeStringify);

const editableProcessorWithBreaks = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkSoftBreaksToHardBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeEditableTransform)
  .use(rehypeRaw)
  .use(rehypeSanitize, editableSanitizeSchema)
  .use(rehypeStringify);

export interface RenderMarkdownOptions {
  /** Treat single line breaks (`\n`) as hard `<br>` breaks (like GitHub Issues / Notion). */
  breaks?: boolean;
}

export async function renderMarkdownToHtml(
  markdown: string,
  options?: RenderMarkdownOptions
): Promise<string> {
  const prepared = preprocessMarkdownImageDestinations(markdown);
  const proc = options?.breaks ? staticProcessorWithBreaks : staticProcessor;
  const file = await proc.process(prepared);
  return String(file);
}

export async function renderMarkdownToEditableHtml(
  markdown: string,
  options?: RenderMarkdownOptions
): Promise<string> {
  const prepared = preprocessMarkdownImageDestinations(markdown);
  const proc = options?.breaks ? editableProcessorWithBreaks : editableProcessor;
  const file = await proc.process(prepared);
  return String(file);
}

export function splitFrontmatter(markdown: string): { frontmatterBlock: string; body: string; bodyStartLine: number } {
  const match = markdown.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$))/);
  if (!match) {
    return { frontmatterBlock: '', body: markdown, bodyStartLine: 1 };
  }
  const consumed = markdown.slice(match[1].length);
  const leadingBlank = consumed.match(/^(\r?\n+)/);
  const leadingNewlines = leadingBlank ? leadingBlank[1].split(/\r?\n/).length - 1 : 0;
  const frontmatterNewlines = match[1].split(/\r?\n/).length - 1;
  return {
    frontmatterBlock: match[1].trimEnd(),
    body: consumed.replace(/^\r?\n+/, ''),
    bodyStartLine: 1 + frontmatterNewlines + leadingNewlines,
  };
}

const blockRangeParser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath);

export interface BlockLineRange {
  index: number;
  startLine: number;
  endLine: number;
  type: string;
}

export function getMarkdownBlockLineRanges(markdown: string): BlockLineRange[] {
  const { body, bodyStartLine } = splitFrontmatter(markdown);
  if (!body.trim()) return [];
  const tree: any = blockRangeParser.parse(preprocessMarkdownImageDestinations(body));
  const offset = bodyStartLine - 1;
  const children: any[] = Array.isArray(tree?.children) ? tree.children : [];
  const ranges: BlockLineRange[] = [];
  let idx = 0;
  for (const node of children) {
    if (node.type === 'definition' || node.type === 'yaml') continue;
    const start = (node.position?.start?.line || 1) + offset;
    const end = (node.position?.end?.line || start) + offset;
    ranges.push({
      index: idx++,
      startLine: start,
      endLine: Math.max(start, end),
      type: String(node.type || 'unknown'),
    });
  }
  return ranges;
}

// Dedicated Turndown converter for TipTap visual editor -> clean Markdown
const visualTurndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  hr: '---',
  blankReplacement(_content, node) {
    const el = node as HTMLElement;
    const dataType = el.getAttribute?.('data-type');
    if (el.nodeName === 'DIV' && dataType === 'math-block') {
      const latex = (el.getAttribute('data-latex') || el.textContent || '').trim();
      return latex ? `\n\n$$\n${latex}\n$$\n\n` : '\n\n';
    }
    if (el.nodeName === 'SPAN' && dataType === 'math-inline') {
      const latex = (el.getAttribute('data-latex') || el.textContent || '').trim();
      return latex ? `$${latex}$` : '';
    }
    if (el.querySelectorAll) {
      const mathNodes = el.querySelectorAll('[data-type="math-block"], [data-type="math-inline"]');
      if (mathNodes.length > 0) {
        const parts: string[] = [];
        mathNodes.forEach((m) => {
          const kind = m.getAttribute('data-type');
          const latex = (m.getAttribute('data-latex') || m.textContent || '').trim();
          if (!latex) return;
          parts.push(kind === 'math-block' ? `$$\n${latex}\n$$` : `$${latex}$`);
        });
        if (parts.length > 0) {
          return (node as any).isBlock ? `\n\n${parts.join(' ')}\n\n` : parts.join(' ');
        }
      }
    }
    return (node as any).isBlock ? '\n\n' : '';
  },
});
visualTurndown.use(turndownGfm);

// Prevent Turndown from escaping markdown inside math or code blocks, and handle custom nodes
visualTurndown.addRule('tiptapTaskItem', {
  filter(node) {
    return (
      node.nodeName === 'LI' &&
      node.getAttribute('data-type') === 'taskItem'
    );
  },
  replacement(content, node) {
    const el = node as HTMLElement;
    const checked = el.getAttribute('data-checked') === 'true';
    const cleaned = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .replace(/\n/gm, '\n    ');
    return `- [${checked ? 'x' : ' '}] ${cleaned}\n`;
  },
});

visualTurndown.addRule('tiptapMathBlock', {
  filter(node) {
    return node.nodeName === 'DIV' && node.getAttribute('data-type') === 'math-block';
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    const latex = el.getAttribute('data-latex') || '';
    return `\n\n$$\n${latex.trim()}\n$$\n\n`;
  },
});

visualTurndown.addRule('tiptapMathInline', {
  filter(node) {
    return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'math-inline';
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    const latex = el.getAttribute('data-latex') || '';
    return `$${latex.trim()}$`;
  },
});

visualTurndown.addRule('tiptapCallout', {
  filter(node) {
    return node.nodeName === 'DIV' && Boolean(node.getAttribute('data-callout'));
  },
  replacement(content, node) {
    const el = node as HTMLElement;
    const kind = (el.getAttribute('data-callout') || 'note').toUpperCase();
    const lines = content
      .trim()
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'));
    return `\n\n> [!${kind}]\n${lines.join('\n')}\n\n`;
  },
});

visualTurndown.addRule('tiptapParagraphInList', {
  filter(node) {
    return (
      node.nodeName === 'P' &&
      Boolean(node.parentElement) &&
      node.parentElement!.nodeName === 'LI'
    );
  },
  replacement(content) {
    return content;
  },
});

visualTurndown.addRule('tiptapImage', {
  filter: 'img',
  replacement(_content, node) {
    const el = node as HTMLElement;
    const rawSrc = el.getAttribute('data-orig-src') || el.getAttribute('src') || '';
    const src = decodeLocalHrefIfNeeded(rawSrc);
    const alt = el.getAttribute('alt') || '';
    const title = el.getAttribute('title');
    if (!src) return '';
    return formatMarkdownImageSyntax(src, alt, title);
  },
});

export function editableHtmlToMarkdown(html: string, frontmatterBlock = ''): string {
  const bodyMd = visualTurndown.turndown(html).replace(/\n{3,}/g, '\n\n').trimEnd();
  if (frontmatterBlock.trim()) {
    return `${frontmatterBlock.trim()}\n\n${bodyMd}\n`;
  }
  return bodyMd ? `${bodyMd}\n` : '';
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

  const readingMinutes = Math.max(
    1,
    Math.ceil(cjkMatches.length / 500 + latinWords.length / 220)
  );

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
      if (rIdx === 1) return;
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

  const lines = text.split('\n');
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
      line = line.replace(/^(#{1,6})([^\s#])/, '$1 $2');
      const prev = processedLines[processedLines.length - 1];
      if (/^#{1,6}\s+/.test(line) && prev !== undefined && prev.trim() !== '' && prev.trim() !== '---') {
        processedLines.push('');
      }
    }

    processedLines.push(line);
  }

  const finalLines = options.formatTables ? formatGfmTables(processedLines) : processedLines;

  let result = finalLines.join('\n');
  if (options.collapseBlankLines) {
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  return result.trimEnd() + '\n';
}

const htmlPasteTurndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
htmlPasteTurndown.use(turndownGfm);

export function htmlToMarkdown(html: string): string {
  return htmlPasteTurndown.turndown(html);
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', 'Noto Sans CJK JP', 'Noto Sans JP', 'Ubuntu', sans-serif;
      line-height: 1.75;
    }
    .markdown-body { max-width: 820px; margin: 0 auto; }
    h1, h2, h3, h4 { line-height: 1.3; margin-top: 1.6em; }
    h1, h2 { border-bottom: 1px solid ${border}; padding-bottom: 0.3em; }
    a { color: #6366f1; }
    code { font-family: 'JetBrains Mono', 'Cascadia Mono', 'SF Mono', Consolas, Menlo, 'Ubuntu Mono', 'Noto Sans Mono', monospace; background: ${codeBg}; padding: 0.18em 0.4em; border-radius: 5px; font-size: 0.9em; }
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

export type DocumentPreviewKind = 'markdown' | 'webpage' | 'code' | 'data';

export function getDocumentPreviewKind(
  fileName?: string,
  filePath?: string,
  languageOverride?: string | null,
  content?: string
): DocumentPreviewKind {
  const isSvgContent = Boolean(
    content && /^\s*(?:<\?xml\b[^>]*>\s*)?<svg[\s>]/i.test(content.slice(0, 1024))
  );
  const target = (filePath || fileName || '').trim().toLowerCase();
  const base = target.split(/[/\\]/).pop() || '';
  const isSvgFile = /\.svg$/i.test(base) || isSvgContent;

  if (languageOverride) {
    if (languageOverride === 'markdown') return 'markdown';
    if (languageOverride === 'html') return 'webpage';
    if (languageOverride === 'xml' && isSvgFile) return 'webpage';
    if (languageOverride === 'csv' || languageOverride === 'tsv') return 'data';
    return 'code';
  }
  const effectiveLangId = resolveEffectiveLanguageId({
    fileName,
    filePath,
    content,
    languageOverride: null,
  });
  if (effectiveLangId === 'markdown') return 'markdown';
  if (effectiveLangId === 'html') return 'webpage';
  if (effectiveLangId === 'xml' && isSvgFile) return 'webpage';
  if (effectiveLangId === 'csv' || effectiveLangId === 'tsv') return 'data';
  if (isSvgFile) return 'webpage';
  if (effectiveLangId) return 'code';

  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === base.length - 1) return 'markdown';
  const ext = base.slice(dotIdx + 1);
  if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || ext === 'svg') {
    return 'webpage';
  }
  if (ext === 'csv' || ext === 'tsv') {
    return 'data';
  }
  if (ext === 'md' || ext === 'markdown' || ext === 'mdown' || ext === 'mdx') {
    return 'markdown';
  }
  return 'code';
}

export function splitMarkdownSlides(markdown: string): string[] {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  const body = fmMatch ? normalized.slice(fmMatch[0].length) : normalized;

  const lines = body.split('\n');
  const slides: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = '';
      }
      current.push(line);
      continue;
    }

    if (!inFence && /^---\s*$/.test(trimmed)) {
      const slideText = current.join('\n').trim();
      if (slideText || slides.length > 0) {
        slides.push(slideText);
      }
      current = [];
      continue;
    }

    current.push(line);
  }

  const lastSlide = current.join('\n').trim();
  if (lastSlide || slides.length === 0) {
    slides.push(lastSlide);
  }

  return slides.filter((s, idx) => s.length > 0 || (idx === 0 && slides.length === 1));
}

export function slugifyHeadingForAnchor(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

export function generateTocMarkdown(markdown: string, maxDepth = 4): string {
  const headings = extractHeadings(markdown).filter((h) => h.level <= maxDepth);
  if (headings.length === 0) {
    return '<!-- TOC -->\n<!-- /TOC -->';
  }
  const minLevel = Math.min(...headings.map((h) => h.level));
  const seenSlugs = new Map<string, number>();
  const lines = headings.map((h) => {
    const indent = '  '.repeat(Math.max(0, h.level - minLevel));
    const baseSlug = slugifyHeadingForAnchor(h.text) || `section-${h.line}`;
    const count = seenSlugs.get(baseSlug) || 0;
    seenSlugs.set(baseSlug, count + 1);
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count}`;
    return `${indent}- [${h.text}](#${slug})`;
  });
  return `<!-- TOC -->\n${lines.join('\n')}\n<!-- /TOC -->`;
}

export function upsertTocInMarkdown(
  markdown: string,
  insertOffset?: number
): { nextMarkdown: string; updatedExisting: boolean } {
  const tocBlock = generateTocMarkdown(markdown);
  const existingRe = /<!--\s*TOC\s*-->[\s\S]*?<!--\s*\/TOC\s*-->/i;
  if (existingRe.test(markdown)) {
    return {
      nextMarkdown: markdown.replace(existingRe, tocBlock),
      updatedExisting: true,
    };
  }
  if (typeof insertOffset === 'number' && insertOffset >= 0 && insertOffset <= markdown.length) {
    const before = markdown.slice(0, insertOffset);
    const after = markdown.slice(insertOffset);
    const needLeadNl = before.length > 0 && !before.endsWith('\n') ? '\n\n' : before.length > 0 && !before.endsWith('\n\n') ? '\n' : '';
    const needTrailNl = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '';
    return {
      nextMarkdown: `${before}${needLeadNl}${tocBlock}${needTrailNl}${after}`,
      updatedExisting: false,
    };
  }
  const fmMatch = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fmMatch) {
    const head = fmMatch[0];
    const rest = markdown.slice(head.length).replace(/^\r?\n+/, '');
    return {
      nextMarkdown: `${head}\n${tocBlock}\n\n${rest}`,
      updatedExisting: false,
    };
  }
  return {
    nextMarkdown: `${tocBlock}\n\n${markdown}`,
    updatedExisting: false,
  };
}

export function escapeHtmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

