export type AppMode = 'simple' | 'basic' | 'advanced';
export type ViewLayout = 'split' | 'editor' | 'preview';
export type RightPaneMode = 'markdown' | 'browser';
export type ThemeId = 'light' | 'dark' | 'sepia' | 'midnight';
export type PreviewTheme = 'editorial' | 'github' | 'notion' | 'academic';
export type Locale = 'ja' | 'en';
export type SidebarTab = 'files' | 'outline' | 'snippets';
export type InspectorTab = 'chat' | 'ai' | 'stats' | 'diff' | 'frontmatter' | 'settings';

export type SyntaxPresetId =
  | 'auto'
  | 'github'
  | 'one-dark'
  | 'dracula'
  | 'nord'
  | 'monokai'
  | 'solarized'
  | 'custom';

export interface SyntaxColorMap {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  type: string;
  variable: string;
  operator: string;
  tag: string;
  property: string;
}

export type OeditLineCopyTrigger = 'eol-only' | 'any-empty-sel';
export type WrapMode = 'window' | 'column' | 'none';
export type TextEncodingId =
  | 'utf-8'
  | 'utf-8-bom'
  | 'shift_jis'
  | 'euc-jp'
  | 'iso-2022-jp'
  | 'utf-16le'
  | 'utf-16be';
export type AiFolderMode = 'disabled' | 'read-only' | 'read-write-approve' | 'cli-direct';

export type AiProviderId =
  | 'codex-cli'
  | 'claude-cli'
  | 'gemini-cli'
  | 'antigravity-cli'
  | 'custom-cli'
  | 'openai-api'
  | 'anthropic-api'
  | 'gemini-api'
  | 'ollama'
  | 'lmstudio'
  | 'openai-compat';

export interface AiCapabilities {
  codexCli: string | null;
  codexLoggedIn: boolean;
  codexModels: string[];
  codexDefaultModel: string | null;
  claudeCli: string | null;
  claudeLoggedIn: boolean;
  claudeModels: string[];
  geminiCli: string | null;
  geminiLoggedIn: boolean;
  geminiModels: string[];
  antigravityCli: string | null;
  antigravityLoggedIn: boolean;
  antigravityModels: string[];
  antigravityDefaultModel: string | null;
  antigravityApp: boolean;
  ollamaInstalled: boolean;
  ollamaRunning: boolean;
  ollamaModels: string[];
  lmstudioInstalled: boolean;
  lmstudioRunning: boolean;
  lmstudioModels: string[];
  nodeInstalled?: boolean;
  homebrewInstalled?: boolean;
}

export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  models?: Partial<Record<AiProviderId, string>>;
  apiKeys: Partial<Record<AiProviderId, string>>;
  baseUrls: Partial<Record<AiProviderId, string>>;
  customCliCmd: string;
  includeDocContext: boolean;
  includeFolderContext: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: number;
  error?: boolean;
}

export interface Snapshot {
  id: string;
  label: string;
  content: string;
  timestamp: number;
}

export interface DocumentTab {
  id: string;
  title: string;
  filePath?: string;
  content: string;
  savedContent: string;
  eol?: '\n' | '\r\n';
  savedEol?: '\n' | '\r\n';
  encoding?: TextEncodingId;
  savedEncoding?: TextEncodingId;
  dirty: boolean;
  cursorLine: number;
  cursorCol: number;
  snapshots: Snapshot[];
  updatedAt: number;
  diskModifiedMs?: number;
  externalStatus?: 'modified' | 'deleted' | null;
  externalContent?: string;
}

export interface FileSyncInfo {
  path: string;
  exists: boolean;
  modifiedMs: number;
  size: number;
}

export interface HeadingItem {
  level: number;
  text: string;
  line: number;
  id: string;
}

export interface WorkspaceEntry {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
}

export interface SearchMatch {
  path: string;
  relativePath: string;
  name: string;
  line: number;
  snippet: string;
}

