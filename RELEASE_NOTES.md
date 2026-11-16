Onigiri Editor `v1.0.4` fixes Windows PHP & newly-installed CLI detection so tools installed via WinGet, Chocolatey, Scoop, Laravel Herd, XAMPP, Laragon, or manual installers are picked up immediately on **Re-check Environment** without restarting the app, and keeps the setup card consistent when a dev server is already running.

### Highlights (`v1.0.4`)
- **Live Windows Registry `PATH` Lookup**: Reads `HKCU\Environment` and `HKLM\...\Environment` `Path` values dynamically (with `%VAR%` expansion and a short cache) so PHP, Composer, Node, or AI CLIs installed while Onigiri Editor is open are detected immediately upon clicking **Re-check Environment** or refreshing AI connections—no app restart required.
- **Expanded Windows PHP Path Discovery**: Scans WinGet Links & Packages (`%LOCALAPPDATA%\Microsoft\WinGet\Links`, `%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP*`), Chocolatey (`%ProgramData%\chocolatey\bin`), Laravel Herd / `php.new` (`.config\herd\bin`, `.config\herd-lite\bin`), Scoop (`scoop\apps\php\current`), XAMPP (`C:\xampp\php`), Laragon (`C:\laragon\bin\php\*`), WampServer / MAMP, versioned `C:\Program Files\PHP\*`, `C:\php*`, and `C:\tools\php*`.
- **Valid WinGet PHP Package ID**: Updated the Windows install hint from `PHP.PHP` to `PHP.PHP.8.4`.
- **Consistent Setup Card & Probe Timeout**: Hides redundant setup error cards across the left sidebar and preview panes while the project's dev server is already running cleanly, and increases local server probe timeout to `750ms`.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.4` では、Windows 環境で PHP や各種 CLI ツールをインストールした直後に「PHP is not installed」と誤判定される問題を修正し、アプリを再起動しなくても「環境を再チェック」ですぐに認識できるようにしました。

### 主な変更点（`v1.0.4`）
- **Windows レジストリ `PATH` のリアルタイム参照**: `HKCU\Environment` および `HKLM\...\Environment` の `Path`（`%VAR%` 展開対応）を参照するようにし、Onigiri Editor を起動したままターミナルから PHP・Composer・Node・AI CLI を導入しても、アプリ再起動なしで「環境を再チェック」から即座に検出できるようになりました。
- **Windows 版 PHP の検索パス大幅拡充**: WinGet（`WinGet\Links` / `WinGet\Packages\PHP.PHP*`）、Chocolatey（`chocolatey\bin`）、Laravel Herd / `php.new`（`.config\herd\bin` / `herd-lite\bin`）、Scoop（`scoop\apps\php\current`）、XAMPP（`C:\xampp\php`）、Laragon（`C:\laragon\bin\php\*`）、WampServer / MAMP、バージョン別 `Program Files\PHP\*`・`C:\php*`・`C:\tools\php*` を自動探索します。
- **WinGet PHP パッケージ ID の修正**: Windows 向けインストールコマンドを正式な ID である `winget install -e --id PHP.PHP.8.4` に修正しました。
- **起動中サーバーとの表示整合性改善**: 開発サーバー（外部サーバー含む）に正常接続している間は、左サイドバー等でも重複したエラーカードを表示しないようにし、ローカルサーバー生存確認タイムアウトも `750ms` に改善しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
