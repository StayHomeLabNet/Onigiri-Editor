Onigiri Editor `v1.3.4` delivers a **Redesigned Multi-Server UI** (compact single-row browser bar, per-server log filter tabs, Sidebar monorepo launcher list, persistent Status Bar server popover, and 1-click restart), **Built-in Browser Viewport Rotation & Screenshot-to-Markdown Capture**, and **Hardened Cross-Platform Auto-Update Security & Reliability** across macOS, Windows, and Linux.

### Highlights (`v1.3.4`)
- **Redesigned Multi-Server UI for Monorepos**:
  - **Compact Single-Row Browser Project Bar**: Consolidates active server tabs (`● web :5173 [×]`, `● api :3000 ⚠2 [×]`) into a single row with inline **`+ Add`** and **`⚙ Settings`** (`Target` / `Script` / `Port` / `LAN`) drawers so the embedded WebView keeps maximum viewport height.
  - **Per-Server Log Isolation & Error Badges**: Tracks stdout/stderr logs and error counts per running server in Rust, enabling **`[All / web / api]`** filter tabs inside **`> Logs`** for focused viewing, copying, per-server clearing, and 1-click **Ask AI** diagnosis—with error-count badges linked directly to each server pill.
  - **Sidebar Launcher List & Persistent Status Bar Indicator**: Multi-target workspaces render a per-row **Dev Servers** launcher list in the Sidebar (1-click Start, Open in Built-in Browser, **Restart `↻`**, Stop, plus **Start All / Stop All**), while a persistent **Status Bar** pill + popover lets you monitor, restart, or stop background servers from any tab.
  - **Port Conflict Auto-Retry (`EADDRINUSE`)**: Detects `EADDRINUSE` / `Address already in use` in server output and offers a 1-click **Retry on Free Port** banner.
- **Built-in Web Browser Rotation & Screenshot-to-Markdown**:
  - Added **Portrait / Landscape** orientation rotation for Tablet (`768px` ⇔ `1024×768`) and Mobile (`390px` ⇔ `844×390`) viewport previews.
  - Added a **Capture Screenshot** camera button that captures the active built-in browser pane, saves the PNG into `assets/`, and inserts it directly into the active Markdown document (supporting macOS `screencapture`, Windows Per-Monitor HiDPI-aware capture, and Linux Wayland `grim` / X11 `import` / `maim` / `scrot`).
- **Hardened Cross-Platform Auto-Update & UX Improvements**:
  - **Unsaved Changes Guard before Restart**: Prompts to **Save All & Update**, **Restart Without Saving**, or **Cancel** whenever dirty tabs exist before applying an update.
  - **SHA-256 Digest Verification, Domain Allowlist & Cancel Download**: Restricts update downloads to official GitHub Releases HTTPS hosts, verifies SHA-256 checksums while streaming (showing a **SHA-256 Verified** badge), and supports mid-download cancellation with `.part` cleanup.
  - **Rich Release Notes, ETag Caching & Apply on Next Quit**: Renders Markdown release notes cleanly in the Update Modal, caches checks with HTTP `If-None-Match` (`ETag`) and persists downloaded update state across restarts, and adds **Apply on Next Quit** mode.
  - **Safe Atomic Updates on macOS, Windows & Linux**: Implements rollback-safe atomic swaps for **macOS `.app`** and **Linux `.AppImage`** (preventing `ETXTBSY` and `single-instance` races), hidden delayed **Windows** installer launches (avoiding file-lock conflicts and handling spaces/special characters/non-ASCII paths), and OS-aware download folder resolution.
- **Windows / Linux Fixes & Codebase Modularization**:
  - Fixed macOS embedded browser DevTools (`open_devtools` / `close_devtools`) docking issue by forcing detached inspector windows and safely restoring child `WKWebView` bounds/hierarchy on close.
  - Fixed Windows external browser URL truncation when URLs contain `&` query parameters, normalized Windows drive-letter casing and `\\?\` prefixes for monorepo matching, removed version suffix from window title bar, and extracted `useAppUpdates` / `useProjectServer` hooks plus modularized `src-tauri/src/project/` into 7 focused files.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.4` では、**複数開発サーバー（モノレポ）UI の全面刷新**（内蔵ブラウザ上部バーの 1 行化・サーバー別ログタブ・サイドバーランチャーリスト・ステータスバー常駐ポップオーバー・1 クリック再起動）、**内蔵 Web ブラウザの縦横回転＆ページ撮影 → Markdown 自動挿入**、および **macOS / Windows / Linux 全 OS での自動更新の安全性・信頼性強化** を実装しました。

