Onigiri Editor `v1.3.3` brings **In-App Auto-Update, Background Update Check Intervals & Rich Update Actions**, **Simultaneous Multi-Server Management for Monorepos**, **Live Server Log Error Highlighting & 1-Click AI Diagnostics**, **Smart LAN URL Virtual-NIC Filtering**, and **Built-in Web Browser Responsive Viewport Presets (`Full` / `Tablet 768px` / `Mobile 390px`) & Bookmarks / Recent URL History**.

### Highlights (`v1.3.3`)
- **In-App Auto-Update, Background Periodic Update Checks & Rich Update Actions**:
  - **One-Click Auto-Update & In-App Installer Download**: Stream release packages directly inside Onigiri Editor with a live progress bar (`%` and `MB / MB`), automatically replacing the macOS `.app` bundle and restarting (or launching the downloaded `.dmg` / Windows `.exe` / `.msi` / Linux `.AppImage` / `.deb` installer and revealing it in Finder / Explorer).
  - **In-App Update Details & Release Notes Modal**: Inspect version comparisons, last-checked timestamps, full Markdown release notes, and all cross-platform binaries with 1-click **Open Release Notes in Editor Tab**, **Open in Built-in Browser**, **Copy Download URL**, **Remind Later**, and **Skip `vX.Y.Z`** (plus clickable update badges in the TopBar and Status Bar).
  - **Configurable Auto-Check & Auto-Update Settings**: Added toggles in **Settings → General & View** (and Inspector quick settings) for **Automatic Update Checking** (`On Startup Only`, `Every 1h`, `6h`, `12h`, `24h`), **Enable Auto-Update** (background auto-download), and **Action When an Update Is Available** (`Banner & Badge`, `Auto-Open Update Dialog`, `Subtle Badge Only`, or `Auto-Download & Notify`).
- **Simultaneous Multi-Server Management in Monorepos (Frontend + Backend)**:
  - Starting a second target in the same monorepo workspace (for example, launching `engine/` FastAPI or Python backend while `gui/` Vite frontend is already running) now keeps the existing sibling server alive in the background (`extra_servers`) instead of stopping it.
  - Both targets stream live stdout/stderr output (prefixed with `[target]`) into the console logs drawer, appear as green running pills (`● gui :5173 [×]`, `● engine :8000 [×]`) in the project bar for instant URL switching or per-target stopping, and generic Python backend folders (`requirements.txt` / `pyproject.toml` + `server.py` / `api.py` / `main.py` / `app.py`) are now auto-discovered as runnable targets.
- **Live Server Logs: Copy, Clear, Auto Error Highlighting & 1-Click "Ask AI"**:
  - Added a toolbar inside the **`> Logs (N)`** drawer with **Copy**, **Clear**, and **Ask AI** buttons.
  - Error lines (`Error`, `Exception`, `Traceback`, `SyntaxError`, `Failed to compile`, `EADDRINUSE`, etc.) and warnings are automatically highlighted with an error-count badge on the **`> Logs`** toggle, and clicking **Ask AI** opens the AI Chat drawer and sends the recent log output for immediate diagnosis.
- **Smart LAN URL Filtering (Physical LAN Priority & Virtual NIC Collapse)**:
  - Automatically separates physical Wi-Fi / Ethernet LAN URLs from virtual or secondary adapters (`VirtualBox Host-Only 192.168.56.x`, `Docker / WSL / Hyper-V 172.16–31.x.x`, `Tailscale / CGNAT 100.64.0.0/10`, `libvirt 192.168.122.x`), displaying primary LAN URLs first and collapsing virtual/other IPs behind a **`+N virtual/other`** toggle.
