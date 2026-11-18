import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import type { Locale } from '../types';

export interface LanguageOption {
  id: string;
  label: string;
  labelJa?: string;
  sampleFilename: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { id: 'markdown', label: 'Markdown', sampleFilename: 'doc.md' },
  { id: 'plaintext', label: 'Plain Text', labelJa: 'テキスト', sampleFilename: 'doc.txt' },
  { id: 'javascript', label: 'JavaScript', sampleFilename: 'app.js' },
  { id: 'jsx', label: 'JSX', sampleFilename: 'app.jsx' },
  { id: 'typescript', label: 'TypeScript', sampleFilename: 'app.ts' },
  { id: 'tsx', label: 'TSX', sampleFilename: 'app.tsx' },
  { id: 'html', label: 'HTML', sampleFilename: 'index.html' },
  { id: 'css', label: 'CSS', sampleFilename: 'styles.css' },
  { id: 'scss', label: 'SCSS', sampleFilename: 'styles.scss' },
  { id: 'json', label: 'JSON', sampleFilename: 'data.json' },
  { id: 'yaml', label: 'YAML', sampleFilename: 'config.yaml' },
  { id: 'toml', label: 'TOML', sampleFilename: 'Cargo.toml' },
  { id: 'xml', label: 'XML / SVG', sampleFilename: 'data.xml' },
  { id: 'python', label: 'Python', sampleFilename: 'main.py' },
  { id: 'php', label: 'PHP', sampleFilename: 'index.php' },
  { id: 'rust', label: 'Rust', sampleFilename: 'lib.rs' },
  { id: 'go', label: 'Go', sampleFilename: 'main.go' },
  { id: 'java', label: 'Java', sampleFilename: 'Main.java' },
  { id: 'cpp', label: 'C++', sampleFilename: 'main.cpp' },
  { id: 'c', label: 'C', sampleFilename: 'main.c' },
  { id: 'csharp', label: 'C#', sampleFilename: 'Program.cs' },
  { id: 'swift', label: 'Swift', sampleFilename: 'App.swift' },
  { id: 'kotlin', label: 'Kotlin', sampleFilename: 'Main.kt' },
  { id: 'ruby', label: 'Ruby', sampleFilename: 'app.rb' },
  { id: 'sql', label: 'SQL', sampleFilename: 'query.sql' },
  { id: 'shell', label: 'Shell', sampleFilename: 'run.sh' },
  { id: 'powershell', label: 'PowerShell', sampleFilename: 'run.ps1' },
  { id: 'dockerfile', label: 'Dockerfile', sampleFilename: 'Dockerfile' },
  { id: 'vue', label: 'Vue', sampleFilename: 'App.vue' },
  { id: 'svelte', label: 'Svelte', sampleFilename: 'App.svelte' },
];

export function isMarkdownFilename(name?: string, overrideId?: string | null): boolean {
  if (overrideId) {
    return overrideId === 'markdown';
  }
  if (!name) return true;
  return /\.(md|markdown|mdown|mdx)$/i.test(name.trim());
}

const SPECIAL_DISPLAY_NAMES: Record<string, string> = {
  svg: 'SVG',
  zsh: 'Shell',
  fish: 'Shell',
  bash: 'Shell',
  sh: 'Shell',
  svelte: 'Svelte',
  astro: 'Astro',
  jsonc: 'JSONC',
  json5: 'JSON5',
  ini: 'INI',
  conf: 'Config',
  env: 'Env',
  csv: 'CSV',
  tsv: 'TSV',
};

const SPECIAL_BASENAME_DISPLAY: Record<string, string> = {
  makefile: 'Makefile',
  gnumakefile: 'Makefile',
  '.env': 'Env',
  '.gitignore': 'Git Ignore',
  '.gitattributes': 'Git Attributes',
  '.editorconfig': 'EditorConfig',
};

const FALLBACK_CM_SYNTAX_EXT: Record<string, string> = {
  zsh: 'shell',
  fish: 'shell',
  jsonc: 'json',
  json5: 'json',
  svelte: 'html',
  astro: 'html',
};

export function resolveEffectiveFilename(
  fileName?: string,
  overrideId?: string | null
): string | undefined {
  if (!overrideId) return fileName;
  const opt = LANGUAGE_OPTIONS.find((o) => o.id === overrideId);
  return opt ? opt.sampleFilename : fileName;
}

export function resolveEditorLanguageDescription(
  fileName?: string,
  overrideId?: string | null
): LanguageDescription | null {
  if (overrideId) {
    if (overrideId === 'markdown' || overrideId === 'plaintext') return null;
    const opt = LANGUAGE_OPTIONS.find((o) => o.id === overrideId);
    if (opt) {
      const matched = LanguageDescription.matchFilename(languages, opt.sampleFilename);
      if (matched) return matched;
      if (opt.id === 'svelte') {
        return LanguageDescription.matchLanguageName(languages, 'html', true);
      }
    }
  }
  const raw = (fileName || '').trim();
  if (!raw || isMarkdownFilename(raw)) return null;
  const base = raw.split(/[/\\]/).pop() || raw;
  const direct = LanguageDescription.matchFilename(languages, base);
  if (direct) return direct;

  const lowerBase = base.toLowerCase();
  const dotIdx = lowerBase.lastIndexOf('.');
  const ext = dotIdx > 0 && dotIdx < lowerBase.length - 1 ? lowerBase.slice(dotIdx + 1) : '';
  const fallbackLang = ext ? FALLBACK_CM_SYNTAX_EXT[ext] : undefined;
  if (fallbackLang) {
    return LanguageDescription.matchLanguageName(languages, fallbackLang, true);
  }
  return null;
}

export function resolveEditorLanguageLabel(
  fileName: string | undefined,
  locale: Locale,
  overrideId?: string | null
): string {
  const plainLabel = locale === 'ja' ? 'テキスト' : 'Plain Text';
  if (overrideId) {
    const opt = LANGUAGE_OPTIONS.find((o) => o.id === overrideId);
    if (opt) {
      return locale === 'ja' && opt.labelJa ? opt.labelJa : opt.label;
    }
  }
  const raw = (fileName || '').trim();
  if (!raw) return 'Markdown';
  if (isMarkdownFilename(raw)) return 'Markdown';

  const base = raw.split(/[/\\]/).pop() || raw;
  const lowerBase = base.toLowerCase();

  if (SPECIAL_BASENAME_DISPLAY[lowerBase]) {
    return SPECIAL_BASENAME_DISPLAY[lowerBase];
  }
  if (lowerBase.startsWith('.env.')) {
    return 'Env';
  }

  const dotIdx = lowerBase.lastIndexOf('.');
  const ext = dotIdx > 0 && dotIdx < lowerBase.length - 1 ? lowerBase.slice(dotIdx + 1) : '';
  if (ext === 'txt' || ext === 'text' || ext === 'log') {
    return plainLabel;
  }
  if (ext && SPECIAL_DISPLAY_NAMES[ext]) {
    return SPECIAL_DISPLAY_NAMES[ext];
  }

  const desc = LanguageDescription.matchFilename(languages, base);
  if (desc?.name) {
    return desc.name;
  }

  return plainLabel;
}
