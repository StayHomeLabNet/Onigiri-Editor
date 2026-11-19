Onigiri Editor `v1.3.1` introduces **Project Dev Server LAN Access & One-Click URL Sharing**, making it effortless to preview local web development projects on phones, tablets, or other computers on the same Wi-Fi/LAN.

### Highlights (`v1.3.1`)
- **Project Dev Server LAN Access (`LAN: ON / OFF`)**:
  - Added a quick **`LAN: ON / OFF`** toggle button across the **Sidebar** project panel, **Built-in Web Browser**, **Web Page Preview**, and **Code Preview** toolbars, as well as **Settings → AI & Browser → Allow LAN access to Project Dev Server** (`projectServerAllowLan`).
  - Automatically binds project dev servers to `0.0.0.0` when LAN access is enabled across built-in static servers, **PHP** (`-S 0.0.0.0:8000`), **Laravel** (`php artisan serve --host=0.0.0.0`), **Python** (**Django**, **Streamlit**, **FastAPI/uvicorn**, **Flask**), **Hugo**, **MkDocs**, and **Node.js** frameworks (**Vite**, **VitePress**, **SvelteKit**, **Astro**, **Nuxt**, **Docusaurus** `--host 0.0.0.0`, **Next.js** `-H 0.0.0.0`, respecting scripts that already declare host flags).
  - Toggling LAN access while a managed server is running automatically restarts it with the updated bind address.
- **One-Click LAN URL Copy Chips & External Server Probe**:
  - Automatically detects local LAN IPv4 addresses (plus any LAN URLs printed by the dev server) and displays clickable **`LAN: <ip>:<port>/`** copy chips right in the UI.
  - When attaching to an externally launched dev server, Onigiri Editor probes whether it is reachable over LAN and displays an actionable hint if it is bound to `localhost` only.

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
- **LAN URL ワンクリックコピーチップ＆外部起動サーバーの疎通判定**:
  - ローカルネットワークの IPv4 アドレス（およびサーバー出力中の LAN URL）を自動検出し、クリックするだけでクリップボードへコピーできる **`LAN: <IP>:<port>/`** チップを表示します。
  - Onigiri Editor 外部で既に起動している開発サーバーへ接続した場合も LAN 疎通を自動確認し、`localhost` 専用バインドで外部から接続できない場合は分かりやすい案内ヒントを表示します。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
