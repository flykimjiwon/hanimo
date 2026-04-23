# 🎯 hanimo Research Dashboard

> **작성일**: 2026-04-11
> **기반**: docs/research/ 9개 문서 (7,743줄, 320KB)
> **목적**: 모든 리서치 결과의 시각적 한눈 요약 — 30초 안에 파악 가능

---

## ⚡ TL;DR (30초 요약)

```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  hanimo v0.3.0 방향 = Certified Model System                 ║
║  "무한 호환" → "10개 모델을 완벽하게"                         ║
║                                                              ║
║  기본 모델:  qwen3-coder:30b (로컬)                           ║
║  Fallback:   qwen2.5-coder:32b → devstral → qwen3:8b         ║
║  프리미엄:   claude-sonnet-4-6 (1M context)                   ║
║                                                              ║
║  🚨 Critical: 3-Layer Defense 없음 = 작은 모델 작동 안함       ║
║  ✅ 액션: Registry + Parse+Repair + Loop Detection 3층 구축   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🏆 Tier 1 Certified Models (확정)

### 🏠 Local (M3 Max 36GB 실행 가능)

| 순위 | 모델 | 크기 | Context | 라이선스 | 비고 |
|:---:|:---|---:|---:|:---:|:---|
| 🥇 | **qwen3-coder:30b** | 19GB | 256K | Apache 2.0 | **기본값**, SWE 최강 |
| 🥈 | qwen2.5-coder:32b | 20GB | 128K | Apache 2.0 | Tool 불안정 (prompt 폴백 필요) |
| 🥉 | devstral-small-2:24b | 14GB | 128K | Apache 2.0 | SWE-Bench 46.8% |
| 4 | gpt-oss:20b | 14GB | 128K | Apache 2.0 | o3-mini급 |
| 5 | qwen3:8b | 5.2GB | 32K | Apache 2.0 | 경량, 빠름 |
| 6 | gemma4:31b | 20GB | 262K | Apache 2.0 (2026-04-02~) | 최신, AIME 89.2% |

### ☁️ Cloud (가격대별)

| Tier | 모델 | Context | Input/Output per MTok | 특징 |
|:---:|:---|---:|:---:|:---|
| Premium | **claude-sonnet-4-6** | **1M** | $3 / $15 | 최고 품질 |
| Premium | claude-opus-4-6 | 1M | $5 / $25 | 플래그십 |
| Premium | gpt-4.1 | 1M | $2 / $8 | OpenAI 최신 |
| Balanced | gemini-2.5-pro | 1M | $1.25 / $10 | 무료티어有 |
| Balanced | **gpt-oss-120b** (Novita) | 128K | $0.2 / $0.8 | 오픈소스, 저가 |
| Cheap | **gemini-2.5-flash** | 1M | $0.15 / $0.6 | **무료 1000 req/day** |
| Cheap | deepseek-chat | 128K | $0.14 / $0.28 | 최저가 |
| Cheap | **gemma-4-31b-it** (Novita) | 262K | $0.14 / $0.4 | 262K context |

---

## 🏗️ 3-Layer Defense Architecture (핵심 발견)

**프로덕션급 오픈모델 하네스가 모두 공유하는 구조** (Aider/Cline/Continue/Hermes 분석 결과):

```
┌──────────────────────────────────────────────────────┐
│  📤 Pre-send Layer                                   │
│     • 모델 family 감지                                │
│     • 올바른 chat template 적용 (ChatML/Llama3/...)  │
│     • Behavior flags (lazy/CoT-strip/temperature)    │
└────────────────────┬─────────────────────────────────┘
                     ↓ LLM 호출
┌──────────────────────────────────────────────────────┐
│  📥 Post-receive Layer                               │
│     • CoT 태그 스트립 (<think>)                       │
│     • XML/JSON tool call 파싱 (폴백)                  │
│     • 스키마 검증                                     │
│     • 오류 주입 → 복구 (max 3회)                      │
└────────────────────┬─────────────────────────────────┘
                     ↓ 툴 실행 결과
