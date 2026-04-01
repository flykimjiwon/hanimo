# hanimo 🐶

> **어디서든 개발하는 터미널 AI 코딩 에이전트 — 클라우드든 로컬이든.**

[English](README.md) · [GitHub](https://github.com/flykimjiwon/dev_anywhere)

이름의 유래: **하니모**는 작고 귀여운 흰색 미니 비숑 강아지 🐶 — 작지만 똑똑하고 항상 곁에 있어줍니다.

---

## hanimo이 뭔가요?

hanimo은 가벼운 터미널 기반 AI 코딩 에이전트입니다. Claude Code나 Cursor와 비슷하지만, **프로바이더 독립적**이고 **로컬 모델 우선**입니다.

- **14개 LLM 프로바이더** — OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama, vLLM, LM Studio 등
- **16개 내장 도구** — 파일 편집, 셸 실행, Git, 웹 페치, 진단 등
- **해시 앵커 편집** — 파일 변경 감지로 잘못된 편집 방지
- **자율 모드** — 에이전트가 작업 완료까지 자동 반복
- **스마트 컨텍스트 압축** — LLM 기반 대화 요약으로 맥락 보존
- **듀얼 UI** — 풀스크린 TUI (Ink/React) 또는 경량 텍스트 모드
- **네이티브 의존성 제로** — 순수 JavaScript, `npm install` 한 방
- **~7,800줄** — AI 코딩 에이전트 중 가장 높은 기능/코드 밀도

---

## 빠른 시작

### 방법 A: 바이너리 다운로드 (Node.js 불필요)

[GitHub Releases](https://github.com/flykimjiwon/dev_anywhere/releases)에서 OS에 맞는 파일을 다운로드:

| OS | 파일 | 설치 |
|----|------|------|
| **macOS (Apple Silicon)** | `hanimo-macos-arm64` | `chmod +x hanimo-macos-arm64 && mv hanimo-macos-arm64 /usr/local/bin/hanimo` |
| **Linux (x64)** | `hanimo-linux-x64` | `chmod +x hanimo-linux-x64 && sudo mv hanimo-linux-x64 /usr/local/bin/hanimo` |
| **Windows (x64)** | `hanimo-windows-x64.exe` | PATH에 추가하거나 직접 실행 |

설치 후:
```bash
hanimo
```

### 방법 B: 소스에서 설치 (Node.js 필요)

#### 사전 요구사항

- **Node.js** >= 20.0.0
- **npm** (Node.js에 포함)
- (선택) **Ollama** 로컬 모델용 — [ollama.com](https://ollama.com)

```bash
# 클론
git clone https://github.com/flykimjiwon/dev_anywhere.git
cd dev_anywhere

# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 또는 글로벌 설치
npm link
hanimo
```

### Ollama로 첫 실행 (무료, 오프라인)

```bash
# 1. Ollama 설치
brew install ollama   # macOS
curl -fsSL https://ollama.com/install.sh | sh   # Linux
# Windows: https://ollama.com 에서 다운로드

# 2. 모델 다운로드
ollama pull qwen3:8b

# 3. hanimo 시작
hanimo --provider ollama --model qwen3:8b
```

### OpenAI로 첫 실행

```bash
# API 키 설정
export OPENAI_API_KEY="sk-..."

# hanimo 시작
hanimo --provider openai --model gpt-4o-mini
```

---

## 지원 프로바이더 (14개)

| 프로바이더 | 유형 | 주요 모델 |
|----------|------|--------|
| **OpenAI** | 클라우드 | gpt-4o, gpt-4o-mini, gpt-4.1, o3-mini |
| **Anthropic** | 클라우드 | claude-sonnet-4, claude-haiku-4, claude-opus-4 |
| **Google** | 클라우드 | gemini-2.5-flash, gemini-2.5-pro |
| **DeepSeek** | 클라우드 | deepseek-chat, deepseek-coder, deepseek-reasoner |
| **Groq** | 클라우드 | llama-3.3-70b, qwen-qwq-32b |
| **Together** | 클라우드 | 다양한 오픈 모델 |
| **OpenRouter** | 클라우드 | OpenRouter를 통한 모든 모델 |
| **Fireworks** | 클라우드 | 다양한 오픈 모델 |
| **Mistral** | 클라우드 | codestral, mistral-large, mistral-small |
| **GLM** | 클라우드 | Zhipu GLM 모델 |
| **Ollama** | 로컬 | 모든 Ollama 모델 (qwen3, llama3, gemma3 등) |
| **vLLM** | 로컬 | 셀프 호스팅 모델 |
| **LM Studio** | 로컬 | 데스크톱 관리 모델 |
| **Custom** | 로컬 | OpenAI 호환 엔드포인트 |

---

## 도구 (16개)

hanimo은 AI 에이전트에게 16개 내장 도구를 제공합니다:

### 핵심 파일 작업
| 도구 | 설명 |
|------|-------------|
| `read_file` | 라인 번호와 함께 파일 읽기 |
| `write_file` | 파일 생성/덮어쓰기 (디렉토리 자동 생성) |
| `edit_file` | 파일 내 정확한 문자열 교체 |
| `hashline_read` | 해시 태그된 라인으로 파일 읽기 (안전한 편집용) |
| `hashline_edit` | 해시 앵커로 편집 — 스테일 라인 에러 방지 |

### 검색
| 도구 | 설명 |
|------|-------------|
| `glob_search` | glob 패턴으로 파일 찾기 (.gitignore 존중) |
| `grep_search` | 정규식 내용 검색 (컨텍스트 라인 지원) |
| `batch` | 여러 읽기/glob을 병렬 실행 (2~5배 빠름) |

### 셸 & Git
| 도구 | 설명 |
|------|-------------|
| `shell_exec` | 셸 명령 실행 (22개 위험 패턴 차단) |
| `git_status` | Git 워킹 트리 상태 확인 |
| `git_diff` | 스테이지/언스테이지 변경사항 보기 |
| `git_commit` | Git 커밋 생성 |
| `git_log` | 커밋 이력 보기 |

### 신규 도구
| 도구 | 설명 |
|------|-------------|
| `webfetch` | 웹 페이지 가져오기, HTML/JSON에서 텍스트 추출 |
| `todo` | 멀티스텝 작업을 태스크 리스트로 추적 |
| `diagnostics` | TypeScript/ESLint 검사 (파일 수정 없이) |

---

## 주요 기능

### 해시 앵커 편집 (Hashline)

기존 라인 번호 편집은 파일이 변경되면 엉뚱한 곳을 수정합니다. Hashline이 이를 해결합니다:

```
# hashline_read로 파일 읽기:
1#a3f1| function hello() {
2#7bc2|   console.log("hello");
3#e4d0| }

# hashline_edit로 해시 앵커를 사용해 편집:
startAnchor: "2#7bc2"  endAnchor: "2#7bc2"
newContent: '  console.log("hello world");'

# 라인 2가 변경되었으면 → "다시 읽으세요" 에러
# 해시가 일치하면 → 안전하게 편집 적용
```

### 자율 모드 (`/auto`)

```
/auto src/의 모든 TypeScript 에러를 수정해
```

에이전트가 자동으로 루프: 코드 읽기 → 수정 → 진단 실행 → 반복. 최대 20회. 완료 시 macOS 알림.

### 스마트 컨텍스트 압축

대화가 길어지면 (40개 메시지 이상), hanimo은 LLM을 사용해 이전 맥락을 요약합니다. 단순 잘라내기 대신 태스크 목표, 완료된 작업, 현재 상태를 보존합니다.

### LSP 진단

```
/diagnostics              # 프로젝트 전체 검사
/diagnostics src/app.ts   # 특정 파일 검사
```

`tsc --noEmit` + ESLint를 실행하고 구조화된 결과를 반환합니다. 에이전트가 에러를 읽고 직접 수정할 수 있습니다.

### 세션 관리

```
/save                     # 현재 세션 저장
/load                     # 저장된 세션 불러오기
/sessions                 # 최근 세션 목록
/search auth              # 키워드로 세션 검색
```

세션은 `~/.hanimo/sessions/`에 JSON 파일로 저장됩니다.

### 역할 시스템

세 가지 내장 역할이 도구 접근을 제어합니다:

| 역할 | 도구 | 용도 |
|------|-------|----------|
| **dev** (에이전트) | 16개 전체 | 코딩, 파일 편집, Git |
| **plan** (어시스턴트) | 읽기 전용 (8개) | 코드 리뷰, 분석 |
| **chat** (채팅) | 도구 없음 | 일반 대화 |

hanimo은 모델 역량에 따라 적절한 역할을 자동 감지합니다 (예: 작은 Ollama 모델 → Chat 역할).

### MCP 지원

hanimo은 Model Context Protocol (MCP)로 도구를 확장할 수 있습니다:

```json
// ~/.hanimo/config.json
{
  "mcp": {
    "servers": {
      "my-server": {
        "command": "npx",
        "args": ["-y", "some-mcp-server"],
        "enabled": true
      }
    }
  }
}
```

**stdio**와 **SSE** 트랜스포트 모두 지원. `onlineOnly` 태그된 서버는 오프라인 모드에서 건너뜁니다.

---

## 설정

### 설정 파일: `~/.hanimo/config.json`

예시 설정 파일을 복사해서 시작:
```bash
cp config.example.jsonc ~/.hanimo/config.json
```

```json
{
  "provider": "ollama",
  "model": "qwen3:8b",
  "providers": {
    "openai": { "apiKey": "sk-..." },
    "anthropic": { "apiKey": "sk-ant-..." }
  },
  "maxSteps": 25,
  "shell": {
    "timeout": 30000,
    "requireApproval": true
  },
  "defaultRole": "dev",
  "subAgents": {
    "enabled": false,
    "count": "3"
  }
}
```

### Custom Provider (직접 추가)

OpenAI 호환 API 서버라면 어디든 연결 가능합니다. 설정 파일의 `customProviders`에 추가:

```json
{
  "customProviders": [
    {
      "name": "my-gpu-server",
      "baseURL": "http://192.168.1.100:8000/v1",
      "models": ["llama-3.1-70b", "qwen2.5-coder-32b"]
    },
    {
      "name": "my-cloud-api",
      "baseURL": "https://api.example.com/v1",
      "apiKey": "your-key",
      "models": ["model-a", "model-b"]
    }
  ]
}
```

Custom provider는 `/provider` 메뉴에 자동으로 나타납니다. 더 많은 예시는 `config.example.jsonc`를 참고하세요.

### 프로젝트 지시사항: `.hanimo.md`

프로젝트 루트에 `.hanimo.md` 파일을 만들어 AI에게 맥락을 제공하세요:

```markdown
# 프로젝트: 내 앱

- Next.js 15 App Router 사용
- TypeScript strict 모드
- 테스트는 Vitest
- 데이터베이스: PostgreSQL + Drizzle ORM
```

hanimo은 CWD에서 상위 디렉토리로 올라가며 모든 `.hanimo.md`를 수집합니다 — 모노레포에서 패키지별 지시사항에 유용합니다.

### 환경 변수

```bash
OPENAI_API_KEY=sk-...          # OpenAI
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic
GOOGLE_API_KEY=AI...           # Google
DEEPSEEK_API_KEY=...           # DeepSeek
GROQ_API_KEY=gsk_...           # Groq
```

---

## 멀티 엔드포인트 시스템

hanimo은 **여러 LLM 서버에 동시 연결**해서 각 서버의 모델을 자동으로 가져옵니다.

### 엔드포인트 등록 방법

#### 방법 1: TUI 커맨드 (hanimo 안에서)

```bash
# 엔드포인트 추가
/endpoint add local ollama http://localhost:11434
/endpoint add dgx custom https://spark3-share.tech-2030.net/api/v1 API키값
/endpoint add remote ollama http://192.168.1.100:11434

# 등록된 엔드포인트 목록
/endpoint list

# 엔드포인트 삭제
/endpoint remove dgx
```

#### 방법 2: 설정 파일 직접 편집

`~/.hanimo/config.json` 편집:

```json
{
  "provider": "ollama",
  "model": "qwen3:8b",
  "endpoints": [
    {
      "name": "local",
      "provider": "ollama",
      "baseURL": "http://localhost:11434",
      "enabled": true,
      "priority": 10
    },
    {
      "name": "dgx-spark",
      "provider": "custom",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "여기에-API-키",
      "enabled": true,
      "priority": 5
    },
    {
      "name": "remote-ollama",
      "provider": "ollama",
      "baseURL": "http://192.168.1.100:11434",
      "enabled": true,
      "priority": 3
    }
  ]
}
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `name` | O | 메뉴에 표시되는 이름 |
| `provider` | O | `ollama`, `custom`, `openai`, `anthropic` 등 |
| `baseURL` | O | 서버 URL |
| `apiKey` | 선택 | API 키 (로컬 Ollama는 불필요) |
| `priority` | 선택 | 높을수록 우선순위 (같은 모델이 여러 곳에 있을 때) |
| `enabled` | 선택 | `false`면 비활성 (기본: true) |

### 동작 원리

- **자동 조회**: 각 엔드포인트에서 모델 목록을 자동으로 가져옴 (Ollama: `/api/tags`, 기타: `/v1/models`)
- **단일 엔드포인트**: 해당 엔드포인트 바로 사용
- **같은 모델이 여러 곳에**: priority 기반 + 라운드로빈 로드밸런싱
- **엔드포인트 오프라인**: 건너뛰고 다음 엔드포인트 시도

### 팀 공유

```bash
# 설정 내보내기 (클라우드 API 키는 마스킹, 로컬은 유지)
hanimo --share-config

# 팀원이 가져오기
hanimo --import-config hanimo-shared.json
# 클라우드 프로바이더 API 키만 직접 입력
```

---

## 키보드 단축키

### TUI 모드
| 키 | 동작 |
|-----|--------|
| `Esc` | 메인 메뉴 열기 |
| `Ctrl+K` | 커맨드 팔레트 (퍼지 검색) |
| `Ctrl+X` → 키 | 리더 키 (S=저장, L=불러오기, V=상세, K=팔레트) |
| `Ctrl+C` | 현재 작업 취소 (두 번 = 종료) |
| `Ctrl+O` | 도구 출력 상세 토글 |
| `↑/↓` | 입력 이력 |
| `Tab` | 명령어 자동완성 |

### 슬래시 커맨드
| 명령어 | 설명 |
|---------|-------------|
| `/help` | 모든 명령어 보기 |
| `/model [이름]` | 모델 변경 (인수 없으면 메뉴) |
| `/provider [이름]` | 프로바이더 변경 (인수 없으면 메뉴) |
| `/role [id]` | 역할 변경 (dev/plan/chat) |
| `/tools [on\|off]` | 도구 접근 토글 |
| `/config` | 현재 설정 보기 |
| `/usage` | 토큰 사용량 & 비용 추정 |
| `/theme [id]` | 테마 변경 (라이브 프리뷰) |
| `/auto [메시지]` | 자율 모드 |
| `/search [키워드]` | 과거 세션 검색 |
| `/diagnostics [파일]` | tsc/eslint 검사 실행 |
| `/clear` | 대화 초기화 |
| `/save` | 세션 저장 |
| `/load` | 세션 불러오기 |
| `/exit` | hanimo 종료 |

---

## 멀티에이전트 오케스트레이션

hanimo은 복잡한 작업을 위한 멀티에이전트 모드를 지원합니다:

```json
// ~/.hanimo/config.json
{
  "subAgents": {
    "enabled": true,
    "count": "5",
    "model": "gpt-4o-mini"
  }
}
```

오케스트레이터가 태스크를 서브태스크로 분해 → 서브에이전트로 병렬 실행 → 결과 합성.

---

## 보안

hanimo은 다층 보안을 제공합니다:

1. **경로 샌드박싱** — 프로젝트 디렉토리 밖 파일 작업 차단
2. **민감 파일 보호** — `.ssh`, `.aws`, `.env`, `*.key`, `*.pem`, `credentials.*` 항상 차단
3. **셸 위험 필터** — 22개+ 패턴 차단 (rm -rf, sudo, curl|bash, DROP TABLE, 포크 폭탄 등)
4. **권한 게이트** — 파괴적 작업은 사용자 승인 필요

---

## Karpathy Loop (자율 연구)

hanimo에는 [Karpathy Loop](https://github.com/karpathy/autoresearch) 스타일 실험을 위한 `program.md`가 포함되어 있습니다:

```bash
cd your-project
claude   # 또는 아무 AI 코딩 에이전트
# 그 다음: "program.md 읽고 실험 루프 시작해"
```

에이전트가: 코드 읽기 → 한 가지 변경 → 점수 측정 → 유지 또는 되돌림 → 무한 반복.

---

## 아키텍처

```
src/
├── core/          # 에이전트 루프, 시스템 프롬프트, 압축, 자율 루프
├── tools/         # 16개 도구 (hashline, webfetch, todo, batch, diagnostics...)
├── providers/     # 14개 LLM 프로바이더 (Ollama, OpenAI, Anthropic, Google...)
├── tui/           # Ink/React 풀스크린 TUI
├── agents/        # 오케스트레이터, 서브에이전트
├── config/        # Zod 스키마 검증
├── roles/         # dev/plan/chat 역할 시스템
├── session/       # JSON 파일 기반 세션 저장
├── mcp/           # MCP 클라이언트 (stdio + SSE)
├── cli.ts         # Commander CLI 진입점
└── text-mode.ts   # 경량 readline 모드
```

**TypeScript ~7,800줄** — 20개 테스트 파일에 150개 테스트.

---

## 개발

```bash
# 개발 모드 실행
npm run dev

# 테스트
npm test

# 타입 체크
npm run lint

# 포맷
npm run format
```

---

## 비교

| 기능 | hanimo | Claude Code | Cursor | Aider |
|---------|:-----:|:-----------:|:------:|:-----:|
| 오픈소스 | O | X | X | O |
| 로컬 모델 | 4개 프로바이더 | X | X | O |
| 클라우드 프로바이더 | 10개 | 1개 | 2개 | 5개 |
| 내장 도구 | 16개 | ~10개 | ~8개 | ~6개 |
| 해시 편집 | O | X | X | X |
| 자율 모드 | O | X | X | X |
| TUI + 텍스트 모드 | 둘 다 | TUI만 | GUI | 텍스트 |
| 네이티브 의존성 제로 | O | X | X | X |
| 코드 규모 | 7.8K | ~200K+ | N/A | ~15K |

---

## 로드맵

- [ ] 서드파티 도구용 플러그인 시스템
- [ ] VS Code 확장
- [ ] 웹 UI 대시보드
- [ ] hanimo.app 생태계 통합 (HanimoAI, HanimoRAG)
- [ ] 에이전트 스웜 모드 (여러 에이전트 협업)

---

## 라이선스

MIT

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/flykimjiwon">김지원</a> and hanimo 🐶
</p>
