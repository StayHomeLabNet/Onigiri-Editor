Onigiri Editor `v1.3.5` introduces **Toolbar AI Custom Buttons**, allowing you to register up to **5 customizable one-click AI action buttons** directly in the Format Toolbar across all modes—complete with a built-in **AI Translate** preset, 24 selectable icons, hover tooltips, custom prompts, and independent **Copy to Clipboard** / **Replace Content** options.

### Highlights (`v1.3.5`)
- **Toolbar AI Custom Buttons (Up to 5 Configurable Buttons, All Modes)**:
  - Displays your registered AI Custom buttons right next to the formatting controls on the Format Toolbar (immediately to the right of the Table button in Basic/Simple modes) across **Simple**, **Basic**, and **Advanced** modes.
  - **Preloaded Default Preset (`AI翻訳` / AI Translate)**: Ships with 1 ready-to-use button configured to automatically translate English to Japanese or Japanese to English and replace the target text with only the translation result.
  - **Dedicated `Settings → AI Custom` Tab**: Add, reorder, edit, delete, or reset up to 5 buttons with:
    - **24-Icon Visual Picker** (Lucide icons matching the toolbar)
    - **Button Name** (displayed as a hover tooltip on the toolbar)
    - **Custom AI Prompt**
    - **Independent Output Checkboxes**: **Copy to clipboard** and/or **Replace document (or selection)** (can be enabled individually or together)
  - **Smart Selection / Full-Document Execution & Instant Undoable Replace**:
    - Sends the **selected text** when a selection is active, or the **entire document** when nothing is selected, using your currently configured AI Chat provider and model.
    - Preserves editor selection on click, replaces immediately without an extra modal while preserving CodeMirror Undo history (`⌘Z` / `Ctrl+Z` reverts in one step), shows a live spinner while running, and lets you click the running button again to cancel.
  - **Full EN / JA Localization & Settings Backup Support**: All new UI labels, tooltips, and status toasts are localized in Japanese and English, and custom buttons are automatically persisted and included in JSON settings backups.

### Downloads
- **macOS (Universal: Apple Silicon & Intel)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.5` では、書式ツールバーに最大 **5 つまで任意の AI 実行ボタン**を登録できる **「AIカスタム」ボタン機能** を追加しました。初期プリセットとして「**AI翻訳**」を 1 件同梱しており、アイコン・ホバー表示名・プロンプト・出力方法（クリップボード／本文置換）を設定画面から自由にカスタマイズできます。

### 主な変更点（`v1.3.5`）
- **ツールバー「AIカスタム」ボタン機能（最大 5 件・全モード対応）**:
  - 書式ツールバーのフォーマットボタン群の右隣（標準／シンプルモードではテーブルボタンの右隣）に、登録した AIカスタムボタンを **最大 5 つまで** 表示します（シンプル / 標準 / 拡張の全モード対応）。
  - **初期プリセット「AI翻訳」を 1 件収録**: 英文であれば日本語に、日本語であれば英文に翻訳し、翻訳結果のみで本文（または選択範囲）を置き換えるボタンを初期状態からすぐに利用できます。
  - **設定 →「AIカスタム」タブを新設**: 最大 5 つまでの追加・並び替え・編集・削除・初期プリセット復元に対応し、各ボタンで以下を設定できます。
    - **アイコン選択**（24 種類のアイコンピッカー）
    - **アイコン名**（ツールバー上でオンマウス表示）
    - **AI へのプロンプト**
    - **AI からの返事の取り扱い**（`クリップボードに入れる` / `本文を置き換える（選択中は選択範囲）` のチェックボックス、両方同時 ON も可）
  - **選択範囲／本文全体の自動判定・即時置換・キャンセル対応**:
    - テキスト選択中なら**選択範囲のみ**、未選択時は**本文全体**を対象に、AI チャットで選択中の AI プロバイダー・モデルで実行します。
    - 置換は確認ダイアログを挟まず即座に反映され、CodeMirror の履歴に積まれるため **`⌘Z` / `Ctrl+Z` で 1 ステップで元に戻せます**。実行中はボタンにスピナーが表示され、再クリックでキャンセルできます。
  - **日本語・英語 UI 完全対応 ＆ 設定バックアップ対応**: すべての設定ラベル・ツールチップ・トースト通知を日英両対応し、設定 JSON バックアップの書き出し・復元にも対応しています。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
