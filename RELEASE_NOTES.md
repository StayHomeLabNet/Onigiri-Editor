Onigiri Editor `v1.0.3` fixes a Windows WebView2 deadlock when opening the embedded browser or clicking **Show in Built-in Browser**, and adds LAN external browser live preview, View toggles for the Top Header Bar and Format Toolbar, **Go to Line** (`Cmd/Ctrl+L`), and a Help menu **Online Manual** shortcut.

### Highlights (`v1.0.3`)
- **Windows Embedded Browser Deadlock Fix**: Converted native WebView2 child-webview operations (`add_child`, navigation, bounds, close, and `url()` queries) to async / `spawn_blocking` and removed blocking `webview.url()` calls inside `.on_page_load`, preventing the UI freeze ("hang") on Windows when switching to the Built-in Browser tab or clicking **Show in Built-in Browser**. Also hid the redundant setup card when an existing dev server is already connected cleanly.
- **LAN External Browser Live Preview**: Added an option in **Settings** to bind the live preview server to `0.0.0.0` so smartphones or other PCs on the same Wi-Fi/LAN can open the live preview, complete with LAN IPv4 detection, quick-copy pill, and path traversal hardening.
- **Top Header Bar & Format Toolbar Visibility Toggles**: Added checkable **View → Top Header Bar** and **View → Format Toolbar** menu items, Settings toggles (including **Show format toolbar in Simple mode**), Command Palette actions, and StatusBar recovery controls.
- **Go to Line (`Cmd/Ctrl+L`)**: Added a **Go to Line** modal (`line` or `line:col`, supporting full-width digits/colon) accessible via the **Edit** menu, shortcut (`⌘L` / `Ctrl+L`), Command Palette, or clicking the StatusBar line/column indicator.
- **Help → Online Manual**: Added **Online Manual** in the **Help** menu and Command Palette to open the official documentation on GitHub.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.3` では、Windows 環境で「Webブラウザ」タブへの切替や「内蔵ブラウザで表示」押下時にアプリが応答しなくなる（だんまり状態）不具合を修正するとともに、外部ライブプレビューの LAN アクセス対応、ヘッダーバー／書式ツールバーの表示切替、指定行へ移動（`Cmd/Ctrl+L`）、オンラインマニュアルリンクを追加しました。

### 主な変更点（`v1.0.3`）
- **Windows 内蔵 WebView2 ブラウザのデッドロック（だんまり）修正**: WebView の生成（`add_child`）・移動・リサイズ・終了コマンドを非同期 / `spawn_blocking` 化し、`.on_page_load` 内でメインスレッドをブロックしていた `webview.url()` 呼び出しを排除しました。これにより Windows で「内蔵ブラウザで表示」や「Webブラウザ」タブを開いてもフリーズしなくなります。また、既存の開発サーバーに正常接続している場合は不要な環境チェックカードを表示しないようにしました。
- **外部ライブプレビューの LAN 共有（他端末アクセス対応）**: 設定で `0.0.0.0` バインドを有効にすることで、同じ Wi-Fi / LAN 内のスマートフォンや他 PC からライブプレビュー URL を開けるようにしました（LAN IPv4 自動取得、URL ワンクリックコピー、パストラバーサル対策強化付き）。
- **上部ヘッダーバー＆書式ツールバーの表示切替**: メニューバーの「表示」・設定・コマンドパレットから **上部ヘッダーバー** および **書式ツールバー** の表示／非表示（シンプルモードでの書式バー表示設定を含む）を切り替えられるようにしました。
- **指定行へ移動（`Cmd/Ctrl+L`）**: `行番号` または `行:列`（全角数字・全角コロン対応）でジャンプできるモーダルを追加しました。編集メニュー・ショートカット（`⌘L` / `Ctrl+L`）・コマンドパレット・ステータスバーの行/列クリックから開けます。
- **ヘルプ → オンラインマニュアル**: ヘルプメニューおよびコマンドパレットから公式ドキュメントを開けるようにしました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
