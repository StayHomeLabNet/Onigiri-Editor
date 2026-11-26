import React, { useMemo } from 'react';
import katex from 'katex';
import type { Locale } from '../../types';
import { escapeHtmlText } from '../../utils/markdown';

interface LatexPreviewPaneProps {
  locale: Locale;
  content: string;
}

function renderKatexSafe(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return `<code>${escapeHtmlText(tex)}</code>`;
  }
}

function renderInlineLatex(text: string): string {
  // Replace inline $...$ and \(...\)
  let html = '';
  let lastIdx = 0;
  const inlineRe = /\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g;
  for (const m of text.matchAll(inlineRe)) {
    const idx = m.index ?? 0;
    if (idx > lastIdx) {
      html += formatBasicInlineCommands(text.slice(lastIdx, idx));
    }
    const expr = m[1] ?? m[2] ?? '';
    html += renderKatexSafe(expr, false);
    lastIdx = idx + m[0].length;
  }
  if (lastIdx < text.length) {
    html += formatBasicInlineCommands(text.slice(lastIdx));
  }
  return html;
}

function formatBasicInlineCommands(segment: string): string {
  let s = escapeHtmlText(segment);
  s = s.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  s = s.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  s = s.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  s = s.replace(/\\texttt\{([^}]*)\}/g, '<code>$1</code>');
  s = s.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  s = s.replace(/\\\\/g, '<br/>');
  return s;
}

function compileLatexToHtml(raw: string): string {
  const normalized = (raw || '').replace(/\r\n/g, '\n');
  // If \begin{document} exists, focus on document body + title/author from preamble
  const titleMatch = normalized.match(/\\title\{([\s\S]*?)\}/);
  const authorMatch = normalized.match(/\\author\{([\s\S]*?)\}/);
  const docBodyMatch = normalized.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const bodySource = docBodyMatch ? docBodyMatch[1] : normalized;

  const chunks: string[] = [];
  if (titleMatch) {
    chunks.push(`<h1 class="ext-tex-title">${renderInlineLatex(titleMatch[1])}</h1>`);
  }
  if (authorMatch) {
    chunks.push(`<div class="ext-tex-author">${renderInlineLatex(authorMatch[1])}</div>`);
  }

  // Split out display math blocks ($$...$$, \[...\], \begin{equation|align|gather}...\end{...})
  const blockRe =
    /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\begin\{(equation\*?|align\*?|gather\*?)\}([\s\S]*?)\\end\{\3\}/g;

  let pos = 0;
  const pushTextBlock = (text: string) => {
    const lines = text.split('\n');
    let paragraph: string[] = [];
    let listItems: string[] = [];
    let listTag: 'ul' | 'ol' | null = null;

    const flushPara = () => {
      if (paragraph.length > 0) {
        chunks.push(`<p>${renderInlineLatex(paragraph.join(' '))}</p>`);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (listTag && listItems.length > 0) {
        chunks.push(
          `<${listTag}>${listItems.map((it) => `<li>${renderInlineLatex(it)}</li>`).join('')}</${listTag}>`
        );
      }
      listTag = null;
      listItems = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('%')) {
        flushPara();
        continue;
      }
      if (/^\\maketitle\b/.test(line)) continue;
      const secMatch = line.match(/^\\(section|subsection|subsubsection)\*?\{([\s\S]*)\}$/);
      if (secMatch) {
        flushPara();
        flushList();
        const tag = secMatch[1] === 'section' ? 'h2' : secMatch[1] === 'subsection' ? 'h3' : 'h4';
        chunks.push(`<${tag}>${renderInlineLatex(secMatch[2])}</${tag}>`);
        continue;
      }
      if (/^\\begin\{itemize\}/.test(line)) {
        flushPara();
        flushList();
        listTag = 'ul';
        continue;
      }
      if (/^\\begin\{enumerate\}/.test(line)) {
        flushPara();
        flushList();
        listTag = 'ol';
        continue;
      }
      if (/^\\end\{(?:itemize|enumerate)\}/.test(line)) {
        flushList();
        continue;
      }
      if (listTag && line.startsWith('\\item')) {
        listItems.push(line.replace(/^\\item\s*/, ''));
        continue;
      }
      paragraph.push(line);
    }
    flushPara();
    flushList();
  };

  for (const m of bodySource.matchAll(blockRe)) {
    const idx = m.index ?? 0;
    if (idx > pos) {
      pushTextBlock(bodySource.slice(pos, idx));
    }
    const mathBody = m[1] ?? m[2] ?? (m[3] ? `\\begin{${m[3]}}${m[4]}\\end{${m[3]}}` : '');
    chunks.push(`<div class="ext-tex-math-block">${renderKatexSafe(mathBody, true)}</div>`);
    pos = idx + m[0].length;
  }
  if (pos < bodySource.length) {
    pushTextBlock(bodySource.slice(pos));
  }

  return chunks.join('\n');
}

export const LatexPreviewPane: React.FC<LatexPreviewPaneProps> = ({ locale, content }) => {
  const isJa = locale === 'ja';
  const renderedHtml = useMemo(() => compileLatexToHtml(content), [content]);

  return (
    <div className="ext-preview-pane">
      <div className="ext-preview-toolbar">
        <div className="ext-preview-toolbar-left">
          <span className="ext-preview-kind-badge">LaTeX / KaTeX</span>
        </div>
      </div>
      <div className="ext-preview-body">
        {renderedHtml ? (
          <article
            className="ext-latex-article markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <div className="ext-empty-cell">
            {isJa ? 'LaTeX コンテンツが空です' : 'Empty LaTeX document'}
          </div>
        )}
      </div>
    </div>
  );
};
