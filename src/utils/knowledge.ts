import type { BacklinkMatch, WorkspaceNoteIndexEntry } from '../types';
import { computeRelativePath } from './paths';

function normalizePathKey(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function stripMdExtension(name: string): string {
  return name.replace(/\.(md|markdown|mdown|mdx)$/i, '');
}

function resolvePosixJoin(fromDirRel: string, targetRel: string): string {
  const cleanTarget = targetRel.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!fromDirRel || fromDirRel === '.') {
    return cleanTarget;
  }
  const combined = `${fromDirRel}/${cleanTarget}`.split('/');
  const out: string[] = [];
  for (const seg of combined) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0) out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.join('/');
}

export function findBacklinksForNote(
  notes: WorkspaceNoteIndexEntry[],
  activeFilePath?: string,
  activeFileName?: string
): BacklinkMatch[] {
  if (!activeFilePath && !activeFileName) return [];
  const activeEntry = activeFilePath
    ? notes.find((n) => normalizePathKey(n.path) === normalizePathKey(activeFilePath))
    : undefined;

  const targetName = activeEntry?.name || activeFileName || '';
  const targetStem = stripMdExtension(targetName).toLowerCase();
  const targetRel = (activeEntry?.relativePath || '').replace(/\\/g, '/').toLowerCase();
  const targetRelNoExt = stripMdExtension(targetRel);

  if (!targetStem) return [];

  const results: BacklinkMatch[] = [];
  const seen = new Set<string>();

  for (const note of notes) {
    if (activeFilePath && normalizePathKey(note.path) === normalizePathKey(activeFilePath)) {
      continue;
    }

    const noteDir = note.relativePath.includes('/')
      ? note.relativePath.slice(0, note.relativePath.lastIndexOf('/'))
      : '';

    for (const link of note.outgoingLinks) {
      let matched = false;
      const rawTarget = link.target.replace(/\\/g, '/').trim();
      const lowerTarget = rawTarget.toLowerCase();
      const lowerNoExt = stripMdExtension(lowerTarget);

      if (link.kind === 'wiki') {
        if (
          lowerNoExt === targetStem ||
          (targetRelNoExt && lowerNoExt === targetRelNoExt) ||
          lowerTarget === targetName.toLowerCase()
        ) {
          matched = true;
        }
      } else {
        const resolvedFromSource = resolvePosixJoin(noteDir, rawTarget).toLowerCase();
        const resolvedNoExt = stripMdExtension(resolvedFromSource);
        if (
          (targetRel && (resolvedFromSource === targetRel || resolvedNoExt === targetRelNoExt)) ||
          (!rawTarget.includes('/') && lowerNoExt === targetStem) ||
          (activeFilePath &&
            computeRelativePath(note.path, true, activeFilePath).replace(/^\.\//, '').toLowerCase() ===
              rawTarget.replace(/^\.\//, '').toLowerCase())
        ) {
          matched = true;
        }
      }

      if (matched) {
        const dedupKey = `${note.path}:${link.line}:${link.kind}`;
        if (!seen.has(dedupKey)) {
          seen.add(dedupKey);
          results.push({
            sourcePath: note.path,
            sourceRelativePath: note.relativePath,
            sourceName: note.name,
            sourceTitle: note.title,
            line: link.line,
            snippet: link.snippet,
            kind: link.kind,
          });
        }
      }
    }
  }

  return results;
}

export interface TagSummaryItem {
  tag: string;
  count: number;
  notes: Array<{
    path: string;
    relativePath: string;
    name: string;
    title: string;
    line: number;
  }>;
}

export function buildTagSummaries(notes: WorkspaceNoteIndexEntry[]): TagSummaryItem[] {
  const map = new Map<string, TagSummaryItem>();

  for (const note of notes) {
    for (const ref of note.tags) {
      const key = ref.tag.toLowerCase();
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          tag: ref.tag,
          count: 0,
          notes: [],
        };
        map.set(key, bucket);
      }
      bucket.count += 1;
      bucket.notes.push({
        path: note.path,
        relativePath: note.relativePath,
        name: note.name,
        title: note.title,
        line: ref.line,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag)
  );
}

export interface KnowledgeGraphNode {
  path: string;
  relativePath: string;
  name: string;
  title: string;
  tags: string[];
  inDegree: number;
  outDegree: number;
}

export interface KnowledgeGraphEdge {
  sourcePath: string;
  targetPath: string;
  kind: 'wiki' | 'md';
}

export interface BrokenNoteLink {
  sourcePath: string;
  sourceRelativePath: string;
  sourceTitle: string;
  target: string;
  kind: 'wiki' | 'md';
  line: number;
  snippet: string;
}

export interface WorkspaceKnowledgeReport {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  orphanNotes: KnowledgeGraphNode[];
  brokenLinks: BrokenNoteLink[];
}

export function buildWorkspaceKnowledgeReport(
  notes: WorkspaceNoteIndexEntry[],
  allWorkspaceRelPaths: string[] = []
): WorkspaceKnowledgeReport {
  const byStem = new Map<string, WorkspaceNoteIndexEntry>();
  const byRelLower = new Map<string, WorkspaceNoteIndexEntry>();
  const byRelNoExtLower = new Map<string, WorkspaceNoteIndexEntry>();
  const workspaceFileRelSet = new Set<string>(
    allWorkspaceRelPaths.map((p) => p.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase())
  );

  for (const n of notes) {
    const rel = n.relativePath.replace(/\\/g, '/').toLowerCase();
    const relNoExt = stripMdExtension(rel);
    const stem = stripMdExtension(n.name).toLowerCase();
    if (!byStem.has(stem)) byStem.set(stem, n);
    byRelLower.set(rel, n);
    byRelNoExtLower.set(relNoExt, n);
    workspaceFileRelSet.add(rel);
  }

  const nodeMap = new Map<string, KnowledgeGraphNode>();
  for (const n of notes) {
    nodeMap.set(n.path, {
      path: n.path,
      relativePath: n.relativePath,
      name: n.name,
      title: n.title || n.name,
      tags: Array.from(new Set(n.tags.map((t) => t.tag))),
      inDegree: 0,
      outDegree: 0,
    });
  }

  const edgeSeen = new Set<string>();
  const edges: KnowledgeGraphEdge[] = [];
  const brokenLinks: BrokenNoteLink[] = [];

  for (const note of notes) {
    const noteRel = note.relativePath.replace(/\\/g, '/');
    const noteDir = noteRel.includes('/') ? noteRel.slice(0, noteRel.lastIndexOf('/')) : '';

    for (const link of note.outgoingLinks) {
      const rawTarget = link.target.replace(/\\/g, '/').split('#')[0].split('?')[0].trim();
      if (!rawTarget || /^(https?:|mailto:|data:|tel:)/i.test(rawTarget)) {
        continue;
      }

      let matchedNote: WorkspaceNoteIndexEntry | undefined;
      let existsAsOtherFile = false;

      if (link.kind === 'wiki') {
        const lower = rawTarget.toLowerCase();
        const lowerNoExt = stripMdExtension(lower);
        matchedNote =
          byRelLower.get(lower) ||
          byRelNoExtLower.get(lowerNoExt) ||
          byStem.get(lowerNoExt);
        if (!matchedNote && workspaceFileRelSet.has(lower)) {
          existsAsOtherFile = true;
        }
      } else {
        const resolvedRel = resolvePosixJoin(noteDir, rawTarget).toLowerCase();
        const resolvedNoExt = stripMdExtension(resolvedRel);
        matchedNote =
          byRelLower.get(resolvedRel) ||
          byRelNoExtLower.get(resolvedNoExt) ||
          (!rawTarget.includes('/') ? byStem.get(stripMdExtension(rawTarget.toLowerCase())) : undefined);
        if (!matchedNote && workspaceFileRelSet.has(resolvedRel)) {
          existsAsOtherFile = true;
        }
      }

      if (matchedNote) {
        if (matchedNote.path !== note.path) {
          const edgeKey = `${note.path}->${matchedNote.path}`;
          if (!edgeSeen.has(edgeKey)) {
            edgeSeen.add(edgeKey);
            edges.push({
              sourcePath: note.path,
              targetPath: matchedNote.path,
              kind: link.kind,
            });
            const srcNode = nodeMap.get(note.path);
            const dstNode = nodeMap.get(matchedNote.path);
            if (srcNode) srcNode.outDegree += 1;
            if (dstNode) dstNode.inDegree += 1;
          }
        }
      } else if (!existsAsOtherFile) {
        brokenLinks.push({
          sourcePath: note.path,
          sourceRelativePath: note.relativePath,
          sourceTitle: note.title || note.name,
          target: link.target,
          kind: link.kind,
          line: link.line,
          snippet: link.snippet,
        });
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  const orphanNotes = nodes.filter((n) => n.inDegree === 0 && n.outDegree === 0);

  return {
    nodes,
    edges,
    orphanNotes,
    brokenLinks,
  };
}

