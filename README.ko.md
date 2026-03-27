# devany

> **어디서든 개발하는 터미널 AI 코딩 어시스턴트 — 클라우드든 로컬이든**

[English](README.md)

---

## devany란?

devany는 터미널에서 동작하는 AI 코딩 어시스턴트입니다. Claude Code, Cursor, Aider와 비슷하지만, **14개 LLM 프로바이더**(클라우드 API + 로컬 서버)를 지원하고, AI가 프로젝트 파일을 읽고, 쓰고, 검색하고, 실행할 수 있습니다.

핵심 차별점:
- **14개 프로바이더, 하나의 인터페이스** — OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama 등
- **Ollama 퍼스트** — 로컬 모델에 최적화, API 비용 0원, 완전 오프라인 지원
- **스마트 역할 감지** — 모델 역량에 따라 Agent/Assistant/Chat 역할 자동 배정
- **네이티브 의존성 제로** — 순수 JavaScript, `npm install` 한 방 (C++ 빌드 없음)

---

## 빠른 시작

```bash
# 클론 & 설치
git clone https://github.com/flykimjiwon/dev_anywhere.git
cd dev_anywhere
npm install

# 실행 (첫 실행 시 설정 위저드 자동 실행)
npm run dev

# 또는 프로바이더/모델 지정
npm run dev -- -p ollama -m qwen3:8b
npm run dev -- -p openai -m gpt-4o
```

**요구사항**: Node.js >= 20.0.0

---

## 설치 방법

```bash
# 개발 모드 (tsx, 핫 리로드)
npm run dev

# 빌드 후 실행
npm run build
npm start

# 글로벌 설치 (어디서든 devany 명령 사용)
npm link
devany
```

---

## 실행 방법

```bash
# 텍스트 모드 (기본 — readline 기반 대화형)
devany

# TUI 모드 (풀스크린 Ink 기반)
devany --tui

# 초기 프롬프트와 함께
devany "이 프로젝트의 구조를 설명해줘"

# 프로바이더 & 모델 지정
devany -p ollama -m qwen3:8b
devany -p anthropic -m claude-sonnet-4-20250514
devany -p deepseek -m deepseek-chat

# 커스텀 엔드포인트 (OpenAI 호환 서버)
devany -u http://내서버:8000/v1 -m my-model

# 세션 관리
devany --list-sessions          # 저장된 세션 목록
devany --resume                 # 최근 세션 이어하기
devany --resume abc12345        # 특정 세션 ID로 이어하기

# 초기 설정 재실행
devany --setup
```

---

## 지원 프로바이더 (14개)

### 클라우드 API

| 프로바이더 | 기본 모델 | 모델 수 | 인증 |
|-----------|-----------|---------|------|
| **OpenAI** | gpt-4o-mini | 7 | API 키 |
| **Anthropic** | claude-sonnet-4 | 3 | API 키 |
| **Google** | gemini-2.5-flash | 3 | API 키 |
| **DeepSeek** | deepseek-chat | 3 | API 키 |
| **Groq** | qwen-qwq-32b | 4 | API 키 |
| **Together** | Qwen2.5-Coder-32B | 4 | API 키 |
| **OpenRouter** | deepseek-chat-v3 (무료) | 4 | API 키 |
| **Fireworks** | qwen2p5-coder-32b | 3 | API 키 |
| **Mistral** | codestral-latest | 3 | API 키 |
| **GLM/Zhipu** | glm-4-plus | 3 | API 키 |

### 로컬 / 자체 호스팅

| 프로바이더 | 기본 URL | 인증 |
|-----------|---------|------|
| **Ollama** | localhost:11434 | 불필요 |
| **vLLM** | localhost:8000 | 불필요 |
| **LM Studio** | localhost:1234 | 불필요 |
| **Custom** | (사용자 지정) | 선택 |

---

## AI 도구 (9개)

| 도구 | 설명 |
|------|------|
| `read_file` | 파일 읽기 |
| `write_file` | 파일 생성/덮어쓰기 |
| `edit_file` | 파일 부분 편집 (줄 번호 기반) |
| `glob_search` | 파일명 패턴 검색 (.gitignore 자동 적용) |
| `grep_search` | 파일 내용 정규식 검색 (.gitignore 자동 적용) |
| `shell_exec` | 셸 명령 실행 (위험 패턴 22종 자동 차단) |
| `git_status` | Git 상태 확인 |
| `git_diff` | Git 변경 사항 확인 |
| `git_commit` | Git 커밋 |

---

## 스마트 모델 역할 감지

devany는 모델 역량을 자동 감지하여 역할을 배정합니다:

| 역할 | 뱃지 | 사용 가능 도구 | 대상 모델 |
|------|------|--------------|-----------|
| **Agent** | `[A]` 초록 | 전체 9개 | qwen3:8b+, 클라우드 API 전부 |
| **Assistant** | `[R]` 노랑 | 읽기 전용 (3개) | qwen3.5:4b, mistral:7b |
| **Chat** | `[C]` 회색 | 없음 | gemma3:1b, codegemma |

30+ 모델이 등록되어 있고, 4단계 매칭으로 미등록 모델도 자동 판정합니다:
정확한 이름 → 프리픽스 → 클라우드 프로바이더 기본값 → 안전한 기본값

---

## 슬래시 명령어

| 명령어 | 단축키 | 설명 |
|--------|--------|------|
| `/help` | `/h` | 도움말 |
| `/model [name]` | `/m` | 모델 변경 (인자 없으면 메뉴) |
| `/provider [name]` | `/p` | 프로바이더 변경 |
| `/tools [on\|off]` | `/t` | 도구 토글 |
| `/models` | | 모델 목록 + 역할 뱃지 |
| `/endpoint url` | `/e` | 커스텀 엔드포인트 연결 |
| `/lang [ko\|en\|ja\|zh]` | | 응답 언어 설정 |
| `/config` | | 현재 설정 표시 |
| `/usage` | `/u` | 토큰 사용량 + 비용 |
| `/clear` | | 대화 초기화 |
| `/exit` | `/q` | 종료 |