┌──────────────────────────────────────────────────────┐
│  🔁 Loop Layer                                       │
│     • Max iterations                                 │
│     • 동일 인자 루프 감지                             │
│     • Context compaction                             │
└──────────────────────────────────────────────────────┘
```

**하니모 현재 상태**: Layer 3만 있음. **Layer 1, 2가 비어있어서 작은 모델이 안 돌아가는 것**.

### 🎯 Top 12 Must-Have 전술 (v0.3.0)

| # | 전술 | 출처 | 해결하는 문제 |
|:---:|:---|:---|:---|
| 1 | **Model Capability Registry** | Aider + Continue | 모든 모델 특성 중앙 관리 |
| 2 | **Strip `<think>` Tags** | Aider | DeepSeek R1/QwQ CoT flood |
| 3 | **XML Tool Call Parser** | Hermes | 모델이 `<tool_call>` 내보냄 |
| 4 | **Schema-Validated Repair (3회)** | Hermes | 잘못된 인자 자동 복구 |
| 5 | **Chat Template Engine** | Continue | 템플릿 틀리면 지시 무시 |
| 6 | **Lazy/Overeager Correction** | Aider | `# ... existing code ...` 방지 |
| 7 | **Reminder Injection (매 3턴)** | Aider | 작은 모델 규칙 망각 |
| 8 | **Head+Tail Truncation** | Aider + Cline | shell 출력 flood 방지 |
| 9 | **Tool Result Role Injection** | Hermes | 모델별 role 토큰 매칭 |
| 10 | **Loop Detector** | 합성 | `run_shell("ls")` 반복 방지 |
| 11 | **Context Prune From Top** | Continue | 오래된 메시지 drop |
| 12 | **Sequential Tool Execution** | Hermes | 병렬 요청 malformed 방지 |

---

## 🚨 법적 경계 (CLI Auth 피기백 전면 차단)

```
┌─ Claude Code ────────┐   ┌─ Codex CLI ──────────┐   ┌─ Gemini CLI ─────────┐
│ 기술적:  ❌           │   │ 기술적:  ✅           │   │ 기술적:  ✅           │
│ 법적:    ❌ ToS 차단  │   │ 법적:    ❌ ToS 차단  │   │ 법적:    ❌ ToS 차단  │
│                      │   │                      │   │                      │
│ 2026-01-09 Anthropic │   │ OpenAI 토큰 이전     │   │ "third-party software │
│ 서버측 차단 발표     │   │ 명시적 금지          │   │ 접근은 약관 위반"    │
└──────────────────────┘   └──────────────────────┘   └──────────────────────┘
```

**선례**: OpenCode/OpenClaw 등 기존 써드파티 하네스는 2026-01-09 Anthropic 서버측 차단으로 **집단 사망**.

**✅ 안전한 경로 = 직접 API 키만**:
- `ANTHROPIC_API_KEY` (platform.claude.com)
- `OPENAI_API_KEY` (platform.openai.com)
- `GEMINI_API_KEY` (aistudio.google.com, **무료 티어 有**)

---

## 📦 Go 라이브러리 Adopt 리스트 (신규 의존성 최소화)

| 우선 | 라이브러리 | 크기 | 용도 | 신규 deps |
|:---:|:---|:---:|:---|:---:|
| 🔥 | **pkoukk/tiktoken-go** | v0.1.8 | 토큰 카운팅 | **0개** (이미 indirect) |
| 🔥 | **cenkalti/backoff** | v4.3.0 | 429 재시도 업계 표준 | 1 |
| 🔥 | **mark3labs/mcp-go** | v0.45.0 | MCP 최신 스펙 (2025-11-25) | 3 |
| 🔥 | **saracen/walker** | v0.1.4 | 10배 빠른 파일 워킹 (133ms vs 1437ms) | 1 |
| 🔥 | **bmatcuk/doublestar** | v4 | `**` glob 필터 | 0 (stdlib 확장) |
| ⚡ | **go-git/gitignore** | latest | negation + nested 지원 | 0 (이미 있음) |
| ⚡ | **zalando/go-keyring** | v0.2.8 | 보안 API 키 저장 | 2 |
| ⚡ | **aymanbagabas/go-udiff** | v0.4.0 | 편집 승인 UI | 0 |
| ⚡ | **log/slog** | stdlib | 디버그 replay | 0 |

