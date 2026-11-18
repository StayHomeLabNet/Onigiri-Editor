Onigiri Editor `v1.0.6` introduces side-by-side tab split & 2-tab diff comparison, keyboard macro recording & playback, inline AI selection editing (`⌘⇧E` / `Ctrl+Shift+E`), a clickable Status Bar language selector, CodeMirror code folding & `⌘D` multi-occurrence selection, pinned/draggable tabs, folder-wide Search & Replace, tree context menus with a Close Workspace Folder action, synced Recent Files & Folders history, and source/text print & PDF export.

### Highlights (`v1.0.6`)
- **Side-by-Side Tab Split & 2-Tab Diff Comparison**:
  - Open any second tab in the right pane to **edit two tabs side-by-side** or switch to **Diff Compare** mode with left/right swap, available from the Tab Bar context menu or Command Palette.
- **Keyboard Macro Recording & Playback (`⌘⇧M` / `⌘⇧P`)**:
  - Record and replay typing, cursor movement, deletions, clipboard actions, toolbar buttons, and context-menu operations across CodeMirror sessions via the Format Toolbar (`REC` / `Play`), native **Edit** menu, or Command Palette.
- **Inline AI Edit on Selection (`⌘⇧E` / `Ctrl+Shift+E`)**:
  - Invoke an AI edit directly on the selected text or code with one-click presets (**Refactor**, **Add Comments**, **Fix Bugs / Typos**, **Make Concise**, **Polite Tone**, **Translate JA / EN**) and review the line-by-line Diff Preview before applying.
- **Status Bar Language Override Selector**:
  - Click the active language pill in the Status Bar (`Markdown`, `TypeScript`, `PHP`, `Python`, `Rust`, etc.) to override the tab's syntax highlighting and preview mode regardless of file extension.
- **Code Folding, Match Highlighting (`⌘D`) & Auto-Close Brackets**:
  - Added CodeMirror fold gutters with **Fold All / Unfold All** commands, selection match highlights with **`⌘D` / `Ctrl+D`** next-occurrence selection, and configurable auto-closing brackets/quotes in **Settings**.
- **Tab Bar, Sidebar Tree, Folder Replace & Recent History**:
  - **Tab Bar**: Pin/unpin tabs, drag-and-drop reorder tabs, middle-click to close, and use the right-click Tab context menu.
  - **Sidebar & Workspace**: Added file/folder right-click operations (**New File**, **New Folder**, **Rename**, **Duplicate**, **Delete**, **Copy Path**, **Reveal**), root **New Folder**, a **Close Workspace Folder** icon (guarded against active dev servers), and **Folder-Wide Search & Replace**.
  - **Recent Files & Folders**: Persists recent files and folders and syncs them to the native **File → Open Recent** menu, Sidebar (when no folder is open), and Command Palette.
- **Source / Plain Text Print & PDF Export**:
  - Print or export clean formatted source code and plain-text documents directly when editing non-Markdown files.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.6` では、タブの左右分割＆2タブ差分比較、キーボードマクロの記録・再生、選択範囲へのインライン AI 編集（`⌘⇧E` / `Ctrl+Shift+E`）、ステータスバーからの言語切り替え、CodeMirror のコード折りたたみ＆`⌘D` 次の一致選択、ピン留め・ドラッグ並び替え対応タブ、フォルダー一括置換＆ツリー右クリック操作（作業フォルダー指定解除アイコン含む）、最近使ったファイル／フォルダー履歴同期、およびソースコード印刷・PDF 出力を追加しました。

### 主な変更点（`v1.0.6`）
- **タブの左右分割表示＆2タブ差分比較**:
  - タブ右クリックメニューやコマンドパレットから別のタブを右ペインに並べて **左右分割編集** または **2タブ差分比較**（左右入替対応）を行えるようにしました。
- **キーボードマクロの記録・再生（`⌘⇧M` / `⌘⇧P`）**:
  - 文字入力・カーソル移動・削除・クリップボード操作・書式ツールバー・コンテキストメニュー操作を記録してワンクリック／ショートカットで再生できるマクロ機能を追加しました（セッションをまたいで保持）。
- **選択範囲のインライン AI 編集（`⌘⇧E` / `Ctrl+Shift+E`）**:
  - 選択中のテキストやコードに対して指示を出して書き換えられるモーダルを追加しました（リファクタ／コメント追加／バグ・誤字修正／簡潔化／丁寧な表現／日英翻訳プリセット付き、適用前に Diff プレビューで確認可能）。
- **ステータスバーの言語切り替えセレクタ**:
  - ステータスバーの言語表示をクリックし、拡張子に依存せずタブ単位でシンタックスハイライトやプレビュー種別を切り替えられるようにしました。
- **コード折りたたみ・一致ハイライト（`⌘D`）・自動括弧閉じ**:
  - CodeMirror に折りたたみガター（すべて折りたたむ／すべて展開）と選択語句の一致ハイライト＆**`⌘D` / `Ctrl+D`** で次の一致を追加選択する機能、自動括弧閉じ（設定で ON/OFF 可）を追加しました。
- **タブバー・サイドバー操作・フォルダー一括置換・最近の履歴**:
  - **タブバー**: ピン留め、ドラッグ＆ドロップ並び替え、中クリック閉じ、右クリックコンテキストメニューに対応しました。
  - **サイドバー＆ワークスペース**: ツリー右クリック操作（新規ファイル／新規フォルダー／名前変更／複製／削除／パスコピー／ファイラーで表示）、ルート直下の新規フォルダー作成、**作業フォルダーの指定を解除** アイコン（開発サーバー稼働中の保護モーダル連携）、および **フォルダー一括置換** を追加しました。
  - **最近使ったファイル／フォルダー**: 履歴を保存し、OS ネイティブメニューの **ファイル → 最近開いた項目**・未選択時のサイドバー・コマンドパレットと同期します。
- **ソースコード／プレーンテキスト印刷＆PDF 書き出し**:
  - Markdown 以外のソースコードやテキストファイルでも、整形されたコード印刷／PDF 出力に対応しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
