# techai-ide → hanimo-ide 포팅 플랜

> **생성일**: 2026-04-23  
> **구현 예정**: 2026-04-24  
> **소스**: `택가이코드/techai-ide/` (Wails v2 + React + CodeMirror 6)  
> **대상**: `hanimo/hanimo-ide/` (독립 Go 모듈)  
> **핵심**: 폐쇄망 IDE → 외부망 IDE 변환 + hanimo 기존 LSP 활용

---

## 현재 상태

### techai-ide (소스) — 64개 기능 구현 완료

| 카테고리 | 기능 | LOC |
|---------|------|-----|
| **Go 백엔드** | app.go (파일시스템), chat.go (LLM 10도구), terminal.go (PTY), git.go, config.go, settings.go, knowledge.go, toolparse.go | ~1,660 |
| **React 프론트엔드** | 17개 컴포넌트 (CodeEditor, FileTree, ChatPanel, Terminal, GitPanel, GitGraph, SearchPanel, QuickOpen, CommandPalette, ThemePicker 등) | ~2,500 |
| **빌드** | macOS .app + Windows .exe | 바이너리 존재 |

### hanimo 기존 자산 (활용 가능)

| 자산 | 위치 | 활용 방법 |
|------|------|----------|
| **LSP 클라이언트** | `internal/lsp/` (505 LOC) | IDE에서 직접 import하거나, 별도 구현 대신 재사용 |
| **멀티 프로바이더** | `internal/llm/providers/` | IDE에서 14+ 프로바이더 선택 가능 |
| **5종 테마** | `internal/ui/styles.go` | IDE 테마와 통합 |
| **MCP 클라이언트** | `internal/mcp/` | IDE에서 MCP 도구 연동 |

---

## 포팅 범위 — 전체 파일 매핑

### Phase A — Go 백엔드 포팅 (8개 파일)

| # | 소스 (techai-ide/) | 대상 (hanimo-ide/) | 변경 사항 |
|---|-------|-------|-----------|
| A1 | `main.go` (140L) | `main.go` | 브랜딩 `택가이코드 IDE` → `hanimo IDE`, ClientInfo 변경 |
| A2 | `app.go` (322L) | `app.go` | `.techai.md` → `.hanimo.md` 프로젝트 파일 경로 |
| A3 | `chat.go` (564L) | `chat.go` | **핵심 변경**: 단일 엔드포인트 → 멀티 프로바이더 지원, 기본 모델/URL 변경, config 경로 `.tgc/` → `.hanimo/` |
| A4 | `terminal.go` (131L) | `terminal.go` | 변경 없음 (PTY는 OS 기능) |
| A5 | `git.go` (181L) | `git.go` | 변경 없음 |
| A6 | `config.go` (60L) | `config.go` | `~/.tgc/` → `~/.hanimo/`, `~/.tgc-onprem/` 경로 제거, 환경변수 `TGC_*` → `HANIMO_*` |
| A7 | `settings.go` (58L) | `settings.go` | config 경로 변경 |
| A8 | `knowledge.go` (191L) | `knowledge.go` | 74개 지식팩 → hanimo의 62개 지식팩으로 교체 (bxm 13개 제외) |
| A9 | `toolparse.go` (191L) | `toolparse.go` | 변경 없음 (Qwen 프록시 포맷은 외부망에서도 사용) |

### Phase B — React 프론트엔드 포팅 (17개 컴포넌트)

| # | 소스 | 변경 사항 |
|---|------|-----------|
| B1 | `App.tsx` (179L) | 레이아웃 유지, 타이틀 변경 |
| B2 | `CodeEditor.tsx` (177L) | 변경 없음 (CodeMirror 13언어) |
| B3 | `Editor.tsx` (262L) | 변경 없음 |
| B4 | `Terminal.tsx` (202L) | 변경 없음 |
| B5 | `ChatPanel.tsx` (345L) | **프로바이더 선택 UI 추가**, 기본 안내 문구 변경 |
| B6 | `FileTree.tsx` (275L) | `.techai.md` → `.hanimo.md` 하이라이트 |
| B7 | `GitPanel.tsx` (159L) | 변경 없음 |
| B8 | `GitGraph.tsx` (131L) | 변경 없음 |
| B9 | `SearchPanel.tsx` (223L) | 변경 없음 |
| B10 | `ActivityBar.tsx` (54L) | 변경 없음 |
| B11 | `StatusBar.tsx` (54L) | 브랜딩 변경 |
| B12 | `ThemePicker.tsx` (93L) | 11종 유지 + hanimo honey 테마 추가 |
| B13 | `SettingsPanel.tsx` (104L) | **프로바이더 드롭다운 추가** (14+ 프로바이더) |
| B14 | `QuickOpen.tsx` (130L) | 변경 없음 |
| B15 | `CommandPalette.tsx` (116L) | 브랜딩 변경 |
| B16 | `ResizeHandle.tsx` (54L) | 변경 없음 |
| B17 | `Toast.tsx` (61L) | 변경 없음 |

