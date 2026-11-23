<div align="center">
  <img src="../public/icon.png" alt="Onigiri Editor" width="84" height="84" />
  <h1>Onigiri Editor User Manual 🍙</h1>
  <p><strong>AI-era cross-platform Markdown, code &amp; dev-preview desktop editor (v1.4.1)</strong></p>
  <p>
    <strong>English</strong> | <a href="README.ja.md">日本語</a> ・
    <a href="../README.md">Repository Home (README)</a>
  </p>
</div>

---

## Table of Contents

1. [Getting Started & Language Settings](#1-getting-started--language-settings)
2. [Three UI Modes, Dual Editor & Layout Controls](#2-three-ui-modes-dual-editor--layout-controls)
3. [Markdown, Slash Commands, Citations, WikiLinks & Slide Mode](#3-markdown-slash-commands-citations-wikilinks--slide-mode)
4. [Advanced Editing, Quick Open, Bookmarks & Context Menu](#4-advanced-editing-quick-open-bookmarks--context-menu)
5. [Character Encodings & Line Endings (EOL)](#5-character-encodings--line-endings-eol)
6. [Multi-Language Syntax Highlighting, Data & SVG/HTML Previews](#6-multi-language-syntax-highlighting-data--svghtml-previews)
7. [Workspace, Knowledge Graph, Git Panel, Grep Replace & Project Config](#7-workspace-knowledge-graph-git-panel-grep-replace--project-config)
8. [Dev Server Integration & Dual Browser Preview](#8-dev-server-integration--dual-browser-preview)
9. [AI Chat, Inline Edit, Document Review & Formatting Tools](#9-ai-chat-inline-edit-document-review--formatting-tools)
10. [Export (`.docx` / HTML / PDF), Themes, Keybindings & Backup Settings](#10-export-docx--html--pdf-themes-keybindings--backup-settings)
11. [Keyboard Shortcuts & Menu Bar Reference](#11-keyboard-shortcuts--menu-bar-reference)

---

## 1. Getting Started & Language Settings

**Onigiri Editor** is a lightweight, high-speed desktop editor built for **macOS (Apple Silicon & Intel)**, **Windows (x64)**, and **Linux (x64)**.

### First-Launch Language Detection

- On first launch, Onigiri Editor detects your OS language automatically: Japanese OS environments start with the **Japanese UI and native menu bar**, while all other OS languages start in **English**.
- You can switch languages anytime from the top-right **Language button** (`EN` / `日本語`), **Settings (`⌘,` / `Ctrl+,`) → General & View**, or the **Command Palette (`⌘K` / `Ctrl+K`)**.
- Selecting **Help → Online Manual** (or **Online Manual** in the Command Palette) opens the online manual (`https://stayhomelab.net/help/onigiri-editor/`) in your external browser.

---

## 2. Three UI Modes, Dual Editor & Layout Controls

Switch anytime via the top header bar, **View** menu, **`⌘\` / `Ctrl+\`** (cycle), or direct shortcuts (**`⌘⌥1`** Simple / **`⌘⌥2`** Basic / **`⌘⌥3`** Advanced — `Ctrl+Alt+1/2/3` on Windows/Linux):

| Mode | Best For | Layout & Capabilities |
| :--- | :--- | :--- |
| **Simple** | Quick notes & fast code edits | Ultra-minimal single-pane editor with tabs and sidebar hidden |
| **Basic** | Daily writing, visual editing & AI | Editor + bidirectional live preview + format toolbar + AI Chat |
| **Advanced** | Dev workflows & multi-file projects | Multi-tab bar (pinned/draggable), left sidebar (Files / Outline / Knowledge / Snippets), dual editor / diff compare, dev server launcher, snapshots, writing goal & token counter |

### Layout, Dual Editor & Focus Mode

- **View Layout**: Switch between **Editor**, **Split**, and **Preview** in the top header bar.
- **Side-by-Side Dual Editor & Tab Diff Compare**: Right-click any tab (or sidebar file) → **Open to the Side** / **Compare Diff with Active Tab**. You can edit two files simultaneously side-by-side (active pane focus automatically routes `⌘S`, toolbar actions, snippets, bookmarks, and AI inserts) or inspect diffs with left/right swap.
- **Top / Bottom Same-File Split**: Split the main editor horizontally (`Toggle Editor Split`) to edit two sections of the same document at once.
- **Focus Mode**: Dim inactive paragraphs/lines outside the active block to keep attention on what you are writing (toggle via TopBar, Settings, or Command Palette).
- **Zen Mode**: Press `⌘⇧F` / `Ctrl+Shift+F` to hide surrounding chrome for distraction-free writing (`Esc` to exit).
- **Header Bar, Format Toolbar & Status Bar Toggles**:
  - Toggle **View → Show Header Bar**, **View → Show Format Toolbar**, and **Status Bar** from the menu bar, Settings, or Command Palette.
  - **Settings → General & View** also provides **Hide top header bar in Simple mode** and **Show format toolbar in Simple mode**.
  - **Status Bar One-Step Mode Switcher**: Whenever the top header bar is hidden, the right side of the Status Bar displays a compact one-click mode switcher (`Simple → Basic`, `Basic → Advanced`, or `Advanced → Basic`) alongside a quick Settings button.

---

## 3. Markdown, Slash Commands, Citations, WikiLinks & Slide Mode

### Bidirectional Sync (CodeMirror 6 ↔ TipTap)

- In **Split** or **Preview** layout, edits in the left Markdown source editor (CodeMirror 6) and the right rich visual editor (TipTap) stay synchronized in real time.
- **Active Line / Block Sync Highlight**: When enabled in Settings, editing in one pane highlights the corresponding block or line in the opposite pane.
- **Sync Scroll & Typewriter Scroll**: Toggle synchronized scrolling between editor and preview, or keep the active line centered vertically in **Typewriter Scroll** mode.

### Slash Commands (`/`), Auto TOC & Tables

- **Slash Commands**: Type `/` at the beginning of a line (or after whitespace) to pick headings, lists, task lists, GFM tables, Mermaid diagrams, KaTeX math blocks, or GitHub callouts (`> [!NOTE]`, `> [!TIP]`, etc.) directly from the autocomplete menu.
- **Auto Table of Contents (TOC)**: Run **Insert / Update Table of Contents (TOC)** from the Command Palette to insert or refresh a `<!-- toc -->` block from document headings.
- **TSV Smart Table Paste & Formatter**: Pasting tab-separated spreadsheet cells automatically converts them into a formatted GFM table; run **Format Markdown Tables** from the Command Palette or Inspector anytime.

### `[[WikiLinks]]`, Citations, Footnotes, Daily Notes & Web Clipper

- **`[[WikiLinks]]`**: Type `[[` in a workspace to autocomplete note names. Ctrl/Cmd-click (or follow the link in preview) to jump to or create the linked note.
- **Citations, Link Cards, BibTeX / DOI Lookup & Footnotes**: Open **Insert Citation / Link Card / Footnote** from the Format Toolbar, Command Palette, or a custom shortcut to insert inline links, formatted link cards, auto-numbered footnotes (`[^N]`), parsed BibTeX entries (APA or Markdown styles), or Crossref DOI lookups.
- **Smart URL Paste & Auto-Title**: Pasting a URL over selected text automatically wraps it as `[selection](url)`. When pasting a bare URL with no selection and **Auto-fetch webpage title** (`autoTitleOnUrlPaste`) is enabled, Onigiri Editor asynchronously fetches the webpage `<title>` and replaces the URL with `[Title](url)`.
- **Daily Notes**: Click the **Daily Note** button in the TopBar/Sidebar (or run **Open / Create Today's Daily Note** in the Command Palette) to open or create `YYYY-MM-DD.md` inside your configured **Daily Notes Folder**.
- **Document Templates**: Open **Templates & Daily Notes** from the TopBar (`+` / Template menu), Sidebar, or Command Palette. Supports built-in templates (**Meeting Notes**, **Technical Design Doc**, **ADR**, **Weekly/Daily Report**) and **Custom Templates** with `{{date}}`, `{{time}}`, and `{{title}}` variables.
- **Web Clipper (URL → Markdown)**: Open **Clip Web Page URL to Markdown...** from the TopBar, Template menu, or Command Palette to fetch a webpage, strip navigation noise, resolve relative links/images, optionally attach YAML frontmatter, and open as a clean Markdown tab.

### Format Toolbar, Clipboard Image Auto-Save & Extended Blocks

- **Edit, AI Custom Buttons, Display Zoom & Responsive Layout**: **Select All**, **Copy**, **Paste**, **Zoom Out**, and **Zoom In** buttons on the Format Toolbar, plus up to **5 customizable Toolbar AI Custom Buttons** (displayed to the right of the formatting group across all modes, preloaded with an **AI Translate** preset) and a clickable **`100%`** zoom readout in the Status Bar (`25%`–`400%` numeric input, `−`/`+` steppers, presets, or `⌘+` / `⌘-` / `⌘0`).
  - **Responsive Progressive Collapsing & App-Wide Instant Custom Tooltips**: Buttons strictly prevent text wrapping. Labels ("Copy Rich Text" and "AI Clean") progressively collapse into compact icon buttons based on real container metrics. Hovering anywhere across the app (Header, Toolbar, Sidebar, Tab Bar, Status Bar, Inspector, Modals) displays **instant theme-aware custom tooltips (0.15s)** with automatic `<kbd>` shortcut badges (toggleable in **Settings → General**). When space is constrained, edge gradient fade masks, scroll buttons, and mouse wheel horizontal scrolling become active, and redundant New / Open / Save file buttons are hidden when the top header bar is active.
- **Auto Snapshot Timeline, Markdown Compatibility Check, Image Optimization, AI Privacy Redaction & Feature Finder (`v1.4.1`)**:
  - **Auto Snapshot Timeline & Partial Chunk Restore**: Automatically records snapshots on save and at configurable intervals (**Settings → General**), allowing full or **chunk-by-chunk partial restore** in **Inspector → Snapshots**.
  - **Markdown Compatibility Check**: Inspect dialect differences for **GitHub / Zenn / Qiita / Notion / Obsidian** in **Inspector → Compat** and jump directly to flagged lines.
  - **Image Auto-Optimization & Size Inventory**: Automatically resize/compress pasted images (WebP on Windows; JPEG/PNG fallback on macOS/Linux), keep optional `originals/` backups, and inspect all workspace image sizes inside the Unused Images modal.
  - **AI Send Content Preview & Secret Redaction**: Preview outgoing AI requests and mask detected API keys, Bearer tokens, private keys, and secrets with 1 click (**Settings → AI**).
  - **Feature Finder Guide (`?`)**: Click `?` in the TopBar (or run **Feature Finder** from the Command Palette) to search and launch any feature in English or Japanese.
  - **Built-in Browser, Multi-Monitor & Security Hardening**: Custom viewport `px` width, 1-click **Clip Page to Markdown**, native-WebView-safe inline `⋮` action strip, **Resync Browser Bounds**, macOS child WebView Y-offset alignment & mixed-DPI multi-monitor startup scaling fixes, strict Mermaid SVG sanitization, updater path/redirect verification, SSRF & URL scheme protection, and tightened Tauri CSP.
- **Single Line Break Preview, Selection Bubble Menu, AI Ghost Text Autocomplete & Markdown Table GUI Toolbar (`v1.4.0`, toggleable in Settings → Editor)**:
  - **Single Line Break (`<br>`) Preview**: Renders single Enter line breaks directly as `<br>` in Live Preview, HTML Export, and External Live Preview while preserving code blocks (on by default; disable for strict CommonMark behavior).
  - **Selection Floating Bubble Menu**: Selecting text displays a floating mini bar right above the selection for Bold, Italic, Inline Code, Link, Inline AI Edit (`⌘⇧E`), and up to 3 quick AI Custom buttons.
  - **AI Ghost Text Autocomplete**: Pausing while typing displays a muted inline AI continuation suggestion (`Tab` to accept, `Esc` to dismiss; opt-in with configurable `400–2500ms` delay).
  - **Markdown Table GUI Toolbar**: Automatically appears when the cursor is inside a Markdown table for 1-click row/column insertion & deletion, alignment, numeric-aware ascending/descending sort, and column width formatting.
- **AI Prompt Variables, Export Page Setup, Quick Scratchpad & Global Hotkey, Integrated Terminal (`v1.4.0`)**:
  - **AI Custom Prompt Variables**: Use `{{selection}}`, `{{clipboard}}`, `{{fileName}}`, `{{filePath}}`, `{{language}}`, `{{date}}`, and `{{time}}` inside any AI Custom button or submenu prompt (1-click variable insertion chips in **Settings → AI Custom**).
  - **PDF / HTML Export Page Setup**: Open **Page Setup & Export (PDF / HTML)...** from the Export menu or Command Palette to pick Design Theme (Modern / Business / Academic), Paper Size (A4 / Letter / B5), Orientation, Margins, Page Numbers (`1 / N`), and Header / Footer (`{{title}}`).
  - **Quick Scratchpad & Global Summon Hotkey**: Auto-persisted save-free scratchpad (Copy, Clear, Open in Tab) accessible from the Status Bar, plus an optional global hotkey (`CommandOrControl+Shift+Space`) in **Settings → General** to summon Onigiri Editor from any app.
  - **Lightweight Integrated Terminal Drawer (Advanced Mode)**: Toggle from the Status Bar or Command Palette for streaming command execution, persistent `cd`, `↑`/`↓` history, Stop control, and 1-click **Ask AI** error diagnosis (toggleable in **Settings → General**).
- **Images & Clipboard Auto-Save**:
  - Paste screenshots (`⌘V` / `Ctrl+V`) or drag & drop image files directly onto the editor or visual preview to auto-save PNG/image assets to your configured **Image Asset Folder** (default `assets`, falls back to workspace root for unsaved tabs) and insert `![image](assets/...)`.
  - When pasting images into an unsaved tab without an open workspace folder, images are staged safely in a temporary cache (`onigiri-markdown-images`) and **automatically moved into `./assets/`** (with Markdown links rewritten) the first time you save or Save As the document.
  - When dropping images into an unsaved tab without an open workspace folder, Onigiri Editor automatically formats local/Windows paths with forward slashes and angle brackets (`<C:/.../my image.png>`) and resolves spaces, parentheses, Japanese/Unicode folders, and `file:///` URIs cleanly in Markdown Preview and Slide Mode.
  - Drag files or images from the left **Sidebar tree** into either the code editor or visual preview to automatically compute and insert a relative Markdown link or image tag.
- **Extended Blocks & SVG / PNG Export**:
  - **Math (KaTeX)**: Inline (`$ ... $`) and block (`$$ ... $$`) LaTeX math rendering with **Copy LaTeX**, **Save SVG**, and **Save PNG** actions.
  - **Mermaid Diagrams**: Live rendering for `` ```mermaid `` code blocks with **Copy SVG**, **Save SVG**, and **Save PNG** export (plus zoom modal export).
  - **GitHub Callouts**: Styled rendering for `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, and `> [!CAUTION]`.
  - **YAML Frontmatter (Metadata)**: Open the **Metadata** tab in the right Options drawer to add frontmatter, edit key/value pairs, or toggle the metadata card at the top of the preview.

### Markdown Slide Presentation Mode

- Click **Slides** in the TopBar (available for Markdown files) or run **Markdown Slide Presentation** from the Command Palette.
- Automatically splits your document at `---` horizontal rules (ignoring fences/frontmatter) and presents clean cards with Mermaid & KaTeX support, **Overview Grid (`G`)**, **Fullscreen (`F`)**, and keyboard navigation (`←` / `→` / `Space` / `Esc`).

---

## 4. Advanced Editing, Quick Open, Bookmarks & Context Menu

### Quick Open (`⌘P` / `Ctrl+P`) & Go to Line (`⌘L` / `Ctrl+L`)

- **Quick Open (`⌘P` / `Ctrl+P`)**: Fuzzy-search open tabs, workspace files, and recent files to jump immediately. Type **`@`** at the start to search and jump to headings in the active file.
- **Go to Line (`⌘L` / `Ctrl+L`)**: Enter `120` (line) or `120:15` (`line:col`) to jump directly; full-width digits/colons are supported.

### Persisted Line Bookmarks (`F2`)

- Press **`⌘F2` / `Ctrl+F2`** (or right-click → **Bookmarks → Toggle Bookmark**) to pin markers in the line-number gutter.
- Navigate with **`F2`** (Next Bookmark) and **`⇧F2`** (Previous Bookmark). Bookmarks persist per tab across restarts.

### Smart Line Copy, Macros & Multi-Occurrence (`⌘D`)

- **Smart Line Copy**: Press **`⌘C` / `Ctrl+C` with no text selected** to copy the entire current line (configurable trigger and trailing newline in Settings).
- **Select Next Occurrence (`⌘D` / `Ctrl+D`)**: Repeatedly add the next matching occurrence to multi-cursor selection.
- **Keyboard Macros (`⌘⇧M` / `F8`)**: Record typing, navigation, editing, toolbar, and context-menu operations (`⌘⇧M` to start/stop, `F8` to replay).

### Column Ruler, Wrap Modes, Code Folding & Bracket Matching

- **Column Ruler**, **Word Wrap Modes** (Window Edge / Fixed Column / No Wrap), **Visible Symbols** (`↓` EOL, whitespace/tab dots), **Code Folding** (**Fold All / Unfold All**), **Auto-Close Brackets**, and **Matching Bracket Highlighting** are all configurable in Settings and the Command Palette.

### Find & Replace (`⌘F` / `Ctrl+F`)

- On Windows/Linux, `Ctrl+H` jumps directly to Replace. Navigate matches with `F3` / `⌘G` and `Shift+F3` / `⌘⇧G`.
- Supports **Match Case**, **Distinguish Full/Half-Width**, **Whole Word**, **Regular Expression**, and **In Selection** scope.

### Editor Right-Click Context Menu

Right-click inside the editor to access:

- **Standard Actions**: Undo, Redo, Cut, Copy, Paste, Delete, Select All, **AI Edit Selection... (`⌘⇧E`)**
- **Rectangular Selection**: Toggle box-selection mode (drag to select rectangular columns, `Esc` to exit), or hold `Alt` (`Option` on macOS) while dragging anytime.
- **Advanced**:
  - **Indent / Unindent (Tab & Space)**, **Insert / Remove Comment**, **Spaces ↔ Tabs**, **Lowercase / Uppercase**
  - **Reverse Lines / Sort Lines (Ascending / Descending) / Remove Duplicate Lines / Remove Empty Lines**
  - **Trim Leading / Trailing Whitespace**, **Insert / Remove `>` Quote**, **Insert / Remove Line Breaks**
- **Half / Full-Width**: Convert full-width/half-width characters (All, Katakana, Alphanumeric)
- **Bookmarks**: Toggle Bookmark, Next/Previous Bookmark, Clear All Bookmarks

---

## 5. Character Encodings & Line Endings (EOL)

### Supported Formats

- **Encodings**: `UTF-8`, `UTF-8 (BOM)`, `Shift_JIS (CP932)`, `EUC-JP`, `ISO-2022-JP (JIS)`, `UTF-16 LE`, `UTF-16 BE`
- **Line Endings**: `LF (\n)`, `CRLF (\r\n)`

### How to Use

- Click the Status Bar **Encoding** or **`LF` / `CRLF`** pill (or use **File** menu / Command Palette) to create a new file with a specific encoding, reopen from disk with another encoding, or change the save encoding/EOL (with warnings if characters cannot be encoded in the target charset).

---

## 6. Multi-Language Syntax Highlighting, Data & SVG/HTML Previews

- **100+ Languages & Status Bar Override**: Automatic syntax highlighting by file extension and content, plus a **clickable Status Bar language pill** to override highlighting and preview mode per tab.
- **Presets & Per-Token Colors**: Choose from 7 syntax presets (`Auto`, `GitHub`, `One Dark`, `Dracula`, `Nord`, `Monokai`, `Solarized`) and customize 10 token categories.
- **Structured Data Tools (CSV / TSV / JSON / YAML / `.env`)**:
  - **CSV / TSV Preview**: Interactive filterable and column-sortable table view with click-to-jump line sync and one-click **Copy MD Table** / **Copy CSV**.
  - **JSON / YAML / `.env` Commands**: Run **Format JSON**, **Minify JSON**, **Sort JSON Keys**, **Convert JSON → YAML**, **Convert YAML → JSON**, and **Sort & Format `.env`** from the Command Palette.
- **Specialized Live Previews**:
  - **HTML (`.html` / `.htm`)**: **HTML Live Page Preview** with **Visual / Code toggle**, **Full Width / Mobile (390px)** viewport switcher, relative CSS/image resolution, and dev-server prompts when an app entry is detected.
  - **SVG (`.svg`)**: Real-time **SVG Live Preview** with zoom (`Fit`, `50%`, `100%`, `200%`), background toggles (**Checker**, **Light**, **Dark**), **Copy SVG**, and **Copy PNG** rasterization.
  - **Source Code**: Right-pane **Code Preview (Synced Line)** synchronized with the cursor line, plus clean **Print Source Code** / PDF export.

---

## 7. Workspace, Knowledge Graph, Git Panel, Grep Replace & Project Config

### Sidebar Tabs (Advanced Mode)

- **Files Tab**: Browse a collapsible hierarchical folder tree with **Git status badges** (`M`, `A`, `D`, `?`), **Quick Action bar** (Daily Note, Templates, Workspace Grep, **Unused Images**), right-click context menu (New File/Folder, Open to Side, Compare with Git HEAD, Rename, Duplicate, Delete, Copy Path, Reveal), **Workspace Image Gallery Modal**, **Unused Image (Orphan Asset) Detector & Cleaner** (scans unreferenced workspace images with thumbnails & batch deletion), **drag-and-drop onto editor** for relative links, **Close Workspace Folder** (with active dev-server guard), and inline search/replace.
- **Outline Tab**: Lists Markdown headings (`#` to `######`); click any heading to jump to it.
- **Knowledge Tab**: Displays **Backlinks** (other notes in the workspace referencing the active note via `[[WikiLinks]]` or Markdown links), a workspace-wide **`#Tag` Browser**, and a button to launch the **Interactive Knowledge Graph & Link Diagnostics Modal** (visualizes note connections with search/`#tag` filters, connected-only toggle, orphan stats, and clickable broken links that jump directly to the source line).
- **Git Tab**: Dedicated **Git Source Control** panel with change-count badge, current branch & ahead/behind counters, **Staged / Unstaged / Untracked** file lists, **Stage / Unstage / Discard**, inline unified **Git Diff** viewer, **Commit**, **AI Generate** commit message button, **Pull / Push**, and **Recent Commits** log.
- **Snippets Tab**: Manage **Custom Snippets** (add, edit, delete, persisted locally) alongside built-in Markdown/diagram snippets.

### Cross-Folder Regex Grep & Selective Replace (`⌘⇧G` / `Ctrl+Shift+G`)

- Open from the Sidebar Quick Bar, Command Palette, or `⌘⇧G` / `Ctrl+Shift+G`.
- Search across the workspace with **Match Case** and **Regex** (`$1` capture support), inspect file-grouped matches, click any match to open the file at that line, and check/uncheck individual files before applying batch replacement (open tabs sync automatically).

### Project Config (`.editorconfig` & `.onigiri.json`), Session Restore & File Watching

- **Project Config (`.editorconfig` & `.onigiri.json`)**: Automatically resolves hierarchical `.editorconfig` and `.onigiri.json` settings (`tabSize`, `indentWithTabs`, EOL, encoding, `trimTrailingWhitespace`, `insertFinalNewline`, `imageAssetFolder`, `dailyNotesFolder`, `wordGoal`). You can also create or open `.onigiri.json` directly from **Settings → Editor & Line Copy**.
- **Per-Project Session Restore**: Remembers open tabs, unsaved drafts, cursor & scroll positions, folded lines, bookmarks, language overrides, recent files/folders (synced to **File → Open Recent**), and window geometry per workspace folder.
- **Git HEAD Diff**: Right-click any tab or file in the Sidebar (or use the Command Palette) to **Compare Diff with Git HEAD**.
- **External File Change Detection**: Watches open files on disk—auto-reloading clean tabs or displaying a conflict banner (**Reload**, **Compare Diff**, **Keep Mine**, **Save Again**) when unsaved edits exist.
- **Snapshots & History Diff**: Save labeled checkpoints in the **History** Inspector tab and compare line-by-line diffs or restore earlier snapshots.

---

## 8. Dev Server Integration & Dual Browser Preview

When you open a project folder (`⌘⇧O` / `Ctrl+Shift+O`) or project file, Onigiri Editor automatically detects Vite, VitePress, SvelteKit, Astro, Nuxt (including serving built `dist/` folders), Docusaurus, Next.js, Laravel, WordPress, PHP, Django, FastAPI, Flask, Streamlit, MkDocs, Hugo, Docker Compose, monorepo subprojects, or static HTML projects, runs pre-flight environment diagnostics, and provides:

- **Monorepo Multi-Server, Sidebar Launcher, Status Bar Popover, Target / Script / Port & 1-Click Restart**:
  - Multi-project workspaces render a dedicated **Dev Servers Launcher List** in the Sidebar (one row per target with 1-click **Start**, **Open in Browser**, **Restart `↻`**, and **Stop**, plus **Start All / Stop All** batch actions and a collapsible **⚙ Settings** section for `Script` / `Port` / `LAN`).
  - Starting another target inside the same monorepo keeps existing sibling servers running in the background. In the Built-in Web Browser, active servers appear in a single-row compact tab bar (`● web :5173 [×]`, `● api :3000 ⚠2 [×]`) alongside **`+ Add`** (launch inactive targets) and **`⚙ Settings`** inline drawers, plus **1-Click Restart (`↻`)** and **Stop All**.
  - A persistent **Status Bar** server indicator stays visible even when the Sidebar and Built-in Browser are closed—click it to open a quick popover to jump to, restart, or stop individual/all running servers.
  - Enter a custom port (`1–65535`) in the **`Port`** input before starting (blank uses the auto-detected default). If a port conflict (`EADDRINUSE`) is detected, the log drawer offers a 1-click **Retry on Free Port** banner.
- **Per-Server Live Console Logs (`> Logs`) & 1-Click AI Diagnostics**: Click **`> Logs (N)`** in the Sidebar, Built-in Web Browser, Web Page Preview, or Code Preview bars to inspect live stdout/stderr output. When multiple servers are running, filter logs per server via **`[All / web / api]`** tabs (with error-count badges linked to each server pill) and **Copy**, **Clear** (per-server or all), or **Ask AI** to diagnose the selected server's logs directly in AI Chat.
- **Pattern 1 (Built-in Web Browser)**: Multi-WebView right-pane browser (`Settings → AI & Browser`) with Back/Forward/Reload/**Home** (configurable via **Built-in Browser Home URL**), URL bar with **★ Bookmark** toggle, **Bookmarks & Recent URLs** bar/drawer, **Responsive Viewport Switcher (`Full Width` / `Tablet 768px` / `Mobile 390px`) with Portrait / Landscape Rotation**, **Capture Screenshot to Markdown** camera button (saves PNG to `assets/` and inserts into the active document across macOS, Windows HiDPI, and Linux Wayland/X11), **DevTools (`F12`)**, **Browser Settings** shortcut, **Open in External Browser**, keyboard shortcuts (`⌘L`/`Ctrl+L` URL focus, `F5`/`⌘R`/`Ctrl+R` reload, `Alt+←`/`Alt+→` history, `F12` DevTools), and a **Server Stopped** recovery banner (one-click **Restart Server** or **Go Home**).
- **Pattern 2 (External Browser Live Preview + LAN)**: Local HTTP live-reload server (`127.0.0.1`, or `0.0.0.0` with **LAN sharing** to preview on phones/other PCs on the same Wi-Fi).
- **Project Dev Server LAN Access (`LAN: ON / OFF`), Virtual-NIC Filtering & QR Codes**: Toggle **`LAN: ON / OFF`** directly in the Sidebar project bar, Built-in Web Browser, Web Page Preview, Code Preview, or **Settings → AI & Browser → Allow LAN access to Project Dev Server**. When enabled, supported dev servers bind to `0.0.0.0` (`--host 0.0.0.0` / `-H 0.0.0.0` / `-S 0.0.0.0:8000`) and display a collapsed-by-default **`LAN URL (N)`** toggle that prioritizes physical Wi-Fi/Ethernet IPs (collapsing VirtualBox/WSL/Docker/Tailscale virtual IPs under **`+N virtual/other`**) with clickable **`LAN: <ip>:<port>/`** copy chips and an inline **QR code button** for instant smartphone/tablet camera scanning.

---

## 9. AI Chat, Inline Edit, Document Review & Formatting Tools

Click the top-right **Options / AI Chat** icon (robot icon) to open the right drawer.

### Supported AI Providers

| Category | Providers | Highlights |
| :--- | :--- | :--- |
| **Subscription CLIs** | **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI** (`agy`) | Local CLI execution, model selector, live streaming progress + Stop, plus **Setup / Sign in via Terminal** |
| **Cloud APIs** | **OpenAI API**, **Anthropic API**, **Gemini API** | Direct connection with your API key, model name, and custom Base URL |
| **Local AI** | **Apple Foundation Models (macOS 26+ only)**, **Ollama**, **LM Studio** | Offline private models: native Apple Intelligence on-device (Default & Content Transformations modes, zero setup on Apple Silicon Macs) plus Ollama launcher/model-pull helpers |
| **Custom CLI** | Any custom command | Integrate custom CLI tools via `{prompt}` placeholder or stdin |

### Per-Tab Chat Threads, Toolbar AI Custom Buttons & Submenus, Note Export & Inline Selection Edit (`⌘⇧E`)

- **Toolbar AI Custom Buttons & Submenus (Up to 5 Buttons × 10 Submenu Items)**: Configure up to **5 AI prompt buttons** in **Settings → AI Custom** (each with a **24-icon Lucide picker**, **hover tooltip name**, **custom AI prompt**, independent **Copy to clipboard** / **Replace document (or selection)** checkboxes, and optional **custom shortcut key**). Displayed to the right of the formatting buttons in all modes (ships with an **AI Translate** preset for automatic English ↔ Japanese translation).
  - **Long-Press / Right-Click Submenus**: Enable the **Enable submenu** checkbox on any button (off by default) to add up to **10 submenu items** with individual icons, labels, prompts, output options, and shortcuts. Normal click runs the parent button; **long-pressing (~0.4s) or right-clicking** slides open the submenu popover below the button (marked with a subtle corner triangle).
  - Sends the active selection when highlighted or the entire document otherwise, replaces immediately with single-step Undo (`⌘Z` / `Ctrl+Z`), and lets you click the spinner (or press its shortcut again) while running to cancel.
- **Per-Tab vs. Shared Threads**: Switch between keeping an isolated AI conversation per active tab or using a shared workspace thread.
- **Save Chat as `.md` Note**: Export the current AI conversation directly into a new Markdown tab for archiving or further editing.
- **Inline AI Edit on Selection (`⌘⇧E` / `Ctrl+Shift+E`)**: Select text or code and edit via AI presets (**Refactor**, **Add Comments**, **Fix Bugs / Typos**, **Make Concise**, **Polite Tone**, **Translate JA / EN**) or custom presets, with **Diff Preview** confirmation before applying.
- **AI Folder Access (Advanced Mode)**: Switch between **Disabled**, **Read-Only**, **Read + Write (Diff Preview approval)**, and **CLI Direct Workspace Write**.

### Proofread & Document Review, Formatter & Stats

- **Review Tab**: Run **Rule Checks** (broken local/anchor links, skipped heading levels, mixed writing style, repeated words, trailing spaces) or **Run AI Review**, click any finding to jump to its line, or click **Apply Fix**.
- **Formatter Tab**: **AI Output Cleanup & Formatter**, **Paste Clipboard HTML as Markdown**, **Copy as Rich Text** (inline-styled HTML + plain text for Notion / Google Docs / Slack / Word).
- **Stats Tab**: Characters, words, lines, paragraphs, reading time, **Estimated AI Tokens**, element counts, and writing goal progress.

---

## 10. Export (`.docx` / HTML / PDF), Themes, Keybindings & Backup Settings

- **Exports & Rich Copy**: **Export Word (`.docx`)** (embeds local & `data:` PNG/JPEG/GIF/BMP/SVG/WebP images cleanly inside `word/media/`), **Export HTML** (optionally inlines local images as Base64 data URIs for single-file portability via **Embed Local Images on HTML Export**), **Print / Export PDF** (Markdown preview or Source Code), **Export Plain Text**, **Mermaid & KaTeX SVG / PNG Export**, **Copy as Rich Text** (selection or full document via Inspector, right-click menu, Command Palette, or custom shortcut), and **Copy Markdown / HTML**.
- **Themes & Preview Styles**: `Light`, `Dark`, `Sepia`, `Midnight` + `Editorial`, `GitHub`, `Notion`, `Academic` + **Custom Preview CSS**.
- **Settings Tabs (`⌘,` / `Ctrl+,`)**:
  - **General & View**: Language, Theme, Preview Style, Font Size, Line Height, Preview Width, Editor Font, Bar visibility toggles, **Inspector Tab Style** (`Icons only`, `Active label`, or `Always show labels`), Focus Mode, Session Restore, Auto-Save, Writing Goal, **Daily Notes Folder**, **Image Asset Folder**, **Embed Local Images on HTML Export**, **App Updates & Auto-Update** (**Automatically check for updates** toggle, **Check Interval** `Startup Only` / `1h` / `6h` / `12h` / `24h`, **Enable Auto-Update** background download toggle, **Action When a New Update Is Available** `Banner & Badge` / `Open Update Dialog` / `Subtle Badge Only` / `Auto-Download & Notify`, plus **Auto-Update Now** with **SHA-256 verification**, **Cancel Download**, **Unsaved Changes Guard** before restart, **Apply on Next Quit**, rich Markdown release notes, **ETag** caching, **Save Installer**, **Open Release Notes in Editor Tab**, **Skip Version**, and manual **Check for Updates**), Custom CSS.
  - **Editor & Line Copy**: Line Numbers, Word Wrap & Column Width, Column Ruler, Visible Symbols, Matching Brackets, Auto-Close Brackets, Default Encoding/EOL, Active Sync Highlight, Sync Scroll, Typewriter Scroll, Smart HTML Paste, **Auto-fetch webpage title on URL paste (`autoTitleOnUrlPaste`)**, Smart Line Copy, and **Project Config (`.editorconfig` / `.onigiri.json`)** status & quick creation.
  - **Syntax Colors**: 7 presets + 10 per-token color pickers.
  - **Keybindings**: Interactive shortcut editor for **112 built-in commands + dynamic AI Custom buttons and enabled submenus** with search filter, **category filter chips**, conflict detection, clear, individual reset, and Reset All (dynamically reflected in toolbar tooltips, submenu badges, and Command Palette).
  - **AI Custom**: Register up to 5 AI buttons on the Format Toolbar (24-icon selector, hover name, custom AI prompt, independent **Copy to clipboard** and **Replace document/selection** checkboxes, inline **Shortcut Key** assignment, optional **Long-Press / Right-Click Submenus** with up to 10 items per button, reordering, deletion, and reset to default **AI Translate** preset).
  - **AI & Browser**: AI Folder Access, Built-in Browser toggle & **Home URL (Initial Page)**, External Live Preview toggle, port & LAN sharing (with QR code display), and **Allow LAN access to Project Dev Server** (`projectServerAllowLan`).
  - **Reset & Data**: **Export / Import JSON Backup** (selectively save/restore App & Editor settings, AI config & presets with optional API key exclusion, Custom Snippets, Templates, and Keybindings with merge/replace), **Reset Settings to Defaults**, and **Clear User Data & Caches** (also clears the LRU in-memory image cache).

---

## 11. Keyboard Shortcuts & Menu Bar Reference

### Key Shortcuts

> **112 built-in commands**—including direct mode switches, layout & panel toggles, Markdown formatting, data formatters, Git, exports, and **every registered AI Custom button and enabled submenu item**—can be freely customized or assigned in **Settings → Keybindings** (and AI Custom items can also be edited directly inside **Settings → AI Custom**).

| Action | macOS | Windows / Linux |
| :--- | :--- | :--- |
| New File | `⌘ + N` | `Ctrl + N` |
| Open File | `⌘ + O` | `Ctrl + O` |
| Quick Open (Files / `@Headings`) | `⌘ + P` | `Ctrl + P` |
| Open Folder | `⌘ + ⇧ + O` | `Ctrl + Shift + O` |
| Save / Save As | `⌘ + S` / `⌘ + ⇧ + S` | `Ctrl + S` / `Ctrl + Shift + S` |
| Close Tab | `⌘ + W` | `Ctrl + W` |
| Open Settings | `⌘ + ,` | `Ctrl + ,` |
| Command Palette | `⌘ + K` | `Ctrl + K` |
| Find & Replace (Active File) | `⌘ + F` | `Ctrl + F` (Replace focus: `Ctrl + H`) |
| Find Next / Previous | `⌘ + G` / `F3` | `Ctrl + G` / `F3` |
| Cross-Folder Regex Grep & Replace | `⌘ + ⇧ + G` | `Ctrl + Shift + G` |
| Inline AI Edit on Selection | `⌘ + ⇧ + E` | `Ctrl + Shift + E` |
| Select Next Occurrence | `⌘ + D` | `Ctrl + D` |
| Go to Line | `⌘ + L` | `Ctrl + L` |
| Toggle Line Bookmark | `⌘ + F2` | `Ctrl + F2` |
| Next / Previous Bookmark | `F2` / `⇧ + F2` | `F2` / `Shift + F2` |
| Record Macro / Play Macro | `⌘ + ⇧ + M` / `F8` | `Ctrl + Shift + M` / `F8` |
| Smart Line Copy (no selection) | `⌘ + C` | `Ctrl + C` |
| Rectangular Selection | `Option + Drag` | `Alt + Drag` |
| Bold / Italic | `⌘ + B` / `⌘ + I` | `Ctrl + B` / `Ctrl + I` |
| Zoom In / Zoom Out / Reset (`25%`–`400%`) | `⌘ + +` / `⌘ + -` / `⌘ + 0` | `Ctrl + +` / `Ctrl + -` / `Ctrl + 0` |
| Switch Mode (Cycle Simple/Basic/Advanced) | `⌘ + \` | `Ctrl + \` |
| Switch to Simple / Basic / Advanced Mode | `⌘ + ⌥ + 1` / `2` / `3` | `Ctrl + Alt + 1` / `2` / `3` |
| Toggle Zen Mode | `⌘ + ⇧ + F` | `Ctrl + Shift + F` |
| Send AI Chat Message | `⌘ + Enter` | `Ctrl + Enter` |
| Built-in Browser: URL Bar / Reload / Back & Forward / DevTools | `⌘ + L` / `F5`, `⌘ + R` / `Alt + ←`・`→` / `F12` | `Ctrl + L` / `F5`, `Ctrl + R` / `Alt + ←`・`→` / `F12` |
| Dismiss Modal / Find / Zen / Box Select | `Esc` | `Esc` |

### Native Menu Bar Structure

- **File**: New File, New File with Encoding..., Open File..., Quick Open..., Reopen with Encoding..., Open Folder..., Open Recent (Files & Folders), Save, Save As..., Export HTML..., Print / Export PDF..., Close Tab *(on Windows/Linux, Settings and Quit also appear in File)*
- **Edit**: Undo, Redo, Cut, Copy, Paste, Select All, Find & Replace, Go to Line..., Macro Record/Play
- **View**: Simple Mode, Basic Mode, Advanced Mode, Show Header Bar, Show Format Toolbar, Command Palette, Options / AI Chat, Live Preview in External Browser, Zen Mode
- **Window**: Minimize, Close Window
- **Help**: **Online Manual**, **Check for Updates...**, About Onigiri Editor *(on macOS, Settings is in the **Onigiri Editor** app menu)*
