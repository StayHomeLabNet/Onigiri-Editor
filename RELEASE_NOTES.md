Onigiri Editor v1.0.0 marks the first major cross-platform release for macOS, Windows, and Linux—combining fast Markdown & code editing, bidirectional live preview, AI assistant & diff preview, project dev-server integration, and automatic OS language detection.

### Highlights
- **Official Rebrand to Onigiri Editor (`v1.0.0`)**: Updated branding, cross-platform app icons, and repository (`StayHomeLabNet/Onigiri-Editor`).
- **OS-Aware First-Launch Language**: Automatically launches in Japanese UI + native Japanese menu bar when the OS is Japanese, and English for all other OS locales.
- **3 UI Modes (`⌘\` / `Ctrl+\`)**: Switch effortlessly between **Simple** (minimal single-pane), **Basic** (bidirectional preview & AI), and **Advanced** (tabs, workspace explorer, snapshots & dev tools).
- **Session Restore, Draft Recovery & Auto-Save**: Preserves open tabs, unsaved drafts, cursor positions, and workspace state across restarts, with optional 1.5s auto-save for file-backed tabs.
- **External File Change Detection**: Watches open files modified or deleted outside the editor (or by AI CLIs), auto-reloading clean tabs or displaying a conflict resolution banner (`Reload`, `Compare Diff`, `Keep Mine`, `Save Again`, `Keep as Draft`).
- **AI Pre-Apply Diff Preview Modal**: Review line-by-line diffs before replacing the active document (with optional automatic snapshot backup) or writing files into the workspace folder.
- **AI Connection Assistant & Model Picker**: Guided setup, login, and model selection for Codex CLI, Claude Code CLI, Gemini CLI, Antigravity CLI, OpenAI / Anthropic / Gemini APIs, Ollama, and LM Studio.
- **Project Dev Server Diagnostics & Dual Browser Preview**: Auto-detects Vite, Next.js, Laravel, WordPress, Docker Compose, Python, and static sites, alongside a native embedded WebView browser and external HTTP live preview.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor v1.0.0 は、macOS・Windows・Linux に対応した最初のメジャーリリースです。軽快な Markdown・コード編集、双方向ライブプレビュー、AI アシスタント＆適用前 Diff プレビュー、開発サーバー連携、初回起動時の OS 言語自動判定を 1 つのデスクトップアプリに統合しました。

### 主なポイント
- **「Onigiri Editor」への名称刷新（`v1.0.0`）**: アプリ名・アプリアイコン・リポジトリ（`StayHomeLabNet/Onigiri-Editor`）を刷新しました。
- **初回起動時の OS 言語自動判定**: OS の言語設定が日本語の場合は日本語 UI・日本語ネイティブメニューで起動し、その他の言語環境では英語 UI・英語メニューで起動します。
- **3つの UI モード（`⌘\` / `Ctrl+\`）**: 極小単一ペインの **シンプル**、双方向プレビュー＆AI 付きの **標準**、マルチタブ・フォルダ探索・開発連携を備えた **拡張** モードをワンキーで切り替えられます。
- **セッション復元・未保存ドラフト保護・自動保存**: 開いていたタブ・下書き・カーソル位置・ワークスペース状態を次回起動時に復元でき、ファイル紐付きタブの自動保存（1.5秒）にも対応しました。
- **外部ファイル変更検知**: 外部エディタや AI CLI による更新・削除を検知し、未編集タブは自動反映、未保存編集がある場合は **再読み込み** / **差分を比較** / **自分の編集を維持** などの解決バナーを表示します。
- **AI 適用前 Diff プレビューモーダル**: 「本文を置換」（適用前スナップショット保存オプション付き）や「フォルダーへ書き込み」の実行前に、行単位で変更差分を確認できます。
- **AI CLI 接続サポート＆モデル選択**: Codex CLI / Claude Code CLI / Gemini CLI / Antigravity CLI / OpenAI・Anthropic・Gemini API / Ollama / LM Studio に対応し、導入・ログイン支援を備えています。
- **開発サーバー診断＆2パターンのブラウザプレビュー**: Vite / Next.js / Laravel / WordPress / Docker / Python / 静的サイト等の自動検出と環境診断、内蔵マルチ WebView ブラウザ＆外部ライブプレビューを利用できます。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
