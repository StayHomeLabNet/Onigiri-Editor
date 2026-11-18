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

const MARKDOWN_EXT_RE = /\.(md|markdown|mdown|mdx)$/i;
const PLAINTEXT_EXT_RE = /\.(txt|text|log)$/i;
const UNTITLED_NAME_RE = /^(?:無題のドキュメント|Untitled|新規作成|New with)\b/i;

const EXT_TO_LANGUAGE_ID: Record<string, string> = {
  md: 'markdown',
  markdown: 'markdown',
  mdown: 'markdown',
  mdx: 'markdown',
  txt: 'plaintext',
  text: 'plaintext',
  log: 'plaintext',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',
  py: 'python',
  pyw: 'python',
  php: 'php',
  phtml: 'php',
  rs: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  hh: 'cpp',
  c: 'c',
  h: 'c',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  psd1: 'powershell',
  vue: 'vue',
  svelte: 'svelte',
};

const LANG_ID_TO_HLJS: Record<string, string | null> = {
  markdown: 'markdown',
  plaintext: null,
  javascript: 'javascript',
  jsx: 'javascript',
  typescript: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  toml: 'ini',
  xml: 'xml',
  python: 'python',
  php: 'php',
  rust: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  swift: 'swift',
  kotlin: 'kotlin',
  ruby: 'ruby',
  sql: 'sql',
  shell: 'bash',
  powershell: 'powershell',
  dockerfile: 'dockerfile',
  vue: 'xml',
  svelte: 'xml',
};

const EXTRA_EXT_TO_HLJS: Record<string, string> = {
  less: 'less',
  ini: 'ini',
  conf: 'ini',
  env: 'ini',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  scala: 'scala',
  gradle: 'groovy',
  groovy: 'groovy',
  pl: 'perl',
  pm: 'perl',
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  makefile: 'makefile',
  mk: 'makefile',
  graphql: 'graphql',
  gql: 'graphql',
  diff: 'diff',
  patch: 'diff',
};

function extractNameInfo(fileName?: string): { base: string; lowerBase: string; ext: string } {
  const raw = (fileName || '').trim();
  const base = raw.split(/[/\\]/).pop() || raw;
  const lowerBase = base.toLowerCase();
  const dotIdx = lowerBase.lastIndexOf('.');
  const ext = dotIdx > 0 && dotIdx < lowerBase.length - 1 ? lowerBase.slice(dotIdx + 1) : '';
  return { base, lowerBase, ext };
}

function stripFencedCodeBlocks(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let inFence = false;
  let fenceChar = '';
  for (const line of lines) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      const ch = m[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
        continue;
      }
      if (ch === fenceChar) {
        inFence = false;
        fenceChar = '';
        continue;
      }
    }
    if (!inFence) {
      kept.push(line);
    }
  }
  return kept.join('\n');
}

interface MarkdownAnalysis {
  hasFrontmatter: boolean;
  headingCount: number;
  hasTaskList: boolean;
  hasGfmTable: boolean;
  hasCallout: boolean;
  hasLinkOrImage: boolean;
  hasBold: boolean;
  hasFencedBlock: boolean;
  hasBlockquote: boolean;
  hasList: boolean;
  strongSignals: number;
  unmistakable: boolean;
}

