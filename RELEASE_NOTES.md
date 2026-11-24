Onigiri Editor `v1.4.2` refines the writing and AI workflow with **Inline Character-Level Preview Selection Sync**, **Enhanced Cursor Block Highlights**, **Per-Button AI Model Selection (Subscription CLI / Cloud API / Local AI)**, **Local AI Empty-Response & Delimiter Fixes**, **Simple Mode Defaults**, a **One-Click Built-in Browser Close Button**, and **Production UI Hardening**.

### Highlights (`v1.4.2`)
- **Inline Selection Sync & Enhanced Cursor Block Highlight (Settings → Editor, on by default)**:
  - **Character-Level Selection Sync (`previewSelectionSyncHighlight`)**: Selecting text in the CodeMirror editor highlights the exact corresponding inline text in the live TipTap preview in real time using non-destructive ProseMirror decorations.
  - **Enhanced Cursor Block Highlight (`activeLineSyncHighlight`)**: Improves background contrast and left accent bar visibility across Light, Dark, Sepia, and Midnight themes when placing the cursor on headings (`H1`, `H2`, etc.) or plain text lines.
- **Per-Button AI Model Selection & Local AI Reliability (`AI Custom`)**:
  - **Per-Button / Submenu Provider & Model Override (`Settings → AI Custom`)**: Assign a specific **Subscription CLI** (`Codex CLI`, `Claude Code CLI`, `Gemini CLI`, `Antigravity CLI`, `Custom CLI`), **Cloud API** (`OpenAI`, `Anthropic`, `Gemini`), or **Local AI / On-Device** (`Ollama`, `LM Studio`, `OpenAI-Compat`, `Apple Foundation Models`) and model to each AI Custom button or submenu item (or follow the AI Chat panel by default), with automatic local/CLI model detection and custom model input.
  - **Local AI Reliability Fixes (LM Studio / Ollama / Apple Foundation Models)**: Reads live editor text directly (`getText()`), wraps appended input text in explicit `# 入力テキスト (Input Text)` + `<input_text>...</input_text>` delimiters so compact local models (such as Gemma 4) do not confuse short inputs with prompt instructions, strips `<think>...</think>` blocks, surfaces clear errors on reasoning-only empty responses, and prevents empty outputs from overwriting document content.
- **Simple Mode Defaults, Built-in Browser Close & Production UI Hardening**:
  - **Simple Mode Defaults**: Defaults **Hide top header bar in Simple mode** and **Show format toolbar in Simple mode** to ON for a distraction-free editor with immediate file & formatting controls.
  - **One-Click Built-in Browser Close (`✕`)**: Adds a close button right next to the **Web Browser** tab in the right-pane header to close the embedded WebView and switch back to Markdown preview.
  - **Header & Release UI Hardening**: Removes the redundant version badge from the top-left brand header, suppresses the browser default context menu (`Back`, `Refresh`, `Save as`, `Print`, `Inspect`) on non-editable app chrome in production builds, and disables DevTools/Inspect on the main application window in release builds (while keeping DevTools available inside the built-in Web Browser).

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.4.2` では、**プレビューの文字単位（インライン）選択同期**・**カーソル行ハイライト強化**・**AIカスタムごとの AI モデル個別選択（サブスク / API / ローカル）**・**ローカル AI 空応答対策**・**シンプルモード既定値変更**・**内蔵 Web ブラウザ閉じるボタン**・**本番 UI 保護** を行いました。

### 主な変更点（`v1.4.2`）
- **文字単位（インライン）選択同期＆カーソル行ハイライト強化（設定 → エディタで ON/OFF 可・既定 ON）**:
  - **文字単位の選択同期（`previewSelectionSyncHighlight`）**: エディタ上で選択した文字列に対応するプレビュー側のテキスト箇所を非破壊な ProseMirror Decoration としてリアルタイムにマーカーハイライトします。
  - **カーソル行・対応ブロックのハイライト視認性改善（`activeLineSyncHighlight`）**: `H1` / `H2` や通常テキスト行にカーソルを置いた際のプレビュー側背景ハイライトと左アクセント線を、ライト・ダーク・セピア・ミッドナイトの全テーマで見やすく調整しました。
- **AIカスタムごとの AI モデル個別選択＆ローカル AI 安定化（設定 → AIカスタム）**:
  - **ボタン／サブメニュー毎のモデル個別指定**: サブスクリプション CLI（Codex / Claude Code / Gemini / Antigravity / Custom CLI）・クラウド API（OpenAI / Anthropic / Gemini）・ローカル AI（Ollama / LM Studio / OpenAI-Compat / Apple Foundation Models）からボタンごとに使用するモデルを個別に選択可能になりました（未指定時は AIチャット選択に追従）。
  - **ローカル AI（LM Studio / Ollama / Apple Foundation Models）対策**: エディタ本文を直接取得した上で `# 入力テキスト (Input Text)` + `<input_text>...</input_text>` の区切りを付与し、Gemma 4 等の小規模モデルでも短い文を指示文と誤認しないよう修正。`<think>...</think>` の自動除去、思考のみ・空応答のエラー検出、および空結果による本文上書き防止ガードを追加しました。
- **シンプルモード既定値変更・内蔵 Web ブラウザ閉じるボタン・本番 UI 保護**:
  - **シンプルモード既定値**: 初期設定を「上部ヘッダーバーを非表示」「書式ツールバーを表示」に変更しました。
  - **内蔵 Web ブラウザの閉じる（`✕`）ボタン**: 右ペインヘッダーの「Webブラウザ」タブ横に `✕` ボタンを追加し、ワンクリックで内蔵 Web ブラウザを閉じてプレビュー表示に戻れるようにしました。
  - **ヘッダー＆リリースビルド UI 保護**: 左上ブランド横のバージョン表記を削除し、本番ビルドにおける UI 上のブラウザ標準右クリックメニュー（戻る／更新／名前を付けて保存／印刷／Inspect）および本体ウィンドウの DevTools（Inspect）を無効化しました（内蔵 Web ブラウザ内の DevTools は引き続き利用可能）。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
