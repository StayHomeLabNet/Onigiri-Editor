import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const ko: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v1.5.1',
  modes: {
    simple: '심플',
    basic: '기본',
    advanced: '고급',
  },
  layouts: {
    editor: '편집기',
    split: '분할',
    preview: '미리보기',
  },
  themes: {
    light: '라이트',
    dark: '다크',
    sepia: '세피아',
    midnight: '미드나잇',
  },
  actions: {
    newFile: '새 파일',
    openFile: '열기',
    openFolder: '폴더 열기',
    save: '저장',
    saveAs: '다른 이름으로 저장',
    exportHtml: 'HTML 내보내기',
    exportPdf: '인쇄 / PDF 내보내기',
    exportDocx: 'Word (.docx) 내보내기',
    exportOptions: '페이지 설정 및 내보내기 (PDF / HTML)...',
    commandPalette: '명령 팔레트',
    quickOpen: '빠른 열기',
    zenMode: '집중 모드 (Zen)',
    toggleFocusMode: '현재 단락 집중',
    sidebar: '사이드바',
    inspector: '옵션 / AI 채팅',
    settings: '설정',
    about: 'Onigiri Editor 정보',
    language: '언어',
    theme: '테마',
    slidePresentation: '슬라이드 프레젠테이션',
    openDailyNote: '데일리 노트',
    newFromTemplate: '템플릿 및 데일리 노트',
    webClipUrl: '웹 페이지 Markdown 스크랩',
    workspaceGrep: '폴더 전체 찾기 및 바꾸기',
    insertCitation: '인용 / 링크 카드 / 각주 삽입',
    knowledgeGraph: '지식 그래프',
    findUnusedAssets: '이미지 관리 및 정리',
    featureGuide: '기능 가이드 (?)',
    toggleTopBar: '상단 헤더 바 표시/숨기기',
    toggleFormatToolbar: '서식 도구 모음 표시/숨기기',
    toggleEditorSplit: '편집기 위/아래 분할',
    undo: '실행 취소',
    redo: '다시 실행',
    selectAll: '모두 선택',
    copy: '복사',
    paste: '붙여넣기',
    zoomIn: '확대',
    zoomOut: '축소',
    resetZoom: '확대/축소 재설정 (100%)',
    copyRichText: '서식 있는 텍스트로 복사',
    macroRecord: '매크로 기록',
    macroStop: '기록 중지',
    macroPlay: '매크로 재생',
  },
  tabMenu: {
    pin: '탭 고정',
    unpin: '고정 해제',
    openSide: '측면에서 열기',
    compareWithActive: '현재 탭과 비교',
    close: '닫기',
    closeOthers: '다른 탭 닫기',
  },
  sidebar: {
    files: '파일',
    outline: '개요',
    knowledge: '지식 베이스',
    snippets: '스니펫',
    git: 'Git 소스 제어',
    noFolder: '열린 폴더가 없습니다',
    chooseFolder: '작업 폴더 열기',
    closeFolder: '작업 폴더 닫기',
    noHeadings: '제목(# ~ ######)을 찾을 수 없습니다',
    filterFiles: '파일 이름 또는 확장자로 필터링...',
    newFilePrompt: '새 파일 이름',
    newFolderPrompt: '새 폴더 이름',
    renamePrompt: '이름 바꾸기',
    deleteConfirm: '"{name}"을(를) 삭제하시겠습니까?',
  },
  inspector: {
    chat: 'AI 채팅',
    review: '문서 교정',
    ai: 'AI 정리',
    stats: '통계',
    diff: '스냅샷',
    settings: '빠른 설정',
    settingsLabels: {
      activeLineSyncHighlight: '반대쪽 창에 현재 줄/블록 배경 하이라이트 표시',
      previewSelectionSyncHighlight: '편집기에서 선택한 텍스트를 미리보기에도 하이라이트 표시',
      syncScroll: '스크롤 동기화 (편집기 ↔ 미리보기)',
      typewriterMode: '타자기 스크롤 (활성 줄 중앙 유지)',
      lineNumbers: '줄 번호 표시',
      wordWrap: '자동 줄 바꿈',
      hideTopBarInSimpleMode: '심플 모드에서 상단 헤더 바 숨기기',
      showFormatToolbarInSimpleMode: '심플 모드에서 서식 도구 모음 표시',
      builtinBrowserEnabled: '오른쪽 창에서 내장 웹 브라우저 전환 활성화',
    },
  },
  status: {
    draft: '초안',
    saved: '저장됨',
    words: '단어',
    chars: '자',
    line: '줄',
    col: '열',
    syncOn: '스크롤 동기화 ON',
    syncOff: '스크롤 동기화 OFF',
  },
  aiChat: {
    title: 'AI 채팅',
    send: '보내기',
    cancelBtn: '중지',
    clearChat: '대화 지우기',
    inputPlaceholder: 'AI에게 질문하거나 현재 문서에 대한 작업을 지시하세요...',
    running: '실행 중',
    offline: '오프라인',
  },
  settingsModal: {
    title: '설정',
    tabGeneral: '일반 및 보기',
    tabEditor: '편집기 및 미리보기',
    tabAiCustom: 'AI 사용자 지정',
    tabKeybindings: '단축키',
    tabIntegrations: '브라우저 및 서버',
    tabData: '데이터 및 백업',
    localeLabel: 'UI 언어',
    themeLabel: '테마',
    aiCustom: {
      title: '도구 모음 AI 사용자 지정 버튼',
      desc: '도구 모음에 최대 5개의 AI 실행 버튼을 등록할 수 있습니다. 텍스트 선택 시 선택 영역만, 미선택 시 전체 문서를 전송합니다.',
      addBtn: '버튼 추가',
      resetDefaultsBtn: '기본값으로 복원',
      aiModelOverrideLabel: '사용할 AI 모델 (구독 CLI / API / 로컬)',
      followAiChatOption: 'AI 채팅 패널 설정 따르기',
      providerGroupSubscription: '구독 CLI',
      providerGroupApi: '클라우드 API',
      providerGroupLocal: '로컬 AI / 온디바이스',
      modelSelectLabel: '모델',
      customModelOption: '사용자 지정 모델 입력...',
      refreshModelsBtn: '모델 다시 검색',
    },
  },
  browser: {
    modePreview: '미리보기',
    modeBrowser: '웹 브라우저',
    closeBrowser: '웹 브라우저 닫기',
    back: '뒤로',
    forward: '앞으로',
    reload: '새로고침',
    home: '홈',
    go: '이동',
    openExternal: '외부 브라우저에서 열기',
    openSettings: '브라우저 설정 (홈 URL)',
  },
  updates: {
    checkBtn: '업데이트 확인',
  },
  sampleDocument: `---
title: Onigiri Editor에 오신 것을 환영합니다 — AI 시대의 하이브리드 편집기
author: Onigiri Editor Team
tags: [Onigiri Editor, AI, Markdown, KnowledgeGraph, Git, DevPreview]
---

# Onigiri Editor에 오신 것을 환영합니다 🍙

**Onigiri Editor**는 **양방향 시각적 Markdown 편집**, **AI 채팅 및 사용자 지정 버튼**, **지식 그래프**, **Git 소스 제어**, **100+ 언어 코드 하이라이트**, **개발 서버 자동 감지 및 내장 웹 브라우저**를 하나로 통합한 크로스 플랫폼 편집기입니다.

> [!TIP]
> - **모드 전환 (\`⌘ + \\\` / \`Ctrl + \\\`)**: **심플**(상단 바 숨김, 글쓰기 집중), **기본**(양방향 실시간 미리보기), **고급**(다중 탭, 폴더 탐색기, Git, 통합 터미널) 간에 언제든 전환할 수 있습니다.
> - **기능 가이드 (\`?\`)**: 상단 오른쪽의 **\`?\`** 버튼이나 명령 팔레트(\`⌘ + K\` / \`Ctrl + K\`)에서 원하는 기능을 검색해 바로 실행하세요.
> - **빠른 열기 (\`⌘ + P\` / \`Ctrl + P\`)**: 파일이나 \`@제목\`으로 빠르게 이동합니다.

## 주요 기능

- [x] **양방향 실시간 편집 및 동기화 하이라이트**: **현재 줄 배경 하이라이트**와 **편집기에서 드래그로 선택한 텍스트의 미리보기 내 문자 단위 하이라이트**를 지원합니다.
- [x] **AI 사용자 지정 버튼 및 개별 모델 선택**: Apple Foundation Models, Codex / Claude / Gemini / Antigravity CLI, 클라우드 API, Ollama / LM Studio를 지원하며 버튼별로 모델을 따로 지정할 수 있습니다.
- [x] **안전한 백업 및 생산성 도구**: 자동 스냅샷 및 부분 복원, Markdown 호환성 검사, 이미지 자동 최적화, Git 패널, 지식 그래프, Word/HTML/PDF 내보내기를 제공합니다.

\`\`\`mermaid
flowchart LR
  Write["✍️ 작성 / 슬래시 명령 / 이미지 최적화"] --> Knowledge["🕸️ 위키링크 & 지식 그래프"]
  Knowledge --> AI["🤖 AI 사용자 지정 / 고스트 텍스트 / 교정"]
  AI --> Git["🌿 Git & 스냅샷 Diff"]
  Git --> Export["📦 Word / HTML / PDF / 슬라이드"]
\`\`\`
`,
};
