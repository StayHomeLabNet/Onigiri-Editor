Onigiri Editor `v1.3.0` brings safer image handling across temporary pastes and exports, icon-only Sidebar/Inspector tabs, faster startup via code splitting and lazy loading, LRU image caching with disk modification tracking, in-app GitHub Release update checking, tighter Tauri CSP, and automated Vitest + CI verification.

### Highlights (`v1.3.0`)
- **Auto-Migrate Temp Pasted Images on Save**:
  - Screenshots or images pasted into unsaved documents (`onigiri-markdown-images` temp folder) are now automatically moved into the configured `assets/` folder beside the saved Markdown file on first **Save / Save As**, rewriting Markdown links cleanly to `./assets/...` so they never break after cache cleanup.
- **Embedded Local Images in HTML & Word (`.docx`) Exports**:
  - Standalone **HTML Export** now inlines local images as Base64 data URIs by default (toggleable via **Settings → General & View → Embed Local Images on HTML Export**).
  - **Word (`.docx`) Export** now embeds local and `data:` images (`word/media/` + DrawingML dimensions, supporting PNG/JPEG/GIF/BMP natively and SVG/WebP/AVIF via PNG conversion) instead of text placeholders.
- **Icon-Only Inspector & Sidebar Tabs + Configurable Style**:
  - Updated both left Sidebar and right Inspector tab bars to clean icon-only tabs with tooltips, plus an **Inspector Tab Style** preference (`Icons only`, `Active label`, or `Always show labels`).
- **LRU Image Memory Cache & Modification Tracking**:
  - Replaced unbounded image data-URL caching with a bounded `ImageLruCache` (120 entries / 48 MiB budget) paired with Rust `read_image_asset_with_meta` disk modification checks and unified cache clearing.
- **Faster Startup via Code Splitting & Lazy Loading**:
  - Added Vite `manualChunks`, dynamic `import('mermaid')` and `docxExport`, and `React.lazy` + `<Suspense>` loading across 17 modals to substantially shrink initial JS bundle size.
- **In-App Update Checker & Tightened Security**:
  - Added GitHub Releases update checking (`Help → Check for Updates...`, optional startup check, Command Palette, About modal, Settings UI, and an update banner pointing directly to your OS installer) and removed `'unsafe-eval'` from Tauri CSP.
  - Updated **Help → Online Manual** to `https://stayhomelab.net/help/onigiri-editor/`.
- **Modularized Codebase & Automated Vitest + CI Suite**:
  - Split large backend/frontend files into focused modules (`images.rs`, `updates.rs`, `session.ts`, `imageCache.ts`, `exportHelpers.ts`, `cmTheme.ts`, `src/styles/*.css`) and added Vitest frontend unit tests alongside Rust `cargo test` in CI.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.0` では、未保存ドキュメントで貼り付けた一時画像の保存時自動移行、HTML／Word（`.docx`）書き出し時の画像埋め込み、左右タブバーのアイコン化、LRU 画像メモリキャッシュ、コード分割・遅延ロードによる高速化、アプリ内アップデート確認、Tauri CSP 強化、および Vitest + CI 自動テストを導入しました。

### 主な変更点（`v1.3.0`）
- **未保存ドキュメント保存時の一時画像自動移行**:
  - 未保存タブへ貼り付けて OS 一時フォルダー（`onigiri-markdown-images`）に保存された画像を、初回 **保存／名前を付けて保存** 時に保存先フォルダー配下の `assets/` へ自動移動し、Markdown リンクも `./assets/...` に自動更新するよう改善しました（キャッシュ削除によるリンク切れを防止）。
- **HTML / Word（`.docx`）書き出し時のローカル画像埋め込み**:
  - **HTML 書き出し**: ローカル画像参照を Base64 Data URI として自動埋め込みし、単体 HTML ファイルのまま持ち運べるようにしました（**設定 → 全般・表示** で切替可能）。
  - **Word（`.docx`）書き出し**: `[Image: ...]` プレースホルダーではなく、ローカル画像や `data:` 画像（PNG/JPEG/GIF/BMP はそのまま、SVG/WebP/AVIF は PNG 変換）を `word/media/` に実画像として埋め込むよう強化しました。
- **左右タブバーのアイコン化＆インスペクタータブ表示設定**:
  - 左サイドバーおよび右インスペクターのタブをアイコン中心のすっきりした表示に統一し、ツールチップと **インスペクタータブの表示スタイル** 設定（`アイコンのみ` / `選択中のみラベル` / `常にラベル表示`）を追加しました。
- **LRU 画像メモリキャッシュ＆更新日時検証**:
  - 無制限だった画像 Data URL キャッシュを上限付き LRU キャッシュ（120 件 / 48 MiB 上限）に刷新し、Rust 側の `read_image_asset_with_meta` による更新日時チェックとキャッシュ削除連動を実装しました。
- **コード分割・遅延ロードによる起動高速化**:
  - Vite の `manualChunks` 設定、Mermaid / `docxExport` の動的 import 化、17 モーダルの `React.lazy` + `Suspense` 化により初期ロード JavaScript サイズを大幅に削減しました。
- **アプリ内アップデート確認＆セキュリティ強化**:
  - 起動時（設定で切替可）・**ヘルプ → アップデートを確認…**・コマンドパレット・バージョン情報・設定画面から GitHub Releases の最新バージョンを確認し、通知バナーから OS 対応インストーラーを開けるようにしました。また Tauri CSP から `'unsafe-eval'` を削除しました。
  - **ヘルプ → オンラインマニュアル** の URL を `https://stayhomelab.net/help/onigiri-editor/` に更新しました。
- **モジュール分割・Vitest + CI 自動テスト導入**:
  - 肥大化していた Rust / TypeScript / CSS ファイルを機能別モジュールへ整理し、Vitest フロントエンド単体テストと GitHub Actions での自動テスト実行を追加しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
