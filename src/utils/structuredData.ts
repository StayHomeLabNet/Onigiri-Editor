import yaml from 'js-yaml';

export interface ParsedDelimitedTable {
  delimiter: '\t' | ',' | ';';
  headers: string[];
  rows: string[][];
}

export function parseDelimitedRows(
  text: string,
  forcedDelimiter?: '\t' | ',' | ';'
): { delimiter: '\t' | ',' | ';'; rows: string[][] } {
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const trimmed = normalized.replace(/\n+$/, '');
  if (!trimmed) {
    return { delimiter: forcedDelimiter || ',', rows: [] };
  }

  let delimiter: '\t' | ',' | ';' = forcedDelimiter || ',';
  if (!forcedDelimiter) {
    const sampleLines = trimmed.split('\n').slice(0, 8);
    const tabCount = sampleLines.reduce((acc, l) => acc + (l.match(/\t/g)?.length || 0), 0);
    const commaCount = sampleLines.reduce((acc, l) => acc + (l.match(/,/g)?.length || 0), 0);
    const semiCount = sampleLines.reduce((acc, l) => acc + (l.match(/;/g)?.length || 0), 0);
    if (tabCount >= sampleLines.length && tabCount > 0) {
      delimiter = '\t';
    } else if (semiCount > commaCount && semiCount >= sampleLines.length) {
      delimiter = ';';
    } else {
      delimiter = ',';
    }
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inQuotes) {
      if (ch === '"') {
        if (trimmed[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  row.push(field);
  rows.push(row);

  return { delimiter, rows };
}

export function parseCsvTsvTable(
  text: string,
  forcedDelimiter?: '\t' | ',' | ';'
): ParsedDelimitedTable {
  const { delimiter, rows } = parseDelimitedRows(text, forcedDelimiter);
  if (rows.length === 0) {
    return { delimiter, headers: [], rows: [] };
  }
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  const padRow = (r: string[]) => {
    const out = r.map((c) => c.trim());
    while (out.length < colCount) out.push('');
    return out;
  };
  const headers = padRow(rows[0]).map((h, i) => h || `Col ${i + 1}`);
  const body = rows.slice(1).map(padRow);
  return { delimiter, headers, rows: body };
}

export function tableRowsToMarkdown(headers: string[], rows: string[][]): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const normHeaders = Array.from({ length: colCount }, (_, i) =>
    (headers[i] || `Col ${i + 1}`).replace(/\|/g, '\\|').replace(/\n/g, ' ')
  );
  const normRows = rows.map((r) =>
    Array.from({ length: colCount }, (_, i) =>
      (r[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>')
    )
  );
  const widths = Array.from({ length: colCount }, (_, c) => {
    let w = Math.max(3, normHeaders[c].length);
    for (const r of normRows) {
      w = Math.max(w, r[c].length);
    }
    return Math.min(w, 48);
  });

  const pad = (val: string, width: number) => val.padEnd(width, ' ');
  const headerLine = `| ${normHeaders.map((h, i) => pad(h, widths[i])).join(' | ')} |`;
  const sepLine = `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`;
  const bodyLines = normRows.map(
    (r) => `| ${r.map((cell, i) => pad(cell, widths[i])).join(' | ')} |`
  );
  return [headerLine, sepLine, ...bodyLines].join('\n');
}

/**
 * Detects whether clipboard plain text looks like pasted spreadsheet TSV or clean multi-row CSV
 * and converts it into a formatted GFM Markdown table. Returns null if not tabular.
 */
export function delimitedToMarkdownTable(text: string): string | null {
  const trimmed = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!trimmed) return null;
  // Never hijack markdown tables or fenced code / HTML / JSON
  if (trimmed.startsWith('|') || trimmed.startsWith('```') || trimmed.startsWith('{') || trimmed.startsWith('<')) {
    return null;
  }

  const lines = trimmed.split('\n').filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const hasConsistentTabs = lines.every((l) => l.includes('\t'));
  if (hasConsistentTabs) {
    const parsed = parseDelimitedRows(trimmed, '\t');
    const counts = parsed.rows.map((r) => r.length);
    const maxCols = Math.max(...counts);
    const minCols = Math.min(...counts);
    if (maxCols >= 2 && minCols >= 2 && maxCols <= 30) {
      const headers = parsed.rows[0].map((c) => c.trim());
      const rows = parsed.rows.slice(1).map((r) => r.map((c) => c.trim()));
      return tableRowsToMarkdown(headers, rows);
    }
  }

  // Careful CSV heuristic: every line has >= 1 comma, consistent column count >= 2, no typical code braces/semicolons
  if (lines.length >= 2 && lines.length <= 200 && lines.every((l) => l.includes(','))) {
    if (/[{}();=>]/.test(trimmed)) return null;
    const parsed = parseDelimitedRows(trimmed, ',');
    const counts = parsed.rows.map((r) => r.length);
    const firstCols = counts[0];
    if (
      firstCols >= 2 &&
      firstCols <= 20 &&
      counts.every((c) => c === firstCols) &&
      parsed.rows.some((r) => r.some((cell) => cell.trim().length > 0))
    ) {
      const headers = parsed.rows[0].map((c) => c.trim());
      const rows = parsed.rows.slice(1).map((r) => r.map((c) => c.trim()));
      return tableRowsToMarkdown(headers, rows);
    }
  }

  return null;
}

export function tableRowsToDelimited(
  headers: string[],
  rows: string[][],
  delimiter: '\t' | ',' = ','
): string {
  const escapeCell = (val: string) => {
    const str = val ?? '';
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers, ...rows].map((r) => r.map(escapeCell).join(delimiter)).join('\n');
}

export function formatJsonText(raw: string): string {
  const parsed = JSON.parse(raw);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function minifyJsonText(raw: string): string {
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed);
}

function sortObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectDeep);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortObjectDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function sortJsonKeysText(raw: string): string {
  const parsed = JSON.parse(raw);
  return `${JSON.stringify(sortObjectDeep(parsed), null, 2)}\n`;
}

export function jsonToYamlText(raw: string): string {
  const parsed = JSON.parse(raw);
  return yaml.dump(parsed, { indent: 2, lineWidth: 100, noRefs: true });
}

export function yamlToJsonText(raw: string): string {
  const parsed = yaml.load(raw);
  return `${JSON.stringify(parsed ?? null, null, 2)}\n`;
}

export function formatEnvText(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const comments: string[] = [];
  const entries: Array<[string, string]> = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('#')) {
      comments.push(t);
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      entries.push([k, v]);
    } else {
      comments.push(t);
    }
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const body = entries.map(([k, v]) => `${k}=${v}`);
  return [...comments, ...(comments.length > 0 && body.length > 0 ? [''] : []), ...body, ''].join('\n');
}
