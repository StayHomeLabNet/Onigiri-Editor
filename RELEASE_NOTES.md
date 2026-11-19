Onigiri Editor `v1.2.0` introduces a major suite of workflow, publishing, Git source control, knowledge visualization, and customization features: **Sidebar Git Source Control Panel (with Inline Diff & AI Commit Messages)**, **Interactive Knowledge Graph & Broken Link Diagnostics**, **Word (`.docx`) & Diagram SVG/PNG Export**, **Citations, Footnotes, BibTeX / DOI Lookup, Link Cards & URL Auto-Title Paste**, **Unused Image (Orphan Asset) Detector & Cleaner**, **Copy as Rich Text (Markdown & Code)**, **`.editorconfig` & `.onigiri.json` Project Settings**, **Keyboard Shortcut Customization UI**, and **Settings / AI / Snippets / Templates / Keybindings JSON Backup & Import** (plus **Factory Reset & App Cache Cleaner**).

### Highlights (`v1.2.0`)
- **Publishing, Citations & Rich Export**:
  - **Word (`.docx`) Native Export**: Export Markdown documents—including headings, lists, task lists, tables, blockquotes, code blocks, and formatting—directly to `.docx` via **File → Export Word (.docx)…**, the Command Palette, or a custom shortcut.
  - **Mermaid & KaTeX SVG / PNG Export**: Save rendered Mermaid diagrams and KaTeX math blocks directly as `.svg` or rasterized `.png` files from the block toolbar or context menu.
  - **Copy as Rich Text**: Copy selected text or the full document as clean inline-styled HTML + plain text (`Notion` / `Google Docs` / `Slack` / `Word` ready) via the Inspector, editor right-click menu, Command Palette, or customizable shortcut.
  - **Citations, Footnotes, BibTeX / DOI Lookup & URL Auto-Title**: Insert inline links, rich link cards, auto-numbered footnotes (`[^N]`), parsed BibTeX citations (APA / Markdown styles), and Crossref DOI lookups via the **Citation Modal**; wrap selected text when pasting a URL (`[selection](url)`), and optionally auto-fetch webpage `<title>` when pasting bare URLs (`autoTitleOnUrlPaste`).
- **Workspace Knowledge, Assets & Git Source Control**:
  - **Git Source Control Panel**: Dedicated **Git** Sidebar tab with change-count badge, branch & ahead/behind indicators, staged/unstaged/untracked lists, **Stage / Unstage / Discard**, inline unified **Git Diff** viewer, **Commit**, **AI Commit Message** generator, **Pull / Push**, and recent commits history.
  - **Interactive Knowledge Graph & Broken Link Diagnostics**: Visualize workspace Markdown note connections with degree-based layout, search/tag filtering, connected-only toggle, orphan note metrics, and clickable broken-link diagnostics that jump straight to the source line.
  - **Unused Image (Orphan Asset) Detector & Cleaner**: Scan the workspace for image files unreferenced by any workspace file or open tab, preview thumbnails & total size, and batch-delete safely.
