import yaml from 'js-yaml';

// ─── JSON / JSONC ───────────────────────────────────────────────────────────

export interface JsonParseResult {
  ok: boolean;
  value?: unknown;
  isJsonc: boolean;
  error?: {
    message: string;
    line: number | null;
    column: number | null;
  };
}

/** Strip // and /* *\/ comments and trailing commas from JSONC without corrupting strings. */
export function stripJsonCommentsAndTrailingCommas(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];

    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        out += ch;
      } else {
        out += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        out += '  ';
        i++;
      } else {
        out += ch === '\n' || ch === '\r' ? ch : ' ';
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      out += '  ';
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      out += '  ';
      i++;
      continue;
    }

    out += ch;
  }

  // Remove trailing commas before } or ] outside strings
  let finalOut = '';
  inString = false;
  escaped = false;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (inString) {
      finalOut += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      finalOut += ch;
      continue;
    }
    if (ch === ',') {
      let j = i + 1;
      while (j < out.length && /\s/.test(out[j])) j++;
      if (out[j] === '}' || out[j] === ']') {
        finalOut += ' ';
        continue;
      }
    }
    finalOut += ch;
  }

  return finalOut;
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < clamped; i++) {
    if (text[i] === '\n') {
      line++;
      lastNl = i;
    }
  }
  return { line, column: clamped - lastNl };
}

export function parseJsonOrJsonc(raw: string, allowJsonc: boolean): JsonParseResult {
  const source = raw || '';
  if (!source.trim()) {
    return { ok: true, value: {}, isJsonc: allowJsonc };
  }
  try {
    return { ok: true, value: JSON.parse(source), isJsonc: false };
  } catch (strictErr) {
    if (allowJsonc) {
      try {
        const cleaned = stripJsonCommentsAndTrailingCommas(source);
        return { ok: true, value: JSON.parse(cleaned), isJsonc: true };
      } catch (jsoncErr) {
        return buildJsonError(source, jsoncErr, true);
      }
    }
    return buildJsonError(source, strictErr, false);
  }
}

function buildJsonError(source: string, err: unknown, isJsonc: boolean): JsonParseResult {
  const message = err instanceof Error ? err.message : String(err);
  let line: number | null = null;
  let column: number | null = null;

  const lineColMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    line = Number(lineColMatch[1]);
    column = Number(lineColMatch[2]);
  } else {
    const posMatch = message.match(/position\s+(\d+)/i);
    if (posMatch) {
      const lc = offsetToLineCol(source, Number(posMatch[1]));
      line = lc.line;
      column = lc.column;
    }
  }
  return {
    ok: false,
    isJsonc,
    error: { message, line, column },
  };
}

export function setValueAtJsonPath(
  root: unknown,
  path: Array<string | number>,
  nextValue: unknown
): unknown {
  if (path.length === 0) return nextValue;
  const [head, ...rest] = path;
  if (Array.isArray(root) && typeof head === 'number') {
    const copy = root.slice();
    copy[head] = setValueAtJsonPath(copy[head], rest, nextValue);
    return copy;
  }
  if (root && typeof root === 'object' && !Array.isArray(root) && typeof head === 'string') {
    const copy = { ...(root as Record<string, unknown>) };
    copy[head] = setValueAtJsonPath(copy[head], rest, nextValue);
    return copy;
  }
  return root;
}

