import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const zhTW: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.0',
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

**Onigiri Editor** 結合了 **雙向視覺化 Markdown 編輯**、**AI 聊天與自訂工具列按鈕**、**知識圖譜**、**Git 原始碼管理**、**100+ 語言程式碼高亮度顯示** 以及 **開發伺服器自動偵測與內建 Web 瀏覽器**。

> [!TIP]
> - **隨時切換模式（\`⌘ + \\\` / \`Ctrl + \\\`）**：在 **簡潔**、**標準** 與 **進階** 模式間快速切換。
> - **功能指南（\`?\`）**：點擊右上角 **\`?\`** 或按 \`⌘ + K\` / \`Ctrl + K\` 開啟命令面板搜尋功能。
> - **快速開啟（\`⌘ + P\` / \`Ctrl + P\`）**：快速跳轉檔案，或輸入 \`@\` 跳轉至標題。

## 核心亮點

- [x] **雙向即時編輯與同步高亮度顯示**：支援**目前行背景高亮度顯示**及**編輯器選取文字在預覽中的字元級同步標記**。
- [x] **AI 自訂按鈕與個別模型指定**：支援 Apple Foundation Models、Codex / Claude / Gemini / Antigravity CLI、雲端 API 與 Ollama / LM Studio，每個按鈕皆可獨立指定模型。
- [x] **備份與效率工具**：自動快照與區塊還原、Markdown 相容性檢查、圖片自動壓縮、Git 面板、知識圖譜與 Word/HTML/PDF 匯出。

\`\`\`mermaid
flowchart LR
  Write["✍️ 寫作 / 斜線指令 / 圖片最佳化"] --> Knowledge["🕸️ 雙向連結與知識圖譜"]
  Knowledge --> AI["🤖 AI 自訂 / 幽靈補全 / 校對"]
  AI --> Git["🌿 Git 與快照對比"]
  Git --> Export["📦 Word / HTML / PDF / 簡報"]
\`\`\`
`,
};
