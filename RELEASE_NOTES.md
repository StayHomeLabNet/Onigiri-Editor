Onigiri Editor `v1.1.0` delivers a major productivity, PKM (Personal Knowledge Management), and multi-format workflow upgrade: **Quick Open (`⌘P` / `@headings`)**, **Slash Commands (`/`) & Custom Snippets**, **Auto Table of Contents (TOC)**, **`[[WikiLinks]]`, Backlinks & Tag Browser**, **Clipboard Image Paste Auto-Save & Sidebar D&D Relative Links**, **Cross-Folder Regex Grep & Selective Replace (`⌘⇧G`)**, **CSV/TSV Interactive Table Preview & JSON/YAML/ENV Tools**, **Document Proofread & Review**, **Markdown Slide Presentation Mode**, **Enhanced HTML/SVG Live Preview**, **Dual Editor Improvements**, **Persisted Line Bookmarks (`F2`) & Focus Mode**, **Daily Notes & Templates**, **URL Web Clipper**, **Per-Tab AI Threads & `.md` Note Export**, **Git Status & HEAD Diff**, **Project-Scoped Session Restore**, and **Language Auto-Detection fixes**.

### Highlights (`v1.1.0`)
- **Navigation, Session & Bookmarks**:
  - **Quick Open (`⌘P` / `Ctrl+P`)**: Fuzzy-search open tabs, workspace files, and recent files, or prefix `@` to jump to headings in the current file.
  - **Per-Project Session Restore & Language Auto-Detection**: Saves/restores open tabs, scroll positions, code folding states, language overrides, and bookmarks per workspace folder; fixes initial welcome/unsaved-tab auto-detection carryover.
  - **Persisted Line Bookmarks (`⌘F2` / `F2` / `⇧F2`) & Focus Mode**: Bookmark lines across sessions and optionally dim inactive paragraphs in **Focus Mode**.
  - **Line Sorting & Blank Line Removal**: Sort ascending/descending, deduplicate, and remove blank lines from selections via the context menu or Command Palette.
- **Markdown Writing, Knowledge Management & Notes**:
  - **Slash Commands (`/`) & Custom Snippets UI**: Type `/` at line start to insert headings, tables, Mermaid, KaTeX, or callouts; create, edit, and save custom snippets in the Sidebar.
  - **Auto TOC & Table Formatter**: Insert/update `<!-- toc -->` Tables of Contents and auto-align GFM Markdown tables (with TSV paste auto-conversion).
  - **`[[WikiLinks]]`, Backlinks & Tag Browser**: Autocomplete `[[note]]` links in the editor and browse incoming **Backlinks** and `#tags` across your workspace in the Sidebar **Knowledge** tab.
  - **Clipboard Image Auto-Save & Sidebar D&D Links**: Auto-save pasted/dropped screenshots to a configurable folder (`assets` by default, with workspace fallback for unsaved tabs), and drag files/images from the Sidebar tree into the editor to insert relative Markdown links.
  - **Daily Notes, Templates & Web Clipper**: One-click Today's Daily Note, built-in & custom templates (`{{date}}`, `{{time}}`, `{{title}}`), and **URL → Clean Markdown** web clipping.
- **Multi-Format Previews, Slide Mode & Dual Editor**:
  - **Cross-Folder Regex Grep & Selective Replace (`⌘⇧G`)**: Search across the workspace with regex/case toggles, select target files via checkboxes, and apply batch replacements cleanly.
  - **CSV/TSV Table Preview & JSON/YAML/ENV Tools**: Filterable/sortable table view for `.csv`/`.tsv` with Markdown/CSV copy, plus JSON pretty/minify/key-sort, JSON ↔ YAML conversion, and `.env` sorting.
  - **HTML / SVG Standalone Live Preview Upgrades**: SVG zoom (`Fit` / `50%` / `100%` / `200%`), background switcher (checker/light/dark), copy SVG / copy rasterized PNG, and HTML Visual/Source toggle.
  - **Markdown Slide Presentation Mode**: Split Markdown by `---` into fullscreen-ready slides with keyboard navigation and grid overview (`G`).
  - **Dual Editor Simultaneous Editing**: Right-pane Side-by-Side editor tracks active focus for `⌘S` save, toolbar actions, snippets, AI inserts, and bookmarks.