export interface EditorSettings {
  fontSize: number;
  lineHeight: number;
  previewWidth: number;
  editorFont: 'mono' | 'sans';
  previewTheme: PreviewTheme;
  lineNumbers: boolean;
  wordWrap: boolean;
  wrapMode: WrapMode;
  wrapColumn: number;
  showRuler: boolean;
  showNewlineSymbols: boolean;
  showWhitespaceSymbols: boolean;
  bracketMatchingEnabled: boolean;
  showStatusBar: boolean;
  defaultNewFileEncoding: TextEncodingId;
  defaultNewFileEol: '\n' | '\r\n';
  syncScroll: boolean;
  typewriterMode: boolean;
  smartPasteHtml: boolean;
  showFrontmatterCard: boolean;
  wordGoal: number;
  customCss: string;
  activeLineSyncHighlight: boolean;
  oeditLineCopyEnabled: boolean;
  oeditLineCopyTrigger: OeditLineCopyTrigger;
  oeditLineCopyIncludeNewline: boolean;
  syntaxPreset: SyntaxPresetId;
  customSyntaxColors: SyntaxColorMap;
  aiFolderMode: AiFolderMode;
  builtinBrowserEnabled: boolean;
  builtinBrowserDefaultUrl: string;
  externalBrowserPreviewEnabled: boolean;
  externalBrowserPort: number;
  restoreSessionEnabled: boolean;
  autoSaveEnabled: boolean;
  hideTopBarInSimpleMode: boolean;
}

export interface DocumentStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
  readingMinutes: number;
  estimatedTokens: number;
  headings: number;
  codeBlocks: number;
  tables: number;
  links: number;
}

export interface AiCleanOptions {
  removeZeroWidth: boolean;
  trimTrailingSpaces: boolean;
  collapseBlankLines: boolean;
  formatTables: boolean;
  normalizeBullets: boolean;
  fixHeadingSpacing: boolean;
  normalizeQuotes: boolean;
}

export type ProjectKind =
  | 'laravel'
  | 'wordpress'
  | 'docker'
  | 'vitepress'
  | 'docusaurus'
  | 'mkdocs'
  | 'hugo'
  | 'jekyll'
  | 'django'
  | 'fastapi'
  | 'flask'
  | 'streamlit'
  | 'vite'
  | 'next'
  | 'astro'
  | 'nuxt'
  | 'sveltekit'
  | 'cra'
  | 'node'
  | 'php'
  | 'static'
  | 'none';

export interface ProjectDiagnostic {
  id: string;
  severity: 'error' | 'warning' | 'info';
  titleJa: string;
  titleEn: string;
  descriptionJa: string;
  descriptionEn: string;
  commandPreview: string | null;
  inAppAction: string | null;
  actionTarget: string | null;
  inAppLabelJa: string | null;
  inAppLabelEn: string | null;
  terminalCommand: string | null;
  docsUrl: string | null;
}

export interface ProjectSetupProgress {
  rootPath: string;
  action: string;
  running: boolean;
  line: string | null;
  done: boolean;
  ok: boolean | null;
  message: string | null;
}

export interface ProjectSetupResult {
  ok: boolean;
  message: string;
  output: string[];
}

export interface ProjectInfo {
  rootPath: string;
  name: string;
  kind: ProjectKind;
  packageManager: string | null;
  devScript: string | null;
  scripts: string[];
  defaultUrl: string | null;
  devCommandLabel: string | null;
  hasDist: boolean;
  distIndexPath: string | null;
  entryHtmlPath: string | null;
  alreadyRunning?: boolean;
  diagnostics?: ProjectDiagnostic[];
}

export interface ProjectServerStatus {
  running: boolean;
  starting: boolean;
  external?: boolean;
  rootPath: string | null;
  kind: string | null;
  url: string | null;
  commandLabel: string | null;
  logs: string[];
  error: string | null;
}