### 🚨 호환 주의

| 라이브러리 | 이슈 |
|:---|:---|
| **sqlite-vec** | CGO만 지원 → `modernc.org/sqlite`와 비호환. `chromem-go` 대체 검토 |
| **Anthropic 토크나이저** | Go SDK 없음. `POST /v1/messages/count_tokens` API만 사용 가능 |
| **survey/promptui** | 둘 다 사망 (2024-04 / 2021-10). setup wizard도 bubbletea로 |

---

## 📚 리서치 문서 9개 인덱스

```
docs/research/
│
├─ 📋 인덱스
│   ├─ README.md                               (404줄, 22KB)  마스터 인덱스
│   └─ (이 파일) DASHBOARD.md                                 대시보드
│
├─ 🤖 모델 카탈로그 (4개)
│   ├─ ollama-models-survey.md                 (516줄, 28KB)  [다른 세션]
│   ├─ ollama-models-catalog.md ⭐              (1011줄, 44KB) 상세 35+ 모델
│   ├─ cloud-models-and-auth.md ⭐              (1133줄, 44KB) 클라우드 + ToS
│   └─ cloud-api-integration.md                (540줄, 22KB) [다른 세션]
│
├─ 🏗️ 설계 / 플랜 (2개)
│   ├─ certified-model-system-plan.md ⭐       (1022줄, 42KB) v0.3.0 전체 플랜
│   └─ hanimo-vs-techaicode-port-analysis.md   (436줄, 19KB) 양방향 포팅
│
├─ 🧪 전술 / 라이브러리 (2개)
│   ├─ open-model-harness-tactics.md ⭐         (1273줄, 51KB) 32개 전술
│   └─ go-ecosystem-libraries.md ⭐            (1478줄, 56KB) 17 영역 평가
│
└─ 📝 보너스
    └─ reference-tools-survey-2026-04.md       (313줄, 14KB) [다른 세션]
```

**총 9 문서 · 7,743줄 · 320KB**

⭐ = 이번 리서치 세션의 핵심 산출물

---

## 🎯 Action Items (우선순위)

### 🔥 Critical — 내일 아침 바로 (2-3시간)

| # | 작업 | 이유 | 파일 |
|:---:|:---|:---|:---|
| 1 | `frontend/` 삭제 | create-react-app 쓰레기 | `rm -rf frontend/` |
| 2 | **Anthropic 네이티브 프로바이더 수정** | 현재 stub, Claude 4.6 1M 못씀 | `internal/llm/providers/anthropic.go` |
| 3 | **429 자동 재시도** | Novita 과부하 자주 발생 | `cenkalti/backoff` 도입 |
| 4 | **`.hanimoignore` 파서** | list_files 500 cap 해결 | `go-git/gitignore` |
| 5 | **MCP 클라이언트 업그레이드** | 2024-11-05 → 2025-11-25 | `mark3labs/mcp-go` |

### ⚡ Important — 이번 주

| # | 작업 | 라이브러리 |
|:---:|:---|:---|
| 6 | `list_tree` 도구 신설 | `saracen/walker` |
| 7 | 프로젝트 경계 인식 (자기 레포 보호) | — |
| 8 | 토큰 기반 컴팩션 트리거 | `pkoukk/tiktoken-go` |
| 9 | gitinfo 패키지 포팅 (TECHAI에서) | — |
| 10 | Context warning UI (70/80/90%) | — |
| 11 | `log/slog` 전환 | stdlib |
| 12 | Strip `<think>` 태그 | — |

### 🎯 Phase 1 — Certified System (1-2주, v0.3.0)

- [ ] `ModelProfile` Go 구조체 + YAML 스키마
- [ ] `//go:embed internal/llm/profiles/*.yaml`
- [ ] `~/.hanimo/models/*.yaml` override 하이브리드
- [ ] 12 certified 모델 YAML 작성
- [ ] Chat Template Engine (family별 변환)
- [ ] Model Capability Registry 중앙 관리
- [ ] `hanimo --list-models` 커맨드
- [ ] 비인증 모델 experimental 경고
- [ ] 20개 시나리오 자동 테스트 (`make test-certified-models`)

