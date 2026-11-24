import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { BlockLineRange } from './markdown';

export interface PmDecorationRange {
  from: number;
  to: number;
}

/**
 * Converts a raw Markdown fragment (which may be a partial selection) into
 * approximate plain rendered text so it can be matched against ProseMirror's text content.
 */
export function markdownFragmentToPlainText(md: string): string {
  if (!md) return '';
  const normalized = md.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n').map((line) => {
    let s = line;
    // Strip ATX heading markers at line start
    s = s.replace(/^\s{0,3}#{1,6}\s+/, '');
    // Strip blockquote markers
    s = s.replace(/^(?:\s*>\s?)+/, '');
    // Strip unordered/ordered/task list markers
    s = s.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, '');
    return s;
  });

  let text = lines.join('\n');
  // Images & links -> display text
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Wiki-links
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Inline code & fences
  text = text.replace(/```[^\n]*\n?/g, '');
  text = text.replace(/`+/g, '');
  // Bold / italic / strike markers
  text = text.replace(/\*\*|__|~~/g, '');
  text = text.replace(/(^|[\s(「『（【\[])\*|\*($|[\s.,!?;:」』）】\]])/g, '$1$2');
  text = text.replace(/^\*+|\*+$/g, '');
  // Backslash escapes
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1');
  return text;
}

export function getLineNumberAtOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

export function getLineStartOffsets(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function extractPmChildTextPositions(
  pmChild: ProseMirrorNode,
  childStartPos: number
): { text: string; positions: number[] } {
  const chars: string[] = [];
  const positions: number[] = [];

  if (pmChild.isText && pmChild.text) {
    for (let i = 0; i < pmChild.text.length; i++) {
      chars.push(pmChild.text[i]);
      positions.push(childStartPos + i);
    }
    return { text: chars.join(''), positions };
  }

  pmChild.descendants((node, relPos) => {
    if (node.isText && node.text) {
      const basePos = childStartPos + 1 + relPos;
      for (let i = 0; i < node.text.length; i++) {
        chars.push(node.text[i]);
        positions.push(basePos + i);
      }
    } else if (node.type.name === 'hardBreak') {
      chars.push('\n');
      positions.push(-1);
    }
    return true;
  });

  return { text: chars.join(''), positions };
}

function findClosestSubstringMatch(
  haystack: string,
  needle: string,
  expectedIdx: number
): { index: number; length: number } | null {
  if (!needle) return null;

  const findAll = (n: string): { index: number; length: number } | null => {
    if (!n) return null;
    let bestIdx = -1;
    let bestDist = Infinity;
    let searchFrom = 0;
    while (searchFrom <= haystack.length - n.length) {
      const idx = haystack.indexOf(n, searchFrom);
      if (idx === -1) break;
      const dist = Math.abs(idx - expectedIdx);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
      searchFrom = idx + 1;
    }
    return bestIdx !== -1 ? { index: bestIdx, length: n.length } : null;
  };

  // 1. Exact match
  const exact = findAll(needle);
  if (exact) return exact;

  // 2. Try collapsing newlines to spaces (common in soft-wrapped Markdown paragraphs)
  if (needle.includes('\n')) {
    const spaceCollapsed = needle.replace(/\n+/g, ' ');
    const matchSpace = findAll(spaceCollapsed);
    if (matchSpace) return matchSpace;
  }

  // 3. Try trimmed needle
  const trimmed = needle.trim();
  if (trimmed && trimmed !== needle) {
    const matchTrimmed = findAll(trimmed);
    if (matchTrimmed) return matchTrimmed;
  }

  return null;
}

/**
 * Maps a CodeMirror selection range `{ from, to }` in Markdown source
 * to ProseMirror document ranges `{ from, to }` for non-destructive inline decorations.
 */
export function computePreviewSelectionDecorations(
  markdown: string,
  selectionRange: { from: number; to: number } | null,
  blockRanges: BlockLineRange[],
  pmDoc: ProseMirrorNode
): PmDecorationRange[] {
  if (!selectionRange || selectionRange.from >= selectionRange.to || blockRanges.length === 0) {
    return [];
  }

  const from = Math.max(0, Math.min(selectionRange.from, markdown.length));
  const to = Math.max(from, Math.min(selectionRange.to, markdown.length));
  if (from >= to) return [];

  const startLine = getLineNumberAtOffset(markdown, from);
  const endLine = getLineNumberAtOffset(markdown, Math.max(from, to - 1));

  const matchingBlocks = blockRanges.filter(
    (r) => r.endLine >= startLine && r.startLine <= endLine
  );
  if (matchingBlocks.length === 0) return [];

  const pmChildStarts: number[] = [];
  let pos = 0;
  for (let i = 0; i < pmDoc.childCount; i++) {
    pmChildStarts.push(pos);
    pos += pmDoc.child(i).nodeSize;
  }

  const lineStarts = getLineStartOffsets(markdown);
  const docSize = pmDoc.content.size;
  const results: PmDecorationRange[] = [];

  for (const block of matchingBlocks) {
    if (block.index < 0 || block.index >= pmDoc.childCount) continue;
    const blockStartOffset = lineStarts[block.startLine - 1] ?? 0;
    const nextLineStart = lineStarts[block.endLine];
    const blockEndOffset =
      nextLineStart !== undefined ? Math.max(blockStartOffset, nextLineStart - 1) : markdown.length;

    const selFromInBlock = Math.max(0, from - blockStartOffset);
    const selToInBlock = Math.min(blockEndOffset - blockStartOffset, to - blockStartOffset);
    if (selFromInBlock >= selToInBlock) continue;

    const blockMd = markdown.slice(blockStartOffset, blockEndOffset);
    const prefixPlain = markdownFragmentToPlainText(blockMd.slice(0, selFromInBlock));
    const selectedPlain = markdownFragmentToPlainText(blockMd.slice(selFromInBlock, selToInBlock));
    if (!selectedPlain.trim()) continue;

    const pmChild = pmDoc.child(block.index);
    const childStart = pmChildStarts[block.index];
    const { text: blockText, positions } = extractPmChildTextPositions(pmChild, childStart);
    if (!blockText) continue;

    const match = findClosestSubstringMatch(blockText, selectedPlain, prefixPlain.length);
    if (!match) continue;

    let firstPos = -1;
    let lastPos = -1;
    for (let k = match.index; k < match.index + match.length; k++) {
      const p = positions[k];
      if (p >= 0) {
        if (firstPos === -1) firstPos = p;
        lastPos = p;
      }
    }

    if (firstPos >= 0 && lastPos >= firstPos) {
      const pmFrom = Math.max(0, firstPos);
      const pmTo = Math.min(docSize, lastPos + 1);
      if (pmFrom < pmTo) {
        results.push({ from: pmFrom, to: pmTo });
      }
    }
  }

  return results;
}