function analyzeMarkdownContent(sample: string): MarkdownAnalysis {
  const fmMatch = sample.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const hasFrontmatter = Boolean(
    fmMatch && /^[a-zA-Z_][\w-]*:\s*\S/m.test(fmMatch[1])
  );
  const withoutFm = fmMatch ? sample.slice(fmMatch[0].length) : sample;
  const hasFencedBlock = /^\s*(?:`{3,}|~{3,})[a-zA-Z0-9_-]*\s*$/m.test(withoutFm);
  const prose = stripFencedCodeBlocks(withoutFm);

  const headingMatches = prose
    .split(/\r?\n/)
    .filter(
      (line) =>
        /^#{1,6}\s+\S/.test(line) &&
        !/^#(?:include|define|ifdef|ifndef|endif|pragma|region|endregion|if|elif|else|line|error|warning|nullable)\b/i.test(
          line
        )
    );
  const headingCount = headingMatches.length;
  const hasTaskList = /^\s*[-*+]\s+\[[ xX]\]\s+\S/m.test(prose);
  const hasGfmTable = /^\|.+\|\s*\r?\n\|[\s:|-]+\|/m.test(prose);
  const hasCallout = /^>\s+\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im.test(prose);
  const hasLinkOrImage = /!?\[[^\]\n]+\]\((?:https?:\/\/|\.?\/|#)[^)\s]+\)/.test(prose);
  const hasBold = /\*\*[^*\n]{2,}\*\*/.test(prose);
  const hasBlockquote = /^>\s+\S/m.test(prose);
  const hasList = /^\s*(?:[-*]|\d+\.)\s+\S/m.test(prose);

  let strongSignals = 0;
  if (hasFrontmatter) strongSignals += 2;
  if (headingCount > 0) strongSignals += 1;
  if (headingCount >= 2) strongSignals += 1;
  if (hasTaskList) strongSignals += 2;
  if (hasGfmTable) strongSignals += 2;
  if (hasCallout) strongSignals += 2;
  if (hasLinkOrImage) strongSignals += 1;
  if (hasBold) strongSignals += 1;
  if (hasFencedBlock && (headingCount > 0 || hasBold || hasLinkOrImage || hasList)) {
    strongSignals += 1;
  }
  if (hasBlockquote && (headingCount > 0 || hasBold || hasList)) {
    strongSignals += 1;
  }

  const unmistakable =
    (hasFrontmatter && (headingCount > 0 || hasBold || hasTaskList || hasLinkOrImage)) ||
    hasCallout ||
    hasGfmTable ||
    hasTaskList ||
    strongSignals >= 3;

  return {
    hasFrontmatter,
    headingCount,
    hasTaskList,
    hasGfmTable,
    hasCallout,
    hasLinkOrImage,
    hasBold,
    hasFencedBlock,
    hasBlockquote,
    hasList,
    strongSignals,
    unmistakable,
  };
}

function hasStrongCodeSyntax(text: string): boolean {
  const outsideFences = stripFencedCodeBlocks(text);
  const strongPatterns = [
    /^\s*<\?php\b/im,
    /^\s*<!DOCTYPE\s+html\b/im,
    /<html[\s>]/i,
    /^\s*using\s+[A-Z][\w.]*;\s*$/m,
    /^\s*namespace\s+[A-Z][\w.]*\s*[{;]/m,
    /^\s*package\s+[a-z_][\w.]*;?\s*$/m,
    /^\s*#include\s*[<"][^>"]+[>"]/m,
    /^\s*(?:public|private|protected|internal)\s+(?:static\s+|async\s+|sealed\s+|abstract\s+|partial\s+|override\s+|virtual\s+)*(?:class|interface|struct|record|enum|void)\s+[A-Za-z_]/m,
    /^\s*(?:from\s+[a-zA-Z_][\w.]*\s+import\s+|def\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:)/m,
    /^\s*(?:pub\s+)?fn\s+[a-z_]\w*\s*\([^)]*\)\s*(?:->|\{)/m,
    /^\s*func\s+(?:\([^)]+\)\s*)?[A-Za-z_]\w*\s*\(/m,
    /^\s*(?:export\s+)?(?:interface|type)\s+[A-Z]\w*(?:<[^>]+>)?\s*(?:=|\{)/m,
    /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+[a-zA-Z_$][\w$]*\s*\(/m,
    /^\s*(?:const|let|var)\s+[a-zA-Z_$][\w$]*\s*(?::\s*[\w<>[\]|&\s]+)?=\s*/m,
    /^\s*import\s+(?:\{[^}]+\}|[a-zA-Z_$][\w$]*)\s+from\s+['"][^'"]+['"]\s*;?\s*$/m,
    /^\s*(?:SELECT\b[\s\S]{1,120}\bFROM\b|CREATE\s+(?:TABLE|INDEX|VIEW)\b|INSERT\s+INTO\b)/im,
    /^\s*FROM\s+[a-zA-Z0-9._/-]+(?::\S+)?(?:\s+AS\s+\S+)?\s*$/im,
  ];
  return strongPatterns.some((re) => re.test(outsideFences));
}

function addScore(scores: Record<string, number>, lang: string, pts: number) {
  scores[lang] = (scores[lang] || 0) + pts;
}

export function detectLanguageFromContent(content?: string): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const sample = content.length > 8192 ? content.slice(0, 8192) : content;
  const md = analyzeMarkdownContent(sample);
  const codeSample = stripFencedCodeBlocks(sample);
  const trimmedCode = codeSample.trim();

  if (md.hasFencedBlock && !trimmedCode) {
    return 'markdown';
  }

  // 1. High-confidence leading signatures (outside Markdown fenced blocks)
  if (/<\?php\b/i.test(codeSample) || /<\?=\s*/.test(codeSample)) {
    return 'php';
  }
  if (
    /<template[\s>][\s\S]*<\/template>/i.test(codeSample) &&
    (/<script[\s>]/i.test(codeSample) || /<style[\s>]/i.test(codeSample))
  ) {
    return 'vue';
  }
  if (
    /^\s*<!DOCTYPE\s+html\b/i.test(trimmedCode) ||
    (/<html[\s>]/i.test(codeSample) && /<\/html>/i.test(codeSample)) ||
    (/<head[\s>]/i.test(codeSample) && /<body[\s>]/i.test(codeSample))
  ) {
    return 'html';
  }
  if (
    /^\s*<\?xml\b/i.test(trimmedCode) ||
    (/^\s*<svg[\s>]/i.test(trimmedCode) && /<\/svg>\s*$/i.test(trimmed))
  ) {
    return 'xml';
  }

  // Valid JSON object or array
  if (
    ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) &&
    trimmed.length <= 100_000
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === 'object') {
        return 'json';
      }
    } catch {
      // not valid JSON
    }
  }

  // Shebang detection
  const firstLine = codeSample.split(/\r?\n/, 1)[0] || '';
  if (firstLine.startsWith('#!')) {
    if (/python/i.test(firstLine)) return 'python';
    if (/(?:ba|z|fi)?sh\b/i.test(firstLine)) return 'shell';
    if (/\bnode\b/i.test(firstLine)) return 'javascript';
    if (/\bruby\b/i.test(firstLine)) return 'ruby';
    if (/\bphp\b/i.test(firstLine)) return 'php';
    if (/\bpwsh\b|powershell/i.test(firstLine)) return 'powershell';
  }

  // Dockerfile
  if (
    /^\s*FROM\s+[a-zA-Z0-9._/-]+(?::[^\s]+)?(?:\s+AS\s+\S+)?\s*$/im.test(codeSample) &&
    /^\s*(?:RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|ENV|EXPOSE|ARG|LABEL)\s+/m.test(codeSample)
  ) {
    return 'dockerfile';
  }

  // 2. Score code languages (outside fenced blocks)
  const scores: Record<string, number> = {};

  // C#
  if (/^\s*using\s+[A-Z][\w.]*;\s*$/m.test(codeSample)) addScore(scores, 'csharp', 3);
  if (/^\s*namespace\s+[A-Z][\w.]*\s*[{;]/m.test(codeSample)) addScore(scores, 'csharp', 3);
  if (
    /\b(?:public|private|protected|internal)\s+(?:static\s+|async\s+|sealed\s+|abstract\s+|partial\s+|override\s+|virtual\s+)*(?:class|interface|struct|record|enum|void|Task|string|int|bool)\b/.test(
      codeSample
    )
  ) {
    addScore(scores, 'csharp', 2);
  }
  if (/\bConsole\.Write(?:Line)?\(|string\.IsNullOr|\basync\s+Task(?:<|\b)/.test(codeSample)) {
    addScore(scores, 'csharp', 2);
  }
  if (/^\s*\[(?:ApiController|HttpGet|HttpPost|Serializable|Fact|Theory|DllImport)\b/m.test(codeSample)) {
    addScore(scores, 'csharp', 2);
  }

  // Java
  if (/^\s*package\s+[a-z][\w.]*;\s*$/m.test(codeSample)) addScore(scores, 'java', 3);
  if (/^\s*import\s+(?:static\s+)?[a-z][\w.*]+;\s*$/m.test(codeSample)) addScore(scores, 'java', 3);
  if (/\bpublic\s+static\s+void\s+main\s*\(/.test(codeSample)) addScore(scores, 'java', 4);
  if (/\bSystem\.out\.print(?:ln)?\(/.test(codeSample)) addScore(scores, 'java', 3);
  if (/@(?:Override|SpringBootApplication|RestController|Autowired)\b/.test(codeSample)) {
    addScore(scores, 'java', 2);
  }

  // Rust
  if (/\bfn\s+[a-z_]\w*\s*\([^)]*\)\s*(?:->\s*[^{\n]+)?\s*\{/.test(codeSample)) addScore(scores, 'rust', 3);
  if (/\b(?:let\s+mut\s+|impl\s+[A-Z]\w*|pub\s+(?:fn|struct|enum|mod|trait|use)\s+|use\s+[a-z_]\w*::)/.test(codeSample)) {
    addScore(scores, 'rust', 3);
  }
  if (/\b(?:println!|eprintln!|vec!|format!|matches!)\(|#\[derive\(/.test(codeSample)) {
    addScore(scores, 'rust', 3);
  }

  // Go
  if (/^\s*package\s+[a-z_]\w*\s*$/m.test(codeSample)) addScore(scores, 'go', 3);
  if (/\bfunc\s+(?:\([^)]+\)\s*)?[A-Za-z_]\w*\s*\(/.test(codeSample)) addScore(scores, 'go', 3);
  if (/\bfmt\.(?:Print|Printf|Println|Sprintf|Errorf)\(/.test(codeSample)) addScore(scores, 'go', 3);
  if (/:=/.test(codeSample) && /\b(?:go\s+func|chan\s+|defer\s+|select\s*\{)/.test(codeSample)) {
    addScore(scores, 'go', 2);
  }

  // Python
  if (/^\s*(?:async\s+)?def\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/m.test(codeSample)) {
    addScore(scores, 'python', 3);
  }
  if (/^\s*from\s+[a-zA-Z_][\w.]*\s+import\s+/m.test(codeSample)) addScore(scores, 'python', 3);
  if (/^\s*import\s+[a-zA-Z_][\w.]*(?:\s+as\s+\w+)?\s*$/m.test(codeSample)) addScore(scores, 'python', 2);
  if (/if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(codeSample)) addScore(scores, 'python', 4);
  if (/^\s*class\s+[A-Z]\w*(?:\([^)]*\))?\s*:/m.test(codeSample)) addScore(scores, 'python', 2);
  if (/\bself\.[a-zA-Z_]\w*/.test(codeSample) && /^\s*elif\s+|^\s*def\s+/m.test(codeSample)) {
    addScore(scores, 'python', 2);
  }

  // TypeScript / JavaScript / JSX / TSX
  const hasJsxSyntax =
    /<[A-Z][A-Za-z0-9]*(?:\s+[^>\n]*)?\/?>/.test(codeSample) ||
    (/\bclassName=/.test(codeSample) && /<\/[a-zA-Z][\w.-]*>/.test(codeSample));
  const hasTsTypes =
    /^\s*(?:export\s+)?(?:interface|type)\s+[A-Z]\w*(?:<[^>]+>)?\s*(?:=|\{)/m.test(codeSample) ||
    /:\s*(?:string|number|boolean|unknown|never|any|void|React\.\w+|Record<)\b/.test(codeSample);
  const tsLang = hasJsxSyntax ? 'tsx' : 'typescript';
  const jsLang = hasJsxSyntax ? 'jsx' : 'javascript';

  if (/^\s*(?:export\s+)?(?:interface|type)\s+[A-Z]\w*(?:<[^>]+>)?\s*(?:=|\{)/m.test(codeSample)) {
    addScore(scores, tsLang, 3);
  }
  if (/:\s*(?:string|number|boolean|unknown|never|any|void|React\.\w+|Record<)\b/.test(codeSample)) {
    addScore(scores, tsLang, 2);
  }
  if (/^\s*import\s+(?:type\s+)?(?:\{[^}]+\}|[a-zA-Z_$][\w$]*)\s+from\s+['"][^'"]+['"]/m.test(codeSample)) {
    addScore(scores, hasTsTypes ? tsLang : jsLang, 3);
  }
  if (/^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+[a-zA-Z_$][\w$]*\s*\(/m.test(codeSample)) {
    addScore(scores, hasTsTypes ? tsLang : jsLang, 2);
  }
  if (/^\s*(?:const|let|var)\s+[a-zA-Z_$][\w$]*\s*=\s*/m.test(codeSample)) {
    addScore(scores, hasTsTypes ? tsLang : jsLang, 2);
  }
  if (/\bconsole\.(?:log|warn|error)\(|\bdocument\.(?:querySelector|getElementById)\b|=>\s*\{/.test(codeSample)) {
    addScore(scores, hasTsTypes ? tsLang : jsLang, 2);
  }

  // C / C++
  if (/#include\s*<(?:iostream|vector|string|memory|algorithm|map|unordered_map|cstdio)>/.test(codeSample)) {
    addScore(scores, 'cpp', 4);
  }
  if (/\bstd::\w+|\btemplate\s*<|\bcout\s*<</.test(codeSample)) {
    addScore(scores, 'cpp', 3);
  }
  if (/#include\s*<(?:stdio\.h|stdlib\.h|string\.h|stdint\.h)>|\bprintf\s*\(|\bmalloc\s*\(/.test(codeSample)) {
    addScore(scores, 'c', 3);
  }
  if (/^\s*#include\s*["<][^">]+[">]/m.test(codeSample)) {
    if (/\b(?:class|namespace|template|std::)\b/.test(codeSample)) {
      addScore(scores, 'cpp', 2);
    } else {
      addScore(scores, 'c', 2);
    }
  }

  // Swift
  if (/^\s*import\s+(?:Foundation|SwiftUI|UIKit|AppKit|Combine)\b/m.test(codeSample)) {
    addScore(scores, 'swift', 4);
  }
  if (/\bguard\s+let\b|\bif\s+let\b/.test(codeSample) && /\bfunc\s+\w+\s*\(/.test(codeSample)) {
    addScore(scores, 'swift', 3);
  }

  // Kotlin
  if (/^\s*fun\s+[a-zA-Z_]\w*\s*\(/m.test(codeSample)) {
    addScore(scores, 'kotlin', 3);
  }
  if (/\b(?:val|var)\s+\w+(?:\s*:\s*[A-Z]\w*)?\s*=/.test(codeSample) && /\b(?:data\s+class|println\(|object\s+\w+)/.test(codeSample)) {
    addScore(scores, 'kotlin', 3);
  }

  // Ruby
  if (/^\s*(?:require|require_relative)\s+['"]/m.test(codeSample)) addScore(scores, 'ruby', 3);
  if (/^\s*def\s+[a-z_]\w*[!?]?/m.test(codeSample) && /^\s*end\s*$/m.test(codeSample)) {
    addScore(scores, 'ruby', 3);
  }

  // SQL
  if (/\bSELECT\b[\s\S]{1,120}\bFROM\b/i.test(codeSample)) addScore(scores, 'sql', 3);
  if (/\b(?:CREATE\s+(?:TABLE|INDEX|VIEW)|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(codeSample)) {
    addScore(scores, 'sql', 3);
  }

  // PowerShell
  if (/\$\w+\s*=/.test(codeSample) && /\b(?:Write-Host|Write-Output|Get-ChildItem|Get-Content|Set-Location|Invoke-WebRequest|param\s*\(|\[CmdletBinding\()/i.test(codeSample)) {
    addScore(scores, 'powershell', 4);
  }

  // Shell
  if (
    /^\s*(?:export\s+[A-Z_]\w*=|set\s+-[euo]+|echo\s+["'$]|chmod\s+\+?[0-7x]+|mkdir\s+-p)\b/m.test(codeSample) ||
    (/^\s*if\s+\[\s+/m.test(codeSample) && /^\s*fi\s*$/m.test(codeSample))
  ) {
    addScore(scores, 'shell', 3);
  }

  // CSS / SCSS
  const hasCssRuleBlock = /(?:^|\n)\s*(?:[.#@a-zA-Z][^\n{};]*\{[^}]*:\s*[^;{}]+;)/.test(codeSample);
  if (hasCssRuleBlock && !/\b(?:function|const|let|var|class|namespace|using|import|def|fn)\b/.test(codeSample)) {
    if (/^\s*\$[a-zA-Z_-]+\s*:/m.test(codeSample) || /@(?:mixin|include|extend)\b/.test(codeSample)) {
      addScore(scores, 'scss', 3);
    } else {
      addScore(scores, 'css', 3);
    }
  }

  // TOML
  const tomlSectionCount = (codeSample.match(/^\s*\[[a-zA-Z0-9_.-]+\]\s*$/gm) || []).length;
  const tomlAssignCount = (codeSample.match(/^\s*[a-zA-Z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|\d+|true|false|\[)/gm) || []).length;
  if (tomlSectionCount >= 1 && tomlAssignCount >= 2) {
    addScore(scores, 'toml', 3);
  }

  // 3. Check Markdown structure vs code scores
  let bestCodeLang: string | null = null;
  let bestCodeScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestCodeScore) {
      bestCodeScore = score;
      bestCodeLang = lang;
    }
  }

  if (md.unmistakable && bestCodeScore < 4 && !hasStrongCodeSyntax(sample)) {
    return 'markdown';
  }
  if (bestCodeLang && bestCodeScore >= 3) {
    return bestCodeLang;
  }

  // YAML (check after stronger code/markdown signals)
  const yamlLineCount = (codeSample.match(/^\s*[a-zA-Z_][\w.-]*:\s*(?:\S.*)?$/gm) || []).length;
  if (
    yamlLineCount >= 3 &&
    !hasStrongCodeSyntax(sample) &&
    !md.unmistakable &&
    md.headingCount === 0 &&
    !md.hasBold &&
    !md.hasLinkOrImage
  ) {
    return 'yaml';
  }

  // Generic XML
  if (
    /^<[a-zA-Z_][\w:-]*(?:\s+[^>]*)?>[\s\S]*<\/[a-zA-Z_][\w:-]*>$/.test(trimmedCode) &&
    !md.unmistakable &&
    bestCodeScore === 0
  ) {
    return 'xml';
  }

  // Lighter Markdown fallback (e.g. a note with a heading or bullet list + link)
  if (md.strongSignals >= 1 || md.hasList || md.hasBlockquote || md.hasFencedBlock) {
    return 'markdown';
  }

  return null;
}

export function resolveAutoLanguageId(params: {
  fileName?: string;
  filePath?: string;
  content?: string;
}): string | null {
  const target = (params.filePath || params.fileName || '').trim();
  const content = params.content ?? '';
  const { lowerBase, ext } = extractNameInfo(target);
  const hasSavedPath = Boolean(params.filePath && params.filePath.trim());

  // Explicit Dockerfile / Makefile basenames
  if (lowerBase === 'dockerfile' || lowerBase.startsWith('dockerfile.')) {
    return 'dockerfile';
  }
  if (lowerBase === 'makefile' || lowerBase === 'gnumakefile') {
    return 'shell';
  }

  // Saved Markdown files (.md / .markdown / .mdown / .mdx) always stay Markdown
  if (hasSavedPath && MARKDOWN_EXT_RE.test(lowerBase)) {
    return 'markdown';
  }

  // Plain text files (.txt / .text / .log) or extensionless files inspect content first
  if (!ext || PLAINTEXT_EXT_RE.test(lowerBase)) {
    const detected = detectLanguageFromContent(content);
    if (detected) return detected;
    return PLAINTEXT_EXT_RE.test(lowerBase) ? 'plaintext' : 'markdown';
  }

  // Unsaved untitled tab (e.g., default "無題のドキュメント.md" / "Untitled.md" with no filePath):
  // detect code if pasted, otherwise remain Markdown
  if (!hasSavedPath && (MARKDOWN_EXT_RE.test(lowerBase) || UNTITLED_NAME_RE.test(lowerBase))) {
    const detected = detectLanguageFromContent(content);
    return detected ?? 'markdown';
  }

  // Concrete non-Markdown extension (e.g. .cs, .py, .ts):
  // if the buffer actually contains unmistakable pure Markdown document with zero code syntax,
  // auto-detect Markdown instead of forcing the mismatched code extension
  if (content.trim()) {
    const md = analyzeMarkdownContent(content.length > 8192 ? content.slice(0, 8192) : content);
    if (md.unmistakable && !hasStrongCodeSyntax(content.length > 8192 ? content.slice(0, 8192) : content)) {
      return 'markdown';
    }
  }

  return EXT_TO_LANGUAGE_ID[ext] ?? null;
}

export function resolveEffectiveLanguageId(params: {
  fileName?: string;
  filePath?: string;
  content?: string;
  languageOverride?: string | null;
}): string | null {
  if (params.languageOverride) {
    return params.languageOverride;
  }
  return resolveAutoLanguageId({
    fileName: params.fileName,
    filePath: params.filePath,
    content: params.content,
  });
}

export function resolveHljsLanguage(
  langId?: string | null,
  fileName?: string
): string | null {
  if (langId) {
    if (langId in LANG_ID_TO_HLJS) {
      return LANG_ID_TO_HLJS[langId];
    }
    return langId.toLowerCase();
  }
  const { lowerBase, ext } = extractNameInfo(fileName);
  if (lowerBase === 'dockerfile' || lowerBase.startsWith('dockerfile.')) {
    return 'dockerfile';
  }
  if (lowerBase === 'makefile' || lowerBase === 'gnumakefile') {
    return 'makefile';
  }
  if (ext && EXT_TO_LANGUAGE_ID[ext]) {
    const mapped = LANG_ID_TO_HLJS[EXT_TO_LANGUAGE_ID[ext]];
    if (mapped !== undefined) return mapped;
  }
  if (ext && EXTRA_EXT_TO_HLJS[ext]) {
    return EXTRA_EXT_TO_HLJS[ext];
  }
  return ext || null;
}

export function isMarkdownFilename(name?: string, overrideId?: string | null): boolean {
  if (overrideId) {
    return overrideId === 'markdown';
  }
  if (!name) return true;
  return MARKDOWN_EXT_RE.test(name.trim());
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
  overrideId?: string | null,
  detectedLanguageId?: string | null
): LanguageDescription | null {
  const activeId = overrideId ?? detectedLanguageId ?? null;
  if (activeId) {
    if (activeId === 'markdown' || activeId === 'plaintext') return null;
    const opt = LANGUAGE_OPTIONS.find((o) => o.id === activeId);
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
  overrideId?: string | null,
  detectedLanguageId?: string | null
): string {
  const plainLabel = locale === 'ja' ? 'テキスト' : 'Plain Text';
  const activeId = overrideId ?? detectedLanguageId ?? null;
  if (activeId) {
    const opt = LANGUAGE_OPTIONS.find((o) => o.id === activeId);
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