### Phase C — 빌드 설정

| # | 파일 | 변경 사항 |
|---|------|-----------|
| C1 | `go.mod` | `module techai-ide` → `module hanimo-ide` |
| C2 | `wails.json` | `name: techai-ide` → `name: hanimo-ide`, OutputFilename 변경 |
| C3 | `package.json` | `name: techai-ide-frontend` → `name: hanimo-ide-frontend` |
| C4 | `FEATURES.md` | hanimo 기준으로 재작성 |

---

## 핵심 변환 상세

### 1. 멀티 프로바이더 지원 (chat.go)

techai-ide는 단일 OpenAI-compatible 엔드포인트만 지원:
```go
// techai-ide 현재
cfg := openai.DefaultConfig(apiKey)
cfg.BaseURL = baseURL // 하나만
```

hanimo-ide는 프로바이더 선택 가능:
```go
// hanimo-ide 목표
// 14+ 프로바이더: openai, anthropic, google, ollama, novita, deepseek, groq, ...
// DefaultBaseURLs 맵에서 자동 URL 설정
// /provider 슬래시 커맨드로 런타임 전환
```

**구현 방법**: chat.go에서 `providers.Get(providerName, baseURL, apiKey)` 호출하거나, 기존 go-openai 직접 사용 유지하되 `DefaultBaseURLs` 맵으로 URL 자동 설정.

### 2. 설정 경로 통합

| 항목 | techai-ide | hanimo-ide |
|------|-----------|------------|
| 설정 디렉토리 | `~/.tgc/` 또는 `~/.tgc-onprem/` | `~/.hanimo/` |
| 설정 파일 | `config.yaml` | `config.yaml` (동일 포맷) |
| 프로젝트 파일 | `.techai.md` | `.hanimo.md` |
| 환경변수 | `TGC_API_BASE_URL`, `TGC_API_KEY`, `TGC_MODEL_SUPER` | `HANIMO_API_BASE_URL`, `HANIMO_API_KEY`, `HANIMO_MODEL_SUPER` |
| 기본 모델 | `qwen/qwen3-coder-30b-a3b-instruct` | `qwen3:8b` (Ollama 로컬) |
| 기본 URL | `https://api.novita.ai/openai` | `http://localhost:11434/v1` (Ollama) |

### 3. 지식팩 변환

techai-ide의 74개 → hanimo의 62개로 교체:
- **제거**: bxm 13개 (Shinhan 전용)
- **추가**: `java/spring.md` (hanimo에만 있음)
- `knowledge.go`의 `detectProjectType()` 로직은 동일 유지

### 4. 브랜딩 치환 규칙

```
s/택가이코드 IDE/hanimo IDE/g
s/techai-ide/hanimo-ide/g
s/techai/hanimo/g
s/TECHAI/HANIMO/g
s/\.tgc/\.hanimo/g
s/TGC_/HANIMO_/g
s/tgc-onprem/삭제/
```

---

## 외부망 추가 기능 (hanimo-ide 전용)

techai-ide에는 없지만, hanimo가 외부망이므로 추가 가능한 기능:

| 기능 | 우선도 | 설명 |
|------|--------|------|
| **프로바이더 선택 UI** | 필수 | SettingsPanel에 드롭다운 (14+ 프로바이더) |
| **Ollama 모델 목록** | 높음 | Ollama 연결 시 `/api/tags` → 모델 리스트 자동 표시 |
| **LSP 통합** | 높음 | hanimo의 `internal/lsp/` 활용 → 에디터에 에러/경고 마커 표시 |
| **MCP 도구 연동** | 보통 | MCP 서버 도구를 IDE 채팅에서 사용 가능 |
| **테마 공유** | 낮음 | TUI의 honey/ocean/dracula/nord/forest를 IDE에도 |

---

## 실행 순서 (내일 구현)

### Step 1 — 디렉토리 복사 + 일괄 치환 (30분)

