Onigiri Editor `v1.0.1` fixes Windows CLI execution errors (`os error 193`), improves Antigravity / Codex / Claude / Gemini CLI setup guidance across OSes, expands Web runtime diagnostics, and upgrades Find & Replace with width sensitivity and selection-scoped replacement.

### Highlights (`v1.0.1`)
- **Windows CLI Shim Resolution Fix (`os error 193`)**: Skips extensionless POSIX shell scripts in `%APPDATA%\npm` (such as `codex`, `claude`, `gemini`, `npm`) on Windows and resolves `.exe` / `.com` / `.cmd` / `.bat` properly before launching via Node.js.
- **Antigravity CLI (`agy`) & AI Setup Guidance**: Distinguishes the standalone Antigravity CLI (`agy`) from `Antigravity.app`, improves cross-OS terminal installers (`curl` / `irm` / `winget`), automatically uses `~/.npm-global` on macOS/Linux when global npm prefixes are read-only, and adds per-CLI login hints plus LM Studio / Ollama step-by-step instructions.
- **Web Runtime & Dependency Diagnostics**: Filters out Windows' empty Microsoft Store `python.exe` stub, detects `wp-config-sample.php` and Laravel SQLite database setup, adds Ruby/Jekyll diagnostics (with macOS `/usr/bin/ruby` protection), Linux `python3-venv` & PHP extension hints, `.env.example` detection, and clearer setup action legends.
- **Find & Replace Enhancements**: Adds full-width/half-width sensitivity toggle (`Aa` / `Ａａ` matching), **In Selection** search/replace scope with range refresh, literal `$1` preservation when Regex is off, and smoother match navigation.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.1` では、Windows 環境での CLI 起動エラー（`os error 193`）の解消、macOS・Windows・Linux 各環境における AI CLI 導入・認証ガイダンスの強化、Web ランタイム環境診断の拡充、および検索・置換機能の機能強化を行いました。

### 主な変更点（`v1.0.1`）
- **Windows CLI 起動エラー（`os error 193`）の修正**: `%APPDATA%\npm` 配下にある拡張子なしの POSIX 用シェルスクリプト（`codex` / `claude` / `gemini` / `npm` 等）を Windows 実行候補から除外し、`.exe` / `.com` / `.cmd` / `.bat` を正しく解決して起動するよう修正しました。
- **Antigravity CLI（`agy`）および各 AI CLI セットアップ改善**: `Antigravity.app` 本体と CLI（`agy`）が別配布である点の明記、OS 別インストーラー（`curl` / `irm` / `winget`）の改善、macOS/Linux で権限エラーを防ぐ `~/.npm-global` 自動設定、CLI 別の認証案内・Ollama/LM Studio の手順表示を追加しました。
- **Web 実行環境・依存パッケージ診断の強化**: Windows Microsoft Store のダミー `python.exe` エイリアス除外、`wp-config-sample.php` や Laravel SQLite の検知、Jekyll/Ruby 診断（macOS 標準 Ruby の保護対応）、Linux `python3-venv`・PHP 拡張案内、`.env.example` 検知、セットアップボタンの役割説明を追加しました。
- **検索・置換機能の強化**: 全角／半角の区別切り替え、選択範囲内での検索・置換（範囲再取得対応）、正規表現 OFF 時の `$1` 等リテラル維持、一致箇所の移動・ハイライト精度を改善しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`