export function formatJsonPathString(path: Array<string | number>): string {
  let out = '$';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

// ─── YAML / TOML ────────────────────────────────────────────────────────────

export interface StructuredParseResult {
  ok: boolean;
  value?: unknown;
  error?: {
    message: string;
    line: number | null;
    column: number | null;
  };
}

export function parseYamlDocument(raw: string): StructuredParseResult {
  try {
    const loaded = yaml.load(raw || '');
    return { ok: true, value: loaded === undefined ? {} : loaded };
  } catch (err) {
    const e = err as { message?: string; mark?: { line?: number; column?: number } };
    return {
      ok: false,
      error: {
        message: e?.message || String(err),
        line: typeof e?.mark?.line === 'number' ? e.mark.line + 1 : null,
        column: typeof e?.mark?.column === 'number' ? e.mark.column + 1 : null,
      },
    };
  }
}

function stripTomlComment(line: string): string {
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inDouble) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

function splitTopLevel(input: string, sep = ','): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inDouble) {
      cur += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }
    if (inSingle) {
      cur += ch;
      if (ch === "'") inSingle = false;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function parseTomlKeyParts(rawKey: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (let i = 0; i < rawKey.length; i++) {
    const ch = rawKey[i];
    if (inDouble) {
      if (escaped) {
        cur += ch;
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inDouble = false;
      } else {
        cur += ch;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      else cur += ch;
      continue;
    }
    if (ch === '"') inDouble = true;
    else if (ch === "'") inSingle = true;
    else if (ch === '.') {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() || parts.length === 0) parts.push(cur.trim());
  return parts.filter((p) => p.length > 0);
}

function parseTomlValue(raw: string): unknown {
  const v = raw.trim();
  if (!v) return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    if (v.startsWith('"')) {
      try {
        return JSON.parse(v);
      } catch {
        return v.slice(1, -1);
      }
    }
    return v.slice(1, -1);
  }
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner, ',').map((item) => parseTomlValue(item));
  }
  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim();
    const obj: Record<string, unknown> = {};
    if (!inner) return obj;
    for (const pair of splitTopLevel(inner, ',')) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const k = parseTomlKeyParts(pair.slice(0, eq)).join('.');
        obj[k] = parseTomlValue(pair.slice(eq + 1));
      }
    }
    return obj;
  }
  const numCandidate = v.replace(/_/g, '');
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(numCandidate)) {
    const n = Number(numCandidate);
    if (Number.isFinite(n)) return n;
  }
  if (/^0x[0-9a-fA-F_]+$/.test(v)) return Number.parseInt(v.slice(2).replace(/_/g, ''), 16);
  if (/^0o[0-7_]+$/.test(v)) return Number.parseInt(v.slice(2).replace(/_/g, ''), 8);
  if (/^0b[01_]+$/.test(v)) return Number.parseInt(v.slice(2).replace(/_/g, ''), 2);
  return v;
}

export function parseTomlDocument(raw: string): StructuredParseResult {
  const root: Record<string, unknown> = {};
  let currentTarget: Record<string, unknown> = root;
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');

  const ensureObjectPath = (base: Record<string, unknown>, parts: string[]): Record<string, unknown> => {
    let cur: Record<string, unknown> = base;
    for (const part of parts) {
      const existing = cur[part];
      if (Array.isArray(existing) && existing.length > 0) {
        const last = existing[existing.length - 1];
        if (last && typeof last === 'object' && !Array.isArray(last)) {
          cur = last as Record<string, unknown>;
          continue;
        }
      }
      if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
        cur[part] = {};
      }
      cur = cur[part] as Record<string, unknown>;
    }
    return cur;
  };

  try {
    for (let i = 0; i < lines.length; i++) {
      let line = stripTomlComment(lines[i]).trim();
      if (!line) continue;

      // Multi-line array support
      while (
        line.includes('=') &&
        line.slice(line.indexOf('=') + 1).trim().startsWith('[') &&
        !line.endsWith(']') &&
        i + 1 < lines.length
      ) {
        i++;
        line += ' ' + stripTomlComment(lines[i]).trim();
      }

      if (line.startsWith('[[') && line.endsWith(']]')) {
        const parts = parseTomlKeyParts(line.slice(2, -2).trim());
        if (parts.length === 0) throw new Error(`Invalid array-of-tables header at line ${i + 1}`);
        const parent = ensureObjectPath(root, parts.slice(0, -1));
        const leaf = parts[parts.length - 1];
        if (!Array.isArray(parent[leaf])) parent[leaf] = [];
        const entry: Record<string, unknown> = {};
        (parent[leaf] as unknown[]).push(entry);
        currentTarget = entry;
        continue;
      }

      if (line.startsWith('[') && line.endsWith(']')) {
        const parts = parseTomlKeyParts(line.slice(1, -1).trim());
        if (parts.length === 0) throw new Error(`Invalid table header at line ${i + 1}`);
        currentTarget = ensureObjectPath(root, parts);
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) {
        throw new Error(`Expected key = value at line ${i + 1}`);
      }
      const keyParts = parseTomlKeyParts(line.slice(0, eqIdx).trim());
      const rawVal = line.slice(eqIdx + 1).trim();
      const target = ensureObjectPath(currentTarget, keyParts.slice(0, -1));
      target[keyParts[keyParts.length - 1]] = parseTomlValue(rawVal);
    }
    return { ok: true, value: root };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lineMatch = msg.match(/line\s+(\d+)/i);
    return {
      ok: false,
      error: {
        message: msg,
        line: lineMatch ? Number(lineMatch[1]) : null,
        column: null,
      },
    };
  }
}

