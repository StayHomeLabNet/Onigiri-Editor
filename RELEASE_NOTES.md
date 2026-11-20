Onigiri Editor `v1.3.2` significantly upgrades **Project Dev Server Controls & the Built-in Web Browser**, adding monorepo target/script selection, collapsible live server console logs, DevTools & keyboard shortcuts, a configurable Home button, port mismatch notifications, and instant LAN URL QR codes for mobile testing.

### Highlights (`v1.3.2`)
- **Monorepo Target & Startup Script Selection (`Target` / `Script`)**:
  - Multi-project workspaces (e.g. `gui/` Vite + `engine/` FastAPI, or `apps/*`) now list all detected subprojects in a compact **Target** dropdown, while multi-script projects let you pick the startup **Script** (`dev`, `preview`, `start`, `artisan-serve`, etc., with `vite preview` defaulting cleanly to port `4173`). Selected targets and scripts are remembered per workspace/project.
- **Collapsible Live Server Console Logs (`> Logs`)**:
  - Added a default-collapsed **`> Logs (N)`** toggle across the Sidebar, Built-in Web Browser, Web Page Preview, and Code Preview project bars so you can inspect live stdout/stderr output (including runtime errors and compile logs) anytime without leaving the editor.
- **Built-in Web Browser Home URL, DevTools (`F12`), Shortcuts & Recovery Banner**:
  - Added a **Home** button and quick **Browser Settings** shortcut to the Built-in Browser toolbar, linked to **Settings → AI & Browser → Built-in Browser Home URL (Initial Page)**.
  - Added a **DevTools (`F12`)** button enabled across both debug and release builds, keyboard shortcuts (`⌘L`/`Ctrl+L` to focus the URL bar, `F5`/`⌘R`/`Ctrl+R` to reload, `Alt+←`/`Alt+→` for Back/Forward, `F12` for DevTools), and a contextual **Server Stopped** banner with one-click **Restart Server** and **Go Home** actions.
- **Custom Dev Server Port Reliability & Mismatch Notification**:
  - Improved port argument handling across Next.js (`--port` vs `-p`), Storybook, Parcel, Webpack, Angular (`ng serve`), Vite, Laravel, PHP, Python, Hugo, MkDocs, Jekyll, and built-in static servers, and notifies via toast if the server started on a different port (e.g. auto-incremented) than requested.
- **LAN URL QR Code Popover Card**:
  - Added a **QR code button** beside each LAN URL chip (and in Settings LAN URL lists) to display a high-contrast QR code card that phones and tablets on the same Wi-Fi/LAN can scan instantly.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.2` では、**プロジェクト開発サーバー連携と内蔵 Web ブラウザ** を大幅に強化し、モノレポの起動ターゲット＆スクリプト選択、稼働中リアルタイムログ表示、DevTools＆ブラウザショートカット、ホームボタン／ホーム URL 設定、ポートずれ通知、スマホ実機確認用 QR コード表示を搭載しました。

### 主な変更点（`v1.3.2`）
- **モノレポ・複合プロジェクトの「起動ターゲット / スクリプト選択」UI**:
  - ルート配下に複数のサブプロジェクト（例: `gui/` と `engine/` 等）がある場合に切り替えられる **対象フォルダー（Target）** セレクトと、複数スクリプト（`dev` / `preview` / `start` / `artisan-serve` 等、`vite preview` の `4173` ポート対応含む）を切り替えられる **Script** セレクトを追加し、プロジェクトごとに記憶します。
- **サーバー稼働中の「リアルタイムログ（`> Logs`）」表示トグル**:
  - サイドバー、内蔵 Web ブラウザ、Web ページプレビュー、コードプレビューの各プロジェクトバーに、デフォルト折りたたみの **`> Logs (件数)`** ボタンを追加しました。稼働中のビルドエラーや実行時ログ（最新 80 行・末尾自動追従）をいつでも開閉して確認できます。
- **内蔵 Web ブラウザのホームボタン・DevTools（`F12`）・ショートカット・停止バナー**:
  - ツールバーに **ホームボタン** と **設定ショートカット** を追加し、**設定 → 連携・AI・ブラウザ → 内蔵ブラウザのホーム URL（初期表示）** で設定した URL へいつでも戻れるようにしました。
  - リリースビルドでも動作する **DevTools ボタン（`F12`）**、キーボードショートカット（ブラウザ内 `⌘L`/`Ctrl+L` で URL バー選択、`F5`/`⌘R`/`Ctrl+R` で再読み込み、`Alt+←`/`Alt+→` で戻る/進む、`F12` で DevTools）、および開発サーバー停止時の **「サーバー再起動／ホームを開く」案内バナー** を実装しました。
- **ポート指定の確実化 ＆ ポートずれ通知**:
  - Next.js（既存の `--port` / `-p` フラグ形式維持）、Storybook、Parcel、Webpack、Angular（`ng serve`）、Vite、Laravel、PHP、Python、Hugo、MkDocs、Jekyll、内蔵静的サーバーのポート引数を整備し、UI 指定ポートと異なるポートで起動した場合（自動インクリメント等）にトースト通知で知らせます。
- **LAN URL の QR コード表示**:
  - 展開した各 LAN URL チップの横（および設定画面の LAN URL 一覧）に **QR コードボタン** を追加し、同一 Wi-Fi / LAN 上のスマートフォン・タブレットのカメラから即座に読み取れる白背景・高コントラストの QR カードを表示できるようにしました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