```bash
# 1. 전체 복사
cp -r 택가이코드/techai-ide hanimo/hanimo-ide

# 2. Go 파일 import 경로 + 브랜딩 치환
find hanimo/hanimo-ide -name "*.go" -exec sed -i '' \
  -e 's/techai-ide/hanimo-ide/g' \
  -e 's/techai/hanimo/g' \
  -e 's/택가이코드/hanimo/g' \
  -e 's/\.tgc-onprem/\.hanimo/g' \
  -e 's/\.tgc/\.hanimo/g' \
  -e 's/TGC_/HANIMO_/g' {} \;

# 3. 프론트엔드 치환
find hanimo/hanimo-ide/frontend -name "*.tsx" -o -name "*.ts" -o -name "*.json" | \
  xargs sed -i '' \
  -e 's/techai-ide/hanimo-ide/g' \
  -e 's/techai/hanimo/g' \
  -e 's/택가이코드/hanimo/g' \
  -e 's/\.tgc/\.hanimo/g'

# 4. 설정 파일 치환
sed -i '' 's/techai-ide/hanimo-ide/g' hanimo/hanimo-ide/wails.json
sed -i '' 's/techai-ide/hanimo-ide/g' hanimo/hanimo-ide/go.mod
```

### Step 2 — Go 백엔드 적응 (1시간)

1. `config.go` — 경로 + 환경변수 변경
2. `chat.go` — 기본 모델/URL 변경, 프로바이더 선택 로직 추가
3. `knowledge.go` — bxm 팩 제거, 지식 경로 변경
4. `main.go` — 브랜딩, 윈도우 타이틀

### Step 3 — 프론트엔드 적응 (1시간)

1. `SettingsPanel.tsx` — 프로바이더 드롭다운 추가
2. `ChatPanel.tsx` — 안내 문구 변경, 프로바이더 표시
3. `ThemePicker.tsx` — honey 테마 추가
4. CSS 변수에 honey 테마 팔레트 추가

### Step 4 — 빌드 + 검증 (30분)

```bash
cd hanimo/hanimo-ide
go mod tidy
cd frontend && npm install && cd ..
wails build
# → hanimo-ide.app / hanimo-ide.exe
```

### Step 5 — LSP 통합 (선택, v1.1)

hanimo에 이미 있는 `internal/lsp/` 패키지를 hanimo-ide에서 활용:
- `lsp_definition` → 에디터에서 Cmd+클릭으로 정의 이동
- `lsp_hover` → 에디터에서 마우스 호버로 타입 정보
- `lsp_symbols` → 아웃라인 뷰 (파일 내 심볼 목록)
- `lsp_references` → 참조 찾기

이 단계는 hanimo-ide의 go.mod에서 hanimo의 lsp 패키지를 참조하거나,
`internal/lsp/`를 hanimo-ide에 복사하여 사용.

---

## 위험 요소

| 위험 | 확률 | 대응 |
|------|------|------|
| Wails v2 빌드 환경 미설치 | 중 | `brew install wails` 또는 `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| npm 의존성 충돌 | 낮 | `rm -rf node_modules && npm install` |
| PTY macOS/Linux 전용 | 낮 | `creack/pty`는 이미 크로스플랫폼, Windows는 ConPTY |
| go-openai 버전 차이 | 낮 | go.mod에서 `v1.41.2` 명시 |
| 프론트엔드 TypeScript 에러 | 중 | 치환 후 `npx tsc --noEmit` 확인 |

---

## 최종 결과물

```
hanimo/
├── cmd/hanimo/          ← 기존 TUI
├── hanimo-ide/          ← 새로운 데스크톱 IDE
│   ├── main.go
│   ├── app.go
│   ├── chat.go          ← 멀티 프로바이더 지원
│   ├── terminal.go
│   ├── git.go
│   ├── config.go        ← ~/.hanimo/ 설정
│   ├── settings.go
│   ├── knowledge.go     ← 62개 지식팩 (bxm 제외)
│   ├── toolparse.go
│   ├── go.mod           ← module hanimo-ide
│   ├── wails.json
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx
│       │   └── components/
│       │       ├── CodeEditor.tsx     ← CodeMirror 13언어
│       │       ├── ChatPanel.tsx      ← 프로바이더 선택 가능
│       │       ├── SettingsPanel.tsx   ← 14+ 프로바이더 드롭다운
│       │       └── ...17개 컴포넌트
│       └── package.json
├── internal/            ← 기존 TUI 패키지
│   ├── lsp/             ← IDE v1.1에서 활용 예정
│   ├── llm/providers/   ← IDE chat.go에서 참조 가능
│   └── ...
└── docs/porting/
    └── IDE_PORTING_PLAN.md  ← 이 문서
```

**TUI와 IDE는 독립 바이너리지만 설정(`~/.hanimo/config.yaml`)을 공유.**

---

*구현은 2026-04-24 예정. 이 문서를 참고하여 Step 1~4 순서대로 진행.*
