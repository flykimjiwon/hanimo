# 06. VS Code 익스텐션 개발 계획

> 작성일: 2026-03-26

---

## 목표

hanimo의 코어 엔진을 **터미널 TUI + VS Code 익스텐션** 양쪽에서 사용할 수 있는 구조로 발전시킨다.

---

## 1. 모노레포 구조 (권장)

```
hanimo/                     ← pnpm workspace root
├── pnpm-workspace.yaml
├── packages/
│   └── core/                     ← @hanimo/core
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          ← 공개 API
│           ├── agents/           ← Coordinator, WorkerPool, FileLock
│           ├── core/             ← agentLoop, systemPrompt
│           ├── tools/            ← file-ops, git, glob, grep, shell
│           ├── session/          ← SessionStore (SQLite)
│           ├── providers/        ← LLM 레지스트리
│           ├── config/           ← Zod 스키마, 로더
│           ├── conversation/     ← (NEW) 대화 관리, 슬래시 명령
│           └── pricing/          ← (NEW) 모델별 비용 산정
├── apps/
│   ├── cli/                      ← 기존 터미널 앱
│   │   ├── package.json          ← depends on @hanimo/core
│   │   └── src/
│   │       ├── cli.ts
│   │       ├── text-mode/        ← ANSI 렌더러, 메뉴
│   │       ├── onboarding.ts
│   │       └── tui/              ← Ink/React 컴포넌트
│   └── vscode/                   ← VS Code 익스텐션 (NEW)
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── extension.ts      ← activate/deactivate
│       │   └── providers/
│       │       └── ChatViewProvider.ts
│       └── media/
│           ├── main.js           ← 챗 UI (React+Vite 번들)
│           └── styles.css
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

---

## 2. VS Code 익스텐션 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────┐
│  VS Code Extension Host (Node.js)           │
│                                             │
│  extension.ts                               │
│    ├── ChatViewProvider                     │
│    │     ├── resolveWebviewView()           │
│    │     └── postMessage() ←→ onMessage()   │
│    ├── @hanimo/core                   │
│    │     ├── runAgentLoop()                 │
│    │     ├── getModel()                     │
│    │     ├── createToolRegistry()           │
│    │     └── SessionStore                   │
│    └── VS Code APIs                         │
│          ├── TextEditor (코드 삽입/수정)      │
│          ├── Diagnostics (문제 패널)         │
│          └── CodeActions (💡 수정 제안)       │
├─────────────────────────────────────────────┤
│  Webview (샌드박스, 브라우저 환경)             │
│                                             │
│  React Chat UI                              │
│    ├── 메시지 표시 (마크다운 렌더링)           │
│    ├── 코드 블록 (구문 강조 + 복사/적용)       │
│    ├── 입력바 (자동완성, 슬래시 명령)          │
│    └── 스트리밍 표시 (토큰 단위)              │
│                                             │
│  통신: window.postMessage() ↔ acquireVsCodeApi() │
└─────────────────────────────────────────────┘
```

