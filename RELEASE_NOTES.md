Onigiri Editor `v1.5.3` enhances the AI Harness experience with live wait-time visibility and error guidance, upgrades the CSV / TSV Table Preview with multi-MB virtual scrolling and bidirectional selection sync, adds a toggle for cell copy on double-click, updates all 8 Welcome documents, and further modularizes `App.tsx` and `EditorPane.tsx`.

### Highlights (`v1.5.3`)
- **AI Harness Wait-Time Visibility & Error Guidance**:
  - **AI Ghost Text Loading & Error Toast**: Displays a subtle pulsing inline `…` indicator while waiting for AI completions (guarded so `Tab` never inserts the placeholder) and shows throttled, actionable provider hints if a request fails.
  - **Inline AI Edit Progress & Troubleshooting (`aiErrorHint.ts`)**: Shows elapsed seconds, live `ai-chat-progress` CLI status updates, an indeterminate progress bar, and categorized troubleshooting hints (missing CLI, auth/API key, timeout, local server, Apple Intelligence).
- **CSV / TSV Table Preview Overhaul & Large-File Virtualization**:
  - **Multi-MB Virtual Scrolling**: Virtualizes both Table and Raw views using `useDeferredValue` and viewport windowing so multi-MB CSV files stay responsive.
  - **Bidirectional Editor ⇔ Table Highlight**: Selecting or clicking cells (or substrings inside cells) highlights the exact corresponding range in the editor, and moving the cursor or selecting text in the editor highlights and scrolls to the matching cells/substrings in the table.
  - **Spreadsheet Polish & Cell-Copy Setting**: Added sticky `#` row numbers, right-aligned numeric columns with `Σ / Avg / Min / Max` stats, delimiter switcher (`Auto` / `,` / `Tab` / `;`), wrap toggle, filter match highlights, and a **Settings → Editor** toggle to enable/disable double-click cell copying.
- **Expanded Welcome Document & Architecture Refactoring**:
  - Updated `Welcome.md` / `ようこそ.md` across all 8 languages to highlight Onigiri Editor's **AI Harness** capabilities and **CSV / TSV Table Preview**.
  - Extracted `AppModals.tsx`, `EditorInlinePopup.tsx`, and `editorContextActions.ts` to keep `App.tsx` and `EditorPane.tsx` cleaner and easier to maintain.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.3` では、AI ハーネスとしての待ち時間可視化・エラー案内強化、CSV / TSV テーブルプレビューの大容量仮想スクロール＆双方向ハイライト対応、セルコピー設定の ON/OFF 切替、全 8 言語のウェルカムドキュメント更新、および `App.tsx` / `EditorPane.tsx` のさらなるモジュール分割を実施しました。

### 主な変更点（`v1.5.3`）
- **AI ハーネス待ち時間の可視化 ＆ エラー対処ヒント**:
  - **ゴーストテキスト生成中表示＆エラー通知**: 応答待ち中にカーソル位置へ控えめなパルス付き `…` を表示し（待機中の `Tab` 誤挿入を防止）、失敗時はクールダウン付きで原因と対処ヒントをステータス通知に表示します。
  - **インライン AI 編集の進捗表示＆診断ヒント（`aiErrorHint.ts`）**: 経過秒数・`ai-chat-progress` のリアルタイム進捗・プログレスバーを表示し、CLI 未検出／認証・API キー／タイムアウト／ローカル AI 未起動等の原因に応じた具体的な対処ヒントを提示します。
- **CSV / TSV テーブルプレビューの大幅強化 ＆ 大容量高速化**:
  - **数 MB 級 CSV 対応の仮想スクロール**: テーブル表示・Raw 表示の双方をウィンドウ仮想化し、`useDeferredValue` と合わせて大容量 CSV でも軽快に動作するよう最適化しました。
  - **エディター ⇔ テーブル双方向ハイライト**: エディター側のカーソル／文字列選択とテーブル側のセル／部分文字列選択が双方向にリアルタイムハイライト連動します。
  - **スプレッドシート操作性＆セルコピー設定**: 行番号列固定、数値列の自動右寄せ＆集計表示（合計・平均・最小・最大）、区切り文字切替（自動/`,`/`Tab`/`;`）、折り返しトグル、検索一致ハイライト、および **設定 → エディタ** での「セルのダブルクリックコピー ON/OFF」切替を追加しました。
- **全 8 言語ウェルカムドキュメント更新 ＆ リファクタリング**:
  - 全 8 言語の `ようこそ.md` / `Welcome.md` に AI ハーネスとしての側面と CSV / TSV テーブルプレビュー機能の紹介を追記しました。
  - `AppModals.tsx`・`EditorInlinePopup.tsx`・`editorContextActions.ts` を切り出し、`App.tsx` と `EditorPane.tsx` の保守性をさらに高めました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
