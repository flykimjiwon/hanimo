# hanimo 프로젝트 전략 정리 (2026-04)

> 이 문서는 2026년 4월 초 진행된 프로젝트 방향성 논의를 정리한 것입니다.

---

## 1. 프로젝트 개요

**hanimo** (`하니스모돌`에서 따온 이름)는 **터미널 기반 AI 코딩 에이전트**입니다.  
Claude Code, Cursor, Aider와 같은 카테고리이지만, **provider-agnostic + local-model-first** 방향으로 개발 중입니다.

### 핵심 수치
- TypeScript ~7,800줄 (경쟁사 대비 초경량)
- 14개 LLM 프로바이더 지원
- 16개 내장 도구 (파일 CRUD, shell, git, web 등)
- 150개 테스트 / 20개 테스트 파일

### 동작 원리 (ReAct 루프)
```
유저 입력
    ↓
[agent-loop.ts] ← Vercel AI SDK (streamText / generateText)
    ↓
LLM 호출 → Tool Call 있으면 → Tool 실행 → 결과를 LLM에 재전달
    ↓
maxSteps=25 까지 반복 (LLM N회 호출)
    ↓
최종 응답
```

### 멀티 에이전트 구조 (orchestrator.ts)
```
1단계: Orchestrator → LLM 호출 → 태스크 분해 (JSON 배열)
2단계: N개 SubAgent 병렬 실행 (Promise.allSettled)
3단계: 결과 종합 → LLM 다시 호출 → 최종 응답
```

---

## 2. 경쟁 도구 비교

| 기능 | hanimo | Claude Code | Gemini CLI | OpenAI Codex | Aider |
|------|:------:|:-----------:|:----------:|:------------:|:-----:|
| 오픈소스 | ✅ | ❌ | ✅ | ❌ | ✅ |
| 로컬 모델 | ✅ 4종 | ❌ | ❌ | ❌ | ✅ |
| 클라우드 프로바이더 수 | **14개** | 1 | 1 | 1 | ~5 |
| 내장 도구 수 | **16개** | ~10 | ~8 | ~6 | ~6 |
| 멀티 에이전트 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 자율 실행 `/auto` | ✅ | ✅ | ❌ | ❌ | ❌ |
| MCP 지원 | ✅ | ✅ | ✅ | ❌ | ❌ |
| Hash-anchored 편집 | ✅ (독자) | ❌ | ❌ | ❌ | ❌ |
| 코드 크기 | 7.8K줄 | ~200K줄+ | 미공개 | 미공개 | ~15K줄 |

### 각 경쟁 도구 동작 원리

| 도구 | 방식 |
|------|------|
| **Claude Code** | claude-sonnet → tool_use 파싱 → bash/file 실행 → 반복 |
| **Gemini CLI** | Gemini 2.5 Pro → Function Calling → 도구 실행 → 반복 |
| **OpenAI Codex** | GPT-4o/o3-mini → function_calling → 코드 실행 → 반복 |
| **OpenCode** | Go 언어, LSP 깊은 통합, VS Code 스타일 TUI |

---

## 3. 포지셔닝 전략: "비-빅테크 오픈 생태계"

### 핵심 방향
- **OpenAI / Anthropic / Google** 은 숨기지 않되 **적극 추천하지 않음**
- **기본(DEFAULT)** 은 Ollama / vLLM / OpenAI-compatible 형식
- OAuth/계정 로그인 방식은 구현하지 않음 (API Key 방식만 유지)

### Provider 계층 구성

```
🟢 기본 (DEFAULT) — 온보딩 첫 화면
  • Ollama (로컬, 완전 오프라인)
  • vLLM (로컬/서버)
  • LM Studio (로컬)
  • Custom OpenAI-compatible (baseURL + apiKey)
    → MiniMax, GLM, DeepSeek, Kimi, MiMo, Devstral 등 전부 포함

🟡 유지하되 Advanced 섹션으로 분류
  • OpenAI (GPT-4o 등)
  • Anthropic (Claude)
  • Google (Gemini)

🔴 구현하지 않음
  • Claude Code 스타일 OAuth
  • Gemini CLI 계정 로그인
  • Codex 계정 연동
```

### UX 변경사항 (코드 최소 수정)
1. `/provider` 메뉴 섹션 분리: `Local → Open API → Custom → Advanced(Cloud)`
2. 온보딩 순서 변경: `Ollama → Custom API → ... → Cloud (Advanced)`
3. README 강조 순서 변경: Ollama를 Quick Start 최상단으로

---

## 4. GLM, MiniMax 등 연결 방법

대부분 **별도 CLI 없음** — OpenAI 호환 REST API를 제공하므로 `baseURL`만 교체하면 됨.

| 모델/회사 | 자체 CLI | 연결 방식 |
|-----------|:--------:|-----------|
| GLM-5 (Zhipu AI) | ❌ | `open.bigmodel.cn/api/paas/v4` |
| MiniMax M2.5 | ❌ | `api.minimax.chat/v1` |
| Kimi K2.5 (Moonshot) | ✅ Kimi Code CLI | `api.moonshot.cn/v1` |
| DeepSeek | ❌ | `api.deepseek.com/v1` |
| MiMo-V2 (Xiaomi) | ❌ | HuggingFace 다운로드 or vLLM |
| Devstral 2 (Mistral) | ❌ | API + Ollama + vLLM |