- **Built-in Web Browser Responsive Viewports & Bookmarks / History Bar**:
  - Added **Full Width**, **Tablet (`768px`)**, and **Mobile (`390px`)** viewport switcher buttons to the Built-in Web Browser toolbar (centering both the native Tauri child WebView and the web fallback frame).
  - Added a **★ Bookmark** button in the address bar and a **Bookmarks & Recent URLs** bar/drawer rendered cleanly above the native WebView host for one-click navigation to pinned or recently visited URLs.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.3` では、**アプリ内自動更新・バックグラウンド定期確認・更新検出時アクションの拡充**、**モノレポでの複数サーバー同時起動（フロント＋バックエンド並行稼働）**、**リアルタイムログのエラー自動ハイライト＆ワンクリック AI 原因解析**、**LAN URL の仮想 NIC 自動仕分け**、および **内蔵 Web ブラウザのレスポンシブ幅プレビュー（全幅 / タブレット `768px` / モバイル `390px`）＆ブックマーク・履歴機能** を追加しました。

### 主な変更点（`v1.3.3`）
- **アプリ内自動更新・更新状況の自動確認＆更新アクションの大幅拡充**:
  - **ワンクリック「今すぐ自動更新」＆インストーラー保存**: 外部ブラウザを開かずにアプリ内で更新パッケージをダウンロード（`%`・MB 進捗バー表示）し、macOS `.app` バンドルの自動置換＆再起動（または `.dmg` / Windows `.exe` / `.msi` / Linux `.AppImage` / `.deb` インストーラーの起動・Finder / Explorer でのフォルダ表示）を行えます。
  - **アプリ内「アップデートと更新内容」モーダル**: バージョン比較・最終確認時刻・リリースノート全文の閲覧に加え、**「新規タブでリリースノートを開く」**・**「内蔵ブラウザで開く」**・**「全 OS 向け配布バイナリ一覧＆URLコピー」**・**「後で通知」**・**「このバージョン (`vX.Y.Z`) をスキップ」**、およびヘッダー・ステータスバーの更新バッジ表示に対応しました。
  - **自動確認・自動更新の設定**: **設定 → 全般・表示**（および右インスペクター設定・更新モーダル下部）から、**更新状況の自動確認 ON/OFF**、**自動確認間隔（起動時のみ / 1時間 / 6時間 / 12時間 / 24時間ごと）**、**自動更新（バックグラウンド自動ダウンロード）ON/OFF**、および **新しい更新が利用可能な場合の動作（バナー通知 / 更新画面を自動で開く / 控えめバッジのみ / 自動ダウンロードして準備完了通知）** を変更できます。
- **モノレポでの「フロントエンド＋バックエンド同時起動（マルチサーバー管理）」**:
  - 同一モノレポ内の別ターゲット（例: `gui/` の Vite フロントエンド稼働中に `engine/` の FastAPI / Python バックエンドを追加起動）を起動した際、先に動いていたサーバーを止めずにバックグラウンド管理（`extra_servers`）へ移行して同時稼働できるようにしました。
  - 稼働中の各ターゲットはプロジェクトバーに緑色のピルバッジ（`● gui :5173 [×]`、`● engine :8000 [×]`）として並び、クリックで URL 切替・`×` で個別停止が可能です。バックグラウンド側の出力も `[ターゲット名]` 付きでリアルタイムログへ統合され、汎用 Python スクリプト構成（`requirements.txt` / `pyproject.toml` + `server.py` / `api.py` / `main.py` 等）も起動ターゲットとして自動検出します。
- **リアルタイムログ（`> Logs`）の「コピー・クリア・エラー自動ハイライト＆AI解析」**:
  - `> Logs (件数)` ドロワー上部に **「コピー」**・**「クリア」**・**「AIで原因を解析」** ツールバーを追加しました。
  - `Error` / `Exception` / `Traceback` / `SyntaxError` / `Failed to compile` / `EADDRINUSE` 等のエラー行を赤色、警告行を黄色で自動ハイライトしてエラー件数バッジを表示し、**「AIで原因を解析」** を押すとワンクリックで AI チャットを開いてエラー原因と解決手順を質問できます。
- **`LAN URL` のネットワークインターフェース絞り込み（仮想 NIC の除外・優先表示）**:
  - 物理 Wi-Fi / 有線 LAN の IP アドレスを最優先で表示し、VirtualBox Host-Only（`192.168.56.x`）・WSL / Docker / Hyper-V（`172.16-31.x.x`）・Tailscale / CGNAT（`100.64.0.0/10`）などの仮想・セカンダリ IP を **`+N 仮想・その他`** トグル内に自動で折りたたむようにしました。
- **内蔵 Web ブラウザの「レスポンシブ幅プレビュー」＆「ブックマーク / 履歴バー」**:
  - ツールバーに **全幅 / タブレット (`768px`) / モバイル (`390px`)** のビューポート幅切替ボタンを追加し、Tauri ネイティブの子 WebView（および Web フォールバック）を中央揃えで実機幅プレビューできるようにしました。
  - URL 入力欄右端の **★ ボタン** でよく使う URL をピン留めでき、ツールバー直下のブックマーク＆履歴バーからいつでもワンクリックで遷移できます。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
