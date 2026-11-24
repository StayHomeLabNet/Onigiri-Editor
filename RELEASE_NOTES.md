Onigiri Editor `v1.5.0` expands UI & native menu localization from 2 to **8 languages** (**English**, **日本語**, **简体中文**, **繁體中文**, **한국어**, **Español**, **Français**, and **Deutsch**) with OS locale auto-detection, a TopBar 8-language dropdown switcher, English fallback merging, a locale-aware **AI Translate** preset, Apple Intelligence model picker labels in **Settings → AI Custom**, and an expanded Welcome sample document.

### Highlights (`v1.5.0`)
- **8-Language UI & Native Menu Localization**:
  - **6 New Language Packs**: Added **Simplified Chinese (`zh-CN`)**, **Traditional Chinese (`zh-TW`)**, **Korean (`ko`)**, **Spanish (`es`)**, **French (`fr`)**, and **German (`de`)** alongside **English (`en`)** and **Japanese (`ja`)**, backed by `mergeTranslations` so any omitted keys safely fall back to English.
  - **TopBar Language Dropdown & Settings Selector**: Replaced the 2-way `EN / 日本語` toggle with an 8-language dropdown menu in the TopBar and updated **Settings → General & View** to list all 8 supported languages.
  - **OS Locale Auto-Detection & Native Menu Bar**: Extended `get_os_locale` (macOS / Windows / Linux) and the Rust native application menu (`menu.rs`) to support all 8 locales automatically.
- **Localized Default `AI Translate` Preset & Apple Intelligence Picker Fix**:
  - **Locale-Aware `AI Translate` Preset**: The default **AI Translate** toolbar button now adapts its label and prompt across all 8 languages (pairing each non-Japanese language with English, and Japanese/English together) on language switch or preset reset, while preserving user-edited prompts and per-button model overrides.
  - **Apple Foundation Models Model Picker (`Settings → AI Custom`)**: Displays readable labels (**Apple Intelligence (Default)** / **Apple Intelligence (Content Transformations)**) when selecting Apple Foundation Models per button or submenu item.
- **Expanded Welcome Sample Document**:
  - Updated the built-in Welcome sample document across all locales to showcase live preview sync, AI custom buttons, slash commands, Mermaid diagrams, KaTeX math, and multi-language editing.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.5.0` では、UI とネイティブメニューの対応言語を従来の 2 言語から **8 言語**（**English**・**日本語**・**简体中文**・**繁體中文**・**한국어**・**Español**・**Français**・**Deutsch**）へ拡張し、OS ロケール自動判定・トップバー言語ドロップダウン・英語フォールバックマージ・言語連動「AI翻訳」プリセット・Apple Intelligence モデル選択表示修正・ウェルカムサンプル拡充を行いました。

### 主な変更点（`v1.5.0`）
- **UI ＆ネイティブメニューの 8 言語対応**:
  - **6 言語パックの新規追加**: 従来の **日本語 (`ja`)**・**英語 (`en`)** に加え、**簡体字中国語 (`zh-CN`)**・**繁体字中国語 (`zh-TW`)**・**韓国語 (`ko`)**・**スペイン語 (`es`)**・**フランス語 (`fr`)**・**ドイツ語 (`de`)** を追加し、未翻訳キーも英語へ安全にフォールバックするマージ基盤（`mergeTranslations`）を導入しました。
  - **トップバー言語ドロップダウン＆設定セレクタ**: ヘッダー右上の `EN / 日本語` 2 択トグルを 8 言語対応のドロップダウンメニューへ刷新し、**設定 → 全般・表示** の言語選択も全 8 言語に対応しました。
  - **OS ロケール自動判定＆ネイティブメニューバー多言語化**: macOS / Windows / Linux の OS 言語自動判定（`get_os_locale`）と Rust 側ネイティブメニューバー（`menu.rs`）を 8 言語化しました。
- **デフォルト「AI翻訳」プリセットの 8 言語追従＆Apple Intelligence モデル選択表示修正**:
  - **言語連動「AI翻訳」プリセット**: ツールバーの初期プリセット（`AI翻訳`）が全 8 言語に対応し、言語切り替え時や初期プリセット復元時に、選択モデルやユーザー独自の編集を維持したまま「その言語 ↔ 英語」（英語時は「英語 ↔ 日本語」）の翻訳プロンプトへ自動切り替わるようになりました。
  - **Apple Foundation Models 選択表示（`設定 → AIカスタム`）**: ボタン／サブメニュー毎のモデル選択で Apple Foundation Models を選んだ際に、`Apple Intelligence（標準）` / `Apple Intelligence（文章変換向け）` を分かりやすく選択できるよう修正しました。
- **ウェルカムサンプルドキュメント拡充**:
  - 初期表示されるサンプルドキュメント（`ようこそ.md` / `Welcome.md`）を拡充し、AI カスタムボタン・スラッシュコマンド・Mermaid 図・KaTeX 数式・双方向プレビュー同期などをすぐに試せる内容に更新しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