### 사이드바 등록 (package.json)

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [{
        "id": "hanimo",
        "title": "Dev Anywhere",
        "icon": "resources/icon.svg"
      }]
    },
    "views": {
      "hanimo": [{
        "type": "webview",
        "id": "devAnywhere.chatView",
        "name": "Chat"
      }]
    },
    "commands": [
      { "command": "devAnywhere.newChat", "title": "Dev Anywhere: New Chat" },
      { "command": "devAnywhere.fixSelection", "title": "Dev Anywhere: Fix Selection" }
    ]
  }
}
```

### ChatViewProvider 핵심 흐름

```typescript
// 1. 사용자 메시지 수신 (Webview → Extension)
webviewView.webview.onDidReceiveMessage(async (msg) => {
  if (msg.type === 'userMessage') {
    // 2. 코어 에이전트 루프 실행
    const result = await runAgentLoop({
      model: getModel(config),
      tools: createToolRegistry(config),
      messages: [...history, { role: 'user', content: msg.text }],
      // 3. 스트리밍 콜백 → 웹뷰로 전달
      onChunk: (chunk) => {
        webviewView.webview.postMessage({
          type: 'streamChunk', text: chunk
        });
      }
    });
  }
});
```

---

## 3. 주요 제약사항

| 제약 | 설명 | 대응 |
|------|------|------|
| CommonJS 필수 | VS Code extension host는 ESM 미지원 | `tsconfig.json`에서 `"module": "commonjs"` |
| 네이티브 모듈 | `better-sqlite3`는 플랫폼별 바이너리 필요 | `sql.js` (WASM) 대체 고려, 또는 `@vscode/vsce --target` |
| 웹뷰 샌드박스 | 웹뷰에서 Node.js API/LLM 호출 불가 | 모든 AI 호출은 extension host에서, `postMessage`로 결과 전달 |
| CSP | 웹뷰 스크립트는 nonce 필수 | `getNonce()` + CSP 헤더 설정 |

---

## 4. 참고 오픈소스

| 프로젝트 | 라이선스 | 참고 포인트 |
|----------|---------|------------|
| **Continue** (`continuedev/continue`) | Apache 2.0 | `core/` + `extensions/vscode/` 분리, React GUI 웹뷰, 스트리밍 |
| **Cline** (`cline/cline`) | Apache 2.0 | WebviewViewProvider + React, 메시지 프로토콜 |
| **aider-vscode** | MIT | 간단한 터미널 래핑 방식 |
| **Vitest VSCode** | MIT | 모노레포 구조 참고 (`packages/extension` + `packages/shared`) |

---

## 5. 주요 VS Code API 정리

### 웹뷰 (챗 UI)
```typescript
vscode.window.registerWebviewViewProvider(viewId, provider)
webviewView.webview.postMessage(data)      // Extension → Webview
webviewView.webview.onDidReceiveMessage    // Webview → Extension
```

### 에디터 데코레이션 (AI 제안 하이라이트)
```typescript
const deco = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(0,255,0,0.1)',
  border: '1px solid green'
});
editor.setDecorations(deco, [range]);
```

### 터미널 API (명령 실행)
```typescript
const terminal = vscode.window.createTerminal({ name: 'Dev Anywhere' });
terminal.sendText('npm test');
```

### 진단 (문제 패널)
```typescript
const diag = vscode.languages.createDiagnosticCollection('devAnywhere');
diag.set(fileUri, [
  new vscode.Diagnostic(range, 'AI 발견 이슈', vscode.DiagnosticSeverity.Warning)
]);
```

### CodeAction (전구 수정 제안)
```typescript
class FixProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc, range, ctx) {
    const fix = new vscode.CodeAction('Dev Anywhere로 수정', vscode.CodeActionKind.QuickFix);
    fix.command = { command: 'devAnywhere.fixSelection', title: 'Fix' };
    return [fix];
  }
}
```

---

## 6. 실행 로드맵

### Phase 1 — 코어 분리 (선행 필수)

1. pnpm workspace 설정
2. `packages/core/` 추출 (agents, core, tools, session, providers, config)
3. `text-mode.ts`에서 대화 관리 로직 → `core/conversation/` 분리
4. CJS + ESM 듀얼 빌드 설정
5. `apps/cli/`로 기존 CLI 이동, `@hanimo/core` 의존
6. CLI 동작 검증

### Phase 2 — VS Code 익스텐션 MVP

1. `apps/vscode/` 스캐폴딩 (yo code 또는 수동)
2. `ChatViewProvider` 구현 — 사이드바 웹뷰
3. React 챗 UI 개발 (Vite → `media/` 번들)
4. 코어 연결: 사용자 입력 → `runAgentLoop` → 스트리밍 → `postMessage`
5. 기본 명령어 등록 (New Chat, Fix Selection)

### Phase 3 — 기능 확장

1. `DiagnosticsCollection` — AI 코드 분석 결과 문제 패널 표시
2. `CodeActionProvider` — 전구 아이콘으로 AI 수정 제안
3. 에디터 데코레이션 — diff 하이라이트
4. 세션 히스토리 TreeView
5. 설정 UI (`contributes.configuration`)

---

## 7. VS Code 버전 요구사항

| 기능 | 최소 버전 |
|------|----------|
| WebviewViewProvider (사이드바) | 1.57.0 |
| 자동 activation (뷰 기반) | 1.74.0 |
| Language Model API (선택사항) | 1.90.0 |

**권장 최소 타겟: `^1.85.0`**
