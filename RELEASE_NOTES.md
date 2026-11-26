Onigiri Editor `v1.5.6` transforms the **CSV / TSV Data Preview** into an **Excel-like interactive spreadsheet** with direct cell typing, formula evaluation & pointing mode, AutoFill series, rich context menus, `.xlsx` / `.ods` binary export, and expanded specialized live previews.

### Highlights (`v1.5.6`)
- **Excel-Like Spreadsheet Editing & Formula Engine (CSV / TSV)**:
  - **Direct Typing & Keyboard Navigation**: Start typing directly (including Japanese/CJK IME) on any selected cell without double-clicking; navigate with `Enter` / `Shift+Enter`, `Tab` / `Shift+Tab`, `Arrow` keys, `F2`, and `Escape`.
  - **Formula Bar & Built-in Formula Engine**: Supports `=` formulas (`SUM`, `AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `COUNTIF`, `SUMIF`, `IF`, `IFERROR`, `ISERROR`, `ISBLANK`, `ISNUMBER`, `AND`, `OR`, `NOT`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `SQRT`, `POWER`, `MOD`, `INT`, `FLOOR`, `CEILING`, `CONCAT`, `LEN`, `UPPER`, `LOWER`, `TRIM`, `LEFT`, `RIGHT`, `MID`, `SUBSTITUTE`, `TODAY`, `NOW`, `%` postfix operator, and circular reference detection), plus **`.xlsx` / `.ods` binary export**.
  - **Formula Pointing Mode**: Click another cell while editing a `=` formula to insert its reference (`B2`), or drag across cells to insert a range (`B2:D2`), with live dashed highlights on referenced cells.
  - **Range Selection & AutoFill**: Drag across cells to select ranges with outer border framing and live `Σ / Avg / Count` footer stats; drag or double-click the bottom-right `+` handle (`Ctrl/Option` toggles Copy vs. Series) with Excel-style AutoFill options smart tag (`Copy`, `Series`, `Dates`, `Weekdays`, `Months`, `Years`, `Days/Months`, `Quarters`).
  - **Rich Right-Click Context Menu**: Cut (`⌘X`), Copy (`⌘C`), Copy Value, Paste (`⌘V` with relative formula reference shifting), Paste Values Only, Insert/Delete Row & Column (automatically adjusting existing formula references), and Clear Contents.
- **Expanded Specialized Live Previews**:
  - Dedicated live preview panes for JSON, YAML/TOML, `.env`, CSS, Diff, HTTP, Logs, OpenAPI, Mermaid/Diagrams, LaTeX, and SVG.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.6` では、**CSV / TSV データプレビューを Excel ライクなインタラクティブ表計算**へと大幅に強化し、セル選択中の直接タイピング入力、数式エンジン＆ポイントモード、オートフィル、充実した右クリックメニュー、`.xlsx` / `.ods` バイナリ書き出し、および各種専用ライブプレビューを追加しました。

### 主な変更点（`v1.5.6`）
- **Excel ライクな表計算編集＆数式エンジン（CSV / TSV）**:
  - **直接タイピング入力＆Excel 風ナビゲーション**: ダブルクリック不要で、セルを選択したまま文字や `=`、日本語 IME を直接入力できます。`Enter` / `Shift+Enter`・`Tab` / `Shift+Tab`・矢印キー・`F2`・`Escape` による直感的な移動と確定に対応しました。
  - **数式バー＆内蔵数式エンジン**: `=` で始まる数式（`SUM` / `AVERAGE` / `MIN` / `MAX` / `COUNT` / `COUNTA` / `COUNTIF` / `SUMIF` / `IF` / `IFERROR` / `ISERROR` / `ISBLANK` / `ISNUMBER` / `AND` / `OR` / `NOT` / `ROUND` / `ROUNDUP` / `ROUNDDOWN` / `ABS` / `SQRT` / `POWER` / `MOD` / `INT` / `FLOOR` / `CEILING` / `CONCAT` / `LEN` / `UPPER` / `LOWER` / `TRIM` / `LEFT` / `RIGHT` / `MID` / `SUBSTITUTE` / `TODAY` / `NOW`、`%` 演算子、循環参照検出）を評価でき、数式を保持したまま **`.xlsx` / `.ods` 形式で保存**できます。
  - **数式ポイントモード**: `=` 数式を入力中に他のセルをクリックすると `B2`、ドラッグすると `B2:D2` が自動入力され、参照先のセルが破線枠でハイライトされます。
  - **範囲選択＆オートフィル**: 複数セルのドラッグ範囲選択（外周枠線＆フッターの合計・平均・個数リアルタイム表示）、右下角 `+` ハンドルのドラッグ／ダブルクリックによるオートフィル（`Ctrl/Option` でコピー⇔連番切替、連続データ／日付／週日／月／年／曜日／四半期、スマートタグメニュー付き）に対応しました。
  - **充実した右クリックメニュー**: 切り取り（`⌘X`）・コピー（`⌘C`）・計算結果をコピー・貼り付け（`⌘V`・数式の相対参照自動シフト対応）・値のみ貼り付け・行/列の挿入と削除（既存数式の参照自動調整付き）・内容クリアを備え、他セルクリックや `Escape` で確実に閉じます。
- **専用ライブプレビューの拡充**:
  - JSON / YAML / TOML / `.env` / CSS / Diff / HTTP / Log / OpenAPI / Mermaid 図表 / LaTeX / SVG の専用ライブプレビューを整備しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
