Onigiri Editor `v1.5.5` introduces **Zone-Aware Drag & Drop** across the Workspace Folder Tree, Editor/Preview panes, and AI Chat panel—allowing you to copy or move files directly into workspace folders, insert images or relative Markdown links, and attach files or multimodal images straight to AI Chat.

### Highlights (`v1.5.5`)
- **Zone-Aware Drag & Drop**:
  - **Workspace Folder Tree (Advanced Mode)**: Hovering highlights the target folder row (or parent folder of a hovered file). Normal drop **copies** external files/folders into that folder; hold **`Shift`** while dropping to **move** them.
  - **Editor & Preview Panes**: Dropping images saves them to your asset folder and inserts Markdown image syntax at the cursor. Dropping non-image files (`.md`, `.txt`, `.csv`, etc.) opens them in a new tab by default, or inserts a relative Markdown link `[name](path)` when holding **`Shift`** or **`Ctrl` (`⌘`)**.
  - **AI Chat Panel (Multimodal & File Attachments)**: Dropping text/code/Markdown files attaches their contents as prompt context chips; dropping images attaches thumbnail chips and sends them as **Base64 multimodal image inputs** to Cloud APIs (OpenAI, Anthropic, Gemini) / Ollama, or as **image file paths** to AI CLIs (Codex, Claude, Gemini, Antigravity, Custom CLI).

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.5` では、**領域別ドラッグ＆ドロップ（フォルダツリー / エディタ＆プレビュー / AI チャット）** を実装し、外部ファイルや画像のドロップ先に応じて「フォルダへのコピー・移動」「カーソル位置への画像／相対リンク挿入」「AI チャットへのファイル・マルチモーダル画像添付」を使い分けられるようになりました。

### 主な変更点（`v1.5.5`）
- **領域別ドラッグ＆ドロップ対応**:
  - **拡張モードのフォルダツリー**: カーソル下のフォルダ行（ファイル上の場合はその親フォルダ）を個別ハイライト表示します。通常ドロップでそのフォルダへ**コピー**、**`Shift` キーを押しながら**離すと**移動**します。
  - **エディタ / プレビュー領域**: 画像ドロップ時はアセットフォルダへ保存してカーソル位置へ挿入します。非画像ファイル（`.md` / `.txt` / `.csv` 等）は通常ドロップで**新しいタブで開き**、**`Shift` または `Ctrl`（Mac は `⌘`）を押しながら**離すと相対パスの Markdown リンク `[ファイル名](パス)` を挿入します。
  - **AI チャット領域（マルチモーダル画像＆ファイル添付）**: テキスト／コード／Markdown 等をドロップすると添付チップとして文脈に追加され、画像をドロップするとサムネイル付きチップとして添付し、Cloud API（OpenAI / Anthropic / Gemini）・Ollama 等には Base64 画像として、CLI プロバイダーには画像パスとして送信します。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