### 🔮 Phase 2 — 3-Layer Defense (2-3주)

- [ ] Pre-send: Chat Template Engine (family별)
- [ ] Post-receive: XML/JSON Tool Call Parser + Schema Repair (max 3)
- [ ] Post-receive: Lazy/Overeager 교정
- [ ] Loop: 동일 인자 감지 (이미 일부 구현됨)
- [ ] Reminder Injection (매 3턴)
- [ ] Head+Tail Output Truncation

### 🚀 Phase 3 — 생태계 (1-2개월)

- [ ] hanimo.dev 랜딩 배포
- [ ] hanimo-core Go 모듈 추출 (TECHAI와 공유)
- [ ] hanimo webui (Wails 또는 Next.js)
- [ ] hanimo rag (hanimo-rag 기반)
- [ ] VS Code Extension

---

## 📊 하니모 v0.3.0 Fallback Chain

```
사용자 요청
    │
    ├─► 1차: qwen3-coder:30b  (기본, 로컬, 256K)
    │      │ 실패
    │      ▼
    ├─► 2차: qwen2.5-coder:32b  (로컬, 128K, tool 불안정)
    │      │ 실패
    │      ▼
    ├─► 3차: devstral-small-2  (로컬, SWE 특화)
    │      │ 실패
    │      ▼
    ├─► 4차: qwen3:8b  (경량 폴백)
    │      │ 실패
    │      ▼
    └─► 5차: gpt-oss:20b  (최종 폴백)
           │ 전부 실패 시
           ▼
         클라우드 전환 (gemma-4-31b-it @ Novita)
```

---

## 🔑 전략 결정 (확정됨)

| 결정 | 이유 |
|:---|:---|
| **"10 models, battle-tested"** 포지셔닝 | "14 provider 호환"은 약한 메시지 |
| **직접 API 키만 지원** | CLI Auth 피기백은 ToS 차단 |
| **pure-Go 빌드 유지** | modernc.org/sqlite, CGO 없음 |
| **YAML 프로필 + Go embed** | 사용자 override 가능 |
| **hanimo-core 분리 검토** | TECHAI와 공유 가능 |
| **3-Layer Defense 우선** | 작은 모델 호환성의 진짜 원인 |

---

## 📖 Deep Dive 가이드

**각 문서별 무엇을 찾아볼지:**

| 궁금한 것 | 읽을 문서 | 섹션 |
|:---|:---|:---|
| "어떤 모델 써요?" | `ollama-models-catalog.md` | Tier 1-3 |
| "Claude 어떻게 붙여요?" | `cloud-models-and-auth.md` | Part 1 |
| "Gemini 무료로 쓸 수 있어요?" | `cloud-api-integration.md` | Part 3 |
| "ModelProfile 구조 어떻게?" | `certified-model-system-plan.md` | §1-2 |
| "작은 모델이 왜 안 돼요?" | `open-model-harness-tactics.md` | 3-Layer Defense |
| "tiktoken-go 어때요?" | `go-ecosystem-libraries.md` | Tier 1 |
| "TECHAI랑 뭐 공유해요?" | `hanimo-vs-techaicode-port-analysis.md` | Top 15 |

---

## 🎬 다음 세션 시작할 때

1. 이 DASHBOARD.md 먼저 읽기 (2분)
2. Critical Actions 1-5번 바로 시작
3. 막히면 해당 문서 Deep Dive 가이드 참조
4. Phase 1 단계별 커밋

---

**🌟 핵심 메시지**:
> hanimo는 "14개 호환"이 아니라 **"10개 완벽"**으로 간다.
> Layer 1-2가 비어있어서 작은 모델이 안 되는 거였다.
> Claude/Codex/Gemini CLI Auth는 포기.
> Qwen3-Coder:30b 기본값, fallback chain으로 안정성 확보.
