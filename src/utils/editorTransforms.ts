export type WidthConvertMode =
  | 'to-full'
  | 'to-full-kana'
  | 'to-full-alnum'
  | 'to-half'
  | 'to-half-kana'
  | 'to-half-alnum';

export interface CommentSyntax {
  type: 'line' | 'block';
  open: string;
  close?: string;
}

export function getCommentSyntax(fileName?: string): CommentSyntax {
  const lower = (fileName || '').trim().toLowerCase();
  const extMatch = lower.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? extMatch[1] : 'md';

  if (['md', 'markdown', 'mdown', 'mdx', 'html', 'htm', 'xml', 'svg', 'vue', 'svelte'].includes(ext)) {
    return { type: 'block', open: '<!-- ', close: ' -->' };
  }
  if (['css'].includes(ext)) {
    return { type: 'block', open: '/* ', close: ' */' };
  }
  if (['py', 'rb', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'toml', 'ini', 'conf', 'env'].includes(ext)) {
    return { type: 'line', open: '# ' };
  }
  if (['sql'].includes(ext)) {
    return { type: 'line', open: '-- ' };
  }
  return { type: 'line', open: '// ' };
}

export function indentLineTab(line: string): string {
  return `\t${line}`;
}

export function unindentLineTab(line: string, tabSize = 4): string {
  if (line.startsWith('\t')) return line.slice(1);
  const match = line.match(new RegExp(`^ {1,${tabSize}}`));
  return match ? line.slice(match[0].length) : line;
}

export function indentLineSpaces(line: string, tabSize = 4): string {
  return `${' '.repeat(tabSize)}${line}`;
}

export function unindentLineSpaces(line: string, tabSize = 4): string {
  const match = line.match(new RegExp(`^ {1,${tabSize}}`));
  if (match) return line.slice(match[0].length);
  if (line.startsWith('\t')) return line.slice(1);
  return line;
}

export function insertCommentLine(line: string, fileName?: string): string {
  const syntax = getCommentSyntax(fileName);
  const indentMatch = line.match(/^([ \t]*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const body = line.slice(indent.length);
  if (syntax.type === 'block') {
    return `${indent}${syntax.open}${body}${syntax.close || ''}`;
  }
  return `${indent}${syntax.open}${body}`;
}

export function removeCommentLine(line: string, fileName?: string): string {
  const syntax = getCommentSyntax(fileName);
  const indentMatch = line.match(/^([ \t]*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  const body = line.slice(indent.length);

  if (syntax.type === 'block') {
    const openTrim = syntax.open.trim();
    const closeTrim = (syntax.close || '').trim();
    if (openTrim === '<!--' && body.startsWith('<!--')) {
      let inner = body.replace(/^<!-- ?/, '');
      if (closeTrim && inner.endsWith('-->')) {
        inner = inner.replace(/ ?-->$/, '');
      }
      return `${indent}${inner}`;
    }
    if (openTrim === '/*' && body.startsWith('/*')) {
      let inner = body.replace(/^\/\* ?/, '');
      if (inner.endsWith('*/')) {
        inner = inner.replace(/ ?\*\/$/, '');
      }
      return `${indent}${inner}`;
    }
  }

  const openTrim = syntax.open.trim();
  if (openTrim === '//' && body.startsWith('//')) {
    return `${indent}${body.replace(/^\/\/ ?/, '')}`;
  }
  if (openTrim === '#' && body.startsWith('#')) {
    return `${indent}${body.replace(/^# ?/, '')}`;
  }
  if (openTrim === '--' && body.startsWith('--')) {
    return `${indent}${body.replace(/^-- ?/, '')}`;
  }

  // Fallback check for common line comments
  if (body.startsWith('//')) return `${indent}${body.replace(/^\/\/ ?/, '')}`;
  if (body.startsWith('<!--') && body.endsWith('-->')) {
    return `${indent}${body.replace(/^<!-- ?/, '').replace(/ ?-->$/, '')}`;
  }
  return line;
}

export function spacesToTabsText(text: string, tabSize = 4): string {
  return text
    .split('\n')
    .map((line) => {
      let col = 0;
      let out = '';
      let i = 0;
      while (i < line.length) {
        const ch = line[i];
        if (ch === '\t') {
          out += '\t';
          col += tabSize - (col % tabSize);
          i += 1;
          continue;
        }
        if (ch === ' ') {
          let j = i;
          while (j < line.length && line[j] === ' ') j += 1;
          const runLen = j - i;
          if (runLen >= 2) {
            let rem = runLen;
            let curCol = col;
            while (rem > 0) {
              const toStop = tabSize - (curCol % tabSize);
              if (rem >= toStop && toStop >= 2) {
                out += '\t';
                curCol += toStop;
                rem -= toStop;
              } else {
                out += ' '.repeat(rem);
                curCol += rem;
                rem = 0;
              }
            }
            col = curCol;
          } else {
            out += ' ';
            col += 1;
          }
          i = j;
          continue;
        }
        out += ch;
        col += 1;
        i += 1;
      }
      return out;
    })
    .join('\n');
}

export function tabsToSpacesText(text: string, tabSize = 4): string {
  return text
    .split('\n')
    .map((line) => {
      let col = 0;
      let out = '';
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '\t') {
          const spaces = tabSize - (col % tabSize);
          out += ' '.repeat(spaces);
          col += spaces;
        } else {
          out += ch;
          col += 1;
        }
      }
      return out;
    })
    .join('\n');
}

export function reverseLines(lines: string[]): string[] {
  return [...lines].reverse();
}

export function sortLinesAsc(lines: string[]): string[] {
  return [...lines].sort((a, b) => a.localeCompare(b));
}

export function sortLinesDesc(lines: string[]): string[] {
  return [...lines].sort((a, b) => b.localeCompare(a));
}

export function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      result.push(line);
    }
  }
  return result;
}