- **AI, Review & Git Integration**:
  - **Proofread & Document Review Tab**: Local rule checks (broken links, skipped heading levels, mixed style, repeated words) + AI-assisted review with one-click fixes.
  - **Per-Tab AI Threads & Note Export**: Keep separate AI conversation threads per tab (or shared) and export chat history directly as a `.md` note.
  - **Git Status & HEAD Diff Compare**: Shows Git status badges in the Sidebar file tree and compares tabs/files against `Git HEAD`.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.1.0` では、執筆・ナレッジ管理・開発ワークフローを大幅に強化する多数の新機能を追加しました：**クイックオープン（`⌘P` / `@見出し`）**、**スラッシュコマンド（`/`）＆カスタムスニペット**、**目次（TOC）自動生成**、**`[[Wikiリンク]]`・バックリンク＆タグブラウザ**、**クリップボード画像自動保存＆サイドバー D&D 相対リンク挿入**、**フォルダー横断正規表現 Grep 一括置換（`⌘⇧G`）**、**CSV/TSV テーブルプレビュー＆JSON/YAML/ENV 整形・変換**、**ドキュメント校正・レビュー**、**Markdown スライドプレゼンモード**、**HTML/SVG プレビュー拡張**、**デュアルエディタ同時編集強化**、**行ブックマーク永続化（`F2`）＆フォーカスモード**、**デイリーノート＆テンプレート**、**URL Web クリップ**、**タブ別 AI スレッド＆`.md` 書き出し**、**Git ステータス＆HEAD 差分比較**、**プロジェクト別セッション復元**、および **言語自動判定の修正** に対応しています。

### 主な変更点（`v1.1.0`）
- **ナビゲーション・セッション管理・ブックマーク**:
  - **クイックオープン（`⌘P` / `Ctrl+P`）**: 開いているタブ・作業フォルダー内ファイル・最近のファイルをファジー検索して即ジャンプでき、先頭に `@` を付けると現在ファイルの見出しアウトラインへ移動できます。
  - **プロジェクト別セッション復元＆言語自動判定修正**: フォルダーごとに開いていたタブ・スクロール位置・コード折りたたみ・言語固定・ブックマークを保存／復元し、初回やタブ切り替え時の言語自動判定引き継ぎ不具合を修正しました。
  - **行ブックマーク永続化（`⌘F2` / `F2` / `⇧F2`）＆フォーカスモード**: タブ単位でブックマークを永続化し、現在段落以外を薄く表示する **フォーカスモード** を追加しました。
  - **行ソート・空白行削除**: 右クリックメニューやコマンドパレットから昇順／降順ソート・重複行削除・空白行削除を実行できます。
- **Markdown 執筆・ナレッジ管理・ノート作成**:
  - **スラッシュコマンド（`/`）＆カスタムスニペット UI**: 行頭で `/` を打つと見出し・テーブル・Mermaid・KaTeX・コールアウトを即挿入でき、サイドバーで独自スニペットを追加・編集・保存できます。
  - **目次（TOC）自動生成＆テーブル整形**: `<!-- toc -->` の挿入／更新と Markdown 表の自動整形（TSV 貼り付け時の表自動変換を含む）に対応しました。
  - **`[[Wikiリンク]]`・バックリンク＆タグブラウザ**: エディタでの `[[ノート名]]` 補完と、サイドバーの **ナレッジ** タブから逆リンク一覧・`#タグ` 別絞り込みジャンプが可能です。
  - **クリップボード画像自動保存＆サイドバー D&D リンク挿入**: 画像ペースト／ドロップ時に指定フォルダー（既定 `assets`、未保存タブも作業フォルダーへフォールバック）へ自動保存し、サイドバーからファイルをエディタへドロップするだけで相対パスの Markdown リンク／画像を挿入します。
  - **デイリーノート・テンプレート＆Web クリップ**: ワンクリックで今日のデイリーノートを作成し、組み込み／カスタムテンプレート（`{{date}}` / `{{time}}` / `{{title}}`）や **URL → Markdown 変換クリップ** が使えます。
- **多形式プレビュー・スライド・並列編集**:
  - **フォルダー横断 Grep 検索＆選択一括置換（`⌘⇧G`）**: 正規表現・大文字小文字区別検索のヒット箇所をファイルごとにチェックボックスで選んで一括置換できます。
  - **CSV/TSV テーブルプレビュー＆JSON/YAML/ENV ツール**: `.csv` / `.tsv` の絞り込み・列ソート・Markdown 表コピー、JSON 整形／圧縮／キーソート、JSON ⇔ YAML 変換、`.env` ソート整形に対応しました。
  - **HTML / SVG 単体ライブプレビュー強化**: SVG ズーム（`Fit / 50% / 100% / 200%`）・背景切替（チェッカー／白／黒）・SVG コード＆PNG コピー、HTML のビジュアル／ソース表示切替を追加しました。
  - **Markdown スライドプレゼンモード**: `---` でスライド分割し、キーボード操作・一覧グリッド（`G`）・フルスクリーン表示・Mermaid / 数式描画に対応しました。
  - **2ファイル同時編集（デュアルエディタ）強化**: 右ペイン編集側のフォーカスを追跡し、`⌘S` 保存・ツールバー・スニペット・AI 挿入・ブックマークをアクティブ側へ反映します。
- **AI・校正レビュー・Git 連携**:
  - **ドキュメント校正・一括チェックタブ**: ローカルルール検査（リンク切れ・見出し飛び・文体混在・重複語等）と AI レビューによるワンクリック修正に対応しました。
  - **AI チャット タブ別スレッド＆`.md` 書き出し**: タブ専用スレッド／共通スレッドを切り替えられ、会話履歴を新規ノートとして書き出せます。
  - **Git ステータス＆HEAD 差分比較**: サイドバーツリーに Git 変更バッジを表示し、`Git HEAD` との差分比較を実行できます。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
