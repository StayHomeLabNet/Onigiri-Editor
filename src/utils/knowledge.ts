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
