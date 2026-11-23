export type AppMode = 'simple' | 'basic' | 'advanced';
export type ViewLayout = 'split' | 'editor' | 'preview';
export type RightPaneMode = 'markdown' | 'browser';
export type ThemeId = 'light' | 'dark' | 'sepia' | 'midnight';
export type PreviewTheme = 'editorial' | 'github' | 'notion' | 'academic';
export type Locale = 'ja' | 'en';
export type SidebarTab = 'files' | 'outline' | 'snippets' | 'knowledge' | 'git';
export type InspectorTab = 'chat' | 'ai' | 'stats' | 'diff' | 'frontmatter' | 'review' | 'settings';
export type InspectorTabStyle = 'icons' | 'active-label' | 'labels';

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
  | 'apple-foundation-models'
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
  appleFoundationModelsSupported?: boolean;
  appleFoundationModelsAvailable?: boolean;
  appleFoundationModelsStatus?: string | null;
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
  languageOverride?: string | null;
  pinned?: boolean;
  dirty: boolean;
  cursorLine: number;
  cursorCol: number;
  scrollTop?: number;
  foldedLines?: number[];
  bookmarks?: number[];
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

export interface WorkspaceGrepLineMatch {
  line: number;
  col: number;
  matchText: string;
  snippet: string;
}

export interface WorkspaceGrepFile {
  path: string;
  relativePath: string;
  name: string;
  totalMatches: number;
  matches: WorkspaceGrepLineMatch[];
}

export interface WorkspaceGrepResult {
  files: WorkspaceGrepFile[];
  totalFiles: number;
  totalMatches: number;
  truncated: boolean;
}

export interface WorkspaceNoteLinkRef {
  target: string;
  kind: 'wiki' | 'md';
  line: number;
  snippet: string;
}

export interface WorkspaceNoteTagRef {
  tag: string;
  line: number;
}

export interface WorkspaceNoteIndexEntry {
  path: string;
  relativePath: string;
  name: string;
  title: string;
  tags: WorkspaceNoteTagRef[];
  outgoingLinks: WorkspaceNoteLinkRef[];
}

export interface BacklinkMatch {
  sourcePath: string;
  sourceRelativePath: string;
  sourceName: string;
  sourceTitle: string;
  line: number;
  snippet: string;
  kind: 'wiki' | 'md';
}

export interface FetchedUrlContent {
  finalUrl: string;
  status: number;
  contentType: string;
  html: string;
}

export interface DocumentTemplate {
  id: string;
  title: string;
  titleJa?: string;
  description: string;
  descriptionJa?: string;
  fileNamePattern: string;
  content: string;
  isBuiltin?: boolean;
}

export interface EditorSettings {
  fontSize: number;
  editorZoom: number;
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
  codeFoldingEnabled: boolean;
  highlightSelectionMatches: boolean;
  autoCloseBrackets: boolean;
  showStatusBar: boolean;
  defaultNewFileEncoding: TextEncodingId;
  defaultNewFileEol: '\n' | '\r\n';
  syncScroll: boolean;
  typewriterMode: boolean;
  focusMode: boolean;
  smartPasteHtml: boolean;
  imageAssetFolder: string;
  dailyNotesFolder: string;
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
  externalBrowserAllowLan: boolean;
  projectServerAllowLan: boolean;
  restoreSessionEnabled: boolean;
  autoSaveEnabled: boolean;
  showTopBar: boolean;
  hideTopBarInSimpleMode: boolean;
  showFormatToolbar: boolean;
  showFormatToolbarInSimpleMode: boolean;
  autoTitleOnUrlPaste?: boolean;
  embedImagesOnHtmlExport?: boolean;
  inspectorTabStyle?: InspectorTabStyle;
  checkUpdatesOnStartup?: boolean;
  updateCheckIntervalHours?: number;
  autoUpdateEnabled?: boolean;
  updateAvailableBehavior?: UpdateAvailableBehavior;
  skippedUpdateVersion?: string;
  aiCustomButtons?: AiCustomButton[];
  selectionBubbleMenuEnabled?: boolean;
  aiGhostTextEnabled?: boolean;
  aiGhostTextDelayMs?: number;
  markdownTableBarEnabled?: boolean;
  exportPageSettings?: ExportPageSettings;
  scratchpadEnabled?: boolean;
  globalHotkeyEnabled?: boolean;
  globalHotkeyShortcut?: string;
  integratedTerminalEnabled?: boolean;
  customTooltipsEnabled?: boolean;
}

export type ExportPaperSize = 'A4' | 'Letter' | 'B5';
export type ExportOrientation = 'portrait' | 'landscape';
export type ExportMarginPreset = 'narrow' | 'normal' | 'wide';
export type ExportDesignTheme = 'modern' | 'business' | 'academic';

export interface ExportPageSettings {
  paperSize: ExportPaperSize;
  orientation: ExportOrientation;
  margin: ExportMarginPreset;
  designTheme: ExportDesignTheme;
  showPageNumbers: boolean;
  headerText: string;
  footerText: string;
}

