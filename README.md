<div align="center">
  <img src="public/icon.png" alt="Onigiri-Markdown" width="96" height="96" />
  <h1>Onigiri-Markdown 🍙</h1>
  <p><strong>An AI-era cross-platform Markdown editor with real-time preview, Basic &amp; Advanced modes, and multilingual UI.</strong></p>
  <p>
    <strong>English</strong> | <a href="README.ja.md">日本語</a>
  </p>
  <p>Version: <code>v0.1.0</code></p>
</div>

---

## Why Onigiri-Markdown?

In the AI era, most output from ChatGPT, Claude, Gemini, and coding agents arrives in Markdown—complete with tables, LaTeX math, Mermaid diagrams, callouts, and code blocks. **Onigiri-Markdown** is built to make viewing, editing, cleaning, and exporting those documents effortless on **macOS, Windows, and Linux**.

## Two Modes for Every Workflow

### 1. Basic Mode (Simple & Distraction-Free)
- Clean, minimal interface focused on writing and reading
- **Editor / Split / Preview** view switcher with resizable split pane and synchronized scrolling
- Essential formatting toolbar (Headings, Bold, Italic, Code, Links, Lists, Checklists, Blockquotes, Tables)
- Interactive task list checkboxes directly inside the live preview
- Quick switching for **UI Language (`English` / `日本語`)** and **4 Color Themes (`Light` / `Dark` / `Sepia` / `Midnight`)**

### 2. Advanced Mode (Power Workspace & AI Toolkit)
- **Multi-Tab Editing** and **Workspace Folder Explorer** with full-text search across notes
- **Document Outline (TOC)** with active heading tracking and click-to-jump
- **AI Output Cleanup & Formatter**:
  - Strip zero-width & invisible characters
  - Auto-align GFM table columns (supports full-width CJK characters)
  - Normalize bullets (`*` / `+` → `-`), heading spacing, and consecutive blank lines
- **Estimated LLM Token Counter** alongside word, character, line, and reading-time statistics
- **Rich Text Copy** (paste styled output straight into Notion, Google Docs, or Slack) & **Smart HTML Paste** (auto-convert copied HTML into clean Markdown)
- **Live Mermaid Diagrams** (with zoom modal & SVG copy), **KaTeX Math**, and **GitHub-style Callouts** (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
- **Snapshots & Line Diff Viewer** to save checkpoints and compare/restore versions
- **YAML Frontmatter Editor** & preview metadata card
- **Find & Replace** (Regex, Case Sensitive, Whole Word), **Command Palette (`⌘K` / `Ctrl+K`)**, **Zen Mode (`⌘⇧F` / `Ctrl+Shift+F`)**, **Custom Preview CSS**, and **HTML / PDF Export**

## Tech Stack

- **Desktop Runtime**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **Frontend**: React 19, TypeScript, Vite
- **Editor**: CodeMirror 6 (IME-friendly for Japanese/CJK input)
- **Markdown Pipeline**: unified / remark / rehype, GFM, KaTeX, Highlight.js, Mermaid, Turndown

## Development & Build

```bash
# Install dependencies
npm install

# Web preview
npm run dev

# Desktop development mode
npx tauri dev

# Build native release installer for your OS (macOS / Windows / Linux)
npx tauri build
```

## License

MIT
