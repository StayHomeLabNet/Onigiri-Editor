Onigiri Editor `v1.3.6` brings **Apple Foundation Models (Apple Intelligence)** on-device AI support for macOS, **Long-Press / Right-Click Submenus** for Toolbar AI Custom Buttons, **All-Mode Status Bar Mode Switching** when the header bar is hidden, and a major **Keyboard Shortcuts Expansion (112 built-in commands + dynamic AI Custom & submenu shortcuts)**.

### Highlights (`v1.3.6`)
- **macOS Only: Apple Foundation Models (Apple Intelligence) On-Device AI Provider**:
  - Select **Apple Foundation Models** under **Local AI** in AI Chat (visible on macOS only) to run Apple's on-device Foundation Models completely offline and free with zero external API keys or servers (requires Apple Silicon Mac running macOS 26+ with Apple Intelligence enabled; weak-linked so older macOS versions still launch safely).
  - Supports both **Apple Intelligence (Default)** and **Apple Intelligence (Content Transformations / Permissive)** modes for smoother translation, proofreading, and rewriting across AI Chat, Inline AI Edit, and Toolbar AI Custom buttons.
  - Features live streaming progress, request cancellation, automatic context-limit safety trimming (~4,096 tokens), and availability diagnostics with a 1-click **Open System Settings** button in Connection Support.
- **Toolbar AI Custom Buttons: Long-Press / Right-Click Submenus (Up to 10 Items per Button)**:
  - **Normal click** runs the primary AI button action as before; **long-press (~0.4s) or right-click** smoothly slides open a downward popover menu when submenus are enabled (indicated by a subtle bottom-right triangle indicator).
  - Configure submenus in **Settings → AI Custom** (off by default): enable the submenu checkbox to automatically scaffold the first item, and add, reorder, edit, or delete up to **10 submenu items** per button—each with its own **24-icon picker**, **name**, **AI prompt**, and independent **Copy to clipboard** / **Replace document (or selection)** checkboxes.
- **Status Bar One-Step Mode Switcher Across All Modes (When Header Bar Is Hidden)**:
  - Whenever the top header bar is hidden, the Status Bar now shows a compact, clickable mode-transition button in every mode:
    - **Simple Mode**: `Simple → Basic`
    - **Basic Mode**: `Basic → Advanced`
    - **Advanced Mode**: `Advanced → Basic`
- **Massive Keyboard Shortcuts Expansion (112 Commands + AI Custom & Submenu Shortcuts)**:
  - Added dedicated direct mode shortcuts (**Simple**: `⌘⌥1` / `Ctrl+Alt+1`, **Basic**: `⌘⌥2` / `Ctrl+Alt+2`, **Advanced**: `⌘⌥3` / `Ctrl+Alt+3`) and expanded **Settings → Keybindings** from 27 to **112 customizable commands** across Mode, File, View/Layout, Edit, Format, AI, Markdown, Note, Data, Browser, Workspace, Git, Macro, Export, Theme, and Settings—now with **category filter chips**.
  - **AI Custom Button & Submenu Shortcuts**: Assign custom keyboard shortcuts to every registered AI Custom button and every enabled submenu item directly from either **Settings → Keybindings** or inline inside **Settings → AI Custom** (synchronized with conflict detection, reflected in toolbar tooltips, submenu badges, Command Palette, and JSON settings backups).
  - **macOS `⌥` (Option) Shortcut Reliability**: Normalized `Alt`/`Option`-modified key events via physical key codes (`e.code`) so shortcuts such as `⌘⌥1` or `⌘⌥T` record and trigger reliably on macOS.

### Downloads
- **macOS (Universal: Apple Silicon & Intel, includes Apple Foundation Models support on macOS 26+)**: `.dmg` / `.app.tar.gz`
- **Windows (x64)**: `.exe` (NSIS installer) / `.msi`
- **Linux (x64)**: `.AppImage` / `.deb`

---