**키보드**: `Esc` = 메뉴, `Tab` = 자동완성, `Ctrl+C` = 취소/종료

---

## 보안

- **경로 샌드박싱** — CWD 밖 파일 접근 차단 + 민감 경로(.ssh, .aws, .env) 블록
- **셸 필터** — 22개 위험 패턴 차단 (rm -rf, sudo, curl|bash, eval, DROP TABLE 등)
- **설정 파일 보호** — `~/.dev-anywhere/config.json`은 `0600` 권한으로 저장
- **.gitignore** — glob/grep 검색 시 .gitignore 패턴 자동 적용

---

## 프로젝트 지침

프로젝트 루트에 `.devany.md` 파일을 만들면 AI에게 프로젝트별 맥락을 제공합니다:

```markdown
# 우리 프로젝트
- Next.js 15 + TypeScript strict 앱
- 스타일링은 Tailwind CSS 사용
- API 라우트는 app/api/ 아래
- any 타입 절대 금지
```

이 내용이 매 세션 시스템 프롬프트에 자동 주입됩니다.

---

## 아키텍처

```
dev_anywhere/
├── src/
│   ├── cli.ts                    # CLI 엔트리포인트 (commander)
│   ├── text-mode.ts              # 텍스트 모드 (readline 기반)
│   ├── onboarding.ts             # 첫 실행 설정 위저드
│   ├── core/
│   │   ├── agent-loop.ts         # LLM 에이전트 루프 (streamText)
│   │   ├── system-prompt.ts      # 시스템 프롬프트 빌더 (.devany.md 로드)
│   │   ├── permission.ts         # 경로 샌드박싱 + 권한 게이트
│   │   ├── markdown.ts           # ANSI 터미널 마크다운 렌더러
│   │   └── types.ts              # 공유 타입 (Message, AgentEvent)
│   ├── providers/
│   │   ├── registry.ts           # 프로바이더 팩토리 + 캐시
│   │   ├── types.ts              # 14개 프로바이더 정의 + KNOWN_MODELS
│   │   └── model-capabilities.ts # 30+ 모델 역량 레지스트리
│   ├── tools/
│   │   ├── registry.ts           # 도구 레지스트리 (전체 + 읽기전용)
│   │   ├── file-ops.ts           # read/write/edit (샌드박싱 적용)
│   │   ├── shell-exec.ts         # 셸 실행 (위험 패턴 차단)
│   │   ├── grep-search.ts        # 정규식 파일 검색
│   │   ├── glob-search.ts        # 파일명 패턴 검색
│   │   └── git-tools.ts          # Git 작업
│   ├── session/
│   │   └── store.ts              # JSON 파일 기반 세션 저장소
│   ├── tui/
│   │   ├── app.tsx               # TUI 메인 앱 (Ink + React)
│   │   ├── components/           # ChatView, InputBar, StatusBar, SelectMenu
│   │   └── hooks/                # useAgent, useCommands, useStream
│   └── config/
│       ├── loader.ts             # 설정 로더 (env → file → defaults)
│       └── schema.ts             # 설정 스키마
├── tests/                        # 5개 테스트 파일, 43개 테스트
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
└── tsconfig.json
```

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| **런타임** | Node.js >= 20 |
| **언어** | TypeScript (strict, ES2022, NodeNext) |
| **LLM 통합** | Vercel AI SDK v4 (streamText, tool calling) |
| **프로바이더 SDK** | @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| **TUI** | Ink 5 + React 18 |
| **CLI** | Commander |
| **검증** | Zod |
| **셸** | Execa |
| **파일 검색** | Globby (gitignore 지원) |
| **Git** | simple-git |
| **테스트** | Vitest (43개 테스트) |
| **린트** | ESLint + typescript-eslint |
| **포맷** | Prettier |

**네이티브 의존성 제로** — C++ 빌드 없음, Python 없음, Rust 없음. 순수 JavaScript.

---

## 데이터 저장

| 경로 | 내용 |
|------|------|
| `~/.dev-anywhere/config.json` | 프로바이더, 모델, API 키 (0600 권한) |
| `~/.dev-anywhere/sessions/*.json` | 대화 세션 (자동 저장) |
| `.devany.md` (프로젝트 루트) | 프로젝트별 AI 지침 |

---

## 개발 명령어

```bash
npm run dev            # tsx로 개발 실행
npm run build          # TypeScript 빌드
npm test               # 43개 테스트 실행
npm run test:watch     # 테스트 워치 모드
npm run lint           # tsc --noEmit + eslint
npm run lint:fix       # eslint 자동 수정
npm run format         # prettier 포맷
npm run format:check   # 포맷 확인
```

---

## 리서치 문서

이 프로젝트의 기반이 된 조사 자료:

| # | 문서 | 내용 |
|---|------|------|
| 1 | [도구 전수 조사](docs/01-tools-survey.md) | 35+ 터미널 AI 코딩 도구 서베이 |
| 2 | [구축 타당성 분석](docs/02-feasibility.md) | 아키텍처, 언어 선택, 타임라인 |
| 3 | [라이선스/저작권 분석](docs/03-license-analysis.md) | 20개 도구 포크 가능 여부 |
| 4 | [내부망/외부망 배포](docs/04-deployment.md) | 클라우드 vs 에어갭 배포 시나리오 |

---

## 라이선스

MIT
