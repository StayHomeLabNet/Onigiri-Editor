<div align="center">
  <img src="public/icon.png" alt="Onigiri Editor" width="96" height="96" />
  <h1>Onigiri Editor 🍙</h1>
  <p><strong>AI-era cross-platform Markdown, code &amp; dev-preview desktop editor for macOS, Windows, and Linux</strong></p>
  <p>
    <strong>English</strong> | <a href="README.ja.md">日本語</a>
  </p>
  <p>
    <a href="#overview">Overview</a> ・
    <a href="#key-features">Key Features</a> ・
    <a href="#requirements">Requirements</a> ・
    <a href="#build">Build</a> ・
    <a href="#whats-new-in-v101">What's New in v1.0.1</a> ・
    <a href="#quick-start">Quick Start</a> ・
    <a href="#downloads">Downloads</a> ・
    <a href="#license">License</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-1.0.1-blue" alt="version" />
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

Current version: `v1.0.1`

## Key Features

- **Three UI Modes (`⌘\` / `Ctrl+\`)**:
  - **Simple Mode**: Ultra-minimal single-pane editor with distraction-free focus and automatic file-extension syntax highlighting.
  - **Basic Mode**: Clean editor + bidirectional live preview with synchronized scrolling and essential formatting controls.
  - **Advanced Mode**: Multi-tab editing, workspace folder explorer, full-text search, dev-server integration, snapshots, and AI workspace tools.
- **Bidirectional Visual Editing & Sync Line Markers**: Edit Markdown in CodeMirror 6 (left) or TipTap visual WYSIWYG (right), with real-time line/block highlight indicators across both panes.
- **100+ Language Syntax Highlighting & Custom Colors**: Built-in support for Markdown, PHP, TypeScript/JavaScript, Python, Rust, SQL, HTML, CSS, YAML, JSON, and more—with 7 theme presets (`Auto`, `GitHub`, `One Dark`, `Dracula`, `Nord`, `Monokai`, `Solarized`) and 10 per-token color pickers.
- **Built-in AI Chat, CLI Connection Assistant & Diff Preview**:
  - Supports **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **OpenAI / Anthropic / Gemini APIs**, **Ollama**, and **LM Studio** with model selection and guided Terminal setup/login when disconnected.
  - Shows a **line-by-line Diff Preview Modal** before applying AI document replacements (with optional pre-apply snapshot) or workspace file writes.
- **Session Restore, Draft Recovery & Auto-Save**: Automatically saves and restores open tabs, unsaved drafts, cursor positions, and workspace state across restarts, plus optional 1.5s auto-save for file-backed tabs.
- **External File Change Detection & Conflict Banner**: Watches open files on disk (including changes from external editors or AI CLIs)—auto-reloading clean tabs or displaying a conflict banner with **Reload**, **Compare Diff**, and **Keep Mine** actions when unsaved edits exist.
- **Web Dev & Dual Browser Preview**:
  - Auto-detects Vite, Next.js, Laravel, WordPress, Docker Compose, Python, Hugo, and static projects, runs pre-flight environment diagnostics, and offers guided setup.
  - **Pattern 1**: Native multi-WebView **Embedded Web Browser** in the right pane (`Settings` toggleable).
  - **Pattern 2**: **External Live Browser Preview** over local HTTP (`127.0.0.1`) with real-time auto-reload.
- **Productivity Extras**: Smart Line Copy (`⌘C` / `Ctrl+C`), Mermaid diagrams, KaTeX math, GitHub callouts, YAML Frontmatter editor, AI output cleanup & table formatter, estimated LLM token counter, Rich Text copy & HTML-to-Markdown smart paste, snapshots & diff viewer, Find & Replace (Regex), Command Palette (`⌘K` / `Ctrl+K`), Zen Mode (`⌘⇧F` / `Ctrl+Shift+F`), and HTML / PDF export.
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

## What's New in v1.0.1

- **Windows CLI Shim Fix (`os error 193`)**: Fixed Windows launching extensionless POSIX shims in `%APPDATA%\npm` (such as `codex`, `claude`, `gemini`, `npm`) by skipping extensionless scripts and resolving `.exe` / `.com` / `.cmd` / `.bat` cleanly.
- **Improved AI CLI & Local LLM Guidance**: Added Antigravity CLI (`agy`) standalone setup distinction and terminal installers (`curl` / `irm`), automatic `~/.npm-global` fallback on macOS/Linux to prevent `EACCES`, per-CLI login hints, and step-by-step Ollama / LM Studio server guidance.
- **Expanded Web Runtime Diagnostics**: Filtered out Windows' empty Microsoft Store `python.exe` stub, added `wp-config-sample.php` / Laravel SQLite / Ruby-Jekyll / `.env.example` checks, Linux `python3-venv` & PHP extension hints, and action button legends.
- **Upgraded Find & Replace**: Added full-width/half-width sensitivity toggle, **In Selection** search & replace scope with range refresh, literal `$1` preservation when Regex is off, and smoother navigation.

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
