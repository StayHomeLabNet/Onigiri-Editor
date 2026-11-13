export type AppMode = 'basic' | 'advanced';
export type ViewLayout = 'split' | 'editor' | 'preview';
export type ThemeId = 'light' | 'dark' | 'sepia' | 'midnight';
export type PreviewTheme = 'editorial' | 'github' | 'notion' | 'academic';
export type Locale = 'ja' | 'en';
export type SidebarTab = 'files' | 'outline' | 'snippets';
export type InspectorTab = 'ai' | 'stats' | 'diff' | 'frontmatter' | 'settings';

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
  dirty: boolean;
  cursorLine: number;
  cursorCol: number;
  snapshots: Snapshot[];
  updatedAt: number;
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
  syncScroll: boolean;
  typewriterMode: boolean;
  smartPasteHtml: boolean;
  showFrontmatterCard: boolean;
  wordGoal: number;
  customCss: string;
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
