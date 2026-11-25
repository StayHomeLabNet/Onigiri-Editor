import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const zhTW: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.3',
  modes: {
    simple: '簡潔',
    basic: '標準',
    advanced: '進階',
  },
  layouts: {
    editor: '編輯器',
    split: '分割',
    preview: '預覽',
  },
  themes: {
    light: '淺色',
    dark: '深色',
    sepia: '護眼米黃',
    midnight: '午夜藍',
  },
  actions: {
    newFile: '新增',
    openFile: '開啟',
    openFolder: '開啟資料夾',
    save: '儲存',
    saveAs: '另存新檔',
    exportHtml: '匯出 HTML',
    exportPdf: '列印 / 匯出 PDF',
    exportDocx: '匯出 Word (.docx)',
    exportOptions: '頁面設定與匯出 (PDF / HTML)...',
    commandPalette: '命令面板',
    quickOpen: '快速開啟',
    zenMode: '專注模式 (Zen)',
    toggleFocusMode: '聚焦目前段落',
    sidebar: '側邊欄',
    inspector: '選項 / AI 聊天',
    settings: '設定',
    about: '關於 Onigiri Editor',
    language: '語言',
    theme: '佈景主題',
    slidePresentation: '簡報演示',
    openDailyNote: '每日筆記',
    newFromTemplate: '範本與每日筆記',
    webClipUrl: '網頁剪藏為 Markdown',
    workspaceGrep: '跨資料夾搜尋與取代',
    insertCitation: '插入引用 / 連結卡片 / 腳註',
    knowledgeGraph: '知識圖譜',
    findUnusedAssets: '圖片管理與清理',
    featureGuide: '功能指南 (?)',
    toggleTopBar: '顯示/隱藏頂部標題列',
    toggleFormatToolbar: '顯示/隱藏格式工具列',
    toggleEditorSplit: '上下分割編輯器',
    undo: '復原',
    redo: '重做',
    selectAll: '全選',
    copy: '複製',
    paste: '貼上',
    zoomIn: '放大',
    zoomOut: '縮小',
    resetZoom: '重設縮放 (100%)',
    copyRichText: '複製為富文本',
    macroRecord: '錄製巨集',
    macroStop: '停止錄製',
    macroPlay: '播放巨集',
  },
  tabMenu: {
    pin: '釘選分頁',
    unpin: '取消釘選',
    openSide: '在側邊開啟',
    compareWithActive: '與目前分頁比較差異',
    close: '關閉',
    closeOthers: '關閉其他',
  },
  sidebar: {
    files: '檔案',
    outline: '大綱',
    knowledge: '知識庫',
    snippets: '程式碼片段',
    git: 'Git 原始碼管理',
    noFolder: '尚未開啟資料夾',
    chooseFolder: '開啟工作區資料夾',
    closeFolder: '關閉工作區',
    noHeadings: '找不到標題（# ~ ######）',
    filterFiles: '依檔名或副檔名篩選...',
    newFilePrompt: '新檔案名稱',
    newFolderPrompt: '新資料夾名稱',
    renamePrompt: '重新命名',
    deleteConfirm: '確定要刪除「{name}」嗎？',
  },
  inspector: {
    chat: 'AI 聊天',
    review: '文件校對',
    ai: 'AI 整理',
    stats: '統計',
    diff: '快照歷史',
    settings: '快速設定',
    settingsLabels: {
      activeLineSyncHighlight: '在另一側面板淺色高亮度顯示目前行/區塊',
      previewSelectionSyncHighlight: '在預覽中同步高亮度顯示編輯器選取的文字',
      syncScroll: '同步捲動（編輯器 ↔ 預覽）',
      typewriterMode: '打字機捲動（保持目前行置中）',
      lineNumbers: '顯示行號',
      wordWrap: '自動換行',
      hideTopBarInSimpleMode: '簡潔模式下隱藏頂部標題列',
      showFormatToolbarInSimpleMode: '簡潔模式下顯示格式工具列',
      builtinBrowserEnabled: '在右側面板啟用內建 Web 瀏覽器切換',
    },
  },
  status: {
    draft: '草稿',
    saved: '已儲存',
    words: '詞',
    chars: '字元',
    line: '行',
    col: '欄',
    syncOn: '同步捲動 ON',
    syncOff: '同步捲動 OFF',
  },
  aiChat: {
    title: 'AI 聊天',
    send: '傳送',
    cancelBtn: '停止',
    clearChat: '清除對話',
    inputPlaceholder: '向 AI 提問，或輸入關於目前文件的指令...',
    running: '運行中',
    offline: '離線',
  },
  settingsModal: {
    title: '設定',
    tabGeneral: '一般與檢視',
    tabEditor: '編輯器與預覽',
    tabAiCustom: 'AI 自訂',
    tabKeybindings: '快捷鍵',
    tabIntegrations: '瀏覽器與伺服器',
    tabData: '資料與備份',
    localeLabel: '介面語言',
    themeLabel: '外觀主題',
    aiCustom: {
      title: '工具列 AI 自訂按鈕',
      desc: '最多可在工具列註冊 5 個自訂 AI 按鈕。選取文字時僅傳送選取範圍，未選取時傳送全文。',
      addBtn: '新增按鈕',
      resetDefaultsBtn: '恢復預設',
      aiModelOverrideLabel: '使用的 AI 模型（訂閱 CLI / API / 本地）',
      followAiChatOption: '跟隨 AI 聊天面板設定',
      providerGroupSubscription: '訂閱 CLI',
      providerGroupApi: '雲端 API',
      providerGroupLocal: '本地 AI / 裝置端模型',
      modelSelectLabel: '模型',
      customModelOption: '手動輸入模型名稱...',
      refreshModelsBtn: '重新偵測模型',
    },
  },
  browser: {
    modePreview: '預覽',
    modeBrowser: 'Web 瀏覽器',
    closeBrowser: '關閉 Web 瀏覽器',
    back: '上一頁',
    forward: '下一頁',
    reload: '重新載入',
    home: '首頁',
    go: '前往',
    openExternal: '在外部瀏覽器開啟',
    openSettings: '瀏覽器設定（首頁 URL）',
  },
  updates: {
    checkBtn: '檢查更新',
  },
  sampleDocument: `---
title: 歡迎使用 Onigiri Editor — AI 時代的混合編輯器
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# 歡迎使用 Onigiri Editor 🍙

**Onigiri Editor** 結合了 **雙向視覺化 Markdown 編輯**、**AI 聊天與自訂工具列按鈕**、**PKM 與知識圖譜**、**Git 原始碼管理**、**100+ 語言程式碼高亮度顯示** 以及 **開發伺服器自動偵測與內建 Web 瀏覽器預覽**。

> [!TIP]
> - **隨時切換模式（\`⌘ + \\\` / \`Ctrl + \\\`）**：在 **簡潔**（隱藏頂欄、保留格式列的專注寫作）、**標準**（雙欄即時預覽與 AI）與 **進階**（多標籤、檔案總管、Git、整合終端機）之間一鍵切換。
> - **功能指南（\`?\`）**：點擊右上角 **\`?\`** 或按 \`⌘ + K\` / \`Ctrl + K\` 開啟命令面板，支援以英文或日文搜尋功能並直接執行。
> - **快速開啟（\`⌘ + P\` / \`Ctrl + P\`）**：快速跳轉工作區檔案，或輸入 \`@\` 跳轉至任意標題。
> - **設定（\`⌘ + ,\` / \`Ctrl + ,\`）**：自訂 112+ 項快速鍵、AI 自訂按鈕、自動快照以及 JSON 設定備份。

---

## 核心亮點

### ✍️ 1. 寫作、視覺化編輯與即時預覽
- [x] **雙向即時編輯與同步高亮度顯示**：左側 CodeMirror 6 原始碼與右側 TipTap 所見即所得即時同步。支援**目前行區塊高亮度顯示**及**編輯器選取文字在預覽中的字元級同步標記**（可在 **設定 → 編輯器** 中切換）
- [x] **豐富的寫作輔助工具**：
  - 選取文字上方自動浮現 **選取浮動選單**（粗體、斜體、程式碼、連結、行內 AI 編輯、AI 自訂快捷按鈕）
  - 游標位於表格內時自動顯示 **Markdown 表格 GUI 工具列**（增刪行列、對齊、數值排序、格式化）
  - **預覽區圖片互動控制**：支援左/右文繞圖排版、寬度切換（200 / 280 / 380px）、編輯 Alt 文字或直接刪除
  - 行首 \`/\` **斜線指令**、**自訂程式碼片段**、**自動目錄 (TOC)**、**單次換行（\`<br>\`）預覽**
  - **引用與連結卡片（支援縮圖） / BibTeX 與 DOI 查詢 / 腳註**、**URL 自動擷取標題貼上**、**每日筆記與範本**、**網頁剪藏 (Web Clipper)** 與 **簡報展示模式**
- [x] **專業程式碼與文字工具（含右鍵選單）**：
  - **多游標（\`⌘ + D\` / \`Option + 點擊\`）**、**矩形區塊選取（\`Option + 拖曳\` / \`Alt + 拖曳\`）**、**行書籤（\`⌘ + F2\` / \`F2\`）**、**跳轉至行（\`⌘ + L\`）**
  - **尋找與正規表示式取代**（支援選取範圍限定及摺疊區塊自動展開）、**程式碼摺疊**、**空白 / 全形空白 / 換行符號可視化**、**欄標尺**、**專注模式**與**打字機捲動**
  - **右鍵快捷轉換與資料工具**：大/小寫/首字母大寫、移除行首空白、加入引用符號、**JSON 格式化 / 壓縮 / 鍵排序**、**JSON ⇔ YAML 互轉**、**\`.env\` 格式化**、**複製為富文字**
  - **編碼與換行符號管理**：支援 UTF-8 / Shift_JIS / EUC-JP 新增與重新開啟、LF/CRLF 切換、即時字數 / 詞數 / 閱讀時間統計

### 🤖 2. AI Harness 多模型編排與隱私保護
- [x] **統一 AI Harness（選取文字後按 \`⌘ + ⇧ + E\` 進行行內編輯）**：
  - 在同一工作區安全編排與呼叫 **Apple Foundation Models（裝置端，macOS 26+）**、**Codex CLI**、**Claude Code CLI**、**Gemini CLI**、**Antigravity CLI**、**OpenAI / Anthropic / Gemini API**、**Ollama** 與 **LM Studio**，支援即時進度串流、隨時中斷及錯誤診斷提示
- [x] **AI 輸出整理（\`AI 整理\` 按鈕）**：
  - 一鍵規則化清洗貼上的 AI 文字：自動對齊 **GFM 表格欄寬**、統一清單與標題空行、清除零寬字元與 NBSP、規範智慧引號，同時完整保留程式碼區塊。亦支援**貼上 HTML 時自動轉為 Markdown**
- [x] **工具列 AI 自訂按鈕與子選單**：
  - 最多可註冊 5 個主按鈕 + 每個最多 10 個子選單項目，支援**按按鈕/子項獨立指定模型（訂閱 CLI / 雲端 API / 本地 AI）**及提示詞變數（\`{{selection}}\`、\`{{clipboard}}\`、\`{{date}}\` 等），內建 **AI 翻譯**預設
- [x] **AI 聊天（支援 \`@檔案\` 引用）、AI 幽靈文字補全（\`Tab\` 採納、含生成中指示）與校對**：
  - 配備唯讀沙箱保護、**AI 傳送內容預覽與敏感資訊遮罩**（自動遮蔽 API Key / Token）以及套用修改前的**逐行 Diff 預覽**

### 🛡️ 3. 安全備份、資源管理與相容性診斷
- [x] **自動快照與快速便箋**：
  - **自動快照時間軸與分塊局部還原**（儲存時與定時自動建立）
  - **快速便箋（Scratchpad）**（無需儲存的臨時筆記）與 **全域呼出快速鍵（\`⌘ + ⇧ + Space\`）**
  - 重啟後**自動恢復工作階段**及外部檔案變更偵測
- [x] **圖片最佳化與方言相容性診斷**：
  - 貼上/拖放圖片自動縮放壓縮至 \`assets/\`、**全工作區圖片大小清單**、**未使用圖片一鍵清理**
  - **Markdown 相容性檢查**（診斷 GitHub / Zenn / Qiita / Notion / Obsidian 語法差異）

### 🕸️ 4. 知識圖譜、Git、開發工具與匯出
- [x] **PKM 與知識圖譜**：
  - \`[[WikiLinks]]\` 雙向連結、反向連結、\`#標籤\` 瀏覽、**互動式知識圖譜與斷鏈診斷**
- [x] **Git 原始碼管理與開發工作區（進階模式）**：
  - **Git 側邊欄**（暫存/取消暫存/放棄變更、行內 Diff、**AI 生成提交訊息**、Pull/Push）與 **與 Git HEAD 對比**
  - **多標籤與雙欄並排對比**、**跨資料夾正規 Grep 取代（\`⌘ + ⇧ + G\`）**
  - **整合終端機抽屜**、**多開發伺服器啟動器（支援 QR / LAN 區域網路分享與 AI 日誌診斷）**、**內建 Web 瀏覽器**（一鍵 \`✕\` 關閉）
  - **CSV / TSV 表格預覽（大檔案虛擬捲動與雙向高亮度標記）**：流暢瀏覽數 MB 級 CSV，支援固定行號欄、數值欄右對齊與統計（總和/平均/最小/最大）、分隔符切換（自動 / , / Tab / ;）、換行顯示、**編輯器 ⇔ 表格儲存格與子字串雙向高亮度標記**、雙擊複製儲存格（可在設定中開關）與複製為 Markdown 表格
- [x] **匯出與個人化自訂**：
  - **Word（\`.docx\`）**、**PDF / HTML（頁面設定、主題樣式與頁首頁尾）**、**Mermaid 與 KaTeX 一鍵匯出 SVG/PNG 及放大檢視**
  - **鍵盤巨集錄製重播（\`⌘ + ⇧ + M\` / \`F8\`）**、**4 套主題（淺色 / 深色 / 護眼 / 午夜）+ 自訂 CSS**、**8 種介面語言**

---

### 1. 立即體驗互動功能

1. **測試行內選取同步與浮動選單**：請在**左側編輯器**中選取下方引文裡的任意詞語——上方會彈出浮動選單，右側預覽也會字元級同步高亮度標記！
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **測試 Markdown 表格 GUI 工具列**：點擊下方表格中的任意儲存格，編輯器上方即會出現表格編輯工具列。

| 模式 | 適用情境 | 版面與功能 |
| :--- | :--- | :--- |
| **簡潔** | 快速記錄與專注編輯 | 隱藏頂欄的單欄純淨編輯器，保留格式工具列 |
| **標準** | 日常寫作與視覺化編輯 | 編輯器 + 雙向即時預覽 + 格式工具列 + AI 聊天 |
| **進階** | 開發工作流、PKM 與 Git | 多標籤與雙欄對比、知識圖譜、Git 面板、開發伺服器與終端機 |

---

### 2. 工作流總覽 (Mermaid)

> [!NOTE]
> GitHub 風格的 \`[!NOTE]\`、\`[!TIP]\`、\`[!IMPORTANT]\`、\`[!WARNING]\`、\`[!CAUTION]\` 提示框、Mermaid 圖表與 KaTeX 公式均可直接在預覽區匯出為 **SVG 或 PNG**。

\`\`\`mermaid
flowchart LR
  Write["✍️ 寫作 / 斜線 / 圖片自動最佳化"] --> Knowledge["🕸️ 雙向連結與知識圖譜"]
  Knowledge --> AI["🤖 AI 自訂 / 幽靈補全 / 校對"]
  AI --> Check["🛡️ 相容性檢查與自動快照"]
  Check --> Git["🌿 Git 面板與行內 Diff"]
  Git --> Export["📦 Word / HTML / PDF / 簡報"]
\`\`\`

---

### 3. 常用快速鍵（可在 設定 → 快速鍵 中自訂 112+ 項指令）

| 操作 | macOS | Windows / Linux |
| :--- | :--- | :--- |
| 切換模式（簡潔 / 標準 / 進階） | \`⌘ + \\\` | \`Ctrl + \\\` |
| 快速開啟（檔案 / \`@標題\`） | \`⌘ + P\` | \`Ctrl + P\` |
| 命令面板 | \`⌘ + K\` | \`Ctrl + K\` |
| 跨資料夾 Grep 搜尋與取代 | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| 選取區行內 AI 編輯 | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| 切換 / 跳轉行書籤 | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| 錄製 / 重播鍵盤巨集 | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| 專注模式 / 矩形區塊選取 | \`⌘ + ⇧ + F\` / \`Option + 拖曳\` | \`Ctrl + Shift + F\` / \`Alt + 拖曳\` |
| 全域呼出快速鍵（需在設定中開啟） | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. LaTeX 數學公式與多語言語法高亮度顯示

Scaled Dot-Product Attention:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V
$$

\`\`\`typescript
export function greetOnigiri(name: string): string {
  return \`Hello, \${name} 🍙\`;
}
console.log(greetOnigiri('Onigiri Editor'));
\`\`\`
`,
};
