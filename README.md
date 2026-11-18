<div align="center">
  <img src="public/icon.png" alt="Onigiri Editor" width="96" height="96" />
  <h1>Onigiri Editor 🍙</h1>
  <p><strong>AI-era cross-platform Markdown, code &amp; dev-preview desktop editor for macOS, Windows, and Linux</strong></p>
  <p>
    <strong>English</strong> | <a href="README.ja.md">日本語</a>
  </p>
  <p>
    <a href="#overview">Overview</a> ・
    <a href="doc/README.md">User Manual</a> ・
    <a href="#key-features">Key Features</a> ・
    <a href="#requirements">Requirements</a> ・
    <a href="#build">Build</a> ・
    <a href="#whats-new-in-v110">What's New in v1.1.0</a> ・
    <a href="#quick-start">Quick Start</a> ・
    <a href="#downloads">Downloads</a> ・
    <a href="#license">License</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-1.1.0-blue" alt="version" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-orange" alt="platform" />
    <img src="https://img.shields.io/badge/framework-Tauri%20v2-purple" alt="framework" />
    <img src="https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-blueviolet" alt="frontend" />
    <img src="https://img.shields.io/badge/backend-Rust-lightgrey" alt="backend" />
  </p>
  <p>
    <a href="https://ko-fi.com/stayhomelabnet"><img src="https://img.shields.io/badge/Ko--fi-Support%20StayHomeLabNet-ff5e5b?style=for-the-badge&logo=kofi&logoColor=white" alt="Ko-fi" /></a>
    <a href="https://buymeacoffee.com/stayhomelabnet"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20StayHomeLabNet-ffdd00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee" /></a>
  </p>
  <p><strong>If Onigiri Editor is useful to you, please consider supporting the project.</strong></p>
</div>

---

## Overview

**Onigiri Editor** is a lightweight, high-speed desktop editor built with **Tauri v2, React 19, TypeScript, and Rust** for writing Markdown, editing source code, previewing web projects, and collaborating with AI tools on **macOS, Windows, and Linux**.

On first launch, it automatically detects the OS language (Japanese when the OS is set to Japanese; English for all other OS languages) and switches both the UI and the native application menu bar accordingly.

Current version: `v1.1.0`

## Key Features