- **Customization, Project Config & Data Management**:
  - **Keyboard Shortcut Customization UI**: Dedicated **Keybindings** tab in Settings to view, filter, record, clear, reset, and detect conflicts across 27 editor commands—reflected dynamically in Command Palette badges and tooltips.
  - **`.editorconfig` & `.onigiri.json` Project Settings**: Automatically applies hierarchical `.editorconfig` and `.onigiri.json` rules (`tabSize`, `indentWithTabs`, EOL, encoding, `trimTrailingWhitespace`, `insertFinalNewline`, `imageAssetFolder`, `dailyNotesFolder`, `wordGoal`) with one-click `.onigiri.json` creation/opening in Settings.
  - **JSON Settings Backup Export/Import & Reset / Cache Cleaner**: Selectively export/import app & editor settings, AI presets (API keys excluded by default), custom snippets, templates, and custom keybindings in **Settings → Reset & Data**, alongside granular factory reset and cache cleanup controls.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.2.0` では、執筆・ナレッジ可視化・Git ソース管理・Word/図表書き出し・設定カスタマイズを大きく進化させる 9 つの主要機能を追加しました：**サイドバー Git パネル（Diff 表示・AI コミットメッセージ生成対応）**、**ナレッジグラフ＆リンク切れ診断**、**Word（`.docx`）書き出し＆Mermaid/KaTeX SVG・PNG 保存**、**引用・脚注・BibTeX / DOI 検索・リンクカード＆URL タイトル自動取得**、**未使用画像（孤立アセット）の検出・一括整理**、**リッチテキストコピー**、**`.editorconfig` / `.onigiri.json` プロジェクト設定連携**、**キーボードショートカット設定 UI**、および **設定・AI・スニペット・テンプレート・キーバインドの JSON バックアップ書き出し／復元**（あわせて設定初期化・キャッシュ削除機能も整理）に対応しています。

### 主な変更点（`v1.2.0`）
- **書き出し・引用・リッチコピー強化**:
  - **Word（`.docx`）形式でのネイティブ書き出し**: 見出し・箇条書き・タスクリスト・表・引用・コードブロックを含む Markdown ドキュメントを `.docx` ファイルとして直接書き出せます（メニュー / コマンドパレット / ショートカット対応）。
  - **Mermaid 図 / KaTeX 数式の SVG・PNG 書き出し**: プレビュー上の Mermaid 図や KaTeX 数式ブロックをツールバーやメニューからそのまま `.svg` / `.png` 画像として保存できます。
  - **リッチテキストとしてコピー**: 選択範囲またはドキュメント全体をインラインスタイル付き HTML＋プレーンテキストとしてコピーし、Notion / Google Docs / Slack / Word へ崩れず貼り付けられます。
  - **引用・脚注・BibTeX / DOI 検索・URL タイトル自動取得**: **引用・脚注モーダル**からリンクカード・自動採番脚注（`[^N]`）・BibTeX パース（APA 風 / Markdown 強調）・Crossref DOI 検索を行えます。テキスト選択中の URL ペーストで `[選択テキスト](URL)` 化でき、空選択の URL 貼り付け時にはページタイトルの自動取得（`autoTitleOnUrlPaste`、設定で ON/OFF 可）にも対応しました。
- **ナレッジ可視化・画像整理・Git ソース管理**:
  - **Git ソース管理パネル**: サイドバーに **Git** タブ（変更件数バッジ付き）を追加。ブランチ＆先行/遅延数表示、ステージ済み/変更ファイル一覧、**ステージ / 戻す / 破棄**、インライン unified **Diff ビューア**、**コミット**、**AI コミットメッセージ生成**、**Pull / Push**、最近のコミット履歴を備えています。
  - **ナレッジグラフ＆リンク切れ診断**: ノート間のつながりをインタラクティブな相関グラフで可視化し、キーワード・`#タグ` 絞り込み、孤立ノート数・リンク切れ件数の集計、およびクリックによる該当行へのジャンプが可能です。
  - **未使用画像（孤立アセット）の検出・整理**: 作業フォルダー内のどのテキストファイル・開いているタブからも参照されていない画像を一覧表示し、サムネイルと容量を確認して一括削除できます。
- **カスタマイズ・プロジェクト設定・バックアップ管理**:
  - **キーボードショートカット設定 UI**: 設定画面の **キーボード** タブから全 27 コマンドのショートカットをインタラクティブに割り当て・検索・競合警告・クリア・リセットでき、コマンドパレット表示にも即時反映されます。
  - **`.editorconfig` / `.onigiri.json` プロジェクト設定連携**: 階層的な `.editorconfig` および `.onigiri.json`（インデント幅・タブ/スペース・改行コード・文字コード・保存時行末空白除去/末尾改行付与・画像保存先・デイリーノート保存先・目標文字数）を自動適用し、設定画面から `.onigiri.json` を作成・編集できます。
  - **設定 JSON バックアップ書き出し／復元＆リセット・キャッシュ管理**: **設定 → リセット・データ管理** からアプリ設定・AI プリセット（API キー除外オプション付き）・マイスニペット・カスタムテンプレート・ショートカット設定を選択的に JSON バックアップ／復元（マージ／上書き選択可）でき、設定初期化やキャッシュ削除も行えます。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