### 主な変更点（`v1.3.4`）
- **複数開発サーバー（モノレポ）UI の全面刷新**:
  - **内蔵ブラウザ上部バーの 1 行集約**: 稼働中サーバーのタブ切替（`● web :5173 [×]`、`● api :3000 ⚠2 [×]`）を 1 行に整理し、未起動ターゲットの **`＋ 追加`** および `対象` / `Script` / `Port` / `LAN` の **`⚙ 設定`** をインラインドロワーに格納してプレビュー領域を広く確保しました。
  - **サーバー別ログ分離 & エラーバッジ直結**: Rust バックエンドでサーバーごとのログとエラー件数を個別管理し、ログドロワーに **`[すべて / web / api]`** タブを追加。特定サーバーのログだけを閲覧・コピー・個別クリア・**AI で原因を解析** でき、エラー件数バッジも各サーバーピルに直結表示されます。
  - **サイドバー ランチャーリスト & ステータスバー常駐表示**: モノレポ検出時は左サイドバーを 1 行 1 サーバーのランチャーリスト（起動・内蔵ブラウザ表示・**再起動 `↻`**・停止、および **すべて起動 / すべて停止**）へ刷新し、サイドバーや内蔵ブラウザを閉じていても画面下部の **ステータスバー** から稼働状況の確認・再起動・停止を行えるようにしました。
  - **ポート競合（`EADDRINUSE`）の自動空きポート提案・再起動**: ポート競合エラーを検知するとログドロワー上部に **「空きポートで再起動」** バナーを表示し、空きポートを自動検出してワンクリック再起動できます。
- **内蔵 Web ブラウザの縦横回転 & ページ撮影 → Markdown 自動挿入**:
  - タブレット（`768px` ⇔ `1024×768`）・モバイル（`390px` ⇔ `844×390`）プレビュー時の **縦横回転（Portrait / Landscape）ボタン** を追加しました。
  - 表示中の内蔵ブラウザ領域を PNG 撮影して `assets/` へ保存し、編集中の Markdown へ自動挿入する **カメラボタン** を追加しました（macOS `screencapture` / Windows Per-Monitor HiDPI 対応 / Linux Wayland `grim`・X11 `import`・`maim`・`scrot` 対応）。
- **自動更新機能の安全性・UX 強化（macOS / Windows / Linux）**:
  - **再起動前の「未保存タブ保護ガード」**: 未保存タブがある状態で更新適用を実行すると確認カードを表示し、**「保存して更新＆再起動」「保存せず更新＆再起動」「キャンセル」** を選択できます。
  - **SHA-256 ダイジェスト検証・公式ドメイン制限・ダウンロード中断**: 公式 GitHub Releases の HTTPS ドメインのみ許可し、ダウンロード中に SHA-256 を検証（成功時は **SHA-256 検証済み** バッジ表示）。ダウンロード中のキャンセルと `.part` 一時ファイルの自動削除にも対応しました。
  - **リリースノートの Markdown リッチ表示・ETag キャッシュ・次回終了時に適用**: 更新モーダル内でリリースノートをサニタイズ済み Markdown として見やすく描画し、HTTP `If-None-Match`（`ETag`）キャッシュとダウンロード済み状態の永続化、および **「次回終了時に適用」** モードを追加しました。
  - **macOS / Windows / Linux それぞれの安全な適用処理**: **macOS `.app`** と **Linux `.AppImage`** でロールバック対応のアトミック置換（Linux の `ETXTBSY` および `single-instance` 競合回避）を実装し、**Windows** でもコンソール非表示の遅延 PowerShell 起動でファイルロック競合・日本語/特殊文字パス問題を解消しました。
- **Windows / Linux / macOS 互換性改善 & コードベース整理**:
  - macOS の内蔵ブラウザで開発者ツール（DevTools）を開閉した際に子 `WKWebView` が画面全幅へ広がり操作不能になる不具合を修正（常に独立ウィンドウで開き、閉鎖時の座標・ビュー階層を自動検証・復旧）。
  - Windows で `&` を含む外部 URL が途中で切れる不具合の修正、モノレポ判定でのドライブ大小文字・`\\?\` パス正規化、OS 準拠のダウンロードフォルダ解決、ウィンドウタイトルバーのバージョン表記整理、および `useAppUpdates` / `useProjectServer` フック抽出と Rust `src-tauri/src/project/` の 7 ファイル分割を行いました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
