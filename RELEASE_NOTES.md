Onigiri Editor `v1.4.0` introduces 8 major productivity upgrades—all configurable with individual ON/OFF toggles in Settings: **Selection Floating Bubble Menu**, **AI Ghost Text Autocomplete (`Tab` to accept)**, **AI Custom Prompt Variables (`{{clipboard}}`, `{{fileName}}`, etc.)**, **Markdown Table GUI Toolbar**, **PDF / HTML Export Page Setup & Design Presets**, **Quick Scratchpad & Global Summon Hotkey**, **Lightweight Integrated Terminal Drawer**, and **App-Wide Instant Custom Tooltips**.

### Highlights (`v1.4.0`)
- **Render Single Line Breaks as `<br>` in Preview (Configurable in Settings → Editor, On by Default)**:
  - Single Enter line breaks in Markdown paragraphs now render directly as `<br>` in Live Preview, HTML Export, HTML Copy, and External Browser Live Preview (while keeping fenced code blocks and math blocks untouched). Toggle off in **Settings → Editor** for strict CommonMark soft-break behavior.
- **Selection Floating Bubble Menu (Configurable in Settings → Editor)**:
  - Selecting text in the editor reveals a floating mini toolbar right above the selection for instant **Bold**, **Italic**, **Inline Code**, **Link**, **Inline AI Edit (`⌘⇧E`)**, and up to **3 quick AI Custom buttons**—eliminating trips to the top toolbar.
- **AI Ghost Text Autocomplete (`Tab` to Accept / `Esc` to Dismiss, Opt-in in Settings → Editor)**:
  - Pausing briefly while typing displays a muted inline continuation suggestion powered by your active AI provider (including free offline **Apple Foundation Models**, **Ollama**, or **LM Studio**). Press `Tab` to insert or `Esc` to dismiss; trigger delay is customizable (`400–2500ms`, off by default to avoid unintended API calls).
- **AI Custom Prompt Variables (`{{selection}}`, `{{clipboard}}`, `{{fileName}}`, `{{filePath}}`, `{{language}}`, `{{date}}`, `{{time}}`)**:
  - Dynamically expand context variables inside any AI Custom button or submenu prompt—complete with 1-click variable insertion chips in **Settings → AI Custom**.
- **Markdown Table GUI Toolbar (Configurable in Settings → Editor)**:
  - Placing the cursor inside any Markdown table reveals a compact GUI bar to **Insert Row Above/Below**, **Delete Row**, **Insert Column Left/Right**, **Delete Column**, **Align Left / Center / Right**, **Sort Column Ascending/Descending** (numeric-aware), and **Format Column Widths** in a single undoable step.
- **PDF / HTML Export Page Setup & Design Presets**:
  - Open **Page Setup & Export (PDF / HTML)...** from the TopBar Export menu or Command Palette to configure **Design Theme** (**Modern**, **Business**, **Academic**), **Paper Size** (`A4` / `Letter` / `B5`), **Orientation** (Portrait / Landscape), **Margins** (Narrow / Normal / Wide), **Page Numbers (`1 / N`)**, and custom **Header / Footer** text (`{{title}}` supported).
- **Quick Scratchpad & Global Summon Hotkey (Configurable in Settings → General)**:
  - Open an auto-persisted, save-free **Quick Scratchpad** from the Status Bar or Command Palette (with Copy, Clear, and **Open in Tab** promotion).
  - Optionally enable a system-wide **Global Hotkey** (default `CommandOrControl+Shift+Space`) via `tauri-plugin-global-shortcut` to bring Onigiri Editor to the foreground from any application.
- **Lightweight Integrated Terminal Drawer (Advanced Mode, Configurable in Settings → General)**:
  - Toggle a bottom terminal drawer from the Status Bar or Command Palette with real-time streaming output, persistent `cd` working directory, `↑`/`↓` command history, Stop/Cancel control, and 1-click **Ask AI** diagnosis on errors.
