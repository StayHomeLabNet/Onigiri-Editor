Onigiri Editor `v1.4.1` delivers 6 major writing & reliability upgrades—**Auto Snapshot Timeline & Partial Chunk Restore**, **Markdown Compatibility Check**, **Image Auto-Optimization & Size Inventory**, **AI Send Content Preview & Secret Redaction**, **Feature Finder Guide (`?`)**, and **Built-in Browser UX enhancements**—alongside cross-platform fixes for macOS/Windows/Linux and a comprehensive **security hardening** pass.

### Highlights (`v1.4.1`)
- **Auto Snapshot Timeline & Partial Chunk Restore (Configurable in Settings → General)**:
  - Automatically captures document snapshots on save and at configurable intervals. Review the timeline in **Inspector → Snapshots** and restore either the entire document or individual changed chunks.
- **Markdown Compatibility Check (GitHub / Zenn / Qiita / Notion / Obsidian)**:
  - Open **Inspector → Compat** to diagnose dialect-specific syntax warnings (Callouts, WikiLinks, KaTeX, Footnotes, Mermaid, HTML) with 1-click jump to line.
- **Image Auto-Optimization & Workspace Image Size Inventory (Configurable in Settings → Editor)**:
  - Automatically resizes and compresses pasted raster images (WebP on Windows WebView2; JPEG/PNG fallback on macOS WKWebView & Linux WebKitGTK), supports organized filenames and optional `originals/` backups, and adds an **All Images Size Inventory** tab inside the Unused Images modal.
- **AI Send Content Preview & Secret Redaction (Configurable in Settings → AI)**:
  - Inspect exact outgoing text before sending to external AI providers, with automatic detection and 1-click redaction of API keys, Bearer tokens, private keys, emails, and secrets.
- **Feature Finder Guide (`?`)**:
  - Click `?` in the TopBar or open **Feature Finder** from the Command Palette to search any Onigiri Editor capability in English or Japanese and launch it directly.
- **Built-in Browser UX & Cross-Platform Fixes (macOS / Windows / Linux)**:
  - Adds custom viewport width (`px` input), 1-click **Clip Page to Markdown**, an inline `⋮` action strip & upward toolbar tooltips immune to native child WebView occlusion across all 3 OSes, and **Resync Browser Bounds**.
  - **Windows Integrated Terminal**: Adds Shift_JIS / CP932 output decoding fallback so Japanese `cmd /C` output never truncates, `cd ~\` support, and `taskkill /T /F` process-tree cancellation.
  - **Global Hotkey**: Displays a toast notification when shortcut registration fails (e.g., Linux Wayland or shortcut conflict).
- **Comprehensive Security Hardening**:
  - Enforces Mermaid `securityLevel: 'strict'` + defense-in-depth SVG sanitization in Preview and Live Preview to eliminate Stored XSS risk.
  - Restricts `apply_downloaded_app_update` / `schedule_app_update_on_exit` to canonical installer files inside the official Downloads directory, and validates every redirect hop in `download_app_update` against the official GitHub Releases allowlist.
  - Enforces URL scheme allowlists on built-in browser navigation and external browser launch (`http`/`https` only).
  - Hardens Web Clipper (`fetch_url_content`) against link-local / cloud metadata SSRF across initial requests and redirects.
  - Neutralizes `</style>` breakout in Live Preview custom CSS, adds `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`, and tightens Tauri CSP (`object-src 'none'; base-uri 'self'; form-action 'self'`).

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.4.1` では、**自動スナップショット＆部分復元**・**Markdown 互換性チェック**・**画像自動最適化＆全画像サイズ一覧**・**AI 送信内容プレビュー＆機密情報マスキング**・**機能検索ガイド（`?`）**・**内蔵ブラウザ UX 強化** に加え、macOS / Windows / Linux 向けのクロスプラットフォーム不具合修正と **包括的なセキュリティ強化** を行いました。

### 主な変更点（`v1.4.1`）
- **自動スナップショット・タイムライン＆部分チャンク復元（設定 → 一般で ON/OFF 可）**:
  - 保存時および一定間隔でスナップショットを自動保存。**インスペクター → スナップショット** から全体復元だけでなく **変更チャンク単位の部分復元** が可能になりました。
- **Markdown 互換性チェック（GitHub / Zenn / Qiita / Notion / Obsidian）**:
  - **インスペクター → 互換性** タブで各プラットフォーム固有の構文差異・注意箇所を診断し、ワンクリックで該当行へジャンプできます。
- **画像の自動最適化＆ワークスペース全画像サイズ一覧（設定 → エディタで ON/OFF 可）**:
  - 貼り付け画像を自動リサイズ・圧縮（Windows は WebP、macOS WKWebView / Linux WebKitGTK は JPEG・PNG フォールバック対応）。整理ファイル名生成や任意での `originals/` 元画像保存に対応し、未使用画像モーダルに **全画像サイズ一覧** タブを追加しました。
- **AI 送信内容プレビュー＆機密情報（シークレット）自動マスキング（設定 → AI で ON/OFF 可）**:
  - 外部 AI 送信前に送信テキストを確認でき、API キー・Bearer トークン・秘密鍵・メールアドレス等を自動検出してワンクリックで伏せ字化できます。
- **機能検索ガイド（`?`）**:
  - ヘッダー右上の `?` ボタンまたはコマンドパレットから、やりたいことを日本語／英語で検索して該当機能を直接起動できます。
- **内蔵ブラウザ UX 強化＆macOS / Windows / Linux クロスプラットフォーム修正**:
  - 数値指定のカスタム幅 (`px`)、ワンクリック **Markdown クリップ**、全 OS でネイティブ子 WebView に隠れないインライン `⋮` 操作帯＆上方向ツールチップ、**表示位置再同期（修復）** を追加しました。
  - **Windows 統合ターミナル**: Shift_JIS / CP932 デコードフォールバックにより日本語 `cmd /C` 出力の途中打ち切りを解消し、`cd ~\` 対応および `taskkill /T /F` によるプロセスツリー強制停止を実装しました。
  - **グローバルホットキー**: Linux Wayland やキー競合等で登録に失敗した際、トースト通知で理由を表示するようにしました。
- **包括的なセキュリティ強化**:
  - Mermaid プレビューを `securityLevel: 'strict'` へ変更し、多層防御の SVG サニタイザを追加して Stored XSS リスクを解消しました。
  - アップデータ適用時に公式ダウンロードフォルダ配下の正規インストーラファイルであることを検証し、ダウンロード時のリダイレクト先も毎回公式 GitHub 許可リストで検証するようにしました。
  - 内蔵ブラウザのナビゲーションおよび外部ブラウザ起動の許可 URL スキームを厳格化（外部起動は `http`/`https` 限定）しました。
  - Web クリッパー（`fetch_url_content`）でリンクローカル／クラウドメタデータ IP への SSRF を初回・リダイレクト先ともに遮断しました。
  - 外部ライブプレビューのカスタム CSS での `</style>` ブレイクアウト防止、`X-Content-Type-Options: nosniff`・`Referrer-Policy: no-referrer` 付与、および Tauri CSP 強化（`object-src 'none'; base-uri 'self'; form-action 'self'`）を実施しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
