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
    <a href="#whats-new-in-v154">What's New in v1.5.4</a> ・
    <a href="#quick-start">Quick Start</a> ・
    <a href="#downloads">Downloads</a> ・
    <a href="#license">License</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-1.5.4-blue" alt="version" />
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

On first launch, it automatically detects the OS language across **8 supported languages** (**English**, **日本語**, **简体中文**, **繁體中文**, **한국어**, **Español**, **Français**, **Deutsch**) and switches both the UI and the native application menu bar accordingly.

Current version: `v1.5.4`

## Key Features

- **Three UI Modes (`⌘\` / `Ctrl+\`, or direct `⌘⌥1` / `⌘⌥2` / `⌘⌥3`)**:
  - **Simple Mode**: Ultra-minimal single-pane editor with distraction-free focus and automatic file-extension syntax highlighting.
  - **Basic Mode**: Clean editor + bidirectional live preview with synchronized scrolling and essential formatting controls.
  - **Advanced Mode**: Multi-tab editing (with pinning, drag-reordering, side-by-side dual editor & 2-tab diff compare), collapsible workspace folder explorer (Git status badges, tree D&D relative links, context menu, image gallery & **Unused Image Cleaner**), **Knowledge tab** (`[[WikiLinks]]`, Backlinks, `#tag` browser & **Interactive Knowledge Graph / Broken Link Diagnostics**), dedicated **Git Source Control tab** (Stage/Unstage/Discard, inline diff, Commit with **AI Commit Message**, Pull/Push), cross-folder Regex Grep & Replace (`⌘⇧G`), dev-server integration, snapshots, and AI workspace tools.
  - **Header-Hidden Status Bar Switcher**: When the top header bar is hidden in any mode, the Status Bar shows a compact 1-click transition button (`Simple → Basic`, `Basic → Advanced`, `Advanced → Basic`).
- **Bidirectional Visual Editing, Citations, Slide Mode & Writing Workflow**: Edit Markdown in CodeMirror 6 (left) or TipTap visual WYSIWYG (right) with real-time line/block highlights, **Slash Commands (`/`)**, **Custom Snippets**, **Auto TOC**, **Clipboard Image Paste Auto-Save (with auto-migration on first save)**, **Citations, Footnotes, BibTeX / DOI Lookup, Link Cards & URL Auto-Title Paste**, **Daily Notes & Templates**, **URL Web Clipper**, and **Markdown Slide Presentation Mode**.
- **100+ Language Syntax Highlighting, Structured Data & Visual Previews**: Built-in support for Markdown, PHP, TypeScript/JavaScript, Python, Rust, SQL, HTML, CSS, YAML, JSON, CSV/TSV, SVG, and more—clickable Status Bar language override, **CSV/TSV interactive table preview**, **JSON/YAML/ENV formatting & conversion**, enhanced **SVG (zoom/background/PNG copy)** & **HTML Visual/Source preview**, **Mermaid & KaTeX SVG/PNG export**, code folding, persisted **Line Bookmarks (`F2`)**, **Focus Mode**, `⌘D` multi-occurrence selection, 7 syntax presets, and 10 per-token color pickers.
- **Built-in AI Chat (Per-Tab Threads), Apple Foundation Models (macOS), Toolbar AI Custom Buttons & Submenus, Document Review & Diff Preview**:
  - Supports **Apple Foundation Models (Apple Intelligence on-device, macOS 26+ only)**, **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **OpenAI / Anthropic / Gemini APIs**, **Ollama**, and **LM Studio** with model selection, **per-tab or shared chat threads**, **Export Chat as `.md` Note**, live streaming progress & Stop/Cancel, folder permission pill, **Inline AI Selection Edit (`⌘⇧E`)**, **Toolbar AI Custom Buttons & Long-Press / Right-Click Submenus** (register up to 5 primary buttons + up to 10 submenu items each, with custom icons, prompts, copy/replace checkboxes, and per-item keyboard shortcuts—preloaded with an **AI Translate** preset), and **Proofread & Document Review**.
  - Shows a **line-by-line Diff Preview Modal** before applying AI document/selection replacements (with optional pre-apply snapshot) or workspace file writes.
- **Project-Scoped Session Restore, `.editorconfig` / `.onigiri.json`, Keybindings & Backup**: Saves and restores open tabs, unsaved drafts, cursor & scroll positions, folding state, bookmarks, language overrides, recent history, and window geometry per workspace folder across restarts; auto-applies hierarchical **`.editorconfig`** & **`.onigiri.json`** project rules; lets you customize shortcuts across **112 built-in commands + dynamic AI Custom buttons & submenus** (**Settings → Keybindings** with category filter chips and conflict detection); and supports selective **JSON Settings / AI / Snippets / Templates / Keybindings Backup Export & Import** plus granular **Factory Reset & Cache Cleaner**.
- **External File Change Detection & Conflict Banner**: Watches open files on disk (including changes from external editors or AI CLIs)—auto-reloading clean tabs or displaying a conflict banner with **Reload**, **Compare Diff**, and **Keep Mine** actions when unsaved edits exist.
- **Web Dev & Dual Browser Preview (Monorepo Multi-Server, Custom Port, AI Log Diagnostics, QR & LAN Sharing)**:
  - Auto-detects Vite, Next.js, Astro, Nuxt, Laravel, WordPress, PHP, Django, FastAPI, Flask, Streamlit, Python backends, Hugo, MkDocs, Docker Compose, monorepo subprojects, and static projects, runs pre-flight environment diagnostics, supports **simultaneous multi-server execution across monorepo targets** (e.g. `gui` frontend + `engine` backend with individual running pills and stop controls), and lets you select **Target Folder**, **Script**, and custom **Port (`1–65535`)** with collapsible live **`> Logs`** console output (Copy, Clear, error auto-highlighting & 1-click **Ask AI** diagnosis).
  - **Pattern 1**: Native multi-WebView **Embedded Web Browser** in the right pane (`Settings` toggleable) with **Home** button (configurable Home URL), **Responsive Viewport Presets (`Full` / `Tablet 768px` / `Mobile 390px`)**, **★ Bookmarks & Recent URL History bar**, **DevTools (`F12`)**, keyboard shortcuts (`⌘L`/`Ctrl+L`, `F5`/`⌘R`, `Alt+←/→`), and **Server Stopped** recovery banner.
  - **Pattern 2**: **External Live Browser Preview** (`127.0.0.1` or LAN `0.0.0.0`) with real-time auto-reload, plus **Project Dev Server LAN Access** (`LAN: ON / OFF` toggle, `0.0.0.0` binding, smart physical LAN prioritization with **`+N virtual/other`** collapse, copy chips, and **QR Code** cards) to preview projects on phones or other PCs over local Wi-Fi.
- **Productivity Extras & Auto-Update Manager**: **Quick Open (`⌘P` / `@headings`)**, Keyboard macro recording & playback (`⌘⇧M` / `F8`), Format Toolbar edit/zoom controls & Status Bar zoom popover (`25%`–`400%`), Smart Line Copy (`⌘C` / `Ctrl+C`), Mermaid diagrams, KaTeX math, GitHub callouts, YAML Frontmatter editor, AI output cleanup & table formatter, estimated LLM token counter, **Copy as Rich Text** & HTML/TSV smart paste, Find & Replace, Command Palette (`⌘K` / `Ctrl+K`), Zen Mode (`⌘⇧F` / `Ctrl+Shift+F`), **Self-Contained Word (`.docx`) / HTML** (embedded local images) / PDF export, and **In-App Auto-Update & Background Update Checker** (configurable periodic check intervals, background auto-download, in-app release notes viewer / tab opener, version skip, and 1-click apply & restart).
- **OS-Aware First-Launch Language (8 Languages)**: Automatically detects the OS language on first launch across **English**, **日本語**, **简体中文**, **繁體中文**, **한국어**, **Español**, **Français**, and **Deutsch** (manual switch available anytime via the TopBar language dropdown or **Settings → General**).

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
# Frontend unit tests (Vitest)
npm test

# TypeScript check + production bundle
npx tsc --noEmit && npm run build

# Rust backend unit tests
cargo test --manifest-path "src-tauri/Cargo.toml"
```

## What's New in v1.5.4

- **AI Harness Architecture Upgrades (All Toggleable in Settings → General)**:
  - **Auto-Load Project Rules (`AGENTS.md` / `CLAUDE.md` / `.onigiri-rules.md`)**: Automatically detects workspace-root rule files and injects them into AI Chat, Inline AI Edit, Toolbar AI Custom Buttons, and AI Document Review prompts.
  - **Unified Progress & Error Diagnostics**: Extended `listenAiChatProgress` live streaming status and categorized `aiErrorHint.ts` troubleshooting hints to Toolbar AI Custom Buttons and AI Document Review.
  - **2-Model Parallel A/B Comparison**: Run a primary model and a secondary comparison model in parallel inside **Inline AI Edit (`⌘⇧E`)** and **AI Chat** to inspect outputs side-by-side before applying.
  - **`cli-direct` Pre-Execution Checkpoint & Changed-File Guard**: Captures workspace state before `cli-direct` writes and surfaces modified files after execution.
  - **AI Execution Audit Log**: Records masked prompt previews, provider/model, elapsed time, and apply status with 1-click re-run support.
- **AI Memory & Context Intelligence**:
  - **Pinned AI Memory (Global / Workspace)**: Manage persistent rules in **Settings → General** or pin directly from any chat message (`Pin`) for automatic injection across all AI pathways.
  - **Long Thread Compaction & Save Rule to `AGENTS.md`**: Compact older chat turns into a persistent summary pill (keeping the latest 6 messages) and save effective instructions straight into `AGENTS.md` / `.onigiri-rules.md`.
  - **Context Visibility Bar & Knowledge Index Suggestions**: Inspect and temporarily mute active context chips (`Doc`, `Folder`, `AGENTS.md`, `Memory (N)`, `History`) above the chat composer, and attach up to 3 relevant workspace notes suggested from the Knowledge Index (`@relativePath`).
- **Basic / Simple Mode TopBar Document Pill**:
  - Added a direct `×` close button to the active filename pill in the TopBar, plus an interactive **Open Tabs Popover** (with `index/total` badge when multiple tabs are open) for switching tabs, closing individual tabs, creating a new tab, or closing other tabs without leaving Basic/Simple mode.

<details>
<summary>Previous release: v1.5.3</summary>

- **AI Harness Wait-Time Visibility & Error Guidance**:
  - **AI Ghost Text Loading & Error Hints**: Shows a subtle pulsing `…` indicator while completions are generating and surfaces throttled, actionable provider hints on failure.
  - **Inline AI Edit Progress**: Displays elapsed seconds, live `ai-chat-progress` CLI status, an indeterminate progress bar, and categorized troubleshooting hints (`aiErrorHint.ts`).
- **CSV / TSV Table Preview Overhaul & Multi-MB Virtualization**:
  - **Virtual Scrolling & Performance**: Virtualized both Table and Raw views with `useDeferredValue` for smooth handling of multi-MB CSVs.
  - **Bidirectional Editor ⇔ Table Highlight**: Selecting or clicking cells/substrings syncs highlights between the editor and table preview, paired with sticky `#` row numbers, numeric column stats (`Σ / Avg / Min / Max`), delimiter selector, wrap toggle, and a **Settings → Editor** toggle for double-click cell copy.
- **Welcome Guide Updates & Modularization**:
  - Updated `Welcome.md` / `ようこそ.md` across all 8 languages to highlight AI Harness and CSV/TSV Table Preview features, and extracted `AppModals.tsx`, `EditorInlinePopup.tsx`, and `editorContextActions.ts`.

</details>

<details>
<summary>Previous release: v1.5.2</summary>

- **Multi-Window Support (`⌘⇧N` / `Ctrl+Shift+N`) & Release Hardening**:
  - Open independent editor windows via **File → New Window** with per-window isolated session state, focused-window menu routing, and release-build WebView hardening.
- **Interactive Preview Images & Link Card Thumbnails**:
  - Float images left/right with text wrap, cycle widths (`200 / 280 / 380px`), and edit Alt text or delete directly in the visual preview; attach optional thumbnail URLs to link cards.
- **Resizable Inline AI Edit Modal & AI Ghost Text IME Fix**:
  - Drag edges/corners to resize the Inline AI Edit modal (persisted across sessions) or expand it, and trigger AI Ghost Text autocomplete reliably after Japanese IME commits (`compositionend`).
- **Expanded Welcome Document Across All 8 Languages**:
  - Updated `Welcome.md` / `ようこそ.md` across all 8 languages (`en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `es`, `fr`, `de`) with the full feature guide, shortcuts, Mermaid workflow, and interactive examples.

</details>

<details>
<summary>Previous release: v1.5.1</summary>

- **Architecture Modularization & Maintainability Refactoring**:
  - **Settings Modal Tab Decomposition (`src/components/settings/`)**: Split `SettingsModal.tsx` into 7 focused tab components (`GeneralTab`, `EditorTab`, `SyntaxTab`, `KeybindingsTab`, `AiCustomTab`, `IntegrationsTab`, `DataTab`), reducing `SettingsModal.tsx` from 4,094 lines to 439 lines.
  - **Custom Hooks Extraction (`src/hooks/`)**: Extracted cohesive domain hooks (`useGitPanelActions`, `useMacroRecorder`, `useAiCustomRunner`, `useExportActions`, `useBackupAndReset`, `useExternalPreview`, `useWorkspaceActions`) out of `App.tsx` (reducing it from 8,739 lines to 7,283 lines) and unified workspace clean-tab reload logic with zero behavior regressions.

</details>

<details>
<summary>Previous release: v1.5.0</summary>

- **8-Language UI & Native Menu Localization**:
  - **Expanded from 2 to 8 Languages**: Added **Simplified Chinese (`zh-CN`)**, **Traditional Chinese (`zh-TW`)**, **Korean (`ko`)**, **Spanish (`es`)**, **French (`fr`)**, and **German (`de`)** alongside **English (`en`)** and **Japanese (`ja`)**.
  - **TopBar Language Dropdown & Settings Selector**: Replaced the 2-way `EN / 日本語` toggle button with a dropdown menu in the TopBar and an updated selector in **Settings → General & View** supporting all 8 languages.
  - **OS Locale Auto-Detection & Native Menu Bar**: Updated macOS, Windows, and Linux OS language detection (`get_os_locale`) and the Rust native application menu bar (`menu.rs`) to localize across all 8 languages, backed by a deep-merge English fallback (`mergeTranslations`) so omitted keys never break the UI.
- **Localized Default `AI Translate` Preset & Apple Intelligence Picker Fix**:
  - **Locale-Aware `AI Translate` Preset**: The default **AI Translate** toolbar button now automatically adapts its button label and prompt across all 8 languages (pairing each non-Japanese language with English, and Japanese/English together) whenever switching UI languages or resetting presets, without overwriting user-edited prompts or model selections.
  - **Apple Foundation Models Model Picker (`Settings → AI Custom`)**: Displays readable labels (**Apple Intelligence (Default)** / **Apple Intelligence (Content Transformations)**) when selecting Apple Foundation Models per button or submenu item.
- **Expanded Welcome Sample Document**:
  - Updated the built-in Welcome sample document across all locales to showcase live preview sync, AI custom buttons, slash commands, Mermaid diagrams, KaTeX math, and multi-language editing.

</details>

<details>
<summary>Previous release: v1.4.2</summary>

- **Inline Selection Sync & Enhanced Cursor Block Highlight in Preview**:
  - **Character-Level Selection Sync (`Settings → Editor`, on by default)**: Selecting text in the CodeMirror editor highlights the exact corresponding inline text in the live TipTap preview in real time using non-destructive ProseMirror decorations.
  - **Enhanced Cursor Block Highlight (`Settings → Editor`, on by default)**: Improves background contrast and accent bar visibility across Light, Dark, Sepia, and Midnight themes when placing the cursor on headings (`H1`, `H2`, etc.) or plain text lines.
- **Per-Button AI Model Selection & Local AI Reliability (`AI Custom`)**:
  - **Per-Button / Submenu Provider & Model Override (`Settings → AI Custom`)**: Choose a specific **Subscription CLI** (`Codex CLI`, `Claude Code CLI`, `Gemini CLI`, `Antigravity CLI`, `Custom CLI`), **Cloud API** (`OpenAI`, `Anthropic`, `Gemini`), or **Local AI / On-Device** (`Ollama`, `LM Studio`, `OpenAI-Compat`, `Apple Foundation Models`) and model per custom button or submenu item (or follow the AI Chat panel by default).
  - **Local AI Fixes (LM Studio / Ollama / Apple Foundation Models)**: Reads live editor text directly, wraps appended input text in explicit `# 入力テキスト (Input Text) / <input_text>` delimiters so compact local models (such as Gemma 4) never mistake short phrases for prompt instructions, strips `<think>...</think>` reasoning blocks, detects reasoning-only empty responses, and blocks empty outputs from overwriting editor content.
- **Simple Mode Defaults, Built-in Browser Close Button & UI Polish**:
  - **Simple Mode Defaults**: Sets **Hide top header bar in Simple mode** and **Show format toolbar in Simple mode** to ON by default for a cleaner writing experience with immediate access to file and formatting tools.
  - **One-Click Built-in Browser Close (`✕`)**: Adds a close button directly next to the **Web Browser** tab in the right-pane header to close the embedded WebView and return to Markdown preview.
  - **Header & Release UI Hardening**: Removes the redundant version pill from the top-left brand header, suppresses the browser default context menu (`Back`, `Refresh`, `Save as`, `Print`, `Inspect`) on non-editable app UI chrome in production builds, and disables DevTools/Inspect on the main application window in release builds (while keeping DevTools available for the built-in Web Browser).

</details>

<details>
<summary>Previous release: v1.4.1</summary>

- **Auto Snapshot Timeline & Partial Chunk Restore**: Automatically saves snapshots on file save and at configurable intervals (**Settings → General**), with a visual timeline in **Inspector → Snapshots** supporting both full restore and **partial chunk-by-chunk restore**.
- **Markdown Compatibility Check (GitHub / Zenn / Qiita / Notion / Obsidian)**: Inspects dialect-specific syntax (Callouts, WikiLinks, KaTeX, Footnotes, Mermaid, HTML tags) in **Inspector → Compat** with 1-click jump to line.
- **Image Auto-Optimization & Workspace Image Size Inventory**: Automatically resizes and compresses pasted images (WebP on Windows WebView2; JPEG/PNG fallback on macOS WKWebView & Linux WebKitGTK), supports organized filenames and optional `originals/` backups, and adds an **All Images Size Inventory** tab to the Unused Images modal.
- **AI Send Content Preview & Secret Redaction**: Preview exact text before sending to external AI providers with automatic detection and 1-click masking of API keys, Bearer tokens, private keys, and secrets (**Settings → AI**).
- **Feature Finder Guide (`?`)**: Search any Onigiri Editor feature in Japanese or English from the TopBar `?` button or Command Palette and launch it immediately.
- **Built-in Browser UX & Cross-Platform Fixes**: Adds custom viewport width (`px`), 1-click **Clip Page to Markdown**, an inline `⋮` action strip & upward tooltips immune to native child WebView occlusion on macOS/Windows/Linux, **Resync Browser Bounds**, macOS child WebView Y-offset alignment fix (prevents the embedded page from covering the browser toolbar), macOS mixed-DPI multi-monitor startup window scaling fix (prevents 1/4-size rendering after update/relaunch), Windows Shift_JIS/CP932 terminal decoding + `cd ~\` + process-tree cancel (`taskkill /T /F`), and Global Hotkey error notifications.
- **Comprehensive Security Hardening**: Enforces Mermaid `securityLevel: 'strict'` + SVG sanitization, restricts updater execution to canonical files inside Downloads with redirect allowlist validation, enforces URL scheme allowlists on built-in/external browsers, blocks cloud metadata / link-local SSRF in Web Clipper, hardens Live Preview (`</style>` breakout protection, `nosniff`, `no-referrer`), and tightens Tauri CSP.

</details>

<details>
<summary>Previous release: v1.4.0</summary>

- **Single Line Break (`<br>`) Preview Option**: Renders single Enter line breaks directly as `<br>` across Live Preview, HTML Export, and External Live Preview without affecting code blocks (toggleable in **Settings → Editor**, on by default).
- **Selection Floating Bubble Menu**: Selecting text in the editor reveals a mini toolbar right above the selection for **Bold**, **Italic**, **Inline Code**, **Link**, **Inline AI Edit (`⌘⇧E`)**, and up to **3 quick AI Custom buttons** (toggleable in **Settings → Editor**).
- **AI Ghost Text Autocomplete (`Tab` to Accept / `Esc` to Dismiss)**: Displays muted inline continuation suggestions powered by your active AI provider (including offline free **Apple Foundation Models**, **Ollama**, or **LM Studio**) after a configurable typing pause (`400–2500ms`; opt-in via **Settings → Editor**).
- **AI Custom Prompt Variables**: Supports dynamic `{{selection}}`, `{{clipboard}}`, `{{fileName}}`, `{{filePath}}`, `{{language}}`, `{{date}}`, and `{{time}}` expansion inside AI Custom buttons & submenus, with 1-click variable chips in **Settings → AI Custom**.
- **Markdown Table GUI Toolbar**: Automatically appears above the editor when the cursor is inside a Markdown table to insert/delete rows & columns, align left/center/right, sort columns ascending/descending (numeric-aware), and format column widths (toggleable in **Settings → Editor**).
- **PDF / HTML Export Page Setup & Design Presets**: Configure **Design Theme** (**Modern**, **Business**, **Academic**), **Paper Size** (`A4` / `Letter` / `B5`), **Orientation**, **Margins**, **Page Numbers (`1 / N`)**, and custom **Header / Footer** (`{{title}}` supported) from the Export menu or Command Palette.
- **Quick Scratchpad & Global Summon Hotkey**: Auto-persisted save-free **Quick Scratchpad** (Copy, Clear, **Open in Tab**) in the Status Bar & Command Palette, plus an optional system-wide **Global Hotkey** (default `CommandOrControl+Shift+Space`) to summon Onigiri Editor from any app (toggleable in **Settings → General**).
- **Lightweight Integrated Terminal Drawer (Advanced Mode)**: Bottom drawer terminal with streaming output, persistent `cd` directory, `↑`/`↓` command history, Stop control, and 1-click **Ask AI** diagnosis on errors (toggleable in **Settings → General**).
- **App-Wide Instant Custom Tooltips**: Upgrades native `title` tooltips across the entire app (Header, Toolbar, Sidebar, Tab Bar, Status Bar, Inspector, Modals) into fast **0.15s** theme-aware Portal tooltips with automatic `<kbd>` shortcut badges (toggleable in **Settings → General**).

</details>

<details>
<summary>Previous release: v1.3.6</summary>

- **Responsive Header & Format Toolbar Polish (Anti-Wrapping & Measurement-Based Progressive Collapse)**:
  - Button labels never wrap vertically onto multiple lines (`white-space: nowrap; flex-shrink: 0`).
  - Progressively collapses labels based on real-time DOM measurements and hysteresis: TopBar relaxes center-balance to borrow left margin, then collapses Theme and Language labels (to 28×28px icon buttons), layout switch labels, and version badge; FormatToolbar collapses "Copy Rich Text" label first, then "AI Clean" (to 26×26px icon buttons).
  - Automatically hides redundant New / Open / Save file buttons in the Format Toolbar when the top header bar is already visible (saving ~90px of space).
  - Added gradient edge fade masks, smooth `<` / `>` scroll buttons, and horizontal mouse wheel scrolling support when the toolbar overflows in narrow windows.
- **Instant Custom Tooltips (`0.15s` Quick Hover & Shortcut Badges)**:
  - Replaced delayed native tooltips on header and toolbar controls with a lightweight, theme-aware Portal tooltip layer displaying within 0.15s, featuring `<kbd>` shortcut badges and zero edge clipping.
- **Optimized Default Prompt for "AI Translate" Preset**:
  - Upgraded the built-in AI Translate preset prompt with structured `# 命令` (automatic English ↔ Japanese language detection) and `# 制約事項` (strict prohibition of conversational filler and preservation of original markdown formatting).
- **macOS Only: Apple Foundation Models (Apple Intelligence) AI Provider**:
  - Select **Apple Foundation Models** under **Local AI** on macOS (Apple Silicon, macOS 26+ with Apple Intelligence enabled; weak-linked so older macOS versions continue running safely) to run private on-device inference offline for free.
  - Supports both **Default** and **Content Transformations (Permissive)** guardrails, live streaming progress, cancellation, and a 1-click **Open System Settings** button in Connection Support across AI Chat, Inline AI Edit, and AI Custom buttons.
- **AI Custom Buttons: Long-Press / Right-Click Submenus (Up to 10 Items per Button)**:
  - Long-pressing (~0.4s) or right-clicking any AI Custom button with submenus enabled smoothly opens a downward animated popover list of submenu actions (while normal click executes the parent button).
  - Toggle submenus per button in **Settings → AI Custom** (off by default) to configure up to 10 submenu items—each with its own 24-icon picker, label, AI prompt, and independent **Copy to clipboard** / **Replace document (or selection)** checkboxes.
- **All-Mode Status Bar Mode Switcher (When Header Bar Is Hidden)**:
  - Displays a compact one-step mode switcher in the Status Bar whenever the top header bar is hidden: `Simple → Basic`, `Basic → Advanced`, and `Advanced → Basic`.
- **Keyboard Shortcuts Expansion (112 Built-in Commands + AI Custom & Submenu Shortcuts)**:
  - Added direct mode shortcuts (`⌘⌥1` Simple / `⌘⌥2` Basic / `⌘⌥3` Advanced) and expanded **Settings → Keybindings** to **112 customizable commands** with **category filter chips**, plus **dynamic shortcuts for every AI Custom button and enabled submenu item** (editable in both **Settings → Keybindings** and **Settings → AI Custom**, displayed on toolbar tooltips, submenu badges, and Command Palette) and macOS `⌥` physical-code key matching.

</details>

<details>
<summary>Previous release: v1.3.5</summary>

- **Toolbar AI Custom Buttons (Up to 5 Configurable One-Click AI Actions)**:
  - Register up to **5 custom AI buttons** directly in the Format Toolbar (displayed to the right of the formatting buttons across **Simple**, **Basic**, and **Advanced** modes whenever the toolbar is visible).
  - **Built-in Default Preset (`AI翻訳` / AI Translate)**: Ships ready to use with 1 default button that automatically translates English → Japanese or Japanese → English and replaces the target text with only the translation result.
  - **Dedicated `Settings → AI Custom` Tab**: Add, reorder, edit, delete, or reset buttons with a **24-icon visual Lucide picker**, **custom hover tooltip name**, **AI prompt editor**, and independent **Copy to clipboard** / **Replace document (or selection)** checkboxes (usable separately or together).
  - **Smart Selection/Document Targeting, Instant Undoable Replace & Cancel**: Sends the **selected text** when text is highlighted, or the **entire document** when nothing is selected, using your active AI provider/model. Immediate replacements push onto CodeMirror's undo stack (`⌘Z` / `Ctrl+Z` reverts in one step), and clicking a running button's spinner cancels the request.

</details>

<details>
<summary>Previous release: v1.3.4</summary>

- **Redesigned Multi-Server UI (Compact Single-Row Bar, Per-Server Log Tabs, Sidebar Launcher, Status Bar Popover & 1-Click Restart)**:
  - **Built-in Browser Compact Bar**: Consolidates running server tabs (`● web :5173 [×]`, `● api :3000 ⚠2 [×]`) into a single row with **`+ Add`** and **`⚙ Settings`** inline drawers (`Port` / `Script` / `LAN`), **Start All / Stop All**, and **`EADDRINUSE` Port Conflict Auto-Retry on Free Port**.
  - **Per-Server Log Isolation & Error Badges**: Separates stdout/stderr logs and error counts per running server with `[All / web / api]` filter tabs for targeted copy, clear, and 1-click **Ask AI** diagnosis.
  - **Sidebar Monorepo Launcher List & Status Bar Indicator**: Displays multi-target projects as a clean per-row launcher list (1-click Start, Open in Browser, Restart `↻`, Stop) and adds a persistent **Status Bar** server indicator popover so background servers are always visible and manageable from any tab.
- **Built-in Web Browser Viewport Rotation & Screenshot-to-Markdown Capture**: Added **Portrait / Landscape** rotation for Tablet (`768px` ⇔ `1024×768`) and Mobile (`390px` ⇔ `844×390`) previews, plus a **Capture Screenshot to Markdown** camera button (macOS `screencapture`, Windows Per-Monitor HiDPI-aware capture, and Linux Wayland `grim` / X11 `import` / `maim` / `scrot`).
- **Hardened Cross-Platform Auto-Update Experience**: Added an **Unsaved Changes Guard** before restart (**Save All & Update**, **Restart Without Saving**, **Cancel**), streaming **SHA-256 verification** restricted to official GitHub Releases domains, **Cancel Download**, rich Markdown release notes rendering, **ETag (`If-None-Match`)** caching & persisted download state, **Apply on Next Quit**, atomic rollback-safe swaps for **macOS `.app`** and **Linux `.AppImage`**, and hidden delayed **Windows** installer launches that avoid file-lock / single-instance races.
- **Cross-Platform Polish & Architecture Cleanup**: Fixed macOS embedded browser DevTools docking/bounds restoration, Windows external URL opening for `&` query strings, Windows monorepo path case/`\\?\` comparison, OS-aware download directory lookup, removed version suffix from window title bar, and modularized `useAppUpdates` / `useProjectServer` hooks and the Rust `src-tauri/src/project/` backend.

</details>

<details>
<summary>Previous release: v1.3.3</summary>

- **Simultaneous Multi-Server Management in Monorepos**: Launch multiple monorepo targets concurrently (e.g., `gui` Vite frontend + `engine` FastAPI/Python backend) without stopping existing sibling servers. Active targets appear as green running pills (`● gui :5173 [×]`, `● engine :8000 [×]`) with one-click URL switching, per-target stop buttons, and combined `[target]` live logs.
- **Live Server Logs: Copy, Clear, Auto Error Highlighting & 1-Click "Ask AI"**: Added **Copy**, **Clear**, and **Ask AI** actions to the **`> Logs (N)`** drawer, automatic red/yellow highlighting for error and warning lines with an error-count badge, and 1-click AI Chat error diagnosis.
- **Smart LAN URL Virtual-NIC Filtering**: Prioritizes physical Wi-Fi / Ethernet LAN URLs and automatically collapses virtual/secondary adapters (`VirtualBox 192.168.56.x`, `WSL / Docker 172.16–31.x.x`, `Tailscale 100.64.0.0/10`) behind a **`+N virtual/other`** toggle.
- **Built-in Web Browser Responsive Viewports (`Full` / `768px` / `390px`) & Bookmarks / History**: Added **Full Width / Tablet (`768px`) / Mobile (`390px`)** viewport toggles and a **★ Bookmark** button + **Bookmarks & Recent URLs** bar in the Built-in Web Browser.
- **In-App Auto-Update, Background Check Intervals & Rich Update Actions**: Added 1-click **Auto-Update Now** (in-app streaming download with live progress bar and automatic `.app` replacement / installer launch), an **Update & Release Notes Modal** (**Open Release Notes in Editor Tab**, **Open in Built-in Browser**, **All-OS Binaries & Copy URL**, **Remind Later**, **Skip Version**), TopBar & Status Bar update badges, and settings for **Automatic Update Checking** (`Startup Only` / `1h` / `6h` / `12h` / `24h`), **Enable Auto-Update** (background auto-download), and **Update Available Behavior**.

</details>

<details>
<summary>Previous release: v1.3.2</summary>

- **Monorepo Target & Startup Script Selector + Custom Port UI**: Added compact **Target** and **Script** dropdowns alongside a **Port (`1–65535`)** input across the Sidebar, Built-in Web Browser, Web Page Preview, and Code Preview bars (remembered per project), improved Next.js/Storybook/Webpack/Angular/Vite preview (`4173`) port flags, and added a toast warning if a server falls back to another port.
- **Collapsible Live Dev Server Console Logs (`> Logs`)**: Added a default-collapsed **`> Logs (N)`** toggle across all project bars so you can inspect live stdout/stderr output while the server is running.
- **Built-in Web Browser Home Button, DevTools (`F12`), Shortcuts & Recovery Banner**: Added a **Home** button + **Browser Settings** shortcut linked to **Built-in Browser Home URL**, a **DevTools** toggle button (`F12`), browser keyboard shortcuts (`⌘L`/`Ctrl+L`, `F5`/`⌘R`/`Ctrl+R`, `Alt+←`/`Alt+→`), and a **Server Stopped** banner with one-click Restart / Go Home.
- **LAN URL QR Code Popover**: Added a **QR code button** next to each collapsible LAN URL chip (and in Settings) for instant smartphone/tablet scanning over local Wi-Fi.

</details>

<details>
<summary>Previous release: v1.3.1</summary>

- **Project Dev Server LAN Access (`LAN: ON / OFF`)**: Added a quick **`LAN: ON / OFF`** toggle across the **Sidebar** project panel, **Built-in Web Browser**, **Web Page Preview**, and **Code Preview** headers (plus **Settings → AI & Browser → Allow LAN access to Project Dev Server**). When enabled, project dev servers automatically bind to `0.0.0.0` across built-in static servers, PHP, Laravel, Django, Streamlit, FastAPI/uvicorn, Flask, Hugo, MkDocs, Vite, VitePress, SvelteKit, Astro, Nuxt, Docusaurus, and Next.js (`-H 0.0.0.0`), restarting cleanly when toggled mid-session.
- **One-Click LAN URL Copy Chips & External Server Probe**: Discovers local LAN IPv4 addresses (and server-printed LAN URLs), renders collapsible clickable **`LAN: <ip>:<port>/`** copy chips in the UI, and probes externally running dev servers to warn clearly when a server is bound to `localhost` only.
- **Windows & Laravel Reliability Fixes**: Fixed Windows `npm.cmd` / `pnpm.cmd` shim resolution and non-ASCII/Shift-JIS output decoding, auto-enabled missing Windows PHP extensions (e.g. `pdo_sqlite`), and added `--no-reload` for `artisan serve` when custom PHP INI scanning is active.

</details>

<details>
<summary>Previous release: v1.3.0</summary>

- **Auto-Migrate Temp Pasted Images on Save**: When screenshots or images pasted into an unsaved document (`onigiri-markdown-images` temp folder) are saved to disk for the first time (Save / Save As), Onigiri Editor automatically moves those images into the configured `assets/` folder beside the document and rewrites the Markdown links (`./assets/...`), preventing broken images after cache cleanup.
- **Embedded Local Images in HTML & Word (`.docx`) Exports**:
  - Standalone **HTML Export** now inlines local referenced images as Base64 data URIs by default (toggleable in **Settings → General & View**).
  - **Word (`.docx`) Export** now embeds local and `data:` images (PNG/JPEG/GIF/BMP natively, SVG/WebP/AVIF via canvas PNG conversion) directly inside `word/media/` with DrawingML dimensions instead of `[Image: ...]` placeholders.
- **Icon-Only Inspector & Sidebar Tabs + Configurable Tab Style**: Cleaned up right **Inspector** (`AI Chat`, `Review`, `Metadata`, `Format`, `Stats`, `History`) and left **Sidebar** tab bars to compact icon-only tabs with accessible tooltips, plus an **Inspector Tab Style** option (`Icons only`, `Active label`, or `Always show labels`).
- **LRU Image Memory Cache with Disk Modification Tracking**: Replaced unbounded image data URL caching with an entry-capped (120 items) and byte-budgeted (48 MiB) LRU cache (`ImageLruCache`) backed by file modification timestamp checks (`read_image_asset_with_meta`) and integrated cache clearing.
- **Faster Startup via Code Splitting & Lazy Loading**: Configured Vite `manualChunks` (`vendor-mermaid`, `vendor-codemirror`, `vendor-tiptap`, `vendor-katex`, `vendor-markdown`, `vendor-highlight`, `vendor-icons`), converted Mermaid rendering and `docxExport` to dynamic imports, and lazy-loaded 17 modals with `<Suspense>` to slash initial JS payload size.
- **In-App Update Checker & Tightened Tauri CSP**: Added GitHub Releases update checks on startup (configurable), from **Help → Check for Updates...**, Command Palette, **About**, and **Settings**, with an update banner linking to the matching OS installer; tightened Tauri Content Security Policy to remove `'unsafe-eval'`.
- **Modularized Architecture & Automated Vitest + CI Suite**: Split oversized backend/frontend files into focused modules (`images.rs`, `updates.rs`, `session.ts`, `imageCache.ts`, `exportHelpers.ts`, `cmTheme.ts`, `src/styles/*.css`), updated **Help → Online Manual** URL, and added Vitest frontend unit tests wired into GitHub Actions release builds.

</details>

<details>
<summary>Previous release: v1.2.1</summary>

- **Image Drop & Preview Rendering Fix (Windows Paths, Spaces & Non-ASCII Filenames)**: Fixed local/dropped images failing to render in Markdown Preview when file paths contain spaces, parentheses, non-ASCII characters (e.g. Japanese folders), or Windows drive letters/backslashes (`C:\...\foo bar.png`). Both inserted image syntax (`<C:/...>`) and manually typed/pasted local paths are normalized cleanly, `rehype-sanitize` preserves local drive/`file:`/`data:`/`blob:` image sources, and the Rust backend decodes UTF-8 percent-encoded paths and `file:///` Windows URIs reliably.
- **Unsaved Tab & Visual Preview Drop Improvements**: Added `workspaceRoot` fallback for image resolution in `PreviewPane`, `ImageModal`, and `SlidePresentationModal`, enabled direct Sidebar drag-and-drop onto Visual Preview, and synced Turndown round-tripping for space/Unicode paths.
- **Updated Welcome Guide (`Welcome.md` / `ようこそ.md`)**: Refreshed the built-in first-launch welcome document with v1.2 feature examples (Git panel, Knowledge Graph, Citations/Footnotes, Word `.docx` & diagram export, Keybindings UI, and JSON backup).

</details>

<details>
<summary>Previous release: v1.2.0</summary>

- **Git Source Control Panel**: Dedicated **Git** sidebar tab with change badge, branch & ahead/behind info, Stage / Unstage / Discard, inline unified Diff viewer, Commit, **AI Commit Message Generator**, Pull / Push, and recent commit log.
- **Knowledge Graph & Broken Link Diagnostics**: Interactive workspace note connection graph with search/`#tag` filters, connected-only toggle, orphan note stats, and click-to-jump broken link diagnostics.
- **Word (`.docx`), Mermaid/KaTeX SVG/PNG Export & Copy as Rich Text**: Export Markdown documents natively to `.docx`, save Mermaid diagrams & KaTeX math blocks as `.svg` or `.png`, and copy selections or whole docs as inline-styled Rich Text (`text/html` + `text/plain`).
- **Citations, Footnotes, BibTeX / DOI Lookup & URL Auto-Title Paste**: Insert Link Cards, auto-numbered footnotes (`[^N]`), parsed BibTeX references (APA / Markdown), and Crossref DOI lookups; wrap selected text when pasting URLs and optionally auto-fetch webpage `<title>` on bare URL paste.
- **Unused Image Cleaner, `.editorconfig` / `.onigiri.json`, Keybindings UI & JSON Backup**: Scan & remove unreferenced workspace images, apply hierarchical `.editorconfig` and `.onigiri.json` project settings, customize shortcuts across 27 commands with conflict detection, and back up/restore settings, AI presets, snippets, templates, and keybindings as JSON (plus granular Reset & Cache Cleaner).

</details>

<details>
<summary>Previous release: v1.1.0</summary>

- **Quick Open (`⌘P` / `@headings`), Persisted Bookmarks (`F2`), Focus Mode & Per-Project Sessions**: Jump to open/workspace/recent files or `@headings` instantly, toggle line bookmarks across sessions, dim inactive paragraphs in Focus Mode, and preserve tabs, scroll positions, folds, and language overrides per workspace folder (with improved language auto-detection).
- **Knowledge Management & Markdown Authoring**: Added **Slash Commands (`/`)**, **Custom Snippets UI**, **Auto TOC (`<!-- toc -->`)**, **`[[WikiLinks]]`**, Sidebar **Knowledge** tab (**Backlinks & `#tag` Browser**), **Daily Notes & Templates (`{{date}}`/`{{time}}`/`{{title}}`)**, **URL → Markdown Web Clipper**, **Clipboard Image Auto-Save** (configurable `assets` folder with workspace fallback), and **Sidebar Tree Drag & Drop** for relative Markdown links.
- **Cross-Folder Regex Grep Replace (`⌘⇧G`), Slide Presentation Mode & Enhanced Previews**: Search & selectively replace across folders, present Markdown docs as slides (`---`), inspect **CSV/TSV Interactive Tables**, format/convert **JSON / YAML / `.env`**, and use **SVG Zoom / Background / PNG Copy** & **HTML Visual/Source Toggle** in standalone webpage previews.
- **Dual Editor, Document Review, Per-Tab AI Threads & Git Integration**: Full focus routing for simultaneous Side-by-Side editing, **Proofread & Document Review** tab, **per-tab AI chat threads + `.md` note export**, and **Git status badges + `Git HEAD` diff compare**.

</details>

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
