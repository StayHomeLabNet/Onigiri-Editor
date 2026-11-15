<div align="center">
  <img src="public/icon.png" alt="Onigiri Editor" width="96" height="96" />
  <h1>Onigiri Editor 🍙</h1>
  <p><strong>シンプル / 標準 / 拡張の3モード、双方向行ハイライト同期、AI連携・Diffプレビュー、内蔵Webブラウザを備えたAI時代・クロスプラットフォーム対応エディタ</strong></p>
  <p>
    <a href="README.md">English</a> | <strong>日本語</strong>
  </p>
  <p>
    <a href="#概要">概要</a> ・
    <a href="#主な機能">主な機能</a> ・
    <a href="#動作環境">動作環境</a> ・
    <a href="#ビルド">ビルド</a> ・
    <a href="#v101-の更新内容">v1.0.1 の更新内容</a> ・
    <a href="#基本的な使い方">基本的な使い方</a> ・
    <a href="#ダウンロード">ダウンロード</a> ・
    <a href="#ライセンス">ライセンス</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-1.0.1-blue" alt="version" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="license" />
    <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-orange" alt="platform" />
    <img src="https://img.shields.io/badge/framework-Tauri%20v2-purple" alt="framework" />
    <img src="https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-blueviolet" alt="frontend" />
    <img src="https://img.shields.io/badge/backend-Rust-lightgrey" alt="backend" />
  </p>
  <p>
    <a href="https://ko-fi.com/stayhomelabnet"><img src="https://img.shields.io/badge/Ko--fi-Support%20StayHomeLabNet-ff5e5b?style=for-the-badge&logo=kofi&logoColor=white" alt="Ko-fi" /></a>
    <a href="https://buymeacoffee.com/stayhomelabnet"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20StayHomeLabNet-ffdd00?style=for-the-badge&logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee" /></a>
  </p>
  <p><strong>Onigiri Editor が役に立った場合は、プロジェクトの支援をご検討ください。</strong></p>
</div>

---

## 概要

**Onigiri Editor** は、**Tauri v2 + React 19 + TypeScript + Rust** で構築された、macOS・Windows・Linux 対応の軽量・高速な AI 時代向け Markdown / コード / Web 開発プレビュー統合エディタです。

初回起動時は OS の言語設定を自動判定し、日本語環境では日本語 UI・日本語ネイティブメニューで起動し、その他の言語環境では英語 UI・英語メニューで起動します。

現在のバージョン: `v1.0.1`

## 主な機能

- **3つの UI モード切替（`⌘\` / `Ctrl+\`）**:
  - **シンプルモード**: ツールバー・タブ・サイドバーを隠し、拡張子に応じたハイライト付きで書くことだけに集中できる単一ペインモード
  - **標準モード**: エディタ／分割／プレビュー切替、双方向ライブプレビュー、書式バーを備えた標準構成
  - **拡張モード**: マルチタブ、フォルダエクスプローラー、全文検索、開発サーバー連携、スナップショット、AI ワークスペース連携を備えた高機能構成
- **双方向ビジュアル編集＆編集中行マーカー**: 左エディタ（CodeMirror 6）と右ビジュアルプレビュー（TipTap）のどちらで編集しても、対応する相手側の行・ブロックをリアルタイムにハイライト表示します。
- **100言語以上のシンタックスハイライト＆色カスタマイズ**: Markdown・PHP・TypeScript/JavaScript・Python・Rust・SQL・HTML・CSS 等に対応し、7種のプリセット（`Auto` / `GitHub` / `One Dark` / `Dracula` / `Nord` / `Monokai` / `Solarized`）と 10 種類のトークン別カラーピッカーを搭載しています。
- **AI チャット・接続サポート・適用前 Diff プレビュー**:
  - **Codex CLI** / **Claude Code CLI** / **Gemini CLI** / **Antigravity CLI** / **OpenAI・Anthropic・Gemini API** / **Ollama** / **LM Studio** に対応し、モデル選択や未接続時のターミナルセットアップ支援を備えています。
  - AI による「**本文を置換**」（適用前スナップショット自動保存オプション付き）および「**フォルダーへ書き込み**」の実行前に、行単位の **Diff プレビューモーダル** で変更内容を確認できます。
- **セッション復元・未保存ドラフト保護・自動保存**: 開いていたタブ・未保存ドラフト・カーソル位置・ワークスペース状態を終了時に保持し、次回起動時に復元します。ファイル紐付きタブ向けの自動保存（1.5秒デバウンス）にも対応しています。
- **外部ファイル変更検知・自動リロード／競合バナー**: 外部ツールや AI CLI によるファイル変更・削除を監視し、未編集タブは自動反映、未保存編集がある場合は **ディスクから再読み込み** / **差分を比較** / **自分の編集を維持** の選択バナーを表示します。
- **開発サーバー診断＆2パターンの Web ブラウザ連携**:
  - Vite / Next.js / Laravel / WordPress / Docker Compose / Python / 静的サイトを自動検出し、起動前チェックと環境構築ガイドを表示します。
  - **パターン1（内蔵 Web ブラウザ）**: 右ペインを Tauri マルチ WebView の本格ブラウザへ切替
  - **パターン2（外部ライブプレビュー）**: ローカル HTTP サーバー（`127.0.0.1`）で Chrome / Safari 等へリアルタイム自動更新プレビューを配信
- **その他の便利機能**: スマート行コピー（`⌘C` / `Ctrl+C`）、Mermaid 図・KaTeX 数式・コールアウト、YAML Frontmatter エディタ、AI 出力整形＆表フォーマット、推定 AI トークン数計測、リッチテキストコピー＆HTML スマート貼付、スナップショット＆差分比較、検索・置換（正規表現）、コマンドパレット（`⌘K` / `Ctrl+K`）、集中モード（`⌘⇧F` / `Ctrl+Shift+F`）、HTML / PDF 書き出し。
- **初回起動時の OS 言語自動判定**: 日本語 OS なら日本語、その他の言語環境なら英語で起動します（設定画面・トップバーからいつでも手動切替可能）。

## 動作環境

- **対応 OS**: macOS（Apple Silicon / Intel）、Windows（x64）、Linux（x64）
- **開発・ソースビルド時**:
  - Node.js 20 以上（22 推奨）
  - Rust ツールチェーン（`rustup` stable）
  - Tauri v2 の OS 別依存環境（macOS: Xcode Command Line Tools / Windows: WebView2 + VS C++ Build Tools / Linux: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev` 等）