Onigiri Editor `v1.3.6` では、Mac 版限定のオンデバイス AI **Apple Foundation Models（Apple Intelligence）対応**、ツールバー AIカスタムボタンの **長押し／右クリックによるサブメニュー展開**、上部ヘッダーバー非表示時の **全モード対応ステータスバー・モード移動ボタン**、および **全 112 コマンド＋AIカスタム（親ボタン＆サブメニュー）対応のキーボードショートカット大幅拡充** を実装しました。

### 主な変更点（`v1.3.6`）
- **Mac 版限定: Apple Foundation Models（Apple Intelligence）プロバイダー対応**:
  - macOS 版のみ AI チャットの「ローカル AI」一覧に **Apple Foundation Models** を追加。API キーや外部サーバー不要・完全オフラインかつ無料でオンデバイス推論を利用できます（Apple Silicon 搭載 Mac・macOS 26 以降・Apple Intelligence 有効環境で動作。フレームワークは弱リンクのため旧 macOS でも問題なく起動します）。
  - **Apple Intelligence（標準）** と翻訳・校正・リライト向けの **Apple Intelligence（文章変換向け）** の 2 モードを選択可能。AI チャット・選択範囲インライン編集・ツールバー AIカスタムボタンのすべてで利用でき、ストリーミング進捗表示・キャンセル・接続サポートからの「システム設定を開く」ボタンを備えています。
- **AIカスタムボタンの長押し／右クリック＆サブメニュー機能（1 ボタンあたり最大 10 件）**:
  - **通常クリック**で親ボタンを実行し、サブメニューが有効なボタンでは **長押し（約 0.4 秒）または右クリック** で下方向アニメーション付きポップオーバーが開き、登録済みサブメニュー項目を実行できます（サブメニュー付きボタンには右下に小さな三角マークを表示）。
  - **設定 → AIカスタム** の各ボタンカードに「サブメニューを有効にする」チェックボックス（初期値 OFF）を追加。ON にすると自動で 1 件目が用意され、最大 10 件までアイコン（24 種類）・ボタン名・プロンプト・返事の取り扱い（`クリップボードに入れる` / `本文を置き換える`）を個別に設定できます。
- **上部ヘッダーバー非表示時のステータスバー・モード移動ボタン（全モード対応）**:
  - 上部ヘッダーバーを非表示にしている際、どのモードでも下部ステータスバーからワンクリックで 1 ステップ先のモードへ移動できるようになりました：
    - **シンプルモード時**: `シンプル → 標準`
    - **標準モード時**: `標準 → 拡張`
    - **拡張モード時**: `拡張 → 標準`
- **キーボードショートカット大幅拡充（112 コマンド＋AIカスタム＆サブメニュー対応）**:
  - 各モードへのダイレクト切替ショートカット（**シンプル**: `⌘⌥1` / `Ctrl+Alt+1`、**標準**: `⌘⌥2` / `Ctrl+Alt+2`、**拡張**: `⌘⌥3` / `Ctrl+Alt+3`）を新設し、ファイル・表示/レイアウト・編集・書式・AI・Markdown・ノート・データ整形・ブラウザ・Git・マクロ・書き出し・テーマまで **計 112 コマンド** を割り当て可能にしました（**設定 → キーボード** にカテゴリ絞り込みチップを追加）。
  - **AIカスタム（親ボタン＆サブメニュー）へのショートカット割り当て**: 登録した各 AIカスタムボタンおよび有効なサブメニュー項目ごとにショートカットを設定可能。「**設定 → キーボード**」と「**設定 → AIカスタム**」の各カード内のどちらからでも編集・解除・重複チェックでき、ツールバーのツールチップ・サブメニュー右端バッジ・コマンドパレット・JSON バックアップに自動反映されます。
  - **macOS `⌥` (Option) キー併用の精度改善**: macOS で `⌥` 併用時に特殊文字へ変化するキー入力を物理キーコードで正規化し、`⌘⌥1` や `⌘⌥T` などが確実に録音・発火するよう改善しました。

### ダウンロード（バイナリ一覧）
- **macOS（Universal: Apple Silicon / Intel 両対応・macOS 26+ Apple Foundation Models 対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`
