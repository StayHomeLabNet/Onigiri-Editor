import type { DeepPartial } from './merge';
import type { Translations } from './types';

export const ko: DeepPartial<Translations> = {
  appName: 'Onigiri Editor',
  versionLabel: 'v2.0.0',
  modes: {
    simple: '심플',
    basic: '기본',
    advanced: '고급',
  },
  harness: {
    modeLabel: 'AI 하네스',
    editorLabel: '편집기',
    newThread: '새 스레드',
    threadsHeading: '스레드 목록',
    permPlan: '계획 (읽기 전용)',
    permApprove: '편집마다 승인',
    permAuto: '자동 편집',
    permFull: '전체 액세스',
    executePlanBtn: '이 계획 실행',
    diffCardTitle: '변경된 파일',
    acceptChangesBtn: '변경 유지',
    revertTurnBtn: '이번 턴 되돌리기',
    openInEditorBtn: '편집기에서 열기',
    sendToHarnessBtn: 'AI 하네스로 보내기',
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

**Onigiri Editor**는 **양방향 시각적 Markdown 편집**, **AI 채팅 및 사용자 지정 도구 모음 버튼**, **PKM 및 지식 그래프**, **Git 소스 제어**, **100+ 언어 코드 하이라이트**, 그리고 **개발 서버 자동 감지 및 내장 웹 브라우저 미리보기**를 하나의 크로스 플랫폼 작업 공간에 통합한 편집기입니다.

> [!TIP]
> - **모드 전환 (\`⌘ + \\\` / \`Ctrl + \\\`)**: **심플**(상단 바를 숨기고 서식 도구 모음에 집중), **기본**(양방향 실시간 분할 미리보기 및 AI), **고급**(다중 탭, 파일 탐색기, Git, 통합 터미널) 간에 언제든 전환할 수 있습니다.
> - **기능 가이드 (\`?\`)**: 상단 오른쪽의 **\`?\`** 버튼을 클릭하거나 명령 팔레트(\`⌘ + K\` / \`Ctrl + K\`)에서 영어 또는 일본어로 기능을 검색해 바로 실행하세요.
> - **빠른 열기 (\`⌘ + P\` / \`Ctrl + P\`)**: 작업 영역 파일로 빠르게 이동하거나 \`@\`를 입력해 원하는 제목으로 점프합니다.
> - **설정 (\`⌘ + ,\` / \`Ctrl + ,\`)**: 112개 이상의 단축키, AI 사용자 지정 버튼, 자동 스냅샷, JSON 설정 백업을 자유롭게 구성할 수 있습니다.

---

## 주요 기능

### ✍️ 1. 작성, 시각적 편집 및 실시간 미리보기
- [x] **양방향 실시간 편집 및 동기화 하이라이트**: 왼쪽 CodeMirror 6와 오른쪽 TipTap 시각적 미리보기가 실시간으로 동기화됩니다. **현재 줄 블록 하이라이트**와 **편집기에서 선택한 텍스트의 미리보기 내 문자 단위 하이라이트**를 지원합니다(**설정 → 편집기**에서 전환 가능)
- [x] **풍부한 작성 도우미**:
  - 선택한 텍스트 위에 자동으로 나타나는 **선택 플로팅 버블 메뉴**(굵게, 기울임꼴, 코드, 링크, 인라인 AI 편집, AI 사용자 지정 빠른 버튼)
  - 커서가 표 안에 있을 때 자동 표시되는 **Markdown 표 GUI 도구 모음**(행/열 추가·삭제, 정렬, 숫자 정렬, 서식 정리)
  - **미리보기 이미지 인터랙티브 제어**: 왼쪽/오른쪽 텍스트 줄 바꿈 배치, 너비 전환(200 / 280 / 380px), Alt 텍스트 편집 또는 미리보기에서 바로 삭제
  - 줄 시작 \`/\` **슬래시 명령**, **사용자 지정 스니펫**, **자동 목차(TOC)**, **Enter 1회 줄 바꿈(\`<br>\`) 미리보기**
  - **인용 및 링크 카드(썸네일 지원) / BibTeX 및 DOI 조회 / 각주**, **URL 붙여넣기 시 제목 자동 가져오기**, **데일리 노트 및 템플릿**, **웹 클리퍼(Web Clipper)**, **슬라이드 프레젠테이션 모드**
- [x] **전문가용 코드 및 텍스트 유틸리티(오른쪽 클릭 메뉴 포함)**:
  - **다중 커서(\`⌘ + D\` / \`Option + 클릭\`)**, **사각형 블록 선택(\`Option + 드래그\` / \`Alt + 드래그\`)**, **줄 북마크(\`⌘ + F2\` / \`F2\`)**, **줄 이동(\`⌘ + L\`)**
  - **찾기 및 정규식 바꾸기**(선택 범위 한정 및 접힌 블록 자동 펼치기 지원), **코드 접기**, **공백 / 전각 공백 / 줄 바꿈 기호 표시**, **열 눈금자**, **집중 모드**, **타자기 스크롤**
  - **오른쪽 클릭 변환 및 데이터 도구**: 대/소문자/제목 대소문자 변환, 줄 앞 공백 제거, 인용 부호 추가, **JSON 포맷 / 압축 / 키 정렬**, **JSON ⇔ YAML 변환**, **\`.env\` 포맷터**, **서식 있는 텍스트로 복사**
  - **인코딩 및 줄 바꿈 관리**: UTF-8 / Shift_JIS / EUC-JP로 새로 만들기·다시 열기, LF/CRLF 전환, 실시간 글자 수 / 단어 수 / 읽기 시간 카운터

### 🤖 2. AI 하네스(Harness), 멀티 프로바이더 및 개인정보 보호
- [x] **통합 AI 하네스 (선택 영역 인라인 편집: \`⌘ + ⇧ + E\`)**:
  - **Apple Foundation Models(온디바이스, macOS 26+)**, **Codex CLI**, **Claude Code CLI**, **Gemini CLI**, **Antigravity CLI**, **OpenAI / Anthropic / Gemini API**, **Ollama**, **LM Studio**를 하나의 작업 공간에서 안전하게 오케스트레이션하며 실시간 진행 상황·중단·오류 원인 안내까지 제공합니다
- [x] **AI 출력 정리 (\`AI 정리\` 버튼)**:
  - 붙여넣은 AI 출력을 한 번의 클릭으로 규칙 기반 정리: 코드 블록을 보존한 채 **GFM 표 열 너비 정렬**, 글머리 기호 및 제목 빈 줄 정규화, 제로 너비 공백/NBSP 제거, 스마트 따옴표 정리. **HTML 붙여넣기 시 Markdown 자동 변환**도 지원
- [x] **도구 모음 AI 사용자 지정 버튼 및 하위 메뉴**:
  - 최대 5개의 기본 버튼 + 각 10개의 하위 메뉴 항목을 등록할 수 있으며, **버튼/항목별 모델 개별 지정(구독 CLI / 클라우드 API / 로컬 AI)** 및 프롬프트 변수(\`{{selection}}\`, \`{{clipboard}}\`, \`{{date}}\` 등)를 지원합니다. **AI 번역** 프리셋 기본 제공
- [x] **AI 채팅(\`@파일\` 참조 지원), AI 고스트 텍스트 자동 완성(\`Tab\` 수락·생성 중 표시) 및 교정**:
  - 읽기 전용 샌드박스 실행, **AI 전송 내용 미리보기 및 민감 정보 마스킹**(API 키/토큰 자동 가리기), 적용 전 **줄 단위 Diff 미리보기**로 안전하게 검증·반영합니다

### 🛡️ 3. 안전 백업, 자산 관리 및 호환성 진단
- [x] **자동 스냅샷 및 빠른 메모**:
  - **자동 스냅샷 타임라인 및 부분 청크 복원**(저장 시 및 주기적 자동 저장)
  - 저장이 필요 없는 **빠른 메모(Scratchpad)** 및 **전역 호출 단축키(\`⌘ + ⇧ + Space\`)**
  - 재시작 시 **세션 자동 복원** 및 외부 파일 변경 감지
- [x] **이미지 최적화 및 방언 호환성 진단**:
  - 붙여넣거나 드롭한 이미지를 \`assets/\`에 자동 리사이즈·압축, **전체 이미지 크기 목록**, **미사용 이미지 일괄 정리**
  - **Markdown 호환성 검사**(GitHub / Zenn / Qiita / Notion / Obsidian 문법 차이 진단)

### 🕸️ 4. 지식 그래프, Git, 개발 도구 및 내보내기
- [x] **PKM 및 지식 그래프**:
  - \`[[WikiLinks]]\`, 백링크, \`#태그\` 탐색, **인터랙티브 지식 그래프 및 깨진 링크 진단**
- [x] **Git 소스 제어 및 개발 작업 공간(고급 모드)**:
  - **Git 사이드바 탭**(스테이지/스테이지 해제/변경 취소, 인라인 Diff, **AI 커밋 메시지**, Pull/Push) 및 **Git HEAD와 비교**
  - **다중 탭 및 나란히 분할 비교**, **폴더 전체 정규식 Grep 바꾸기(\`⌘ + ⇧ + G\`)**
  - **통합 터미널 서랍**, **멀티 개발 서버 런처(QR / LAN 공유 및 AI 로그 진단)**, **내장 웹 브라우저**(원클릭 \`✕\` 닫기)
  - **CSV / TSV 표 미리보기(대용량 가상 스크롤 & 양방향 하이라이트)**: 수 MB 크기 CSV도 부드럽게 렌더링하며 고정 행 번호 열, 숫자 열 자동 오른쪽 정렬 및 통계(합계/평균/최소/최대), 구분 기호 전환(자동 / , / Tab / ;), 줄 바꿈 토글, **편집기 ⇔ 표 셀·부분 문자열 양방향 하이라이트**, 더블 클릭 셀 복사(설정에서 ON/OFF 가능), Markdown 표로 복사를 지원합니다
- [x] **내보내기 및 사용자 지정**:
  - **Word(\`.docx\`)**, **PDF / HTML(페이지 설정, 디자인 테마 및 머리글/바닥글)**, **Mermaid 및 KaTeX SVG/PNG 내보내기 및 확대**
  - **키보드 매크로(\`⌘ + ⇧ + M\` / \`F8\`)**, **4가지 테마(라이트 / 다크 / 세피아 / 미드나이트) + 사용자 지정 CSS**, **8개 언어 UI**

---

### 1. 여기에서 바로 대화형 기능 체험하기

1. **인라인 선택 동기화 및 버블 메뉴 테스트**: **왼쪽 편집기**에서 아래 인용문 안의 아무 문구나 드래그해 선택해 보세요. 선택 영역 위에 플로팅 버블 메뉴가 나타나고 오른쪽 미리보기에서도 문자 단위로 하이라이트됩니다!
   > こんにちは！下の「AI翻訳」ボタンや選択メニューを使って、この文章を英語に翻訳してみてください。
2. **Markdown 표 GUI 도구 모음 테스트**: 아래 표의 아무 셀이나 클릭하면 편집기 위에 표 편집 도구 모음이 나타납니다.

| 모드 | 추천 용도 | 레이아웃 및 기능 |
| :--- | :--- | :--- |
| **심플** | 빠른 메모 및 코드 집중 편집 | 상단 바를 숨긴 깔끔한 단일 창 편집기 + 서식 도구 모음 |
| **기본** | 일상적인 글쓰기 및 시각적 편집 | 편집기 + 양방향 실시간 미리보기 + 서식 도구 모음 + AI 채팅 |
| **고급** | 개발 워크플로, PKM 및 Git | 다중 탭 및 분할 비교, 지식 그래프, Git 패널, 개발 서버 및 터미널 |

---

### 2. 워크플로 개요 (Mermaid)

> [!NOTE]
> GitHub 스타일의 \`[!NOTE]\`, \`[!TIP]\`, \`[!IMPORTANT]\`, \`[!WARNING]\`, \`[!CAUTION]\` 콜아웃과 Mermaid 다이어그램, KaTeX 수식은 미리보기에서 바로 **SVG 또는 PNG**로 내보낼 수 있습니다.

\`\`\`mermaid
flowchart LR
  Write["✍️ 작성 / 슬래시 / 이미지 자동 최적화"] --> Knowledge["🕸️ 위키링크 & 지식 그래프"]
  Knowledge --> AI["🤖 AI 사용자 지정 / 고스트 텍스트 / 교정"]
  AI --> Check["🛡️ 호환성 검사 & 자동 스냅샷"]
  Check --> Git["🌿 Git 패널 & 인라인 Diff"]
  Git --> Export["📦 Word / HTML / PDF / 슬라이드"]
\`\`\`

---

### 3. 유용한 단축키 (설정 → 단축키에서 112+ 명령 사용자 지정 가능)

| 작업 | macOS | Windows / Linux |
| :--- | :--- | :--- |
| 모드 전환 (심플 / 기본 / 고급) | \`⌘ + \\\` | \`Ctrl + \\\` |
| 빠른 열기 (파일 / \`@제목\`) | \`⌘ + P\` | \`Ctrl + P\` |
| 명령 팔레트 | \`⌘ + K\` | \`Ctrl + K\` |
| 폴더 전체 Grep 검색 및 바꾸기 | \`⌘ + ⇧ + G\` | \`Ctrl + Shift + G\` |
| 선택 영역 인라인 AI 편집 | \`⌘ + ⇧ + E\` | \`Ctrl + Shift + E\` |
| 줄 북마크 전환 / 이동 | \`⌘ + F2\` / \`F2\` | \`Ctrl + F2\` / \`F2\` |
| 키보드 매크로 기록 / 재생 | \`⌘ + ⇧ + M\` / \`F8\` | \`Ctrl + Shift + M\` / \`F8\` |
| 집중 모드 / 사각형 블록 선택 | \`⌘ + ⇧ + F\` / \`Option + 드래그\` | \`Ctrl + Shift + F\` / \`Alt + 드래그\` |
| 전역 호출 단축키 (설정에서 활성화) | \`⌘ + ⇧ + Space\` | \`Ctrl + Shift + Space\` |

---

### 4. LaTeX 수식 및 다중 언어 구문 하이라이트

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
