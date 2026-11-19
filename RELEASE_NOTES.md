Onigiri Editor `v1.2.1` fixes local image drag-and-drop and Markdown preview rendering for Windows paths, filenames containing spaces or parentheses, non-ASCII/Japanese directories, and unsaved documents, alongside the refreshed built-in Welcome Guide (`Welcome.md` / `ようこそ.md`).

### Highlights (`v1.2.1`)
- **Image Drop & Markdown Preview Fix (Windows / Spaces / Non-ASCII Paths)**:
  - Fixed dropped or inserted images rendering as raw `![alt](C:\...\foo bar.png)` text in Markdown Preview when using unsaved documents without an open workspace folder: paths are now normalized (`\` → `/`) and wrapped cleanly with angle brackets (`<...>`) when containing spaces, parentheses, or special characters.
  - Updated `rehype-sanitize` (`editableSanitizeSchema`) to permit local Windows drive letters (`C:` etc.), `file:`, `data:`, and `blob:` image sources while continuing to block unsafe protocols such as `javascript:`.
  - Added safe Markdown image pre-normalization (`preprocessMarkdownImageDestinations`) outside code fences/inline code so manually typed or pasted local/Windows image paths also render properly, plus matching Turndown round-trip serialization (`tiptapImage`).
  - Enhanced Rust `read_image_data_url` with full UTF-8 percent-decoding (preserving `+`), `file:///C:/...` Windows URI handling, and `<...>` cleanup, and fixed collision filename sanitization in `save_image_asset_impl`.
- **Unsaved Tab & Visual Preview Improvements**:
  - Added `workspaceRoot` fallback to `PreviewPane`, `ImageModal`, and `SlidePresentationModal` so relative `./assets/...` images resolve immediately even inside unsaved tabs.
  - Enabled direct Sidebar workspace file/image drag-and-drop onto TipTap Visual Preview and extension-based image drop detection.
- **Refreshed Welcome Document (`Welcome.md` / `ようこそ.md`)**:
  - Updated the default first-launch welcome note to showcase all v1.2 features (Git Source Control panel, Knowledge Graph & Broken Link diagnostics, Citations/Footnotes, Word `.docx` & Mermaid/KaTeX SVG/PNG export, Keybindings UI, and JSON backup).

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.2.1` では、Windows パスや空白・括弧・日本語フォルダーを含む画像のドラッグ＆ドロップおよびマークダウンプレビュー表示の不具合修正と、初期ウェルカムドキュメント（`ようこそ.md` / `Welcome.md`）の刷新を行いました。

### 主な変更点（`v1.2.1`）
- **画像ドロップ＆マークダウンプレビュー表示の修正（Windows パス・空白・日本語対応）**:
  - 作業フォルダーを開いていない未保存ドキュメント（`無題のドキュメント.md` 等）へローカル画像をドロップ／挿入した際、`![alt](C:\...\素材\KIWI WHITE.png)` が画像として解釈されず生テキストのまま表示される問題を修正しました。挿入時のスラッシュ正規化（`\` → `/`）と角括弧ラップ（`<...>`）により有効な CommonMark として出力されます。
  - `rehype-sanitize`（`editableSanitizeSchema`）で Windows ドライブレター（`C:` 等）や `file:` / `data:` / `blob:` の画像 `src` が除去されないよう許可し（`javascript:` 等の危険なスキームは引き続きブロック）、手入力・貼り付けされたローカル画像パスもコードブロック外で安全に正規化して描画できるよう改善しました。
  - TipTap ビジュアル編集からの書き戻し（`tiptapImage`）でも日本語・空白パスが崩れないよう往復変換を統一しました。
  - Rust バックエンドの `read_image_data_url` で UTF-8 パーセントデコード（`%E7%B4%A0%E6%9D%90` 等、`+` は保持）・Windows `file:///C:/...` URI・`<...>` 処理に対応し、`save_image_asset_impl` の重複時ファイル名サニタイズも修正しました。
- **未保存タブ・ビジュアルプレビューの操作性向上**:
  - ワークスペースを開いた状態の未保存タブでも `./assets/...` 等の相対パス画像を解決できるよう `PreviewPane` / `ImageModal` / `SlidePresentationModal` に `workspaceRoot` フォールバックを追加しました。
  - 左サイドバーからのドラッグ＆ドロップを TipTap ビジュアルプレビュー上でも直接受け付けるようにし、MIME タイプ空のドロップ画像も拡張子で確実に判定するよう改善しました。
- **初期ウェルカムドキュメント（`ようこそ.md` / `Welcome.md`）の更新**:
  - Git パネル、ナレッジグラフ＆リンク切れ診断、引用・脚注・DOI/BibTeX、Word（`.docx`）＆図表 SVG/PNG 書き出し、ショートカットカスタマイズ、JSON バックアップなど v1.2 の主要機能を一通り試せる内容へ更新しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
