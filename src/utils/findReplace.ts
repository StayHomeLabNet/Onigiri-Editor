export interface TextRange {
  from: number;
  to: number;
}

export interface FindOptions {
  caseSensitive: boolean;
  widthSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface FindMatch {
  from: number;
  to: number;
}

export interface FindResult {
  matches: FindMatch[];
  error: string | null;
}

export interface ReplaceAllResult {
  nextText: string;
  replacedSlice: string;
  count: number;
  scopeFrom: number;
  scopeTo: number;
  error: string | null;
}

const MAX_MATCHES = 10000;

/**
 * Converts full-width ASCII alphanumerics (０-９, Ａ-Ｚ, ａ-ｚ) to half-width
 * while preserving exact UTF-16 string length (1:1 code unit mapping).
 */
export function foldAlphanumericWidth(text: string): string {
  let changed = false;
  let out = '';
  let lastCopy = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 0xff10 && code <= 0xff19) || // ０-９
      (code >= 0xff21 && code <= 0xff3a) || // Ａ-Ｚ
      (code >= 0xff41 && code <= 0xff5a) // ａ-ｚ
    ) {
      if (!changed) changed = true;
      if (i > lastCopy) out += text.slice(lastCopy, i);
      out += String.fromCharCode(code - 0xfee0);
      lastCopy = i + 1;
    }
  }

  if (!changed) return text;
  if (lastCopy < text.length) out += text.slice(lastCopy);
  return out;
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createRegExpWithIndices(pattern: string, flags: string): RegExp {
  try {
    return new RegExp(pattern, flags.includes('d') ? flags : `${flags}d`);
  } catch {
    return new RegExp(pattern, flags);
  }
}

export function buildFindRegex(
  query: string,
  options: FindOptions,
  withIndices = false
): { regex: RegExp | null; error: string | null } {
  if (!query) return { regex: null, error: null };

  const normalizedQuery = options.widthSensitive ? query : foldAlphanumericWidth(query);

  try {
    let pattern: string;
    if (options.useRegex) {
      // Validate raw user regex first so wholeWord wrapping doesn't mask syntax errors
      new RegExp(normalizedQuery);
      pattern = normalizedQuery;
      if (options.wholeWord) {
        pattern = `\\b(?:${pattern})\\b`;
      }
    } else {
      pattern = escapeRegExpLiteral(normalizedQuery);
      if (options.wholeWord) {
        const prefix = /^\w/.test(normalizedQuery) ? '\\b' : '';
        const suffix = /\w$/.test(normalizedQuery) ? '\\b' : '';
        pattern = `${prefix}${pattern}${suffix}`;
      }
    }

    const flags = options.caseSensitive ? 'gm' : 'gim';
    const regex = withIndices
      ? createRegExpWithIndices(pattern, flags)
      : new RegExp(pattern, flags);
    return { regex, error: null };
  } catch (err) {
    return {
      regex: null,
      error: (err as Error).message || 'Invalid regular expression',
    };
  }
}

export function normalizeScope(textLength: number, scope?: TextRange | null): TextRange | null {
  if (!scope) return null;
  const from = Math.max(0, Math.min(scope.from, textLength));
  const to = Math.max(0, Math.min(scope.to, textLength));
  if (to <= from) return null;
  return { from, to };
}

export function findAllMatches(
  text: string,
  query: string,
  options: FindOptions,
  scope?: TextRange | null,
  maxMatches = MAX_MATCHES
): FindResult {
  if (!query) return { matches: [], error: null };

  const { regex, error } = buildFindRegex(query, options, false);
  if (!regex || error) {
    return { matches: [], error };
  }

  let baseOffset = 0;
  let searchText = text;
  if (scope) {
    const normalized = normalizeScope(text.length, scope);
    if (!normalized) {
      return { matches: [], error: null };
    }
    baseOffset = normalized.from;
    searchText = text.slice(normalized.from, normalized.to);
  }

  const foldedSearchText = options.widthSensitive
    ? searchText
    : foldAlphanumericWidth(searchText);

  const matches: FindMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(foldedSearchText)) !== null) {
    if (m[0].length === 0) {
      // Advance past zero-width match (respecting surrogate pairs)
      const ch = foldedSearchText.codePointAt(regex.lastIndex);
      regex.lastIndex += ch !== undefined && ch > 0xffff ? 2 : 1;
      if (regex.lastIndex > foldedSearchText.length) break;
      continue;
    }
    matches.push({
      from: baseOffset + m.index,
      to: baseOffset + m.index + m[0].length,
    });
    if (matches.length >= maxMatches) break;
  }

  return { matches, error: null };
}

