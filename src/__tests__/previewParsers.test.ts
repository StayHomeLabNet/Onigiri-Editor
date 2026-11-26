import { describe, expect, it } from 'vitest';
import { getDocumentPreviewKind } from '../utils/markdown';
import {
  extractCssColors,
  extractSvgMetadata,
  parseEnvEntries,
  parseHttpRequests,
  parseJsonOrJsonc,
  parseLogLines,
  parseOpenApiDocument,
  parseTomlDocument,
  parseUnifiedDiff,
  parseYamlDocument,
  setValueAtJsonPath,
  updateEnvLine,
} from '../utils/previewParsers';

describe('getDocumentPreviewKind', () => {
  it('routes all dedicated extensions to their preview kinds', () => {
    expect(getDocumentPreviewKind('data.json')).toBe('json');
    expect(getDocumentPreviewKind('tsconfig.jsonc')).toBe('json');
    expect(getDocumentPreviewKind('config.yaml')).toBe('yaml');
    expect(getDocumentPreviewKind('Cargo.toml')).toBe('toml');
    expect(getDocumentPreviewKind('.env')).toBe('env');
    expect(getDocumentPreviewKind('.env.local')).toBe('env');
    expect(getDocumentPreviewKind('settings.ini')).toBe('env');
    expect(getDocumentPreviewKind('icon.svg')).toBe('svg');
    expect(getDocumentPreviewKind('flow.mmd')).toBe('diagram');
    expect(getDocumentPreviewKind('graph.dot')).toBe('diagram');
    expect(getDocumentPreviewKind('styles.css')).toBe('css');
    expect(getDocumentPreviewKind('theme.scss')).toBe('css');
    expect(getDocumentPreviewKind('changes.diff')).toBe('diff');
    expect(getDocumentPreviewKind('fix.patch')).toBe('diff');
    expect(getDocumentPreviewKind('app.log')).toBe('log');
    expect(getDocumentPreviewKind('paper.tex')).toBe('latex');
    expect(getDocumentPreviewKind('api.http')).toBe('http');
    expect(getDocumentPreviewKind('openapi.yaml')).toBe('openapi');
    expect(getDocumentPreviewKind('data.csv')).toBe('data');
    expect(getDocumentPreviewKind('index.html')).toBe('webpage');
    expect(getDocumentPreviewKind('notes.md')).toBe('markdown');
  });
});

describe('previewParsers', () => {
  it('parses JSONC comments and trailing commas and updates by path', () => {
    const res = parseJsonOrJsonc('{\n  // comment\n  "name": "onigiri",\n  "items": [1, 2,],\n}', true);
    expect(res.ok).toBe(true);
    expect(res.isJsonc).toBe(true);
    const updated = setValueAtJsonPath(res.value, ['items', 1], 99) as { items: number[] };
    expect(updated.items).toEqual([1, 99]);
  });

  it('parses YAML and TOML documents', () => {
    const y = parseYamlDocument('title: Hello\ncount: 3\n');
    expect(y.ok).toBe(true);
    expect(y.value).toEqual({ title: 'Hello', count: 3 });

    const t = parseTomlDocument('[package]\nname = "onigiri"\nversion = "1.5.5"\ntags = ["md", "code"]\n');
    expect(t.ok).toBe(true);
    expect(t.value).toEqual({
      package: { name: 'onigiri', version: '1.5.5', tags: ['md', 'code'] },
    });
  });

  it('parses .env entries, detects duplicates, and updates lines', () => {
    const envRaw = 'API_KEY=abc\nPORT=3000\nAPI_KEY=xyz\n';
    const entries = parseEnvEntries(envRaw);
    expect(entries).toHaveLength(3);
    expect(entries[0].isDuplicate).toBe(true);
    expect(entries[0].isSensitive).toBe(true);
    expect(entries[1].isDuplicate).toBe(false);
    expect(updateEnvLine(envRaw, 2, 'PORT', '8080')).toContain('PORT=8080');
  });

  it('extracts SVG metadata, CSS colors, Diff sections, Log levels, HTTP blocks, and OpenAPI', () => {
    const svg = extractSvgMetadata('<svg viewBox="0 0 24 24" width="24"><path fill="#ff5500"/></svg>');
    expect(svg.viewBox).toBe('0 0 24 24');
    expect(svg.colors).toContain('#ff5500');

    const css = extractCssColors(':root {\n  --brand: #10b981;\n}\n');
    expect(css).toHaveLength(1);
    expect(css[0].variableName).toBe('--brand');

    const diff = parseUnifiedDiff('diff --git a/a.txt b/a.txt\n@@ -1,1 +1,1 @@\n-old\n+new\n');
    expect(diff).toHaveLength(1);
    expect(diff[0].additions).toBe(1);
    expect(diff[0].deletions).toBe(1);

    const logs = parseLogLines('[ERROR] boom\n[INFO] ok\n');
    expect(logs[0].level).toBe('error');
    expect(logs[1].level).toBe('info');

    const http = parseHttpRequests('### Test\nPOST https://example.com/api\nContent-Type: application/json\n\n{"ok":true}\n');
    expect(http).toHaveLength(1);
    expect(http[0].method).toBe('POST');
    expect(http[0].headers['Content-Type']).toBe('application/json');

    const oa = parseOpenApiDocument('openapi: 3.0.0\ninfo:\n  title: Demo\n  version: 1.0.0\npaths:\n  /ping:\n    get:\n      summary: Ping\n      responses:\n        "200":\n          description: OK\n');
    expect(oa.ok).toBe(true);
    expect(oa.endpoints).toHaveLength(1);
    expect(oa.endpoints[0].path).toBe('/ping');
  });
});
