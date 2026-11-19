import type { ProjectConfigBundle, TextEncodingId } from '../types';

export interface OnigiriProjectJson {
  imageAssetFolder?: string;
  dailyNotesFolder?: string;
  defaultNewFileEncoding?: TextEncodingId;
  defaultNewFileEol?: '\n' | '\r\n';
  tabSize?: number;
  indentWithTabs?: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  wordGoal?: number;
}

export interface ResolvedProjectEditorConfig {
  tabSize?: number;
  indentWithTabs?: boolean;
  eol?: '\n' | '\r\n';
  encoding?: TextEncodingId;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  imageAssetFolder?: string;
  dailyNotesFolder?: string;
  wordGoal?: number;
  sources: Array<'editorconfig' | 'onigiri.json'>;
}

function normalizePosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function editorconfigGlobToRegex(pattern: string): RegExp {
  let out = '^';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else if (ch === '{') {
      const close = pattern.indexOf('}', i + 1);
      if (close > i) {
        const inner = pattern.slice(i + 1, close);
        if (inner.includes('..')) {
          out += '\\{' + inner + '\\}';
        } else {
          const alts = inner
            .split(',')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
          out += `(?:${alts.join('|')})`;
        }
        i = close + 1;
        continue;
      }
      out += '\\{';
    } else if (ch === '[') {
      const close = pattern.indexOf(']', i + 1);
      if (close > i) {
        let cls = pattern.slice(i + 1, close);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        out += `[${cls}]`;
        i = close + 1;
        continue;
      }
      out += '\\[';
    } else {
      out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    i++;
  }
  out += '$';
  return new RegExp(out, 'i');
}

function matchesEditorconfigSection(sectionPattern: string, relFilePath: string): boolean {
  const cleanRel = relFilePath.replace(/^\/+/, '');
  const baseName = cleanRel.split('/').pop() || cleanRel;
  const target = sectionPattern.includes('/') ? cleanRel : baseName;
  try {
    return editorconfigGlobToRegex(sectionPattern.trim()).test(target);
  } catch {
    return false;
  }
}

export function parseEditorConfigForFile(
  content: string,
  relFilePath: string
): { isRoot: boolean; props: Record<string, string> } {
  const props: Record<string, string> = {};
  let isRoot = false;
  let currentSection: string | null = null;
  let inMatchedSection = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).trim();
      inMatchedSection = matchesEditorconfigSection(currentSection, relFilePath);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const val = line.slice(eq + 1).trim().toLowerCase();
    if (currentSection === null) {
      if (key === 'root' && val === 'true') isRoot = true;
    } else if (inMatchedSection) {
      props[key] = val;
    }
  }
  return { isRoot, props };
}

