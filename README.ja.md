<div align="center">
  <img src="public/icon.png" alt="Onigiri-Markdown" width="96" height="96" />
  <h1>Onigiri-Markdown 🍙</h1>
  <p><strong>AI時代のMarkdownをリアルタイムプレビューしながら快適に編集できる、クロスプラットフォーム対応エディタ</strong></p>
  <p>
    <a href="README.md">English</a> | <strong>日本語</strong>
  </p>
  <p>バージョン: <code>v0.1.0</code></p>
</div>

---

## Onigiri-Markdown について

AI時代には、ChatGPT・Claude・Gemini などが生成する文章のほとんどが Markdown 形式で出力されます。テーブル、数式、Mermaid 図、コールアウト、コードブロックを含む AI 生成テキストを、**macOS・Windows・Linux** のすべてで気持ちよく閲覧・編集・整形・共有できるように設計したのが **Onigiri-Markdown** です。

## 使い分けできる 2 つの UI モード

### 1. ベーシックモード（シンプル＆迷わない構成）
- 書くこととプレビューに集中できるミニマルなUI
- **エディタ / 分割 / プレビュー** のワンクリック切替、ドラッグリサイズ可能な分割ペイン＆スクロール同期
- よく使う書式だけを絞ったシンプルツールバー（見出し、太字、斜体、コード、リンク、箇条書き、タスクリスト、引用、テーブル）
- プレビュー上のチェックボックスをクリックして直接タスクを ON/OFF
- **多言語UI（日本語 / English）** と **4種のカラーテーマ（ライト / ダーク / セピア / ミッドナイト）** を即座に切替

### 2. アドバンスドモード（高機能ワークスペース＆AIツールキット）
- **マルチタブ編集** ＆ **フォルダエクスプローラー**（ファイル名フィルタ・フォルダ内全文検索・新規メモ作成）
- **アウトライン（目次）** ＆ **スニペットライブラリ**（Mermaid図・KaTeX数式・コールアウト・AIプロンプト設計テンプレート等をワンクリック挿入）
- **AI出力クリーンアップ＆整形**:
  - ゼロ幅文字・不可視文字の除去
  - GFMテーブルの列幅を自動整形（日本語の全角文字幅にも対応）
  - 箇条書き記号（`*` / `+` → `-`）、見出し前後スペース、連続空行、スマートクォートを自動統一
- **推定 AI トークン数計測**（日英混在テキスト対応）＋ 文字数・単語数・読了目安・目標達成バー
- **リッチテキストコピー**（Notion / Google Docs / Slack へ見た目そのまま貼り付け）＆ **HTML→Markdown スマート貼付**
- **Mermaid 図表**（拡大モーダル・SVGコピー対応）、**KaTeX 数式**、**GitHub互換コールアウト**（`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`）
- **スナップショット＆差分（Diff）ビューア**（編集の区切りを保存し、行単位で比較・復元）
- **YAML Frontmatter ビジュアルエディタ** ＆ プレビュー上部メタデータカード
- **検索・置換**（正規表現・大文字小文字・単語単位）、**コマンドパレット（`⌘K` / `Ctrl+K`）**、**集中モード（`⌘⇧F` / `Ctrl+Shift+F`）**、**カスタムCSS**、**HTML / PDF 書き出し**

## 技術スタック

- **デスクトップ基盤**: [Tauri v2](https://v2.tauri.app/) (Rust)
- **フロントエンド**: React 19, TypeScript, Vite
- **エディタエンジン**: CodeMirror 6（日本語IME入力対応）
- **Markdown処理**: unified / remark / rehype, GFM, KaTeX, Highlight.js, Mermaid, Turndown

## 開発・ビルド方法

```bash
# 依存関係のインストール
npm install

# Webプレビュー起動
npm run dev

# デスクトップ開発モード起動
npx tauri dev

# ネイティブアプリ＆インストーラのビルド（macOS / Windows / Linux）
npx tauri build
```

## ライセンス

MIT