- **Three UI Modes (`⌘\` / `Ctrl+\`)**:
  - **Simple Mode**: Ultra-minimal single-pane editor with distraction-free focus and automatic file-extension syntax highlighting.
  - **Basic Mode**: Clean editor + bidirectional live preview with synchronized scrolling and essential formatting controls.
  - **Advanced Mode**: Multi-tab editing (with pinning, drag-reordering, side-by-side dual editor & 2-tab diff compare), collapsible workspace folder explorer (Git status badges, tree D&D relative links, context menu & image gallery), **Knowledge tab** (`[[WikiLinks]]`, Backlinks & `#tag` browser), cross-folder Regex Grep & Replace (`⌘⇧G`), dev-server integration, snapshots, and AI workspace tools.
- **Bidirectional Visual Editing, Slide Mode & Writing Workflow**: Edit Markdown in CodeMirror 6 (left) or TipTap visual WYSIWYG (right) with real-time line/block highlights, **Slash Commands (`/`)**, **Custom Snippets**, **Auto TOC**, **Clipboard Image Paste Auto-Save**, **Daily Notes & Templates**, **URL Web Clipper**, and **Markdown Slide Presentation Mode**.
- **100+ Language Syntax Highlighting, Structured Data & Visual Previews**: Built-in support for Markdown, PHP, TypeScript/JavaScript, Python, Rust, SQL, HTML, CSS, YAML, JSON, CSV/TSV, SVG, and more—clickable Status Bar language override, **CSV/TSV interactive table preview**, **JSON/YAML/ENV formatting & conversion**, enhanced **SVG (zoom/background/PNG copy)** & **HTML Visual/Source preview**, code folding, persisted **Line Bookmarks (`F2`)**, **Focus Mode**, `⌘D` multi-occurrence selection, 7 syntax presets, and 10 per-token color pickers.
- **Built-in AI Chat (Per-Tab Threads), Document Review & Diff Preview**:
  - Supports **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **OpenAI / Anthropic / Gemini APIs**, **Ollama**, and **LM Studio** with model selection, **per-tab or shared chat threads**, **Export Chat as `.md` Note**, live streaming progress & Stop/Cancel, folder permission pill, **Inline AI Selection Edit (`⌘⇧E`)**, and **Proofread & Document Review**.
  - Shows a **line-by-line Diff Preview Modal** before applying AI document/selection replacements (with optional pre-apply snapshot) or workspace file writes.
- **Project-Scoped Session Restore, Git HEAD Diff & Auto-Save**: Saves and restores open tabs, unsaved drafts, cursor & scroll positions, folding state, bookmarks, language overrides, recent history, and window geometry per workspace folder across restarts, plus optional 1.5s auto-save and `Git HEAD` diff compare.
- **External File Change Detection & Conflict Banner**: Watches open files on disk (including changes from external editors or AI CLIs)—auto-reloading clean tabs or displaying a conflict banner with **Reload**, **Compare Diff**, and **Keep Mine** actions when unsaved edits exist.
- **Web Dev & Dual Browser Preview**:
  - Auto-detects Vite, Next.js, Laravel, WordPress, Docker Compose, Python, Hugo, and static projects, runs pre-flight environment diagnostics, and offers guided setup.
  - **Pattern 1**: Native multi-WebView **Embedded Web Browser** in the right pane (`Settings` toggleable).
  - **Pattern 2**: **External Live Browser Preview** over local HTTP (`127.0.0.1` or LAN `0.0.0.0`) with real-time auto-reload.
- **Productivity Extras**: **Quick Open (`⌘P` / `@headings`)**, Keyboard macro recording & playback (`⌘⇧M` / `F8`), Format Toolbar edit/zoom controls & Status Bar zoom popover (`25%`–`400%`), Smart Line Copy (`⌘C` / `Ctrl+C`), Mermaid diagrams, KaTeX math, GitHub callouts, YAML Frontmatter editor, AI output cleanup & table formatter, estimated LLM token counter, Rich Text copy & HTML/TSV smart paste, Find & Replace, Command Palette (`⌘K` / `Ctrl+K`), Zen Mode (`⌘⇧F` / `Ctrl+Shift+F`), and HTML / Markdown / Source Code PDF export.
- **OS-Aware First-Launch Language**: Automatically launches in Japanese when the OS language is Japanese, and English for all other languages (manual switch available anytime in Settings or TopBar).

## Requirements

- **Supported OS**: macOS (Apple Silicon & Intel), Windows (x64), Linux (x64)
- **For Development**:
  - Node.js 20+ (22 recommended)
  - Rust toolchain (`rustup` stable)
  - Tauri v2 OS prerequisites (Xcode Command Line Tools on macOS; WebView2 + Visual Studio C++ Build Tools on Windows; `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, etc. on Linux)
- **Optional AI / Project Tools**: Node.js, Codex / Claude Code / Gemini / Antigravity CLI, or Ollama / LM Studio

## Build

```bash
# Install npm dependencies
npm install

# Run web UI preview
npm run dev

# Run desktop app in development mode
npx tauri dev

# Build release installer / app bundle for your OS
npx tauri build
```

Run tests and type-checks:

```bash
# TypeScript check + production bundle
npx tsc --noEmit && npm run build

# Rust backend unit tests
cargo test --manifest-path "src-tauri/Cargo.toml"
```

## What's New in v1.1.0

- **Quick Open (`⌘P` / `@headings`), Persisted Bookmarks (`F2`), Focus Mode & Per-Project Sessions**: Jump to open/workspace/recent files or `@headings` instantly, toggle line bookmarks across sessions, dim inactive paragraphs in Focus Mode, and preserve tabs, scroll positions, folds, and language overrides per workspace folder (with improved language auto-detection).
- **Knowledge Management & Markdown Authoring**: Added **Slash Commands (`/`)**, **Custom Snippets UI**, **Auto TOC (`<!-- toc -->`)**, **`[[WikiLinks]]`**, Sidebar **Knowledge** tab (**Backlinks & `#tag` Browser**), **Daily Notes & Templates (`{{date}}`/`{{time}}`/`{{title}}`)**, **URL → Markdown Web Clipper**, **Clipboard Image Auto-Save** (configurable `assets` folder with workspace fallback), and **Sidebar Tree Drag & Drop** for relative Markdown links.
- **Cross-Folder Regex Grep Replace (`⌘⇧G`), Slide Presentation Mode & Enhanced Previews**: Search & selectively replace across folders, present Markdown docs as slides (`---`), inspect **CSV/TSV Interactive Tables**, format/convert **JSON / YAML / `.env`**, and use **SVG Zoom / Background / PNG Copy** & **HTML Visual/Source Toggle** in standalone webpage previews.
- **Dual Editor, Document Review, Per-Tab AI Threads & Git Integration**: Full focus routing for simultaneous Side-by-Side editing, **Proofread & Document Review** tab, **per-tab AI chat threads + `.md` note export**, and **Git status badges + `Git HEAD` diff compare**.

<details>
<summary>Previous release: v1.0.6</summary>

- **Side-by-Side Tab Split & 2-Tab Diff Compare**: Open a second tab in the right pane to edit side-by-side or inspect line-by-line diffs with left/right swap.
- **Keyboard Macro Recording & Playback (`⌘⇧M` / `⌘⇧P`)**: Record and replay typing, navigation, editing, toolbar, and context-menu actions across sessions.
- **Inline AI Selection Edit (`⌘⇧E` / `Ctrl+Shift+E`)**: Edit selected text or code with AI presets (Refactor, Comments, Fix Typos, Concise, Polite, Translate JA/EN) and Diff Preview confirmation.
- **Status Bar Language Selector, Code Folding & `⌘D` Selection**: Override syntax highlighting per tab from the Status Bar, fold code blocks, highlight matching selections (`⌘D` next occurrence), and configure auto-close brackets.
- **Pinned/Draggable Tabs, Tree Context Menu, Close Folder & Folder Replace**: Pin/reorder/middle-click tabs, create/rename/duplicate/delete files & folders in the sidebar, close the active workspace folder cleanly, run folder-wide Search & Replace, sync Recent Files/Folders to the native menu, and print/export source code to PDF.

</details>

<details>
<summary>Previous release: v1.0.5</summary>

- **Format Toolbar Edit & Zoom Controls + Status Bar Zoom Popover (`25%`–`400%`)**: Added **Select All**, **Copy**, **Paste**, **Zoom Out**, and **Zoom In** buttons to the Format Toolbar across all UI modes and both CodeMirror & TipTap panes, plus a clickable `100%` Status Bar zoom readout with numeric input (`25%`–`400%`), steppers, presets, and `⌘+` / `⌘-` / `⌘0` shortcuts.
- **Collapsible Workspace Folder Tree & Image Gallery Modal**: Replaced the flat sidebar list with a collapsible hierarchical folder tree (with **Collapse All**, file/folder icons, and auto-refresh) and added an in-app **Workspace Image Gallery** modal with Prev/Next navigation and Markdown insertion.
- **AI CLI Streaming Progress, Stop Button & Folder Permission Pill**: Added live streaming updates for AI CLIs (including Codex JSONL events), a **Stop** cancellation button, extended long-task timeouts, and an interactive folder-access pill in the AI Chat panel.
- **Folder Switch Guard, Dialog Z-Order & Window State Persistence**: Prompts with a **Stop & Switch / Disconnect & Switch** modal when switching folders during an active dev server, hides embedded child WebViews behind OS file dialogs, runs workspace scans asynchronously via `spawn_blocking`, remembers window geometry, and removes the duplicate `Settings…` entry from the macOS `Help` menu.

</details>

<details>
<summary>Previous release: v1.0.4</summary>

- **Live Windows Registry `PATH` Lookup**: Reads `HKCU\Environment` and `HKLM\...\Environment` `Path` dynamically (with `%VAR%` expansion) so newly installed PHP, Composer, Node, or AI CLIs are picked up on **Re-check Environment** without restarting the app.
- **Expanded Windows PHP Path Discovery**: Scans WinGet Links & Packages (`WinGet\Links`, `WinGet\Packages\PHP.PHP*`), Chocolatey, Laravel Herd / `php.new`, Scoop, XAMPP, Laragon, WampServer / MAMP, versioned `Program Files\PHP\*`, `C:\php*`, and `C:\tools\php*`, and uses valid WinGet ID `PHP.PHP.8.4`.
- **Consistent Setup Card & Probe Timeout**: Hides redundant setup error cards across the left sidebar and preview panes while the project's dev server is cleanly running, and raises local server probe timeout to `750ms`.

</details>

<details>
<summary>Previous release: v1.0.3</summary>

- **Windows Embedded Browser Deadlock Fix**: Converted native WebView2 child-webview operations (`add_child`, navigation, bounds, close, and `url()` queries) to async / `spawn_blocking` and removed blocking `webview.url()` calls inside `.on_page_load`, preventing Windows UI hangs when switching to the Built-in Browser tab or clicking **Show in Built-in Browser**. Also hides the redundant setup card when an existing dev server is already connected cleanly.
- **LAN External Browser Live Preview**: Added a Settings toggle to bind the live preview server to `0.0.0.0` so smartphones or other PCs on the same Wi-Fi/LAN can open the live preview, complete with LAN IPv4 detection, quick-copy pill, and path traversal hardening.
- **Top Header Bar & Format Toolbar Visibility Toggles**: Added checkable **View → Top Header Bar** and **View → Format Toolbar** menu items, Settings toggles (including **Show format toolbar in Simple mode**), Command Palette actions, and StatusBar recovery controls.
- **Go to Line (`⌘L` / `Ctrl+L`)**: Added a **Go to Line** modal (`line` or `line:col`, supporting full-width digits/colon) via Edit menu, shortcut, Command Palette, or clicking the StatusBar line/column readout.
- **Help → Online Manual**: Added **Online Manual** in the **Help** menu and Command Palette to open the official documentation on GitHub.

</details>

<details>
<summary>Previous release: v1.0.2</summary>

- **Full Character Encoding & EOL Support**: Auto-detects and supports `UTF-8`, `UTF-8 (BOM)`, `Shift_JIS (CP932)`, `EUC-JP`, `ISO-2022-JP (JIS)`, `UTF-16 LE`, and `UTF-16 BE` plus `LF` / `CRLF`. Click the StatusBar pills to **Reopen with Encoding**, **Change Save Encoding**, or open **New File with Encoding…**, set defaults in Settings, and guard against unmappable characters on save.
- **Editor Right-Click Context Menu**: Adds Undo/Redo, Cut/Copy/Paste/Delete, Select All, **Rectangular Selection**, **Advanced** line operations (Tab/Space indent, comments, spaces↔tabs, case conversion, reverse/sort/dedupe lines, trim whitespace, `>` quote, wrap/unwrap line breaks), **Full-width / Half-width Conversion**, and **Bookmarks** with gutter markers.
- **Ruler, Wrap Modes, Visible Symbols & Bracket Matching**: Adds a column ruler, Window / Fixed Column / No Wrap modes, visible newline & whitespace symbols, StatusBar toggle, and **Matching Bracket Highlighting**.

</details>

<details>
<summary>Previous release: v1.0.1</summary>

- **Windows CLI Shim Fix (`os error 193`)**: Fixed Windows launching extensionless POSIX shims in `%APPDATA%\npm` (such as `codex`, `claude`, `gemini`, `npm`) by skipping extensionless scripts and resolving `.exe` / `.com` / `.cmd` / `.bat` cleanly.
- **Improved AI CLI & Local LLM Guidance**: Added Antigravity CLI (`agy`) standalone setup distinction and terminal installers (`curl` / `irm`), automatic `~/.npm-global` fallback on macOS/Linux to prevent `EACCES`, per-CLI login hints, and step-by-step Ollama / LM Studio server guidance.
- **Expanded Web Runtime Diagnostics**: Filtered out Windows' empty Microsoft Store `python.exe` stub, added `wp-config-sample.php` / Laravel SQLite / Ruby-Jekyll / `.env.example` checks, Linux `python3-venv` & PHP extension hints, and action button legends.
- **Upgraded Find & Replace**: Added full-width/half-width sensitivity toggle, **In Selection** search & replace scope with range refresh, literal `$1` preservation when Regex is off, and smoother navigation.

</details>

<details>
<summary>Previous release: v1.0.0</summary>

- Renamed the application to **Onigiri Editor** with refreshed app icons across macOS, Windows, and Linux.
- Added **OS-aware first-launch language detection** (Japanese UI + menu bar on Japanese OS; English on all other OS locales).
- Added **Session Restore, Unsaved Draft Recovery & Auto-Save** with toggles in Settings and Inspector.
- Added **External File Change Detection** with auto-reload for clean tabs and conflict resolution (`Reload`, `Compare Diff`, `Keep Mine`, `Save Again`, `Keep as Draft`) for modified or deleted files.
- Added **AI Pre-Apply Diff Preview Modal** for both document replacements (with automatic pre-apply snapshot option) and workspace file writes.
- Added **AI Connection Assistant & Model Picker** for Codex / Claude / Gemini / Antigravity CLIs, Ollama, LM Studio, and Cloud APIs across macOS, Windows, and Linux.
- Added **Project Environment Diagnostics & Dev Server Integration** (Vite, Next.js, Laravel, WordPress, Docker, Python, static HTML/PHP, etc.) plus code/webpage right-pane previews.
- Added **OS-specific guidance & compatibility improvements** across Windows, Linux, and macOS (`.cmd` shim handling, single-instance file-open args, terminal launch helpers, and non-blocking fallbacks).

</details>

## Quick Start

1. Launch **Onigiri Editor** — it opens in your OS language (Japanese or English).
2. Switch modes anytime using the top bar or `⌘\` / `Ctrl+\` (**Simple** / **Basic** / **Advanced**).
3. Open a Markdown file, code file, or workspace folder (`⌘O` / `Ctrl+O`).
4. Click the top-right **Panel / Bot icon** to open **AI Chat**, **Cleanup Tools**, **Stats & Diff**, **Frontmatter**, and **Settings** (`⌘,` / `Ctrl+,`).
5. Use **Embedded Browser** or **External Live Preview** in the right pane to preview HTML, Markdown, or running local dev servers side-by-side.

## Downloads

Pre-built binaries for each release are attached on the [GitHub Releases](https://github.com/StayHomeLabNet/Onigiri-Editor/releases) page:

- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

## License

MIT — see [LICENSE](LICENSE).