export function resolveProjectConfigBundle(
  bundle: ProjectConfigBundle,
  targetFilePath?: string | null
): ResolvedProjectEditorConfig {
  const sources = new Set<'editorconfig' | 'onigiri.json'>();
  const ecMerged: Record<string, string> = {};

  if (bundle.editorconfigs.length > 0) {
    // Walk from nearest directory upwards only until `root = true`
    const parsedFromNearest: Array<{ isRoot: boolean; props: Record<string, string> }> = [];
    for (let i = bundle.editorconfigs.length - 1; i >= 0; i--) {
      const entry = bundle.editorconfigs[i];
      const normDir = normalizePosix(entry.dir).replace(/\/+$/, '');
      const normTarget = normalizePosix(targetFilePath || `${normDir}/Untitled.md`);
      const rel = normTarget.toLowerCase().startsWith(`${normDir.toLowerCase()}/`)
        ? normTarget.slice(normDir.length + 1)
        : normTarget.split('/').pop() || 'Untitled.md';
      const parsed = parseEditorConfigForFile(entry.content, rel);
      parsedFromNearest.unshift(parsed);
      if (parsed.isRoot) break;
    }
    for (const item of parsedFromNearest) {
      for (const [k, v] of Object.entries(item.props)) {
        ecMerged[k] = v;
        sources.add('editorconfig');
      }
    }
  }

  let onigiriCfg: OnigiriProjectJson = {};
  if (bundle.onigiriJson) {
    try {
      const parsed = JSON.parse(bundle.onigiriJson);
      if (parsed && typeof parsed === 'object') {
        onigiriCfg = parsed as OnigiriProjectJson;
        sources.add('onigiri.json');
      }
    } catch {
      // ignore invalid JSON
    }
  }

  const out: ResolvedProjectEditorConfig = {
    sources: Array.from(sources),
  };

  // Apply .editorconfig
  if (ecMerged.indent_style === 'tab') out.indentWithTabs = true;
  else if (ecMerged.indent_style === 'space') out.indentWithTabs = false;

  const indentSizeNum = Number(ecMerged.indent_size || ecMerged.tab_width);
  if (Number.isFinite(indentSizeNum) && indentSizeNum >= 1 && indentSizeNum <= 16) {
    out.tabSize = Math.round(indentSizeNum);
  }

  if (ecMerged.end_of_line === 'crlf') out.eol = '\r\n';
  else if (ecMerged.end_of_line === 'lf') out.eol = '\n';

  if (ecMerged.charset === 'utf-8-bom') out.encoding = 'utf-8-bom';
  else if (ecMerged.charset === 'utf-8') out.encoding = 'utf-8';
  else if (ecMerged.charset === 'utf-16le') out.encoding = 'utf-16le';
  else if (ecMerged.charset === 'utf-16be') out.encoding = 'utf-16be';

  if (ecMerged.trim_trailing_whitespace === 'true') out.trimTrailingWhitespace = true;
  else if (ecMerged.trim_trailing_whitespace === 'false') out.trimTrailingWhitespace = false;

  if (ecMerged.insert_final_newline === 'true') out.insertFinalNewline = true;
  else if (ecMerged.insert_final_newline === 'false') out.insertFinalNewline = false;

  // .onigiri.json overrides/supplements
  if (typeof onigiriCfg.imageAssetFolder === 'string' && onigiriCfg.imageAssetFolder.trim()) {
    out.imageAssetFolder = onigiriCfg.imageAssetFolder.trim();
  }
  if (typeof onigiriCfg.dailyNotesFolder === 'string') {
    out.dailyNotesFolder = onigiriCfg.dailyNotesFolder.trim();
  }
  if (onigiriCfg.defaultNewFileEncoding) {
    out.encoding = onigiriCfg.defaultNewFileEncoding;
  }
  if (onigiriCfg.defaultNewFileEol === '\n' || onigiriCfg.defaultNewFileEol === '\r\n') {
    out.eol = onigiriCfg.defaultNewFileEol;
  }
  if (typeof onigiriCfg.tabSize === 'number' && onigiriCfg.tabSize >= 1 && onigiriCfg.tabSize <= 16) {
    out.tabSize = Math.round(onigiriCfg.tabSize);
  }
  if (typeof onigiriCfg.indentWithTabs === 'boolean') {
    out.indentWithTabs = onigiriCfg.indentWithTabs;
  }
  if (typeof onigiriCfg.trimTrailingWhitespace === 'boolean') {
    out.trimTrailingWhitespace = onigiriCfg.trimTrailingWhitespace;
  }
  if (typeof onigiriCfg.insertFinalNewline === 'boolean') {
    out.insertFinalNewline = onigiriCfg.insertFinalNewline;
  }
  if (typeof onigiriCfg.wordGoal === 'number' && onigiriCfg.wordGoal >= 0) {
    out.wordGoal = onigiriCfg.wordGoal;
  }

  return out;
}

export function applyProjectSaveTransforms(
  text: string,
  cfg: ResolvedProjectEditorConfig | null
): string {
  if (!cfg) return text;
  let out = text;
  if (cfg.trimTrailingWhitespace) {
    out = out
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');
  }
  if (cfg.insertFinalNewline) {
    if (out.length > 0 && !out.endsWith('\n')) {
      out = `${out}\n`;
    }
  }
  return out;
}
