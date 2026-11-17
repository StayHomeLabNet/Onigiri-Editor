Onigiri Editor `v1.0.5` introduces a collapsible workspace folder tree with an in-app image gallery viewer, Format Toolbar edit & display-zoom controls (`25%`–`400%`) with a clickable Status Bar zoom popover, real-time AI CLI streaming with cancellation & folder-permission controls, a Folder Switch Guard modal for active dev servers, window geometry persistence, and the bilingual User Manual.

### Highlights (`v1.0.5`)
- **Format Toolbar Edit & Zoom Controls + Status Bar Zoom Popover (`25%`–`400%`)**:
  - Added **Select All**, **Copy**, **Paste**, **Zoom Out**, and **Zoom In** buttons to the Format Toolbar across all UI modes and both CodeMirror and TipTap Visual panes.
  - Added a clickable zoom percentage readout (`100%`) to the Status Bar with a numeric popover (`25%`–`400%` input, `−`/`+` 10% steppers, `50%`–`200%` presets, and `100%` reset), plus `⌘+` / `⌘-` / `⌘0` (`Ctrl+` / `Ctrl-` / `Ctrl0`) shortcuts and Command Palette commands—scaling the editor, column ruler, visual preview, and code preview together.
- **Collapsible Workspace Folder Tree & Image Gallery Viewer**:
  - Replaced the flat workspace file list with a hierarchical **collapsible folder tree** featuring **Collapse All**, file/folder icons, automatic refresh on window focus and AI CLI completion, and workspace image detection (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.avif`).
  - Added an in-app **Image Gallery Preview Modal** with Next/Previous navigation and one-click insertion into Markdown.
- **AI CLI Live Streaming, Cancellation & Folder Permission Pill**:
  - Streams live progress events from AI CLIs (including Codex JSONL events), adds a **Stop** button to cancel running AI requests cleanly, adjusts timeouts (`420s` idle / `1800s` max) for long tasks, and adds an interactive **Folder Access** pill (`Disabled` / `Read-Only` / `Approve` / `CLI Direct Write`) directly in the AI Chat panel.
- **Folder Switch Guard Modal & Native Dialog Fixes**:
  - Shows a confirmation modal (**Stop & Switch** / **Disconnect & Switch**) when switching folders while a dev server or setup task is running.
  - Temporarily hides the embedded child WebView before opening OS file/folder dialogs so dialogs stay in front, and runs `scan_workspace`, `search_workspace`, and `read_workspace_context` asynchronously via `spawn_blocking` with expanded skip-directory filtering.
- **Window State Persistence, Bilingual Manual & macOS Help Menu Cleanup**:
  - Saves and restores main window position, size, and maximized state cleanly within visible monitors on startup.
  - Adds a comprehensive English & Japanese User Manual (`doc/README.md` / `doc/README.ja.md`) opened in your active UI language via **Help → Online Manual**, and removes the duplicate `Settings…` entry from the macOS `Help` menu.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.5` では、折りたたみ対応のフォルダツリー＆ワークスペース画像ギャラリー表示、書式ツールバーの編集／拡大縮小ボタンとステータスバーの表示倍率ポップオーバー（`25%`〜`400%`）、AI CLI のリアルタイム進捗表示・中断ボタン・フォルダ権限切り替えピル、開発サーバー起動中のフォルダ切り替え確認モーダル、ウィンドウ位置・サイズ復元、および日英ユーザーマニュアルを追加しました。

### 主な変更点（`v1.0.5`）
- **書式ツールバーの編集／拡大縮小ボタン＆ステータスバー表示倍率（`25%`〜`400%`）**:
  - 書式ツールバーに **全選択**・**コピー**・**ペースト**・**縮小**・**拡大** ボタンを追加しました（全 UI モード、および CodeMirror エディタ／TipTap ビジュアルプレビューの両方に対応）。
  - 下部ステータスバーにクリック可能な **`100%`** 表示を追加し、数値直接入力（`25%`〜`400%`）・`−`/`+`（10% 刻み）・プリセット（`50%`〜`200%`）・`100%` リセットが行えるポップオーバーと `⌘+` / `⌘-` / `⌘0`（`Ctrl+` / `Ctrl-` / `Ctrl0`）ショートカットを実装しました（エディタ・ルーラ・プレビュー・コードプレビューが連動して拡大縮小します）。
- **折りたたみ可能なフォルダツリー＆ワークスペース画像プレビュー**:
  - 左サイドバーのファイル一覧を階層構造の **折りたたみ対応フォルダツリー** へ刷新し、**すべて折りたたむ** ボタン、ファイル種別アイコン、フォーカス復帰時・AI CLI 完了時の自動更新、画像ファイル（`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.avif`）の一覧表示に対応しました。
  - ワークスペース内の画像をアプリ内で閲覧（前へ／次へ移動）してそのまま Markdown へ挿入できる **画像ギャラリーモーダル** を追加しました。
- **AI CLI リアルタイム進捗表示・中断＆フォルダ連携権限ピル**:
  - Codex CLI（JSONL イベント等）を含む AI CLI の処理経過をリアルタイム表示し、実行中に停止できる **中断ボタン** と長時間タスク向けのタイムアウト調整（アイドル `420秒` / 最大 `1800秒`）を追加しました。
  - AI チャットパネル上から **フォルダ連携権限**（`無効` / `読み込みのみ` / `提案→適用可` / `CLI直接書き込み許可`）をワンクリックで切り替えられるピルを追加しました。
- **フォルダ切り替え保護モーダル＆ネイティブダイアログ前面表示修正**:
  - 開発サーバー稼働中やセットアップ実行中に別フォルダへ切り替えようとした際、**サーバーを停止して切り替え** / **接続を解除して切り替え** を選べる確認モーダルを表示するようにしました。
  - OS のファイル／フォルダ選択ダイアログを開く前に内蔵 WebView を一時退避してダイアログが背面に隠れる問題を解消し、ワークスペース走査・検索・コンテキスト読込を `spawn_blocking` で非同期化しました。
- **ウィンドウ状態復元・日英ユーザーマニュアル＆macOS ヘルプメニュー整理**:
  - アプリ終了時のウィンドウ位置・サイズ・最大化状態を記憶し、次回起動時に接続中モニター範囲内に安全に復元します。
  - 現在の UI 言語に合わせて開く日英ユーザーマニュアル（`doc/README.ja.md` / `doc/README.md`）を整備し、macOS の「ヘルプ」メニューに重複表示されていた `設定…` を整理しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
