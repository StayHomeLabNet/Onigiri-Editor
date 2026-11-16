Onigiri Editor `v1.0.2` adds a rich editor context menu (with advanced line operations, full-width/half-width conversion, rectangular selection, and bookmarks), matching bracket highlighting, an editor column ruler with wrap-width & whitespace/newline indicators, and comprehensive character encoding & EOL support.

### Highlights (`v1.0.2`)
- **Full Character Encoding & EOL Support**: Auto-detects and supports `UTF-8`, `UTF-8 (BOM)`, `Shift_JIS (CP932)`, `EUC-JP`, `ISO-2022-JP (JIS)`, `UTF-16 LE`, and `UTF-16 BE` plus `LF` / `CRLF`. Click the StatusBar Encoding or EOL pill to **Reopen with Encoding**, **Change Save Encoding**, or open **New File with Encoding…**, configure defaults in **Settings**, and prevent silent corruption with an unmappable character check on save.
- **Editor Right-Click Context Menu**: Adds Undo/Redo, Cut/Copy/Paste/Delete, Select All, **Rectangular Selection** (`Ctrl/Cmd+B` + Alt+Drag), **Advanced** line transforms (Tab/Space indent, comments, spaces↔tabs, case conversion, line reverse/sort/dedupe, trim whitespace, `>` quote toggle, wrap/unwrap line breaks), **Full-width / Half-width Conversion** (`半角－全角変換`), and **Bookmarks** with gutter markers.
- **Ruler, Wrap Modes & Visible Symbols**: Adds a column ruler (`EditorRuler`), selectable wrap modes (Window Width / Fixed Column / No Wrap), visible newline (`↓`) & whitespace symbols, StatusBar visibility toggle, and **Matching Bracket Highlighting** (`()`, `[]`, `{}`, `「」`, `（）`, etc.)—all configurable in Settings and Command Palette.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.0.2` では、エディタ右クリックメニュー（高度な行操作・半角／全角変換・矩形選択・ブックマーク）、対応括弧のハイライト、ルーラー・折り返し幅／改行・空白記号表示、および文字コード・改行コードの指定読み込み・指定新規作成・変換保存機能を追加しました。

### 主な変更点（`v1.0.2`）
- **文字コード・改行コードの全面対応**: `UTF-8` / `UTF-8 (BOM)` / `Shift_JIS (CP932)` / `EUC-JP` / `ISO-2022-JP (JIS)` / `UTF-16 LE` / `UTF-16 BE` の自動判別と `LF` / `CRLF` に対応しました。ステータスバー、ファイルメニュー、コマンドパレットから **文字コードを指定して再読み込み**・**文字コードを指定して新規作成**・**保存時文字コード変更** ができ、設定画面で新規作成時の既定値も指定可能です。保存時には表現不可文字（絵文字等）の文字化けを検知してエラー通知します。
- **エディタ右クリックコンテキストメニュー**: 元に戻す／やり直し・切り取り／コピー／貼り付け・**矩形選択**・**高度な操作**（Tab/Space インデント、コメント挿入／削除、スペース⇔タブ変換、大文字／小文字、行の逆順／ソート／重複削除、前後空白削除、`>` 引用、折り返し位置改行／改行削除）・**半角－全角変換**・**ブックマーク**（ガターマーカー付き）を追加しました。
- **ルーラー・折り返し設定・記号表示＆括弧ハイライト**: 列ルーラー（目盛り）、折り返し方法（ウィンドウ右端／指定文字数／折り返さない）、改行記号・空白記号の可視化、ステータスバー表示切替、および `()` や `「」` 等の**対応括弧ハイライト**（設定で ON/OFF 可）を追加しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