**hanimo의 Custom Provider 기능으로 추가 코드 없이 즉시 연결 가능.**

---

## 5. 검증된 오픈 모델 벤치마크 (SWE-bench Verified, 2026-04 기준)

### Tier 1 — Opus급 (78%+)

| 모델 | SWE-bench | 개발사 | 비고 |
|------|:---------:|--------|------|
| MiniMax M2.5 | **80.2%** | MiniMax | 230B MoE, API only |
| MiMo-V2-Pro | **78.0%** | Xiaomi | 오픈웨이트 |
| GLM-5 | **77.8%** | Zhipu AI | 744B MoE, 오픈웨이트(비Apache) |

### Tier 2 — Sonnet급 (70~77%)

| 모델 | SWE-bench | 개발사 | 비고 |
|------|:---------:|--------|------|
| Kimi K2.5 | **76.8%** | Moonshot | 1T 파라미터, API |
| DeepSeek V3.2 | **73.1%** | DeepSeek | 오픈웨이트 |
| MiMo-V2-Flash | **73.4%** | Xiaomi | $0.09/$0.29 per 1M |
| Devstral 2 (123B) | **72.2%** | Mistral | Apache 2.0, OpenRouter 무료 |

### Tier 3 — Haiku급 (65~69%)

| 모델 | SWE-bench | 개발사 | 비고 |
|------|:---------:|--------|------|
| Qwen3.5-35B-A3B | **69.2%** | Alibaba | Apache 2.0, 22GB VRAM, Ollama 가능 |
| Devstral Small 2 | **68.0%** | Mistral | 24B, Apache 2.0 |
| DeepSeek V3.1 | **66.0%** | DeepSeek | Ollama 가능 |

### 실용 추천

| 용도 | 추천 모델 | 이유 |
|------|-----------|------|
| 성능 최우선 | MiniMax M2.5 | 80.2%, Opus 4급, 비용 1/10 |
| 오픈웨이트 최강 | MiMo-V2-Pro | 78.0% |
| 가성비 코딩 에이전트 | Kimi K2.5 | 76.8%, $0.5/$2.8 |
| 무료 코딩 에이전트 | Devstral 2 | 72.2%, Apache 2.0, OpenRouter 무료 |
| 경량 로컬 실행 | Qwen3.5-35B-A3B | 69.2%, 22GB VRAM, Apache 2.0 |

---

## 6. 서드파티 정책 비교 (Claude / Codex / Gemini)

### 한눈에 보기

| | Claude Code | OpenAI Codex | Gemini CLI |
|--|:-----------:|:------------:|:----------:|
| OAuth 서드파티 연결 | 🚫 **명시적 금지** | ⚠️ 회색지대 | ⚠️ 회색지대 |
| API Key 서드파티 연결 | ✅ **공식 권장** | ✅ 자유 | ✅ 가능 |
| 공식 서드파티 SDK | ✅ Claude Agent SDK | ❌ | ❌ |
| 위반 시 제재 | 🔴 계정 정지 | 🟡 ToS 경고 | 🟡 키 차단 |

### Claude Code (가장 엄격)
- Pro/Max 구독 OAuth 토큰으로 서드파티 앱 연결 → **명시적 금지, 계정 정지**
- API Key 방식 → **공식 권장**, Claude Agent SDK 사용 권장
- Amazon Bedrock / Google Vertex AI / Azure AI Foundry 경유 → OK

### OpenAI Codex (가장 유연)
- "Codex Protocol"을 공개 스펙으로 운영 → 서드파티 연동 자유
- API Key 방식은 완전 자유
- OpenClaw 같은 독립 오픈소스 프로젝트 허용

### Gemini CLI (중간)
- API Key 방식 OK, 단 무료 티어에서 입력 데이터가 Google 학습에 사용될 수 있음
- 유료 Cloud 티어 사용 시 데이터 기밀 보장
- 2026년부터 정책 강화 중

### hanimo에 대한 결론
> **현재 hanimo는 API Key 방식만 사용 → 세 회사 정책 모두 준수 상태**  
> OAuth 방식을 구현하지 않으면 아무 법적/정책적 문제없음.

---

## 7. 용어 정리

| 용어 | 설명 |
|------|------|
| **ToS** | Terms of Service — 서비스 이용약관 |
| **OAuth** | 계정 로그인 방식의 인증 (토큰 기반) |
| **API Key** | 직접 발급받는 인증 키 (환경변수로 관리) |
| **OpenAI-compatible** | OpenAI API 형식과 호환되는 엔드포인트 |
| **오픈소스** | 소스코드 + 라이선스 공개 (Apache 2.0 등) |
| **오픈웨이트** | 모델 가중치만 공개, 라이선스 제한 있을 수 있음 |
| **SWE-bench Verified** | 실제 GitHub 이슈 해결 능력을 측정하는 AI 코딩 벤치마크 |
| **ReAct 루프** | Reasoning + Acting — LLM이 생각하고 도구 쓰고 반복하는 패턴 |
| **MCP** | Model Context Protocol — Anthropic이 만든 AI 도구 표준 프로토콜 |
| **vLLM** | 오픈소스 LLM 서빙 프레임워크 (고성능 로컬 서버) |
