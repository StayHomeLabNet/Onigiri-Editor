import type { Translations } from './types';

export const en: Translations = {
  appName: 'Onigiri-Markdown',
  versionLabel: 'v0.1.0',
  modes: {
    basic: 'Basic',
    advanced: 'Advanced',
    basicHint: 'Clean, distraction-free writing & live preview',
    advancedHint: 'Multi-tab workspace, outline, AI toolkit, diffs & customization',
  },
  layouts: {
    editor: 'Editor',
    split: 'Split',
    preview: 'Preview',
  },
  themes: {
    light: 'Light',
    dark: 'Dark',
    sepia: 'Sepia',
    midnight: 'Midnight',
  },
  previewThemes: {
    editorial: 'Editorial',
    github: 'GitHub',
    notion: 'Notion',
    academic: 'Academic',
  },
  actions: {
    newFile: 'New File',
    openFile: 'Open File',
    openFolder: 'Open Folder',
    save: 'Save',
    saveAs: 'Save As...',
    exportHtml: 'Export HTML',
    exportPdf: 'Print / Export PDF',
    exportText: 'Export Plain Text',
    copyMarkdown: 'Copy Markdown',
    copyRichText: 'Copy Rich Text',
    copyHtml: 'Copy HTML',
    pasteHtmlAsMd: 'Paste HTML as Markdown',
    commandPalette: 'Command Palette',
    findReplace: 'Find & Replace',
    zenMode: 'Zen Mode',
    exitZen: 'Exit Zen Mode',
    inspector: 'Inspector',
    sidebar: 'Sidebar',
    about: 'About Onigiri-Markdown',
    close: 'Close',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    undo: 'Undo',
    redo: 'Redo',
  },
  toolbar: {
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bold: 'Bold',
    italic: 'Italic',
    strikethrough: 'Strikethrough',
    inlineCode: 'Inline Code',
    codeBlock: 'Code Block',
    link: 'Link',
    bulletList: 'Bullet List',
    numberedList: 'Numbered List',
    taskList: 'Task List',
    quote: 'Blockquote',
    table: 'Table',
    hr: 'Divider',
    math: 'Math Block (KaTeX)',
    mermaid: 'Mermaid Diagram',
    callout: 'Callout',
    aiClean: 'AI Cleanup',
  },
  sidebar: {
    files: 'Files',
    outline: 'Outline',
    snippets: 'Snippets',
    noFolder: 'No folder opened',
    openFolderPrompt: 'Open a folder containing Markdown files to browse the file tree and search across notes.',
    chooseFolder: 'Choose Folder',
    filterFiles: 'Filter files...',
    searchContent: 'Full-Text Search',
    searchPlaceholder: 'Search text across folder...',
    noFilesFound: 'No matching files found',
    noHeadings: 'No headings (# to ######) found',
    newNoteInFolder: 'New Note in Folder',
    refreshFolder: 'Refresh',
    newFilePrompt: 'Enter new filename (e.g. notes.md)',
    insertSnippet: 'Click to insert at cursor',
  },
  inspector: {
    ai: 'AI Tools',
    stats: 'Stats',
    diff: 'History',
    frontmatter: 'Metadata',
    settings: 'Settings',
    aiCleanerTitle: 'AI Output Cleanup & Formatter',
    aiCleanerDesc: 'Fix broken tables, stray invisible characters, inconsistent bullets, and messy spacing from ChatGPT, Claude, or Gemini.',
    runAiClean: 'Clean & Format Document',
    pasteHtmlBtn: 'Paste Clipboard HTML as Markdown',
    copyRichTextBtn: 'Copy as Rich Text (Notion / Docs / Slack)',
    copyHtmlBtn: 'Copy Raw HTML',
    cleanOpts: {
      removeZeroWidth: 'Remove zero-width & invisible characters',
      trimTrailingSpaces: 'Trim trailing whitespace',
      collapseBlankLines: 'Collapse 3+ consecutive blank lines',
      formatTables: 'Auto-align GFM table columns',
      normalizeBullets: 'Normalize bullets (* / +) to "-"',
      fixHeadingSpacing: 'Ensure spacing around headings (#)',
      normalizeQuotes: 'Convert smart quotes (“ ”) to ASCII',
    },
    statsLabels: {
      chars: 'Characters (with spaces)',
      charsNoSpaces: 'Characters (no spaces)',
      words: 'Words',
      lines: 'Lines',
      paragraphs: 'Paragraphs',
      readingTime: 'Reading Time',
      estimatedTokens: 'Est. AI Tokens',
      headings: 'Headings',
      codeBlocks: 'Code Blocks',
      tables: 'Tables',
      links: 'Links',
      minuteUnit: 'min',
      tokenNote: '* Approximate LLM token estimate supporting mixed CJK & English text',
      wordGoal: 'Word / Char Target',
      goalProgress: 'Goal Progress',
    },
    diffLabels: {
      createSnapshot: 'Save Snapshot',
      snapshotLabelPlaceholder: 'Note (e.g. Draft v1)',
      compareTarget: 'Compare Against',
      savedVersion: 'Saved file on disk',
      noSnapshots: 'No snapshots yet. Save checkpoints while editing to compare diffs or restore earlier versions.',
      restore: 'Restore',
      delete: 'Delete',
      identical: 'No differences from comparison target.',
      additions: 'Additions',
      deletions: 'Deletions',
    },
    frontmatterLabels: {
      detected: 'YAML Frontmatter',
      none: 'No YAML frontmatter (---) detected.',
      addFrontmatter: 'Add Frontmatter',
      key: 'Key',
      value: 'Value',
      addField: 'Add Field',
      showCard: 'Show metadata card at top of preview',
      invalidYaml: 'Invalid YAML syntax',
    },
    settingsLabels: {
      fontSize: 'Editor Font Size',
      lineHeight: 'Line Height',
      previewWidth: 'Preview Max Width',
      editorFont: 'Editor Font',
      fontMono: 'Monospace',
      fontSans: 'Sans-serif',
      previewTheme: 'Preview Style',
      lineNumbers: 'Show Line Numbers',
      wordWrap: 'Word Wrap',
      syncScroll: 'Sync Scroll (Editor ↔ Preview)',
      typewriterMode: 'Typewriter Scroll (Keep active line centered)',
      smartPasteHtml: 'Auto-convert pasted HTML to Markdown',
      wordGoal: 'Writing Goal (words/chars, 0 = off)',
      customCss: 'Custom Preview CSS',
      customCssPlaceholder: '.markdown-body h1 { color: #6366f1; }',
    },
  },
  find: {
    findPlaceholder: 'Find...',
    replacePlaceholder: 'Replace with...',
    caseSensitive: 'Match Case',
    regex: 'Regex',
    wholeWord: 'Whole Word',
    previous: 'Previous',
    next: 'Next',
    replace: 'Replace',
    replaceAll: 'Replace All',
    matches: 'matches',
    noMatches: 'No matches',
  },
  status: {
    saved: 'Saved',
    unsaved: 'Unsaved',
    draft: 'Draft',
    chars: 'chars',
    words: 'words',
    tokens: 'tokens (est.)',
    line: 'Ln',
    col: 'Col',
    syncOn: 'Sync Scroll ON',
    syncOff: 'Sync Scroll OFF',
    dropHint: 'Drop Markdown file to open',
  },
  toasts: {
    savedSuccess: 'Saved successfully',
    copiedRichText: 'Copied as Rich Text',
    copiedHtml: 'Copied HTML to clipboard',
    copiedMarkdown: 'Copied Markdown to clipboard',
    copiedCode: 'Code copied',
    copiedSvg: 'SVG diagram copied',
    aiCleaned: 'Markdown cleaned & formatted',
    htmlPasted: 'Converted HTML clipboard to Markdown',
    noClipboardHtml: 'No HTML content found in clipboard',
    snapshotCreated: 'Snapshot saved',
    snapshotRestored: 'Snapshot restored',
    exportedSuccess: 'Export completed',
    errorPrefix: 'Error:',
  },
  dialogs: {
    unsavedCloseConfirm: 'You have unsaved changes. Close without saving?',
    untitledName: 'Untitled.md',
    commandPlaceholder: 'Search commands, open tabs, files, themes...',
    noCommands: 'No matching commands',
    aboutDesc: 'A cross-platform Markdown editor crafted for writing, reviewing, and refining AI-era documents.',
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcuts: [
      { keys: '⌘ + S', desc: 'Save file' },
      { keys: '⌘ + ⇧ + S', desc: 'Save As' },
      { keys: '⌘ + O', desc: 'Open file' },
      { keys: '⌘ + N', desc: 'New document' },
      { keys: '⌘ + K / ⌘ + P', desc: 'Command Palette' },
      { keys: '⌘ + F', desc: 'Find & Replace' },
      { keys: '⌘ + B / ⌘ + I', desc: 'Bold / Italic' },
      { keys: '⌘ + \\', desc: 'Toggle Basic / Advanced Mode' },
      { keys: '⌘ + ⇧ + F', desc: 'Toggle Zen Mode' },
    ],
  },
  sampleDocument: `---
title: Welcome to Onigiri-Markdown — AI-Era Markdown Editor
author: Onigiri-Markdown Team
tags: [AI, Markdown, Productivity]
---

# Welcome to Onigiri-Markdown ✨

**Onigiri-Markdown** is built for the AI era—where almost everything generated by AI arrives in Markdown. Preview, edit, clean, and export rich Markdown effortlessly.

> [!TIP]
> Use the **Basic / Advanced** toggle in the top bar anytime.
> Stay in **Basic Mode** for effortless daily writing, or switch to **Advanced Mode** for multi-tab workspaces, outline navigation, AI cleanup, diff snapshots, and custom styling.

## Highlights

- [x] **Real-time Preview with Sync Scroll** (click checkboxes directly in preview to toggle!)
- [x] **One-click AI Output Cleanup** (auto-aligns GFM tables, strips invisible chars, fixes spacing)
- [x] **Live Mermaid Diagrams & KaTeX Math**
- [x] **Copy as Rich Text** for seamless pasting into Notion, Google Docs, or Slack

### 1. AI Callouts & Tables

> [!NOTE]
> Supports GitHub-style \`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, and \`[!CAUTION]\` callouts out of the box.

| Mode | Best For | Key Capabilities |
| :--- | :--- | :--- |
| **Basic** | Quick notes & reading AI output | Clean toolbar, split/toggle preview, theme & language switch |
| **Advanced** | Deep writing, specs & prompt craft | Multi-tab, folder explorer, outline, diff snapshots, token counter |

### 2. Live Mermaid Flowchart

\`\`\`mermaid
flowchart LR
  AI["🤖 AI Markdown Output"] --> Paste["📋 Paste into Onigiri-Markdown"]
  Paste --> Clean["✨ 1-Click AI Cleanup"]
  Clean --> Preview["👁️ Live Preview"]
  Preview --> Share["🚀 Rich Copy / HTML / PDF"]
\`\`\`

### 3. LaTeX Math & Code Highlighting

Scaled Dot-Product Attention:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

\`\`\`typescript
export function estimateTokens(text: string): number {
  const cjk = (text.match(/[\\u3040-\\u30ff\\u4e00-\\u9faf]/g) || []).length;
  const other = text.length - cjk;
  return Math.ceil(cjk * 1.4 + other / 4);
}
\`\`\`
`,
};