// ─── ENV / INI / PROPERTIES ─────────────────────────────────────────────────

export interface EnvEntry {
  id: string;
  key: string;
  value: string;
  section: string;
  line: number;
  isDuplicate: boolean;
  isSensitive: boolean;
  rawLine: string;
}

const SENSITIVE_KEY_RE = /(secret|token|password|passwd|pwd|api[_-]?key|private[_-]?key|auth|credential|jwt|salt)/i;

export function parseEnvEntries(raw: string): EnvEntry[] {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
  const entries: EnvEntry[] = [];
  const seenCount = new Map<string, number>();
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).trim();
      continue;
    }

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const eqIdx = withoutExport.indexOf('=');
    const colonIdx = withoutExport.indexOf(':');
    let splitIdx = eqIdx;
    if (splitIdx <= 0 && colonIdx > 0) splitIdx = colonIdx;

    if (splitIdx > 0) {
      const key = withoutExport.slice(0, splitIdx).trim();
      let val = withoutExport.slice(splitIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
        (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
      ) {
        val = val.slice(1, -1);
      }
      const composite = `${currentSection}::${key}`;
      seenCount.set(composite, (seenCount.get(composite) || 0) + 1);
      entries.push({
        id: `env-${i + 1}-${key}`,
        key,
        value: val,
        section: currentSection,
        line: i + 1,
        isDuplicate: false,
        isSensitive: SENSITIVE_KEY_RE.test(key),
        rawLine: line,
      });
    }
  }

  for (const entry of entries) {
    const composite = `${entry.section}::${entry.key}`;
    if ((seenCount.get(composite) || 0) > 1) {
      entry.isDuplicate = true;
    }
  }

  return entries;
}

export function updateEnvLine(raw: string, lineNumber: number, nextKey: string, nextValue: string): string {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) return raw;
  const orig = lines[idx];
  const needsQuotes = /\s|#/.test(nextValue) && !/^".*"$/.test(nextValue) && !/^'.*'$/.test(nextValue);
  const formattedValue = needsQuotes ? `"${nextValue.replace(/"/g, '\\"')}"` : nextValue;
  const prefix = orig.trimStart().startsWith('export ') ? 'export ' : '';
  lines[idx] = `${prefix}${nextKey.trim()}=${formattedValue}`;
  return lines.join('\n');
}

// ─── SVG ────────────────────────────────────────────────────────────────────

export interface SvgMetadata {
  width: string | null;
  height: string | null;
  viewBox: string | null;
  colors: string[];
}

export function extractSvgMetadata(raw: string): SvgMetadata {
  const head = (raw || '').slice(0, 4096);
  const svgTagMatch = head.match(/<svg\b([^>]*)>/i);
  const attrs = svgTagMatch ? svgTagMatch[1] : '';
  const width = attrs.match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1] || null;
  const height = attrs.match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1] || null;
  const viewBox = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1] || null;

  const colorSet = new Set<string>();
  const hexMatches = (raw || '').matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g);
  for (const m of hexMatches) {
    colorSet.add(m[0].toLowerCase());
  }
  const fnMatches = (raw || '').matchAll(/\b(?:rgb|rgba|hsl|hsla)\(\s*[^)]+\)/gi);
  for (const m of fnMatches) {
    colorSet.add(m[0].replace(/\s+/g, ' ').trim());
  }
  return {
    width,
    height,
    viewBox,
    colors: Array.from(colorSet).slice(0, 48),
  };
}