function unescapeRegexReplacementLiterals(replacement: string): string {
  let out = '';
  for (let i = 0; i < replacement.length; i++) {
    const ch = replacement[i];
    if (ch === '\\' && i + 1 < replacement.length) {
      const next = replacement[i + 1];
      if (next === 'n') {
        out += '\n';
        i++;
        continue;
      }
      if (next === 'r') {
        out += '\r';
        i++;
        continue;
      }
      if (next === 't') {
        out += '\t';
        i++;
        continue;
      }
      if (next === '\\') {
        out += '\\';
        i++;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function expandRegexReplacement(
  template: string,
  originalMatchText: string,
  execResult: RegExpExecArray,
  fullText: string,
  matchStartInFull: number
): string {
  const unescaped = unescapeRegexReplacementLiterals(template);
  const indices = execResult.indices;

  const getGroupValue = (groupNum: number): string => {
    if (groupNum === 0) return originalMatchText;
    if (indices && indices[groupNum]) {
      const [s, e] = indices[groupNum];
      return originalMatchText.slice(s, e);
    }
    return execResult[groupNum] ?? '';
  };

  const getNamedGroupValue = (name: string): string => {
    if (indices?.groups && indices.groups[name]) {
      const [s, e] = indices.groups[name];
      return originalMatchText.slice(s, e);
    }
    return execResult.groups?.[name] ?? '';
  };

  let result = '';
  for (let i = 0; i < unescaped.length; i++) {
    if (unescaped[i] !== '$' || i + 1 >= unescaped.length) {
      result += unescaped[i];
      continue;
    }

    const next = unescaped[i + 1];
    if (next === '$') {
      result += '$';
      i++;
    } else if (next === '&') {
      result += originalMatchText;
      i++;
    } else if (next === '`') {
      result += fullText.slice(0, matchStartInFull);
      i++;
    } else if (next === "'") {
      result += fullText.slice(matchStartInFull + originalMatchText.length);
      i++;
    } else if (next === '<') {
      const closeIdx = unescaped.indexOf('>', i + 2);
      if (closeIdx !== -1) {
        const name = unescaped.slice(i + 2, closeIdx);
        result += getNamedGroupValue(name);
        i = closeIdx;
      } else {
        result += '$';
      }
    } else if (next >= '0' && next <= '9') {
      const twoDigit =
        i + 2 < unescaped.length && unescaped[i + 2] >= '0' && unescaped[i + 2] <= '9'
          ? Number(unescaped.slice(i + 1, i + 3))
          : null;
      const oneDigit = Number(next);

      if (
        twoDigit !== null &&
        twoDigit >= 1 &&
        twoDigit < execResult.length
      ) {
        result += getGroupValue(twoDigit);
        i += 2;
      } else if (oneDigit >= 1 && oneDigit < execResult.length) {
        result += getGroupValue(oneDigit);
        i += 1;
      } else if (twoDigit !== null && execResult.length <= 10) {
        result += `$${unescaped[i + 1]}${unescaped[i + 2]}`;
        i += 2;
      } else {
        result += `$${next}`;
        i += 1;
      }
    } else {
      result += '$';
    }
  }

  return result;
}

export function computeReplacementForMatch(
  text: string,
  match: FindMatch,
  query: string,
  replacement: string,
  options: FindOptions
): string {
  if (!options.useRegex) {
    return replacement;
  }

  const originalSlice = text.slice(match.from, match.to);
  const { regex, error } = buildFindRegex(query, options, true);
  if (!regex || error) return replacement;

  // Match against the exact single match span using non-global evaluation
  const flags = regex.flags.replace('g', '');
  const singleRe = createRegExpWithIndices(regex.source, flags);
  const target = options.widthSensitive
    ? originalSlice
    : foldAlphanumericWidth(originalSlice);
  const execResult = singleRe.exec(target);
  if (!execResult) return replacement;

  return expandRegexReplacement(replacement, originalSlice, execResult, text, match.from);
}

export function replaceAllInText(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions,
  scope?: TextRange | null
): ReplaceAllResult {
  const normalizedScope = scope ? normalizeScope(text.length, scope) : null;
  if (scope && !normalizedScope) {
    return {
      nextText: text,
      replacedSlice: '',
      count: 0,
      scopeFrom: 0,
      scopeTo: 0,
      error: null,
    };
  }

  const scopeFrom = normalizedScope ? normalizedScope.from : 0;
  const scopeTo = normalizedScope ? normalizedScope.to : text.length;

  const { matches, error } = findAllMatches(text, query, options, normalizedScope, Number.MAX_SAFE_INTEGER);
  if (error || matches.length === 0) {
    return {
      nextText: text,
      replacedSlice: text.slice(scopeFrom, scopeTo),
      count: 0,
      scopeFrom,
      scopeTo,
      error,
    };
  }

  let replacedSlice = '';
  let cursor = scopeFrom;

  for (const m of matches) {
    if (m.from > cursor) {
      replacedSlice += text.slice(cursor, m.from);
    }
    const piece = computeReplacementForMatch(text, m, query, replacement, options);
    replacedSlice += piece;
    cursor = m.to;
  }

  if (cursor < scopeTo) {
    replacedSlice += text.slice(cursor, scopeTo);
  }

  const nextText = text.slice(0, scopeFrom) + replacedSlice + text.slice(scopeTo);
  return {
    nextText,
    replacedSlice,
    count: matches.length,
    scopeFrom,
    scopeTo,
    error: null,
  };
}

export function pickInitialMatchIndex(matches: FindMatch[], cursorOffset: number): number {
  if (matches.length === 0) return 0;
  const idx = matches.findIndex((m) => m.from >= cursorOffset);
  return idx >= 0 ? idx : 0;
}

export function pickNextMatchAfterReplace(matches: FindMatch[], afterPos: number): number {
  if (matches.length === 0) return 0;
  const idx = matches.findIndex((m) => m.from >= afterPos);
  return idx >= 0 ? idx : 0;
}

export function getLineRangeForOffsets(
  text: string,
  from: number,
  to: number
): { startLine: number; endLine: number } {
  const safeFrom = Math.max(0, Math.min(from, text.length));
  const safeTo = Math.max(safeFrom, Math.min(to, text.length));
  let startLine = 1;
  for (let i = 0; i < safeFrom; i++) {
    if (text.charCodeAt(i) === 10) startLine++;
  }
  let endLine = startLine;
  for (let i = safeFrom; i < safeTo; i++) {
    if (text.charCodeAt(i) === 10) endLine++;
  }
  return { startLine, endLine };
}