- **任意（AI / 開発プロジェクト連携時）**: Node.js、Codex / Claude Code / Gemini / Antigravity CLI、Ollama / LM Studio

## ビルド

```bash
# 依存関係のインストール
npm install

# Web プレビュー起動
npm run dev

# デスクトップ開発モード起動
npx tauri dev

# 各 OS 向けリリース用バイナリ / インストーラのビルド
npx tauri build
```

テストおよび型チェックの実行:

```bash
# TypeScript 型チェック + 本番フロントエンドビルド
npx tsc --noEmit && npm run build

# Rust バックエンド単体テスト
cargo test --manifest-path "src-tauri/Cargo.toml"
```

## v1.0.1 の更新内容

- **Windows CLI 起動エラー（`os error 193`）の修正**: `%APPDATA%\npm` 内の拡張子なし POSIX シェルスクリプト（`codex` / `claude` / `gemini` / `npm` 等）を Windows 実行候補から除外し、`.exe` / `.com` / `.cmd` / `.bat` を正しく解決して起動するようにしました。
- **AI CLI・ローカル LLM 接続サポート強化**: Antigravity CLI（`agy`）がデスクトップアプリ本体とは別配布である点の明記と OS 別インストーラー（`curl` / `irm`）、macOS/Linux の `~/.npm-global` 自動設定による権限エラー回避、CLI 別の認証案内・Ollama/LM Studio 詳細手順を追加しました。
- **Web 実行環境・依存パッケージ診断の拡充**: Windows Microsoft Store のダミー `python.exe` 除外、`wp-config-sample.php` / Laravel SQLite / Ruby・Jekyll / `.env.example` の診断、Linux `python3-venv`・PHP 拡張案内、ボタンの役割説明を追加しました。
- **検索・置換機能の強化**: 全角／半角の区別切り替え、選択範囲内での検索・置換（範囲再取得対応）、正規表現 OFF 時の `$1` 等リテラル維持、一致箇所ナビゲーションを改善しました。

<details>
<summary>以前のリリース: v1.0.0</summary>

- アプリ名を **Onigiri Editor** へ正式刷新し、macOS / Windows / Linux 向けアイコンを更新しました。
- **初回起動時の OS 言語自動判定** を追加しました（日本語 OS は日本語 UI・メニュー、それ以外は英語 UI・メニューで起動）。
- **セッション復元・未保存ドラフト保護・自動保存** を実装しました（設定画面・インスペクターから切替可能）。
- **外部ファイル変更検知** を実装し、未編集タブの自動リロードと、競合・削除時の解決バナー（再読み込み・差分比較・編集維持など）を追加しました。
- **AI 適用前 Diff プレビューモーダル** を追加し、本文置換（スナップショット保存付き）やワークスペース書き込み前に差分を確認できるようにしました。
- **AI CLI 接続サポート＆モデル選択**（Codex / Claude Code / Gemini / Antigravity / Ollama / LM Studio / Cloud API）を強化しました。
- **プロジェクト環境診断＆開発サーバー連携**（Vite / Next.js / Laravel / WordPress / Docker / Python / PHP 等）とコード／Web ページプレビューを追加しました。
- **Windows / Linux / macOS 間のクロスプラットフォーム互換性**（`.cmd` シム対応、単一インスタンス起動引数処理、OS 別ガイド表示など）を改善しました。

</details>

## 基本的な使い方

1. **Onigiri Editor** を起動すると、OS の言語設定に応じて日本語または英語で起動します。
2. 上部バーまたは `⌘\` / `Ctrl+\` で **シンプル / 標準 / 拡張** モードをいつでも切り替えられます。
3. Markdown ファイル・ソースコード・ワークスペースフォルダーを開きます（`⌘O` / `Ctrl+O`）。
4. 右上の **パネル／Bot アイコン** から **AI チャット**・**整形ツール**・**統計＆差分**・**Frontmatter**・**設定**（`⌘,` / `Ctrl+,`）を開けます。
5. 右ペインの **内蔵ブラウザ** または **外部ライブプレビュー** を使って、HTML・Markdown・起動中のローカル開発サーバーを並べてプレビューできます。

## ダウンロード

各 OS 向けのビルド済みバイナリは [GitHub Releases](https://github.com/StayHomeLabNet/Onigiri-Editor/releases) ページからダウンロードできます。

- **macOS（Universal: Apple Silicon / Intel 両対応）**: `.dmg` / `.app.tar.gz`
- **Windows（x64）**: `.exe`（NSIS インストーラ） / `.msi`
- **Linux（x64）**: `.AppImage` / `.deb`

## ライセンス

MIT — 詳細は [LICENSE](LICENSE) をご覧ください。
