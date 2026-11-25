Onigiri Editor `v1.5.2` introduces multi-window support, interactive preview image controls, link-card thumbnails, a resizable Inline AI Edit modal, Japanese IME support for AI Ghost Text autocomplete, and expanded Welcome guides across all 8 languages.

### Highlights (`v1.5.2`)
- **Multi-Window Support (`⌘ + ⇧ + N` / `Ctrl + Shift + N`) & Release Hardening**:
  - Open independent editor windows from the **File → New Window** menu or shortcut with per-window scoped session state, focused-window menu action routing, and release-build WebView DevTools hardening.
- **Interactive Preview Images & Link Card Thumbnails**:
  - Float images left/right with text wrap, cycle widths (`200 / 280 / 380px`), and edit Alt text or delete directly inside the visual preview.
  - Add optional thumbnail image URLs (with toggle) to Markdown link cards in the Citation / Link Card modal.
- **Resizable Inline AI Edit Modal & AI Ghost Text IME Fix**:
  - Resize the Inline AI Edit modal by dragging edges/corners (persisted across sessions) or expand it to fill the viewport.
  - Fixed AI Ghost Text autocomplete to trigger properly after Japanese IME composition commits (`compositionend`), handle leading newlines in AI responses, and added `cmGhostText` unit tests.
- **Expanded Welcome Document Across All 8 Languages**:
  - Updated `ようこそ.md` / `Welcome.md` across all 8 languages (`en`, `ja`, `zh-CN`, `zh-TW`, `ko`, `es`, `fr`, `de`) to cover the full feature set, shortcuts, Mermaid workflows, and interactive examples.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.2` では、マルチウィンドウ対応、プレビュー上の画像インタラクティブ操作、リンクカードサムネイル対応、インライン AI 編集モーダルのリサイズ対応、AI ゴーストテキスト補完の日本語 IME 対応、および全 8 言語でのウェルカムドキュメント拡充を行いました。

### 主な変更点（`v1.5.2`）
- **マルチウィンドウ対応（`⌘ + ⇧ + N` / `Ctrl + Shift + N`）＆リリースビルド強化**:
  - **ファイル → 新しいウィンドウ** またはショートカットから独立したウィンドウを開けるようになり、ウィンドウごとのセッション分離、フォーカス中ウィンドウへのメニューイベント振り分け、リリースビルド時の WebView DevTools 無効化を実装しました。
- **プレビュー上の画像操作＆リンクカードサムネイル対応**:
  - ビジュアルプレビュー上で画像の左寄せ／右寄せ（テキスト回り込み）、幅切替（`200 / 280 / 380px`）、Alt テキスト編集、削除を直接操作できるようになりました。
  - 引用／リンクカードモーダルで任意のサムネイル画像 URL（表示 ON/OFF 切替付き）を指定できるようになりました。
- **インライン AI 編集モーダルのリサイズ対応＆AI ゴーストテキスト日本語 IME 修正**:
  - インライン AI 編集モーダルの端・角ドラッグによる自由リサイズ（サイズ自動保存）および拡大表示トグルを追加しました。
  - AI ゴーストテキスト補完が日本語 IME 変換確定（`compositionend`）後にも正しく発火し、AI 応答の先頭空行で破棄されないよう修正するとともに、単体テスト（`ghostText.test.ts`）を追加しました。
- **全 8 言語のウェルカムドキュメント拡充**:
  - `ようこそ.md` / `Welcome.md` を全 8 言語（`en` / `ja` / `zh-CN` / `zh-TW` / `ko` / `es` / `fr` / `de`）で拡充し、最新機能・ショートカット・Mermaid ワークフロー図・インタラクティブ体験を網羅しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
