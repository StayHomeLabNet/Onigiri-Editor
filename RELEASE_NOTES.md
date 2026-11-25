Onigiri Editor `v1.5.4` strengthens the AI Harness and AI Memory architecture—adding automatic `AGENTS.md` / `CLAUDE.md` rule injection, unified progress & error diagnostics, 2-model parallel A/B comparison, `cli-direct` checkpoint guards, an AI execution audit log, global/workspace pinned AI memory, long thread compaction, context visibility chips, and Knowledge Index note suggestions (all toggleable in **Settings → General**).

### Highlights (`v1.5.4`)
- **AI Harness Enhancements (`Settings → General` toggles)**:
  - **Auto-Load Project Rules (`AGENTS.md` / `CLAUDE.md` / `.onigiri-rules.md`)**: Automatically detects workspace-root rule files and injects them into AI Chat, Inline AI Edit, Toolbar AI Custom Buttons, and AI Document Review.
  - **Unified Progress & Error Diagnostics**: Extends `listenAiChatProgress` live streaming status and categorized `aiErrorHint.ts` troubleshooting hints to Toolbar AI Custom Buttons and AI Document Review.
  - **2-Model Parallel A/B Comparison**: Run a primary model and a comparison model side-by-side in **Inline AI Edit (`⌘⇧E`)** and **AI Chat**, and apply the better result.
  - **`cli-direct` Pre-Run Checkpoint Guard**: Captures workspace state before `cli-direct` writes and surfaces modified files after execution.
  - **AI Execution Audit Log**: Records masked prompt previews, provider/model, duration, and apply status with 1-click re-run support.
- **AI Memory & Context Intelligence**:
  - **Explicit Pinned AI Memory (Global / Workspace)**: Manage persistent rules in **Settings → General** or pin directly from any chat message (`Pin`) for injection across all AI pathways.
  - **Long Thread Compaction & 1-Click Save Rule**: Compact older chat turns into a persistent summary pill (retaining the latest 6 messages) and append effective instructions straight to `AGENTS.md` / `.onigiri-rules.md`.
  - **Context Visibility Bar & Related Note Suggestions**: Inspect active context chips (`Doc`, `Folder`, `AGENTS.md`, `Memory (N)`, `History`) above the chat composer with 1-click mute toggles, and attach up to 3 relevant workspace notes suggested from the Knowledge Index (`@relativePath`).

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.4` では、AI ハーネス基盤と AI メモリー機能を大幅に強化しました。`AGENTS.md` / `CLAUDE.md` 自動読み込み、全 AI 経路での進捗・エラー診断統一、2 モデル並列 A/B 比較、`cli-direct` チェックポイントガード、AI 実行履歴ログに加え、ピン留め AI メモリー、スレッド要約圧縮、文脈可視化バー、ナレッジ関連ノート提案を実装しています（各種機能は **設定 → 全般** で ON/OFF 切替可能）。

### 主な変更点（`v1.5.4`）
- **AI ハーネス基盤の強化（`設定 → 全般` で各種 ON/OFF 可）**:
  - **`AGENTS.md` / `CLAUDE.md` / `.onigiri-rules.md` 自動読み込み**: ワークスペース直下の規約ファイルを自動検出し、AI チャット・インライン編集・AI カスタムボタン・AI 校正へ自動注入します。
  - **進捗表示＆エラー診断の統一**: ツールバー AI カスタムボタンおよび AI 校正でも、`listenAiChatProgress` のリアルタイム進捗と `aiErrorHint.ts` の原因別対処ヒントを表示します。
  - **2 モデル並列 A/B 比較**: **インライン AI 編集（`⌘⇧E`）** と **AI チャット** で比較用セカンダリモデルを並列実行し、出力を並べて比較・適用できます。
  - **`cli-direct` 実行前チェックポイントガード**: ワークスペース直接書き込み前に状態を記録し、実行後に変更ファイル一覧を確認できます。
  - **AI 実行履歴（監査・再実行ログ）**: シークレットマスク済みプロンプト・使用モデル・所要時間・適用有無を記録し、ワンクリックで再実行できます。
- **AI メモリー ＆ 文脈インテリジェンス**:
  - **明示的ピン留めメモリー（グローバル／ワークスペース別）**: **設定 → 全般** での編集やチャットメッセージ横のピン留めボタンからルールを登録し、全 AI 経路へ自動注入します。
  - **長いスレッドの要約圧縮 ＆ `AGENTS.md` 追記**: 過去の会話を要約ピルへ圧縮して直近 6 件を保持でき、チャットでうまくいった指示をワークスペース規約ファイルへワンクリック追記できます。
  - **コンテキスト可視化バー ＆ ナレッジ関連ノート提案**: 入力欄上部に送信中の文脈チップ（文書・フォルダ・`AGENTS.md`・メモリー件数・履歴件数）を表示して一時ミュートできるほか、ナレッジインデックスから関連ノートを最大 3 件提案して `@相対パス` で即添付できます。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