- **App-Wide Instant Custom Tooltips (Configurable in Settings → General)**:
  - Automatically upgrades native `title` tooltips across the entire app (Header, Format Toolbar, Sidebar, Tab Bar, Status Bar, Inspector, and Modals) into fast **0.15s** theme-aware Portal tooltips with automatic `<kbd>` shortcut badges and zero edge clipping.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.4.0` では、執筆・AI・ビジネス文書・開発ワークフローを一気に強化する **8つの新機能** を搭載しました（各機能は設定画面から個別に ON / OFF 可能）。

### 主な変更点（`v1.4.0`）
- **Enter 1 回の改行をそのままプレビューに反映する設定（設定 → エディタで ON/OFF・既定 ON）**:
  - 本文中の単一改行（`\n`）をライブプレビュー・HTML 書き出し・HTML コピー・外部ライブプレビューでそのまま `<br>` として改行表示します（コードブロックや数式ブロックには影響しません）。厳密な CommonMark 仕様に戻したい場合は **設定 → エディタ** からいつでも OFF にできます。
- **選択範囲フローティングミニバー（Bubble Menu・設定 → エディタで ON/OFF）**:
  - エディタ上でテキストを選択すると、選択箇所のすぐ上にミニバー（**太字・斜体・コード・リンク・インライン AI 編集・登録済み AIカスタムボタン最大 3 件**）を表示。上部ツールバーまでマウスを往復させずに素早く装飾・翻訳・編集できます。
- **AI ゴーストテキスト補完（`Tab` で確定 / `Esc` で却下・設定 → エディタで ON/OFF）**:
  - 入力を少し止めると、設定中の AI プロバイダー（完全無料＆オフラインの **Apple Foundation Models** / **Ollama** / **LM Studio** 等）で続きを予測し、カーソル位置に薄いグレー文字で表示します（意図しない課金防止のため初期値 OFF、待ち時間 `400〜2500ms` 調整可）。
- **AIカスタムの「プロンプト変数」対応**:
  - AIカスタム（親ボタン＆サブメニュー）のプロンプト内で `{{selection}}` / `{{clipboard}}` / `{{fileName}}` / `{{filePath}}` / `{{language}}` / `{{date}}` / `{{time}}` が自動展開されます。**設定 → AIカスタム** のプロンプト欄下にワンクリック変数挿入チップを追加しました。
- **Markdown テーブル GUI 簡易編集バー（設定 → エディタで ON/OFF）**:
  - Markdown の表内にカーソルがあるとき、エディタ上部に専用操作バーを表示。**行の上下追加・行削除・列の左右追加・列削除・左/中央/右揃え・昇順/降順ソート（数値対応）・列幅整形**をワンクリックで実行できます。
- **PDF / HTML 書き出しのプリセット＆ページ設定**:
  - 上部バーの書き出しメニューやコマンドパレットから **デザインテーマ（モダン / ビジネス / 学術）・用紙サイズ（A4 / Letter / B5）・向き（縦 / 横）・余白・ページ番号（`1 / N`）・ヘッダー / フッター（`{{title}}` 対応）** を指定して書き出しできます。
- **クイック・スクラッチパッド＆グローバル呼び出しショートカット（設定 → 一般で ON/OFF）**:
  - 保存不要で自動永続化される常駐メモ（全文コピー・クリア・**新規タブへ昇格**対応）をステータスバー＆コマンドパレットに追加。
  - 他アプリで作業中でも指定ショートカット（既定 `CommandOrControl+Shift+Space`）で Onigiri Editor を最前面へ呼び出せるグローバルホットキーに対応しました。
- **下部ドロワー「軽量統合ターミナル」（拡張モード・設定 → 一般で ON/OFF）**:
  - ステータスバーまたはコマンドパレットから開閉できる軽量ターミナルを追加。リアルタイム出力、`cd` によるディレクトリ維持、`↑`/`↓` コマンド履歴、停止ボタン、エラー時のワンクリック **「AIで解析」** に対応します。
- **カスタムツールチップのアプリ全体への展開（設定 → 一般で ON/OFF）**:
  - ヘッダー・書式ツールバーに加え、サイドバー・タブバー・ステータスバー・インスペクター・モーダルを含むアプリ全体のオンマウス表示を **0.15秒カスタムツールチップ（`<kbd>` ショートカットバッジ自動分離付き）** に統一しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
