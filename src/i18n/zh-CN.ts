import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const zhCN: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v2.0.0',
  modes: {
    simple: '简洁',
    basic: '标准',
    advanced: '高级',
  },
  harness: {
    modeLabel: 'AI Harness',
    editorLabel: '编辑器',
    newThread: '新建线程',
    threadsHeading: '线程列表',
    permPlan: '计划（只读）',
    permApprove: '逐项审批',
    permAuto: '自动编辑',
    permFull: '完全访问',
    executePlanBtn: '执行此计划',
    diffCardTitle: '已更改的文件',
    acceptChangesBtn: '保留更改',
    revertTurnBtn: '撤回本轮更改',
    openInEditorBtn: '在编辑器中打开',
    sendToHarnessBtn: '发送到 AI Harness',
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

**Onigiri Editor** 将 **双向可视化 Markdown 编辑**、**AI 聊天与自定义工具栏按钮**、**PKM 与知识图谱**、**Git 源码管理**、**100+ 语言代码高亮** 以及 **开发服务器自动检测与内置 Web 浏览器预览** 融为一体。

> [!TIP]
> - **随时切换模式（\`⌘ + \\\` / \`Ctrl + \\\`）**：在 **简洁**（隐藏顶栏、保留格式栏的专注写作）、**标准**（双向分栏实时预览与 AI）和 **高级**（多标签、文件树、Git、集成终端）之间一键切换。
> - **功能指南（\`?\`）**：点击右上角 **\`?\`** 或按 \`⌘ + K\` / \`Ctrl + K\` 打开命令面板，用英文或日文搜索功能并直接执行。
> - **快速打开（\`⌘ + P\` / \`Ctrl + P\`）**：快速跳转工作区文件，或输入 \`@\` 跳转到任意标题。
> - **设置（\`⌘ + ,\` / \`Ctrl + ,\`）**：自定义 112+ 项快捷键、AI 自定义按钮、自动快照以及 JSON 设置备份。

---

## 核心亮点

### ✍️ 1. 写作、可视化编辑与实时预览
- [x] **双向实时编辑与同步高亮**：左侧 CodeMirror 6 源码与右侧 TipTap 所见即所得实时同步。支持**当前行区块高亮**与**编辑器选区在预览中的字符级同步高亮**（可在 **设置 → 编辑器** 中开关）
- [x] **丰富的写作辅助工具**：
  - 选中文本上方自动浮现 **选区浮动菜单**（加粗、斜体、代码、链接、行内 AI 编辑、AI 自定义快捷按钮）
  - 光标位于表格内时自动显示 **Markdown 表格 GUI 工具栏**（增删行列、对齐、数值排序、格式化）
  - **预览区图片交互控制**：支持左/右环绕排版、宽度切换（200 / 280 / 380px）、编辑 Alt 文本或直接删除
  - 行首 \`/\` **斜杠命令**、**自定义代码片段**、**自动目录 (TOC)**、**单次换行（\`<br>\`）预览**
  - **引用与链接卡片（支持缩略图） / BibTeX 与 DOI 查询 / 脚注**、**URL 自动抓取标题粘贴**、**每日笔记与模板**、**网页剪藏 (Web Clipper)** 与 **幻灯片演示模式**
- [x] **专业代码与文本工具（含右键菜单）**：
  - **多光标（\`⌘ + D\` / \`Option + 点击\`）**、**矩形块选择（\`Option + 拖拽\` / \`Alt + 拖拽\`）**、**行书签（\`⌘ + F2\` / \`F2\`）**、**跳转到行（\`⌘ + L\`）**
  - **查找与正则替换**（支持选区限定范围及折叠区块自动展开）、**代码折叠**、**空格 / 全角空格 / 换行符可视化**、**列标尺**、**专注模式**与**打字机滚动**
  - **右键快捷转换与数据工具**：大/小写/首字母大写、去除行首空格、添加引用符、**JSON 格式化 / 压缩 / 键排序**、**JSON ⇔ YAML 互转**、**\`.env\` 格式化**、**复制为富文本**
  - **编码与换行符管理**：支持 UTF-8 / Shift_JIS / EUC-JP 新建与重新打开、LF/CRLF 切换、实时字数 / 词数 / 阅读时间统计

### 🤖 2. AI Harness 多模型编排与隐私保护
- [x] **统一 AI Harness（选中文本后按 \`⌘ + ⇧ + E\` 进行行内编辑）**：
  - 在同一工作区安全编排与调度 **Apple Foundation Models（设备端，macOS 26+）**、**Codex CLI**、**Claude Code CLI**、**Gemini CLI**、**Antigravity CLI**、**OpenAI / Anthropic / Gemini API**、**Ollama** 与 **LM Studio**，支持实时进度流、随时中断及智能错误诊断
- [x] **AI 输出整理（\`AI 整理\` 按钮）**：
  - 一键规则化清洗粘贴的 AI 文本：自动对齐 **GFM 表格列宽**、统一列表与标题空行、清除零宽字符与 NBSP、规范智能引号，同时完整保留代码块。亦支持**粘贴 HTML 时自动转为 Markdown**
- [x] **工具栏 AI 自定义按钮与子菜单**：
  - 最多可注册 5 个主按钮 + 每个最多 10 个子菜单项，支持**按按钮/子项独立指定模型（订阅 CLI / 云端 API / 本地 AI）**及提示词变量（\`{{selection}}\`、\`{{clipboard}}\`、\`{{date}}\` 等），内置 **AI 翻译**预设
- [x] **AI 聊天（支持 \`@文件\` 引用）、AI 幽灵文本补全（\`Tab\` 采纳、含生成中指示）与校对**：
  - 配备只读沙箱保护、**AI 发送内容预览与敏感信息脱敏**（自动遮蔽 API Key / Token）以及应用修改前的**逐行 Diff 预览**

### 🛡️ 3. 安全备份、资源管理与兼容性诊断
- [x] **自动快照与快速便签**：
  - **自动快照时间轴与分块局部还原**（保存时与定时自动创建）
  - **快速便签（Scratchpad）**（无需保存的临时笔记）与 **全局呼出快捷键（\`⌘ + ⇧ + Space\`）**
  - 重启后**自动恢复会话**及外部文件变更检测
- [x] **图片优化与方言兼容性诊断**：
  - 粘贴/拖放图片自动缩放压缩至 \`assets/\`、**全工作区图片大小清单**、**未使用图片一键清理**
  - **Markdown 兼容性检查**（诊断 GitHub / Zenn / Qiita / Notion / Obsidian 语法差异）

### 🕸️ 4. 知识图谱、Git、开发工具与导出
- [x] **PKM 与知识图谱**：
  - \`[[WikiLinks]]\` 双向链接、反向链接、\`#标签\` 浏览、**交互式知识图谱与断链诊断**
- [x] **Git 源码管理与开发工作区（高级模式）**：
  - **Git 侧边栏**（暂存/取消暂存/放弃更改、行内 Diff、**AI 生成提交信息**、Pull/Push）与 **与 Git HEAD 对比**
  - **多标签与双栏并排对比**、**跨文件夹正则 Grep 替换（\`⌘ + ⇧ + G\`）**
  - **集成终端抽屉**、**多开发服务器启动器（支持 QR / LAN 局域网分享与 AI 日志诊断）**、**内置 Web 浏览器**（一键 \`✕\` 关闭）
  - **CSV / TSV 表格预览（大文件虚拟滚动与双向高亮）**：轻松流畅浏览数 MB 级 CSV，支持固定行号列、数值列右对齐及统计（总和/均值/最小/最大）、分隔符切换（自动 / , / Tab / ;）、自动换行、**编辑器 ⇔ 表格单元格与子串双向高亮**、双击复制单元格（可在设置中开关）及复制为 Markdown 表格
- [x] **导出与个性化定制**：
  - **Word（\`.docx\`）**、**PDF / HTML（页面设置、主题样式与页眉页脚）**、**Mermaid 与 KaTeX 一键导出 SVG/PNG 及放大查看**
  - **键盘宏录制回放（\`⌘ + ⇧ + M\` / \`F8\`）**、**4 套主题（浅色 / 深色 / 护眼 / 午夜）+ 自定义 CSS**、**8 种界面语言**

---

### 1. 立即体验交互功能

1. **测试行内选区同步与浮动菜单**：请在**左侧编辑器**中选中下方引文里的任意词语——上方会弹出浮动菜单，右侧预览也会字符级同步高亮！
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **测试 Markdown 表格 GUI 工具栏**：点击下方表格中的任意单元格，编辑器上方即会出现表格编辑工具栏。

| 模式 | 适用场景 | 布局与功能 |
| :--- | :--- | :--- |
| **简洁** | 快速记录与专注编辑 | 隐藏顶栏的单栏纯净编辑器，保留格式工具栏 |
| **标准** | 日常写作与可视化编辑 | 编辑器 + 双向实时预览 + 格式工具栏 + AI 聊天 |
| **高级** | 开发工作流、PKM 与 Git | 多标签与双栏对比、知识图谱、Git 面板、开发服务器与终端 |

---

### 2. 工作流总览 (Mermaid)

> [!NOTE]
> GitHub 风格的 \`[!NOTE]\`、\`[!TIP]\`、\`[!IMPORTANT]\`、\`[!WARNING]\`、\`[!CAUTION]\` 提示框、Mermaid 图表与 KaTeX 公式均可直接在预览区导出为 **SVG 或 PNG**。

\`\`\`mermaid
flowchart LR
  Write["✍️ 写作 / 斜杠 / 图片自动优化"] --> Knowledge["🕸️ 双向链接与知识图谱"]
  Knowledge --> AI["🤖 AI 自定义 / 幽灵补全 / 校对"]
  AI --> Check["🛡️ 兼容性检查与自动快照"]
  Check --> Git["🌿 Git 面板与行内 Diff"]
  Git --> Export["📦 Word / HTML / PDF / 幻灯片"]
\`\`\`

---

### 3. 常用快捷键（可在 设置 → 快捷键 中自定义 112+ 项命令）

| 操作 | macOS | Windows / Linux |
| :--- | :--- | :--- |
| 切换模式（简洁 / 标准 / 高级） | \`⌘ + \\\` | \`Ctrl + \\\` |
| 快速打开（文件 / \`@标题\`） | \`⌘ + P\` | \`Ctrl + P\` |
| 命令面板 | \`⌘ + K\` | \`Ctrl + K\` |
| 跨文件夹 Grep 搜索与替换 | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| 选区行内 AI 编辑 | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| 切换 / 跳转行书签 | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| 录制 / 回放键盘宏 | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| 专注模式 / 矩形块选择 | \`⌘ + ⇧ + F\` / \`Option + 拖拽\` | \`Ctrl + Shift + F\` / \`Alt + 拖拽\` |
| 全局呼出快捷键（需在设置中开启） | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. LaTeX 数学公式与多语言语法高亮

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
