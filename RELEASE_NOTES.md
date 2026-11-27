Onigiri Editor `v2.0.0` introduces **AI Harness Mode**—a thread-centric, agentic AI workspace built right into Onigiri Editor alongside your Markdown & code editor—plus **Excel-like CSV/TSV spreadsheet Undo/Redo** and UI refinements.

### Highlights (`v2.0.0`)
- **AI Harness Mode (`AI Harness` ⇄ `Editor` Switcher)**:
  - **Thread-Centric Agentic Workspace**: Create and manage multiple persistent AI threads per project folder with a timeline view showing prompts, thinking process, tool execution, proposed plans, and workspace diffs.
  - **4 Permission Modes**: Switch between **Plan (Read-only)**, **Approve Edits**, **Auto-Edit**, and **Full Access** directly from the composer, with interactive approval gates (`Allow` / `Allow for Turn` / `Deny`) and 1-click **`Execute This Plan`** on proposed plans.
  - **Turn-Level Snapshots, Diff Review & Rollback**: Automatically snapshots modified workspace files per turn, highlights dirty-editor conflicts, and lets you **`Keep Changes`** or **`Revert This Turn`** anytime.
  - **Live Workbench Pane**: Inspect **Preview**, **Diff**, **Files**, and **Browser** tabs side-by-side with the agent timeline, attach the active editor file, or jump straight into the Editor from any file.
  - **CLI & Cloud API Runners**: Supports Codex CLI, Claude Code CLI, Gemini CLI, Antigravity CLI, OpenAI, Anthropic, Gemini API, Ollama, and LM Studio.
- **CSV / TSV Spreadsheet Undo/Redo & Zen Mode Polish**:
  - Added full **Undo (`⌘Z` / `Ctrl+Z`) / Redo (`⇧⌘Z` / `Ctrl+Y`)** history (up to 100 steps with selection restoration) for all spreadsheet edits, AutoFill, paste, cut, and row/column actions, accessible via keyboard shortcuts, right-click menu, and the native **Edit** menu.
  - Auto-selects an initial cell on table load and prevents the Zen Mode exit button from overlapping the right-pane **External Browser** button.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v2.0.0` では、これまでのエディタとワンクリックで切り替えられるスレッド中心の自律型エージェント作業空間 **「AI ハーネスモード（AI Harness）」** を新たに搭載しました。さらに、CSV / TSV スプレッドシートの **元に戻す / やり直し（Undo / Redo）** 対応や集中モード時の UI 改善も行っています。

### 主な変更点（`v2.0.0`）
- **AI ハーネスモード（`AIハーネス` ⇄ `エディタ` 切替）**:
  - **スレッド中心のエージェント作業空間**: 作業フォルダ単位で複数の AI スレッドを作成・管理でき、プロンプト・思考プロセス・実行計画・ファイル変更 Diff をタイムライン形式で記録・復元できます。
  - **4段階の権限モード**: **計画（読み取り専用）**・**編集ごとに承認**・**自動編集**・**フルアクセス** をコンポーザーから切り替え可能。承認ゲート（`許可` / `このターン中は自動許可` / `拒否`）や、提案された計画の **`この計画で実行`** ボタンを備えています。
  - **ターン単位のスナップショット＆ロールバック**: ターンごとに変更されたファイルを自動スナップショットし、未保存エディタとの競合警告付きで **`変更を確定`** または **`このターンを元に戻す`** ことができます。
  - **ライブ作業台（Workbench）**: タイムラインの隣に **プレビュー / 差分 / ファイル / ブラウザ** の作業台ペインを常駐でき、編集中ファイルの添付やエディタへのジャンプもシームレスに行えます。
  - **CLI ＆ API ランナー両対応**: Codex / Claude Code / Gemini / Antigravity CLI および OpenAI / Anthropic / Gemini API / Ollama / LM Studio で動作します。
- **CSV / TSV スプレッドシート Undo / Redo ＆ UI 改善**:
  - セル編集・数式バー・オートフィル・コピペ・行列操作すべてに対応した **元に戻す（`⌘Z` / `Ctrl+Z`）・やり直し（`⇧⌘Z` / `Ctrl+Y`）** を実装し、右クリックメニューおよびアプリメニュー「編集」からも実行できるようになりました。
  - テーブル初期表示時のセル自動選択、および集中モード時の「集中モードを終了 (Esc)」ボタンと「外部ブラウザ」ボタンの重なりを解消しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