export type AiCustomButtonIconId =
  | 'languages'
  | 'sparkles'
  | 'wand'
  | 'spellcheck'
  | 'file-text'
  | 'align-left'
  | 'bot'
  | 'zap'
  | 'lightbulb'
  | 'pen-line'
  | 'check-check'
  | 'list-checks'
  | 'code'
  | 'message-square'
  | 'book-open'
  | 'refresh-cw'
  | 'scissors'
  | 'tags'
  | 'mail'
  | 'brain'
  | 'globe'
  | 'file-search'
  | 'smile'
  | 'terminal';

export interface AiCustomSubmenuItem {
  id: string;
  name: string;
  icon: AiCustomButtonIconId;
  prompt: string;
  copyToClipboard: boolean;
  replaceContent: boolean;
}

export interface AiCustomButton {
  id: string;
  name: string;
  icon: AiCustomButtonIconId;
  prompt: string;
  copyToClipboard: boolean;
  replaceContent: boolean;
  submenuEnabled?: boolean;
  submenuItems?: AiCustomSubmenuItem[];
}

export type UpdateAvailableBehavior = 'banner' | 'modal' | 'badge-only' | 'auto-install';

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
  | 'python'
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

export interface ProjectTarget {
  rootPath: string;
  label: string;
  relativePath: string;
  kind: ProjectKind;
  devScript: string | null;
  scripts: string[];
  defaultUrl: string | null;
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
  targets?: ProjectTarget[];
}

export interface RunningProjectTarget {
  rootPath: string;
  name: string;
  kind: string;
  url: string | null;
  commandLabel: string | null;
  starting: boolean;
  logs?: string[];
  errorCount?: number;
}

export interface ProjectServerStatus {
  running: boolean;
  starting: boolean;
  external?: boolean;
  allowLan?: boolean;
  lanUrls?: string[];
  rootPath: string | null;
  kind: string | null;
  url: string | null;
  commandLabel: string | null;
  requestedPort?: number | null;
  requestedScript?: string | null;
  logs: string[];
  error: string | null;
  runningTargets?: RunningProjectTarget[];
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string | null;
  entries: Record<string, string>;
}

export interface GitHeadFileResult {
  existsInHead: boolean;
  content: string;
  branch: string | null;
}

export interface InlineAiPresetItem {
  id: string;
  label: string;
  prompt: string;
  isBuiltin?: boolean;
}

export interface ReviewFinding {
  id: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  category: 'link' | 'consistency' | 'structure' | 'typo' | 'ai';
  title: string;
  detail: string;
  original?: string;
  replacement?: string;
}

export interface ClearAppCacheResult {
  removedFiles: number;
  removedBytes: number;
}

export interface SettingsResetSelection {
  editorSettings: boolean;
  appearanceAndMode: boolean;
  locale: boolean;
  aiConfigAndClean: boolean;
  inlineAiPresets: boolean;
  windowState: boolean;
}

export interface UserDataClearSelection {
  sessions: boolean;
  recentHistory: boolean;
  aiThreads: boolean;
  searchAndMacros: boolean;
  customSnippetsAndTemplates: boolean;
  appCaches: boolean;
}

export interface StoredDataSummary {
  workspaceSessionCount: number;
  recentFileCount: number;
  recentFolderCount: number;
  aiThreadCount: number;
  customSnippetCount: number;
  customTemplateCount: number;
  macroStepCount: number;
  dirtyTabCount: number;
}

export interface UnusedAssetEntry {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedMs: number;
}

export interface GitWorkingFile {
  path: string;
  relativePath: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitCommitSummary {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitPanelState {
  isRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  hasRemote: boolean;
  files: GitWorkingFile[];
  recentCommits: GitCommitSummary[];
}

export interface EditorConfigFileEntry {
  dir: string;
  content: string;
}

export interface ProjectConfigBundle {
  onigiriJson: string | null;
  onigiriJsonPath: string | null;
  editorconfigs: EditorConfigFileEntry[];
}

export interface ImageAssetPayload {
  unchanged: boolean;
  modifiedMs: number;
  dataUrl: string | null;
  byteLen: number;
}

export interface MigrateTempImagesResult {
  content: string;
  migratedCount: number;
  migratedFiles: string[];
}

export interface AppUpdateAsset {
  name: string;
  downloadUrl: string;
  size: number;
  platform: 'macos' | 'windows' | 'linux' | 'other' | string;
  kind: 'dmg' | 'app-archive' | 'exe' | 'msi' | 'appimage' | 'deb' | 'other' | string;
  digest?: string | null;
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string | null;
  notes: string;
  downloadUrl: string | null;
  autoUpdateUrl?: string | null;
  canInPlaceUpdate?: boolean;
  assets?: AppUpdateAsset[];
  checkedAtMs?: number;
  etag?: string | null;
  notModified?: boolean;
}

export interface AppUpdateProgressEvent {
  phase: 'downloading' | 'verifying' | 'extracting' | 'ready' | 'installing' | 'cancelled' | 'error' | string;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  filePath: string | null;
  message: string;
}

export interface AppUpdateDownloadResult {
  filePath: string;
  fileName: string;
  bytes: number;
  canAutoApply: boolean;
  sha256?: string;
  verified?: boolean;
}
