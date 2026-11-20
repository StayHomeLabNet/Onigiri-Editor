Onigiri Editor `v1.3.1` introduces **Project Dev Server LAN Access & One-Click URL Sharing**, making it effortless to preview local web development projects on phones, tablets, or other computers on the same Wi-Fi/LAN.

### Highlights (`v1.3.1`)
- **Project Dev Server LAN Access (`LAN: ON / OFF`)**:
  - Added a quick **`LAN: ON / OFF`** toggle button across the **Sidebar** project panel, **Built-in Web Browser**, **Web Page Preview**, and **Code Preview** toolbars, as well as **Settings → AI & Browser → Allow LAN access to Project Dev Server** (`projectServerAllowLan`).
  - Automatically binds project dev servers to `0.0.0.0` when LAN access is enabled across built-in static servers, **PHP** (`-S 0.0.0.0:8000`), **Laravel** (`php artisan serve --host=0.0.0.0`), **Python** (**Django**, **Streamlit**, **FastAPI/uvicorn**, **Flask**), **Hugo**, **MkDocs**, and **Node.js** frameworks (**Vite**, **VitePress**, **SvelteKit**, **Astro**, **Nuxt**, **Docusaurus** `--host 0.0.0.0`, **Next.js** `-H 0.0.0.0`, respecting scripts that already declare host flags).
  - Toggling LAN access while a managed server is running automatically restarts it with the updated bind address.
- **One-Click LAN URL Copy Chips & External Server Probe (Collapsed by Default)**:
  - Automatically detects local LAN IPv4 addresses (plus any LAN URLs printed by the dev server) and displays a compact collapsible toggle (collapsed by default) with clickable **`LAN: <ip>:<port>/`** copy chips right in the UI.
  - When attaching to an externally launched dev server, Onigiri Editor probes whether it is reachable over LAN and displays an actionable hint if it is bound to `localhost` only.
- **Custom Dev Server Port Input & Built-in Browser Home Button**:
  - Added a **`Port`** input field to the Sidebar, Built-in Web Browser, Web Page Preview, and Code Preview project controls so you can specify a custom port (`1–65535`) before starting the dev server (remembered per project folder; blank uses the auto-detected default).
  - Added a **Home** button and quick **Browser Settings** shortcut to the Built-in Web Browser toolbar, linked to **Settings → Integrations → Built-in Browser Home URL**.
- **Windows & Laravel Reliability Fixes**:
  - Fixed Windows `npm.cmd` / `pnpm.cmd` shim resolution and non-ASCII/Shift-JIS output decoding, auto-enabled missing Windows PHP extensions (e.g. `pdo_sqlite` for Laravel), and added `--no-reload` for `artisan serve` when custom PHP INI scanning is active.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.1` では、**プロジェクト開発サーバーの LAN 公開（同一 Wi-Fi / ローカルネットワーク上の別デバイスからのアクセス）＆ LAN URL ワンクリックコピー** を搭載し、開発中の Web アプリを手元のスマホ・タブレット・別 PC からすぐに実機確認できるようになりました。

### 主な変更点（`v1.3.1`）
- **プロジェクト開発サーバーの LAN 公開設定（`LAN: ON / OFF`）**:
  - 左サイドバーのプロジェクト操作欄、内蔵 Web ブラウザ、Web ページプレビュー、コードプレビューの各ヘッダーに **`LAN: ON / OFF`** クイック切替ボタンを追加し、**設定 → AI・ブラウザ → プロジェクト開発サーバーへの LAN アクセスを許可**（`projectServerAllowLan`）からも設定できるようにしました。
  - LAN 公開がオンの状態で開発サーバーを起動すると、内蔵静的サーバー、**PHP**（`-S 0.0.0.0:8000`）、**Laravel**（`php artisan serve --host=0.0.0.0`）、**Python**（**Django** / **Streamlit** / **FastAPI (uvicorn)** / **Flask**）、**Hugo**、**MkDocs**、**Node.js** フレームワーク（**Vite** / **VitePress** / **SvelteKit** / **Astro** / **Nuxt** / **Docusaurus** へ `--host 0.0.0.0`、**Next.js** へ `-H 0.0.0.0` を自動付与。既存のホスト指定がある場合は尊重）を `0.0.0.0` バインドで起動します。
  - サーバー稼働中に `LAN: ON / OFF` を切り替えると、新しいバインド設定で自動的に再起動します。
- **LAN URL ワンクリックコピーチップ＆外部起動サーバーの疎通判定（デフォルト折りたたみ）**:
  - ローカルネットワークの IPv4 アドレス（およびサーバー出力中の LAN URL）を自動検出し、デフォルトで折りたたまれたトグルから **`LAN: <IP>:<port>/`** チップを展開してワンクリックでコピーできます。
  - Onigiri Editor 外部で既に起動している開発サーバーへ接続した場合も LAN 疎通を自動確認し、`localhost` 専用バインドで外部から接続できない場合は分かりやすい案内ヒントを表示します。
- **開発サーバーのポート番号指定 UI ＆ 内蔵 Web ブラウザのホームボタン**:
  - サイドバー、内蔵 Web ブラウザ、Web ページプレビュー、コードプレビューの開発サーバー操作欄に **`Port`** 入力欄を追加し、起動前にポート番号（`1〜65535`）を指定できるようにしました（プロジェクトごとに記憶、空欄時は自動検出ポートを使用）。
  - 内蔵 Web ブラウザのツールバーに **ホームボタン** と **設定ショートカット** を追加し、**設定 → 連携・AI・ブラウザ → 内蔵ブラウザのホーム URL（初期表示）** で設定した URL へすぐ戻れるようにしました。
- **Windows / Laravel の安定性改善**:
  - Windows 環境での `npm.cmd` / `pnpm.cmd` シム解決と日本語パス・Shift-JIS 出力の文字化けを修正し、Laravel 等で不足しやすい PHP 拡張（`pdo_sqlite` 等）の自動有効化や `artisan serve --no-reload` 対応を行いました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
