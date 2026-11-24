import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const zhCN: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.1',
  modes: {
    simple: '简洁',
    basic: '标准',
    advanced: '高级',
  },
  layouts: {
    editor: '编辑器',
    split: '分屏',
    preview: '预览',
  },
  themes: {
    light: '浅色',
    dark: '深色',
    sepia: '护眼米黄',
    midnight: '午夜蓝',
  },
  actions: {
    newFile: '新建',
    openFile: '打开',
    openFolder: '打开文件夹',
    save: '保存',
    saveAs: '另存为',
    exportHtml: '导出 HTML',
    exportPdf: '打印 / 导出 PDF',
    exportDocx: '导出 Word (.docx)',
    exportOptions: '页面设置与导出 (PDF / HTML)...',
    commandPalette: '命令面板',
    quickOpen: '快速打开',
    zenMode: '专注模式 (Zen)',
    toggleFocusMode: '聚焦当前段落',
    sidebar: '侧边栏',
    inspector: '选项 / AI 聊天',
    settings: '设置',
    about: '关于 Onigiri Editor',
    language: '语言',
    theme: '主题',
    slidePresentation: '幻灯片演示',
    openDailyNote: '每日笔记',
    newFromTemplate: '模板与每日笔记',
    webClipUrl: '网页剪藏为 Markdown',
    workspaceGrep: '跨文件夹查找与替换',
    insertCitation: '插入引用 / 链接卡片 / 脚注',
    knowledgeGraph: '知识图谱',
    findUnusedAssets: '图片管理与清理',
    featureGuide: '功能指南 (?)',
    toggleTopBar: '显示/隐藏顶部标题栏',
    toggleFormatToolbar: '显示/隐藏格式工具栏',
    toggleEditorSplit: '上下拆分编辑器',
    undo: '撤销',
    redo: '重做',
    selectAll: '全选',
    copy: '复制',
    paste: '粘贴',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetZoom: '重置缩放 (100%)',
    copyRichText: '复制为富文本',
    macroRecord: '录制宏',
    macroStop: '停止录制',
    macroPlay: '播放宏',
  },
  tabMenu: {
    pin: '固定标签页',
    unpin: '取消固定',
    openSide: '在侧边打开',
    compareWithActive: '与当前标签页对比差异',
    close: '关闭',
    closeOthers: '关闭其他',
  },
  sidebar: {
    files: '文件',
    outline: '大纲',
    knowledge: '知识库',
    snippets: '代码片段',
    git: 'Git 源码管理',
    noFolder: '尚未打开文件夹',
    chooseFolder: '打开工作区文件夹',
    closeFolder: '关闭工作区',
    noHeadings: '未找到标题（# ~ ######）',
    filterFiles: '按文件名或扩展名筛选...',
    newFilePrompt: '新建文件名',
    newFolderPrompt: '新建文件夹名',
    renamePrompt: '重命名',
    deleteConfirm: '确定删除「{name}」吗？',
  },
  inspector: {
    chat: 'AI 聊天',
    review: '文档校对',
    ai: 'AI 整理',
    stats: '统计',
    diff: '快照历史',
    settings: '快速设置',
    settingsLabels: {
      activeLineSyncHighlight: '在另一侧面板浅色高亮显示当前行/块',
      previewSelectionSyncHighlight: '在预览中同步高亮编辑器选中的文本',
      syncScroll: '同步滚动（编辑器 ↔ 预览）',
      typewriterMode: '打字机滚动（保持当前行居中）',
      lineNumbers: '显示行号',
      wordWrap: '自动换行',
      hideTopBarInSimpleMode: '简洁模式下隐藏顶部标题栏',
      showFormatToolbarInSimpleMode: '简洁模式下显示格式工具栏',
      builtinBrowserEnabled: '在右侧面板启用内置 Web 浏览器切换',
    },
  },
  status: {
    draft: '草稿',
    saved: '已保存',
    words: '词',
    chars: '字',
    line: '行',
    col: '列',
    syncOn: '同步滚动 ON',
    syncOff: '同步滚动 OFF',
  },
  aiChat: {
    title: 'AI 聊天',
    send: '发送',
    cancelBtn: '停止',
    clearChat: '清空对话',
    inputPlaceholder: '向 AI 提问，或输入关于当前文档的指令...',
    running: '运行中',
    offline: '离线',
  },
  settingsModal: {
    title: '设置',
    tabGeneral: '常规与视图',
    tabEditor: '编辑器与预览',
    tabAiCustom: 'AI 自定义',
    tabKeybindings: '快捷键',
    tabIntegrations: '浏览器与服务',
    tabData: '数据与备份',
    localeLabel: '界面语言',
    themeLabel: '外观主题',
    aiCustom: {
      title: '工具栏 AI 自定义按钮',
      desc: '最多可在工具栏注册 5 个自定义 AI 按钮。选中文本时仅发送选区，未选中时发送全文。',
      addBtn: '添加按钮',
      resetDefaultsBtn: '恢复默认预设',
      aiModelOverrideLabel: '使用的 AI 模型（订阅 CLI / API / 本地）',
      followAiChatOption: '跟随 AI 聊天面板设置',
      providerGroupSubscription: '订阅 CLI',
      providerGroupApi: '云端 API',
      providerGroupLocal: '本地 AI / 端侧模型',
      modelSelectLabel: '模型',
      customModelOption: '手动输入模型名称...',
      refreshModelsBtn: '重新检测模型',
    },
  },
  browser: {
    modePreview: '预览',
    modeBrowser: 'Web 浏览器',
    closeBrowser: '关闭 Web 浏览器',
    back: '后退',
    forward: '前进',
    reload: '刷新',
    home: '主页',
    go: '前往',
    openExternal: '在外部浏览器中打开',
    openSettings: '浏览器设置（主页 URL）',
  },
  updates: {
    checkBtn: '检查更新',
  },
  sampleDocument: `---
title: 欢迎使用 Onigiri Editor — AI 时代的混合编辑器
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# 欢迎使用 Onigiri Editor 🍙

**Onigiri Editor** 将 **双向可视化 Markdown 编辑**、**AI 聊天与自定义按钮**、**知识图谱**、**Git 源码管理**、**100+ 语言代码高亮** 以及 **开发服务器自动检测与内置 Web 浏览器** 融为一体。

> [!TIP]
> - **随时切换模式（\`⌘ + \\\` / \`Ctrl + \\\`）**：在 **简洁**（隐藏顶栏、专注写作）、**标准**（双栏实时预览）和 **高级**（多标签、文件树、Git、集成终端）之间一键切换。
> - **功能指南（\`?\`）**：点击右上角 **\`?\`** 或按 \`⌘ + K\` / \`Ctrl + K\` 打开命令面板快速搜索功能。
> - **快速打开（\`⌘ + P\` / \`Ctrl + P\`）**：快速跳转文件，或输入 \`@\` 跳转标题。

## 核心亮点

- [x] **双向实时编辑与同步高亮**：左侧源码与右侧所见即所得实时同步，支持**当前行背景高亮**及**编辑器选区在预览中的字符级高亮**。
- [x] **AI 自定义按钮与多模型支持**：支持 Apple Foundation Models、Codex / Claude / Gemini / Antigravity CLI、云端 API 以及 Ollama / LM Studio，可为每个按钮单独指定模型。
- [x] **安全与效率工具**：自动快照与分块还原、Markdown 平台兼容性检查、图片自动压缩、Git 面板、知识图谱、Word/HTML/PDF 导出及跨文件夹正则替换。

\`\`\`mermaid
flowchart LR
  Write["✍️ 写作 / 斜杠命令 / 图片优化"] --> Knowledge["🕸️ 双向链接与知识图谱"]
  Knowledge --> AI["🤖 AI 自定义 / 幽灵补全 / 校对"]
  AI --> Git["🌿 Git 与快照对比"]
  Git --> Export["📦 Word / HTML / PDF / 幻灯片"]
\`\`\`
`,
};
