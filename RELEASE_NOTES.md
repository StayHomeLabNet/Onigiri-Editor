Onigiri Editor `v1.3.3` brings **Simultaneous Multi-Server Management for Monorepos**, **Live Server Log Error Highlighting & 1-Click AI Diagnostics**, **Smart LAN URL Virtual-NIC Filtering**, and **Built-in Web Browser Responsive Viewport Presets (`Full` / `Tablet 768px` / `Mobile 390px`) & Bookmarks / Recent URL History**.

### Highlights (`v1.3.3`)
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

Onigiri Editor `v1.3.3` では、**モノレポでの複数サーバー同時起動（フロント＋バックエンド並行稼働）**、**リアルタイムログのエラー自動ハイライト＆ワンクリック AI 原因解析**、**LAN URL の仮想 NIC 自動仕分け**、および **内蔵 Web ブラウザのレスポンシブ幅プレビュー（全幅 / タブレット `768px` / モバイル `390px`）＆ブックマーク・履歴機能** を追加しました。

### 主な変更点（`v1.3.3`）
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
