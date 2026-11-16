import type { TextEncodingId } from '../types';

export interface EncodingOption {
  id: TextEncodingId;
  label: string;
  shortLabel: string;
  noteJa: string;
  noteEn: string;
}

export const TEXT_ENCODINGS: EncodingOption[] = [
  {
    id: 'utf-8',
    label: 'UTF-8',
    shortLabel: 'UTF-8',
    noteJa: '標準（BOMなし）',
    noteEn: 'Standard (No BOM)',
  },
  {
    id: 'utf-8-bom',
    label: 'UTF-8 (BOM)',
    shortLabel: 'UTF-8 BOM',
    noteJa: 'Windows メモ帳 / Excel CSV向け',
    noteEn: 'With UTF-8 Byte Order Mark',
  },
  {
    id: 'shift_jis',
    label: 'Shift_JIS (CP932)',
    shortLabel: 'Shift_JIS',
    noteJa: 'Windows 日本語レガシーテキスト',
    noteEn: 'Japanese Windows / CP932',
  },
  {
    id: 'euc-jp',
    label: 'EUC-JP',
    shortLabel: 'EUC-JP',
    noteJa: 'UNIX / Linux 日本語テキスト',
    noteEn: 'Japanese UNIX / Linux',
  },
  {
    id: 'iso-2022-jp',
    label: 'ISO-2022-JP (JIS)',
    shortLabel: 'ISO-2022-JP',
    noteJa: '7bit JIS / メール互換',
    noteEn: '7-bit JIS encoding',
  },
  {
    id: 'utf-16le',
    label: 'UTF-16 LE',
    shortLabel: 'UTF-16 LE',
    noteJa: 'Little Endian (BOM付)',
    noteEn: 'Little Endian with BOM',
  },
  {
    id: 'utf-16be',
    label: 'UTF-16 BE',
    shortLabel: 'UTF-16 BE',
    noteJa: 'Big Endian (BOM付)',
    noteEn: 'Big Endian with BOM',
  },
];

export function normalizeTextEncoding(raw?: string | null): TextEncodingId {
  const norm = (raw || '').trim().toLowerCase().replace(/_/g, '-');
  switch (norm) {
    case 'utf-8-bom':
    case 'utf8-bom':
      return 'utf-8-bom';
    case 'shift-jis':
    case 'shiftjis':
    case 'sjis':
    case 'cp932':
      return 'shift_jis';
    case 'euc-jp':
    case 'eucjp':
      return 'euc-jp';
    case 'iso-2022-jp':
    case 'iso2022jp':
    case 'jis':
      return 'iso-2022-jp';
    case 'utf-16le':
    case 'utf16le':
      return 'utf-16le';
    case 'utf-16be':
    case 'utf16be':
      return 'utf-16be';
    default:
      return 'utf-8';
  }
}

export function getEncodingLabel(enc?: TextEncodingId): string {
  const found = TEXT_ENCODINGS.find((e) => e.id === enc);
  return found ? found.label : 'UTF-8';
}

export function getEncodingShortLabel(enc?: TextEncodingId): string {
  const found = TEXT_ENCODINGS.find((e) => e.id === enc);
  return found ? found.shortLabel : 'UTF-8';
}

export function decodeBytesBrowser(
  bytes: Uint8Array,
  requested?: TextEncodingId
): { content: string; encoding: TextEncodingId; eol: '\n' | '\r\n' } {
  const detect = (): { content: string; encoding: TextEncodingId } => {
    if (requested) {
      const labelMap: Record<TextEncodingId, string> = {
        'utf-8': 'utf-8',
        'utf-8-bom': 'utf-8',
        shift_jis: 'shift_jis',
        'euc-jp': 'euc-jp',
        'iso-2022-jp': 'iso-2022-jp',
        'utf-16le': 'utf-16le',
        'utf-16be': 'utf-16be',
      };
      const slice =
        requested === 'utf-8-bom' &&
        bytes[0] === 0xef &&
        bytes[1] === 0xbb &&
        bytes[2] === 0xbf
          ? bytes.slice(3)
          : requested === 'utf-16le' && bytes[0] === 0xff && bytes[1] === 0xfe
            ? bytes.slice(2)
            : requested === 'utf-16be' && bytes[0] === 0xfe && bytes[1] === 0xff
              ? bytes.slice(2)
              : bytes;
      const content = new TextDecoder(labelMap[requested]).decode(slice);
      return { content, encoding: requested };
    }

    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return {
        content: new TextDecoder('utf-8').decode(bytes.slice(3)),
        encoding: 'utf-8-bom',
      };
    }
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      return {
        content: new TextDecoder('utf-16le').decode(bytes.slice(2)),
        encoding: 'utf-16le',
      };
    }
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      return {
        content: new TextDecoder('utf-16be').decode(bytes.slice(2)),
        encoding: 'utf-16be',
      };
    }

    try {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (content.includes('\x1b$B') || content.includes('\x1b$@')) {
        return {
          content: new TextDecoder('iso-2022-jp').decode(bytes),
          encoding: 'iso-2022-jp',
        };
      }
      return { content, encoding: 'utf-8' };
    } catch {
      try {
        return {
          content: new TextDecoder('shift_jis', { fatal: true }).decode(bytes),
          encoding: 'shift_jis',
        };
      } catch {
        try {
          return {
            content: new TextDecoder('euc-jp', { fatal: true }).decode(bytes),
            encoding: 'euc-jp',
          };
        } catch {
          return {
            content: new TextDecoder('utf-8').decode(bytes),
            encoding: 'utf-8',
          };
        }
      }
    }
  };

  const { content, encoding } = detect();
  const eol: '\n' | '\r\n' = content.includes('\r\n') ? '\r\n' : '\n';
  return { content, encoding, eol };
}

export function encodeTextBrowser(content: string, encoding: TextEncodingId): Uint8Array {
  if (encoding === 'utf-8-bom') {
    const body = new TextEncoder().encode(content);
    const out = new Uint8Array(3 + body.length);
    out.set([0xef, 0xbb, 0xbf], 0);
    out.set(body, 3);
    return out;
  }
  if (encoding === 'utf-16le' || encoding === 'utf-16be') {
    const le = encoding === 'utf-16le';
    const out = new Uint8Array(2 + content.length * 2);
    out[0] = le ? 0xff : 0xfe;
    out[1] = le ? 0xfe : 0xff;
    for (let i = 0; i < content.length; i++) {
      const code = content.charCodeAt(i);
      const offset = 2 + i * 2;
      out[offset] = le ? code & 0xff : (code >> 8) & 0xff;
      out[offset + 1] = le ? (code >> 8) & 0xff : code & 0xff;
    }
    return out;
  }
  return new TextEncoder().encode(content);
}