export function trimLeadingLine(line: string): string {
  return line.replace(/^[ \t\u3000]+/, '');
}

export function trimTrailingLine(line: string): string {
  return line.replace(/[ \t\u3000]+$/, '');
}

export function insertQuoteLine(line: string): string {
  return `> ${line}`;
}

export function removeQuoteLine(line: string): string {
  return line.replace(/^> ?/, '');
}

export function removeLineBreaksText(text: string): string {
  return text.replace(/\r?\n/g, '');
}

// Half-width <-> Full-width conversion maps
const HALF_KANA_TO_FULL: Record<string, string> = {
  'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
  'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
  'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
  'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
  'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
  'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
  '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
  'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ',
  'ｫ': 'ォ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ',
  'ｰ': 'ー',
  'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
  'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
  'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
  'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
  'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
  'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
  'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
  'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
  'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
  'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜',
};

const FULL_KANA_TO_HALF: Record<string, string> = {};
for (const [half, full] of Object.entries(HALF_KANA_TO_FULL)) {
  FULL_KANA_TO_HALF[full] = half;
}
FULL_KANA_TO_HALF['ヸ'] = 'ｲﾞ';
FULL_KANA_TO_HALF['ヹ'] = 'ｴﾞ';

function isAsciiAlnum(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) // a-z
  );
}

function isFullWidthAlnum(code: number): boolean {
  return (
    (code >= 0xff10 && code <= 0xff19) || // ０-９
    (code >= 0xff21 && code <= 0xff3a) || // Ａ-Ｚ
    (code >= 0xff41 && code <= 0xff5a) // ａ-ｚ
  );
}

function halfKanaToFull(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = i + 1 < text.length ? text[i + 1] : '';
    if (next === 'ﾞ' || next === 'ﾟ') {
      const pair = ch + next;
      if (HALF_KANA_TO_FULL[pair]) {
        out += HALF_KANA_TO_FULL[pair];
        i += 1;
        continue;
      }
    }
    out += HALF_KANA_TO_FULL[ch] ?? ch;
  }
  return out;
}

function fullKanaToHalf(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    out += FULL_KANA_TO_HALF[ch] ?? ch;
  }
  return out;
}

export function convertHalfFullWidth(text: string, mode: WidthConvertMode): string {
  switch (mode) {
    case 'to-full-kana':
      return halfKanaToFull(text);

    case 'to-half-kana':
      return fullKanaToHalf(text);

    case 'to-full-alnum': {
      let out = '';
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        out += isAsciiAlnum(code) ? String.fromCharCode(code + 0xfee0) : text[i];
      }
      return out;
    }

    case 'to-half-alnum': {
      let out = '';
      for (let i = 0; i < text.length; i += 1) {
        const code = text.charCodeAt(i);
        out += isFullWidthAlnum(code) ? String.fromCharCode(code - 0xfee0) : text[i];
      }
      return out;
    }

    case 'to-full': {
      const kanaConverted = halfKanaToFull(text);
      let out = '';
      for (let i = 0; i < kanaConverted.length; i += 1) {
        const code = kanaConverted.charCodeAt(i);
        if (code === 0x20) {
          out += '\u3000';
        } else if (code >= 0x21 && code <= 0x7e) {
          out += String.fromCharCode(code + 0xfee0);
        } else {
          out += kanaConverted[i];
        }
      }
      return out;
    }

    case 'to-half': {
      const kanaConverted = fullKanaToHalf(text);
      let out = '';
      for (let i = 0; i < kanaConverted.length; i += 1) {
        const code = kanaConverted.charCodeAt(i);
        if (code === 0x3000) {
          out += ' ';
        } else if (code >= 0xff01 && code <= 0xff5e) {
          out += String.fromCharCode(code - 0xfee0);
        } else {
          out += kanaConverted[i];
        }
      }
      return out;
    }
  }
}