// ─── CSS / SCSS ─────────────────────────────────────────────────────────────

export interface CssColorToken {
  color: string;
  variableName?: string;
  line: number;
  from: number;
  to: number;
}

export function extractCssColors(raw: string): CssColorToken[] {
  const source = (raw || '').replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const tokens: CssColorToken[] = [];
  let offset = 0;

  const colorPattern = /(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|(?:rgb|rgba|hsl|hsla)\(\s*[^)]+\))/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const varMatch = line.match(/^\s*(--[A-Za-z0-9_-]+|\$[A-Za-z0-9_-]+)\s*:/);
    const variableName = varMatch ? varMatch[1] : undefined;

    for (const m of line.matchAll(colorPattern)) {
      if (typeof m.index !== 'number') continue;
      tokens.push({
        color: m[0],
        variableName,
        line: i + 1,
        from: offset + m.index,
        to: offset + m.index + m[0].length,
      });
    }
    offset += line.length + 1;
  }
  return tokens;
}

// ─── DIFF / PATCH ───────────────────────────────────────────────────────────

export interface DiffLine {
  type: 'add' | 'del' | 'context' | 'hunk' | 'meta';
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffFileSection {
  id: string;
  header: string;
  oldFile: string;
  newFile: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export function parseUnifiedDiff(raw: string): DiffFileSection[] {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
  const files: DiffFileSection[] = [];
  let current: DiffFileSection | null = null;
  let oldLn = 0;
  let newLn = 0;

  const ensureSection = (header = 'Patch') => {
    if (!current) {
      current = {
        id: `diff-${files.length}`,
        header,
        oldFile: header,
        newFile: header,
        additions: 0,
        deletions: 0,
        lines: [],
      };
      files.push(current);
    }
    return current;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const m = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      current = {
        id: `diff-${files.length}`,
        header: m ? m[2] : line.slice(11),
        oldFile: m ? m[1] : '',
        newFile: m ? m[2] : '',
        additions: 0,
        deletions: 0,
        lines: [{ type: 'meta', content: line, oldLine: null, newLine: null }],
      };
      files.push(current);
      continue;
    }

    if (line.startsWith('--- ')) {
      const sec = ensureSection(line.slice(4).trim());
      sec.oldFile = line.slice(4).replace(/^a\//, '').trim();
      sec.lines.push({ type: 'meta', content: line, oldLine: null, newLine: null });
      continue;
    }

    if (line.startsWith('+++ ')) {
      const sec = ensureSection(line.slice(4).trim());
      sec.newFile = line.slice(4).replace(/^b\//, '').trim();
      if (sec.header === 'Patch' || !sec.header) {
        sec.header = sec.newFile || sec.oldFile || 'Patch';
      }
      sec.lines.push({ type: 'meta', content: line, oldLine: null, newLine: null });
      continue;
    }

    if (line.startsWith('@@ ')) {
      const sec = ensureSection();
      const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        oldLn = Number(hunkMatch[1]);
        newLn = Number(hunkMatch[2]);
      }
      sec.lines.push({ type: 'hunk', content: line, oldLine: null, newLine: null });
      continue;
    }

    const sec = ensureSection();
    if (line.startsWith('+') && !line.startsWith('+++')) {
      sec.additions++;
      sec.lines.push({ type: 'add', content: line.slice(1), oldLine: null, newLine: newLn++ });
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      sec.deletions++;
      sec.lines.push({ type: 'del', content: line.slice(1), oldLine: oldLn++, newLine: null });
    } else if (
      line.startsWith('index ') ||
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode')
    ) {
      sec.lines.push({ type: 'meta', content: line, oldLine: null, newLine: null });
    } else {
      const content = line.startsWith(' ') ? line.slice(1) : line;
      sec.lines.push({
        type: 'context',
        content,
        oldLine: oldLn > 0 ? oldLn++ : null,
        newLine: newLn > 0 ? newLn++ : null,
      });
    }
  }

  return files;
}

// ─── LOG ────────────────────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'other';

export interface ParsedLogLine {
  line: number;
  level: LogLevel;
  text: string;
}

export function parseLogLines(raw: string): ParsedLogLine[] {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
  return lines.map((text, idx) => {
    let level: LogLevel = 'other';
    if (/\b(ERROR|FATAL|CRITICAL|ERR|EXCEPTION|TRACEBACK)\b/i.test(text)) level = 'error';
    else if (/\b(WARN|WARNING)\b/i.test(text)) level = 'warn';
    else if (/\b(INFO|NOTICE)\b/i.test(text)) level = 'info';
    else if (/\b(DEBUG|TRACE|VERBOSE)\b/i.test(text)) level = 'debug';
    return { line: idx + 1, level, text };
  });
}

// ─── HTTP / REST ────────────────────────────────────────────────────────────

export interface HttpRequestBlock {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  line: number;
}

export function parseHttpRequests(raw: string): HttpRequestBlock[] {
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: HttpRequestBlock[] = [];
  let chunkStartLine = 1;
  let chunkLines: string[] = [];

  const flushChunk = () => {
    const cleaned = chunkLines.filter((l) => !/^\s*(?:#|\/\/)/.test(l) || l.trim().startsWith('###'));
    const nameLine = chunkLines.find((l) => l.trim().startsWith('###'));
    const nonComment = cleaned.filter((l) => !l.trim().startsWith('###'));
    const firstNonEmptyIdx = nonComment.findIndex((l) => l.trim().length > 0);
    if (firstNonEmptyIdx === -1) {
      chunkLines = [];
      return;
    }

    const requestLine = nonComment[firstNonEmptyIdx].trim();
    const reqMatch = requestLine.match(
      /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(?:\s+HTTP\/[\d.]+)?$/i
    );
    const method = reqMatch ? reqMatch[1].toUpperCase() : 'GET';
    const url = reqMatch ? reqMatch[2] : requestLine;

    const headers: Record<string, string> = {};
    let bodyStartIdx = nonComment.length;
    for (let i = firstNonEmptyIdx + 1; i < nonComment.length; i++) {
      const l = nonComment[i];
      if (!l.trim()) {
        bodyStartIdx = i + 1;
        break;
      }
      const colon = l.indexOf(':');
      if (colon > 0) {
        headers[l.slice(0, colon).trim()] = l.slice(colon + 1).trim();
      }
    }

    const body = nonComment.slice(bodyStartIdx).join('\n').trim();
    blocks.push({
      id: `http-${chunkStartLine}-${blocks.length}`,
      name: nameLine ? nameLine.replace(/^#+\s*/, '').trim() : `${method} ${url}`,
      method,
      url,
      headers,
      body,
      line: chunkStartLine,
    });
    chunkLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('###')) {
      if (chunkLines.length > 0) flushChunk();
      chunkStartLine = i + 1;
    }
    chunkLines.push(line);
  }
  if (chunkLines.length > 0) flushChunk();
  return blocks;
}

// ─── OPENAPI / SWAGGER ──────────────────────────────────────────────────────

export interface OpenApiEndpoint {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: Array<{ name: string; in: string; required?: boolean; type?: string }>;
  requestBodySchema?: unknown;
  responses: Array<{ status: string; description: string; schema?: unknown }>;
}

export interface ParsedOpenApi {
  ok: boolean;
  title: string;
  version: string;
  description: string;
  servers: string[];
  endpoints: OpenApiEndpoint[];
  error?: string;
}

export function isOpenApiDocument(fileName?: string, content?: string): boolean {
  const lowerName = (fileName || '').toLowerCase();
  if (/(?:openapi|swagger)\.(?:ya?ml|json)$/i.test(lowerName)) return true;
  if (!content) return false;
  const head = content.slice(0, 4096);
  const hasSpecKey =
    /(?:^|\n)\s*["']?(?:openapi|swagger)["']?\s*:/m.test(head);
  const hasPathsKey =
    /(?:^|\n)\s*["']?paths["']?\s*:/m.test(content.slice(0, 16384));
  return hasSpecKey && hasPathsKey;
}

export function parseOpenApiDocument(raw: string): ParsedOpenApi {
  try {
    const trimmed = (raw || '').trim();
    const doc = (trimmed.startsWith('{') ? JSON.parse(trimmed) : yaml.load(trimmed)) as Record<
      string,
      unknown
    > | null;
    if (!doc || typeof doc !== 'object') {
      return {
        ok: false,
        title: 'OpenAPI',
        version: '',
        description: '',
        servers: [],
        endpoints: [],
        error: 'Document is empty or not an object.',
      };
    }

    const info = (doc.info && typeof doc.info === 'object' ? doc.info : {}) as Record<
      string,
      unknown
    >;
    const servers = Array.isArray(doc.servers)
      ? doc.servers
          .map((s) => (s && typeof s === 'object' ? String((s as Record<string, unknown>).url || '') : ''))
          .filter(Boolean)
      : [];

    const pathsObj = (doc.paths && typeof doc.paths === 'object' ? doc.paths : {}) as Record<
      string,
      unknown
    >;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
    const endpoints: OpenApiEndpoint[] = [];

    for (const [apiPath, pathItem] of Object.entries(pathsObj)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      const itemObj = pathItem as Record<string, unknown>;
      for (const method of methods) {
        const op = itemObj[method];
        if (!op || typeof op !== 'object') continue;
        const opObj = op as Record<string, unknown>;
        const rawParams = [
          ...(Array.isArray(itemObj.parameters) ? itemObj.parameters : []),
          ...(Array.isArray(opObj.parameters) ? opObj.parameters : []),
        ];
        const parameters = rawParams
          .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
          .map((p) => ({
            name: String(p.name || ''),
            in: String(p.in || 'query'),
            required: Boolean(p.required),
            type:
              p.schema && typeof p.schema === 'object'
                ? String((p.schema as Record<string, unknown>).type || '')
                : undefined,
          }));

        let requestBodySchema: unknown;
        if (opObj.requestBody && typeof opObj.requestBody === 'object') {
          const content = (opObj.requestBody as Record<string, unknown>).content as
            | Record<string, Record<string, unknown>>
            | undefined;
          const jsonMedia = content?.['application/json'] || (content ? Object.values(content)[0] : undefined);
          requestBodySchema = jsonMedia?.schema;
        }

        const responsesObj = (opObj.responses && typeof opObj.responses === 'object'
          ? opObj.responses
          : {}) as Record<string, unknown>;
        const responses = Object.entries(responsesObj).map(([status, resp]) => {
          const r = (resp && typeof resp === 'object' ? resp : {}) as Record<string, unknown>;
          const content = r.content as Record<string, Record<string, unknown>> | undefined;
          const jsonMedia = content?.['application/json'] || (content ? Object.values(content)[0] : undefined);
          return {
            status,
            description: String(r.description || ''),
            schema: jsonMedia?.schema,
          };
        });

        endpoints.push({
          id: `${method.toUpperCase()} ${apiPath}`,
          method: method.toUpperCase(),
          path: apiPath,
          summary: String(opObj.summary || ''),
          description: String(opObj.description || ''),
          tags: Array.isArray(opObj.tags) ? opObj.tags.map(String) : [],
          parameters,
          requestBodySchema,
          responses,
        });
      }
    }

    return {
      ok: true,
      title: String(info.title || 'OpenAPI Specification'),
      version: String(info.version || ''),
      description: String(info.description || ''),
      servers,
      endpoints,
    };
  } catch (err) {
    return {
      ok: false,
      title: 'OpenAPI',
      version: '',
      description: '',
      servers: [],
      endpoints: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
