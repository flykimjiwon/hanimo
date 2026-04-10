# Cloud AI API Integration Research

> 작성일: 2026-03-30  
> 대상 프로젝트: hanimo (Go 기반 오픈소스 AI 코딩 에이전트)  
> 현재 의존성: `github.com/sashabaranov/go-openai v1.41.2` (OpenAI-compatible 클라이언트)

---

## Part 1: Anthropic / Claude

### Standard API

**Base URL:** `https://api.anthropic.com`

**인증 방식:** API 키 전용 (Bearer 방식 아닌 전용 헤더)

```
x-api-key: <YOUR_API_KEY>
anthropic-version: 2023-06-01
content-type: application/json
```

API 키는 [Anthropic Console](https://platform.claude.com/settings/keys)에서 발급. 계정 생성 후 즉시 발급 가능.

**주요 엔드포인트:**

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/v1/messages` | POST | 메시지 생성 (주 API) |
| `/v1/messages/batches` | POST | 배치 처리 (50% 비용 절감) |
| `/v1/messages/count_tokens` | POST | 전송 전 토큰 카운팅 |
| `/v1/models` | GET | 사용 가능한 모델 목록 |
| `/v1/files` | POST/GET | 파일 업로드 및 관리 (Beta) |
| `/v1/agents` | POST/GET | 에이전트 구성 (Beta) |
| `/v1/sessions` | POST/GET | 스테이트풀 에이전트 세션 (Beta) |

**Tool Use (함수 호출):** 지원. `tools` 파라미터로 함수 정의 전달, 스트리밍도 지원.

**소스:** [Anthropic API Overview](https://platform.claude.com/docs/en/api/getting-started)

---

### 현재 Claude 모델 (2026-04 기준)

#### 최신 모델 (권장)

| 모델 | API ID | 컨텍스트 | 최대 출력 | 입력 가격 | 출력 가격 |
|------|--------|---------|---------|---------|---------|
| Claude Opus 4.6 | `claude-opus-4-6` | **1M 토큰** | 128K | $5/MTok | $25/MTok |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | **1M 토큰** | 64K | $3/MTok | $15/MTok |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | 200K 토큰 | 64K | $1/MTok | $5/MTok |

> MTok = 백만 토큰. Opus/Sonnet 4.6은 1M 토큰 컨텍스트로 대폭 확장됨.

#### 레거시 모델 (사용 가능하나 마이그레이션 권장)

| 모델 | API ID | 컨텍스트 | 입력 가격 | 출력 가격 |
|------|--------|---------|---------|---------|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 200K | $3/MTok | $15/MTok |
| Claude Opus 4 | `claude-opus-4-20250514` | 200K | $15/MTok | $75/MTok |
| Claude Haiku 3 | `claude-3-haiku-20240307` | 200K | $0.25/MTok | $1.25/MTok |

> **중요:** `claude-3-haiku-20240307`은 **2026-04-19 퇴역** 예정. `claude-haiku-4-5`로 마이그레이션 필요.

**소스:** [Anthropic Models Overview](https://platform.claude.com/docs/en/docs/about-claude/models/overview)

---

### Claude Pro/Max Subscription 연결 가능성

**결론: 공식적으로 지원됨 (단, 제약 있음)**

Claude Code CLI는 Pro/Max 구독자가 OAuth 방식으로 자신의 계정 quota를 사용할 수 있다. 이 방식을 hanimo 같은 서드파티 CLI에 적용하는 것은 **2026년 4월 기준 Anthropic 정책상 제한됨.**

#### Claude Code CLI 인증 우선순위 (공식 문서 기준)

1. 클라우드 프로바이더 환경변수 (`CLAUDE_CODE_USE_BEDROCK` 등)
2. `ANTHROPIC_AUTH_TOKEN` 환경변수 (Bearer 헤더로 전송 — LLM 게이트웨이용)
3. `ANTHROPIC_API_KEY` 환경변수 (직접 API 키)
4. `apiKeyHelper` 스크립트 출력 (동적/로테이팅 크리덴셜)
5. `CLAUDE_CODE_OAUTH_TOKEN` (장기 OAuth 토큰, CI/CD용)
6. `/login` OAuth 크리덴셜 (기본값 — Pro/Max/Team/Enterprise 구독자용)

#### OAuth 토큰 방식 (subscription 연결)

Claude Code CLI가 `claude setup-token`을 실행하면 브라우저 OAuth flow를 통해 **1년짜리 OAuth 토큰**을 발급한다.

- 토큰 형식: `sk-ant-oat01-...` 접두사 (OAuth 기반 토큰)
- 환경변수: `CLAUDE_CODE_OAUTH_TOKEN`
- 이 토큰은 Pro/Max 구독 quota를 사용
- 스코프: **inference only** (Remote Control 세션 불가)
- 배포 방식: bearer token으로 `Authorization: Bearer <token>` 헤더로 전송

```bash
# Claude Code CLI에서 장기 토큰 발급
claude setup-token
export CLAUDE_CODE_OAUTH_TOKEN=<token>
```

#### 2026년 4월 정책 변경: 서드파티 제한

Anthropic은 2026-04-04부터 Claude Pro/Max subscription OAuth 토큰을 **서드파티 앱(OpenClaw 등)에서 사용하는 것을 공식 차단**했다. 현재 subscription OAuth로 API를 사용할 수 있는 것은:

- Claude Code CLI (공식)
- claude.ai 웹
- Claude Desktop
- Claude for Teams/Enterprise (공식 채널)

hanimo 같은 서드파티 CLI는 subscription OAuth를 직접 사용하는 것이 **정책 위반**이다. API 키 방식을 사용해야 한다.

#### LiteLLM을 통한 우회 (참고용)

일부 사용자는 `ANTHROPIC_BASE_URL`을 LiteLLM 프록시로 설정하고, `forward_client_headers_to_llm_api: true` 옵션으로 OAuth 토큰을 포워딩하는 방법을 사용한다. 이는 정책적으로 그레이존이므로 프로덕션 사용 권장하지 않음.

**소스:**
- [Claude Code Authentication](https://code.claude.com/docs/en/authentication)
- [LiteLLM Claude Code Max Tutorial](https://docs.litellm.ai/docs/tutorials/claude_code_max_subscription)

---

### Go SDK

```bash
go get -u 'github.com/anthropics/anthropic-sdk-go@v1.34.0'
```

- **요구사항:** Go 1.22+
- **최신 버전:** v1.34.0 (2026-04-09 릴리스)
- **인증:** `ANTHROPIC_API_KEY` 환경변수 또는 `option.WithAPIKey()`

```go
import (
    "github.com/anthropics/anthropic-sdk-go"
    "github.com/anthropics/anthropic-sdk-go/option"
)

client := anthropic.NewClient(
    option.WithAPIKey("sk-ant-..."),
)
message, err := client.Messages.New(ctx, anthropic.MessageNewParams{
    MaxTokens: 1024,
    Messages: []anthropic.MessageParam{
        anthropic.NewUserMessage(anthropic.NewTextBlock("Hello")),
    },
    Model: anthropic.ModelClaudeOpus4_6,
})
```

**지원 기능:** Tool use, 스트리밍, 배치 처리, Files API, Sessions API (Beta)

> hanimo는 현재 `go-openai`만 사용 중. Claude Native SDK를 추가하면 tool use 파라미터를 Anthropic 형식으로 직접 전달 가능.

**소스:** [anthropic-sdk-go GitHub](https://github.com/anthropics/anthropic-sdk-go)

---

## Part 2: OpenAI

### Standard API

**Base URL:** `https://api.openai.com/v1`

**인증:** API 키 전용 (`Authorization: Bearer <key>`)

API 키는 [OpenAI Platform](https://platform.openai.com/api-keys)에서 발급.

**현재 주요 모델 (2026-04 기준):**

| 모델 | 컨텍스트 | 입력 가격 | 출력 가격 | 특징 |
|------|---------|---------|---------|------|
| GPT-4.1 | 1M 토큰 | $2/MTok | $8/MTok | 플래그십, 긴 컨텍스트 |
| GPT-4o | 128K | $2.50/MTok | $10/MTok | 멀티모달 |
| GPT-4o mini | 128K | $0.15/MTok | $0.60/MTok | 저비용 |
| o3 | — | $2/MTok | $8/MTok | 추론 모델 |
| o4-mini | — | $1.10/MTok | $4.40/MTok | 저비용 추론 (o3-mini 대체) |

> o-시리즈는 내부 reasoning tokens가 별도로 청구됨. 출력 토큰 수 ≠ 실제 비용.

**Go SDK:** hanimo가 이미 사용 중인 `github.com/sashabaranov/go-openai v1.41.2` 그대로 사용 가능.

**소스:**
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [OpenAI Models](https://platform.openai.com/docs/models)

---

### OpenAI Codex CLI

OpenAI가 공식 제공하는 터미널용 AI 코딩 에이전트. hanimo와 유사한 포지셔닝.

**인증 방식 (3가지):**

1. **ChatGPT OAuth (기본):**
   - `codex login` 실행 → 브라우저 열림 → ChatGPT 계정으로 로그인 → access token 반환
   - ChatGPT Plus/Pro 구독 quota 사용
   - 토큰 저장: `~/.codex/auth.json` 또는 OS 크리덴셜 스토어

2. **Device Code (헤드리스 환경용, Beta):**
   - 브라우저 없이 코드 입력 방식

3. **API 키:**
   - `printenv OPENAI_API_KEY | codex login --with-api-key`
   - OpenAI Platform 계정에서 표준 API 요금으로 청구
   - CI/CD 등 자동화 환경에 권장

**ChatGPT Plus/Pro 구독 → API 접근:**
- Codex CLI에서는 ChatGPT OAuth로 subscription quota 사용 가능
- 그러나 OpenAI API (`api.openai.com/v1`) 직접 호출은 **API 키 + Platform 계정 결제** 별도 필요
- ChatGPT 구독이 OpenAI API 키 비용을 포함하지 않음

**Codex 전용 API 모델 (2026-04 현재 Claude Code 포지셔닝과 다름):**
- 현재 공식 API에 `codex-mini-latest` 같은 전용 엔드포인트는 없음 (confirm needed)
- Codex CLI는 내부적으로 GPT-4.1 계열 또는 전용 모델 사용으로 추정

**소스:**
- [Codex CLI Authentication](https://developers.openai.com/codex/auth)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference)

---

## Part 3: Google / Gemini

### Gemini API (Direct)

**Base URL:** `https://generativelanguage.googleapis.com/v1beta`

**인증:** API 키 (`?key=<API_KEY>` 쿼리 파라미터 또는 `x-goog-api-key` 헤더)

API 키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급.

**환경변수:** `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` (둘 다 설정 시 `GOOGLE_API_KEY` 우선)

**현재 주요 모델 (2026-04 기준):**

| 모델 | 컨텍스트 | 입력 가격 | 출력 가격 | 무료 티어 |
|------|---------|---------|---------|---------|
| Gemini 2.5 Pro | 1M 토큰 | $1.25/MTok (≤200K) / $2.50 (>200K) | $10/MTok (≤200K) / $15 (>200K) | ✅ 무료 |
| Gemini 2.5 Flash | 1M 토큰 | $0.15/MTok (≤200K) / $0.30 (>200K) | $0.60/MTok (≤200K) / $1.20 (>200K) | ✅ 무료 |
| Gemini 2.5 Flash-Lite | — | $0.10/MTok | $0.40/MTok | ✅ 무료 |
| Gemini 3.1 Pro Preview | — | $2/MTok (≤200K) / $4 (>200K) | $12/MTok (≤200K) / $18 (>200K) | ❌ |
| Gemini 3.1 Flash-Lite Preview | — | $0.25/MTok | $1.50/MTok | ✅ 무료 |

> Gemini 2.0 Flash는 **deprecated** — 곧 shut down 예정. 마이그레이션 필요.

**OpenAI-Compatible 엔드포인트:**

```
https://generativelanguage.googleapis.com/v1beta/openai/
```

기존 `go-openai` SDK의 `BaseURL`만 바꾸면 바로 사용 가능 (Beta):

```go
client := openai.NewClientWithConfig(openai.ClientConfig{
    BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    APIKey:  os.Getenv("GEMINI_API_KEY"),
})
```

단, `reasoning_effort` → `thinking_level` 매핑 등 일부 파라미터 차이 있음.

**Go SDK (Native):**

```bash
go get google.golang.org/genai
```

**소스:**
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Gemini OpenAI Compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

### Gemini CLI

Google이 공식 제공하는 오픈소스 터미널 AI 에이전트.

- **저장소:** [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- **설치:** `npm install -g @google/gemini-cli` 또는 `brew install gemini-cli`

**인증 방식 3가지:**

| 방식 | 환경변수 | 무료 한도 | 설명 |
|------|---------|---------|------|
| OAuth (Google 계정) | 없음 (브라우저 로그인) | 60 req/min, 1,000 req/day | 개인 사용자 기본 |
| Gemini API Key | `GEMINI_API_KEY` | 1,000 req/day 무료 | 개발자용 |
| Vertex AI | GCP 환경변수 | GCP 결제 기반 | 기업용 |

> **주의:** Vertex AI는 API 키 인증을 지원하지 않음. IAM/ADC 방식만 지원. 일부 문서의 "Vertex AI API key" 언급은 오류.

**소스:** [Gemini CLI GitHub](https://github.com/google-gemini/gemini-cli)

---

### Vertex AI vs Direct Gemini API

| 항목 | Gemini API (Direct) | Vertex AI |
|------|---------------------|-----------|
| 인증 | API 키 | IAM (ADC / 서비스 계정) |
| GCP 프로젝트 | 불필요 | 필요 (`GOOGLE_CLOUD_PROJECT`) |
| 무료 티어 | ✅ 있음 | ❌ 없음 (GCP 결제 필요) |
| 개발 속도 | 빠름 (API 키만 설정) | 느림 (GCP 설정 필요) |
| 기업 보안/컴플라이언스 | 기본 수준 | VPC, IAM, 감사 로그 |
| 모델 최신성 | 즉시 제공 | 약간 지연 가능 |
| 한국어 지원 | 동일 | 동일 |

**hanimo 권장:** 직접 Gemini API 사용 (이미 `GOOGLE_GENERATIVE_AI_KEY` 방식으로 구현됨)

**소스:** [Gemini vs Vertex AI](https://ai.google.dev/gemini-api/docs/migrate-to-cloud)

---

## Part 4: Aggregators

### OpenRouter

**Base URL:** `https://openrouter.ai/api/v1`  
**인증:** `Authorization: Bearer <OPENROUTER_API_KEY>`  
**Go SDK:** `go-openai`의 `BaseURL`만 교체하면 사용 가능

**제공 모델:** 300+ 모델 (GPT, Claude, Gemini, Llama, DeepSeek, Qwen, Mistral 등 주요 프로바이더 전부 포함)

**무료 티어:**
- 28~29개 완전 무료 모델 (DeepSeek V3, DeepSeek R1, Llama 3.3 70B, Qwen 계열 등)
- 무료 모델 rate limit: 구매 크레딧 없으면 50 req/day, $10 이상 구매 시 1,000 req/day
- 컨텍스트 윈도우: 무료 모델 최대 200K 토큰 (모델별 상이)

**가격 구조:**
- 유료 모델은 원래 프로바이더 가격 + 소폭 마진
- 무료 모델은 $0

**특이사항:** 단일 API 키로 모든 프로바이더 접근 가능. 모델 폴백/라우팅 기능 내장.

**소스:**
- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [OpenRouter Models](https://openrouter.ai/docs/guides/overview/models)
- [OpenRouter Free Models](https://openrouter.ai/collections/free-models)

---

### DeepSeek

**Base URL:** `https://api.deepseek.com/v1`  
**환경변수:** `DEEPSEEK_API_KEY`  
**인증:** OpenAI-compatible (`Authorization: Bearer`)

| 모델 | 특징 | 가격 (입력/출력) |
|------|------|----------------|
| `deepseek-chat` (V3) | 최고 성능 채팅/코딩 모델 | ~$0.14 / ~$0.28 /MTok |
| `deepseek-reasoner` (R1) | 추론 특화 | ~$0.55 / ~$2.19 /MTok |

**특이사항:** 중국 서버 소재. 데이터 프라이버시 고려 필요.

---

### Groq

**Base URL:** `https://api.groq.com/openai/v1`  
**환경변수:** `GROQ_API_KEY`  
**인증:** OpenAI-compatible

**특이사항:** LPU(Language Processing Unit) 기반 초고속 추론. Llama, Qwen, Mixtral 등 오픈소스 모델 제공. 무료 티어 있음 (rate limit 있음).

대표 모델: `llama-3.3-70b-versatile`, `qwen-qwq-32b`, `mixtral-8x7b-32768`

---

### Together AI

**Base URL:** `https://api.together.xyz/v1`  
**환경변수:** `TOGETHER_API_KEY`  
**인증:** OpenAI-compatible

오픈소스 모델 (Llama, Qwen, Code Llama 등) 제공. 미세조정(fine-tuning) 지원.

---

### Fireworks AI

**Base URL:** `https://api.fireworks.ai/inference/v1`  
**환경변수:** `FIREWORKS_API_KEY`  
**인증:** OpenAI-compatible

고속 추론 특화. `accounts/fireworks/models/qwen2p5-coder-32b-instruct` 등 코딩 모델 제공.

---

### Mistral AI

**Base URL:** `https://api.mistral.ai/v1`  
**환경변수:** `MISTRAL_API_KEY`  
**인증:** OpenAI-compatible

`codestral-latest` (코딩 특화), `mistral-large-latest` (범용) 제공. 유럽 서버 (GDPR 친화적).

---

### 기타 providers (hanimo 현재 지원 목록 기반)

| Provider | Base URL | 주요 모델 | 특이사항 |
|----------|----------|---------|---------|
| GLM (智谱) | `open.bigmodel.cn/api/paas/v4` | `glm-4-plus`, `codegeex-4` | 중국 시장 특화 |
| Ollama | `http://localhost:11434/v1` | qwen3, llama 등 로컬 모델 | 로컬 무료 |
| vLLM | `http://localhost:8000/v1` | 사용자 지정 | GPU 서버 자체 호스팅 |
| LM Studio | `http://localhost:1234/v1` | 사용자 지정 | macOS GUI |

---

## Part 5: 인증 방식 총정리

| Provider | API Key | OAuth | 브라우저 로그인 | Subscription 연결 | CLI 도구 |
|----------|---------|-------|----------------|-------------------|---------|
| **Anthropic** | ✅ `sk-ant-...` | ✅ (Claude Code 전용) | ❌ (서드파티 불가) | ✅ Pro/Max (Claude Code CLI 한정) | Claude Code CLI |
| **OpenAI** | ✅ `sk-...` | ✅ (Codex CLI 전용) | ❌ (API 키만) | ❌ (ChatGPT 구독 ≠ API 키) | Codex CLI |
| **Google Gemini** | ✅ `AI...` | ✅ (Google 계정) | ✅ (Gemini CLI) | ❌ (Gemini Advanced ≠ API 무료) | Gemini CLI |
| **Vertex AI** | ❌ (미지원) | ✅ ADC/gcloud | ❌ | GCP 결제 계정 필요 | gcloud CLI |
| **OpenRouter** | ✅ | ❌ | ❌ | ❌ | — |
| **DeepSeek** | ✅ | ❌ | ❌ | ❌ | — |
| **Groq** | ✅ | ❌ | ❌ | ❌ | — |
| **Together** | ✅ | ❌ | ❌ | ❌ | — |
| **Fireworks** | ✅ | ❌ | ❌ | ❌ | — |
| **Mistral** | ✅ | ❌ | ❌ | ❌ | — |
| **Ollama** | ❌ (불필요) | ❌ | ❌ | ❌ (완전 무료 로컬) | ollama CLI |

### OAuth 토큰 형식 정리

| Provider | OAuth 토큰 접두사 | 사용 헤더 | 서드파티 허용 |
|----------|-----------------|---------|------------|
| Anthropic (Pro/Max) | `sk-ant-oat01-...` | `Authorization: Bearer` | ❌ (2026-04-04 이후 차단) |
| OpenAI (ChatGPT) | 내부 형식 (비공개) | — | ❌ (Codex CLI 전용) |
| Google | OAuth 2.0 access token | `Authorization: Bearer` | ✅ (Gemini CLI 오픈소스) |

---

## Part 6: hanimo Go SDK 통합 가이드

### 현재 상태 (go.mod 기준)

hanimo는 `github.com/sashabaranov/go-openai v1.41.2`만 사용. 이 클라이언트는 `BaseURL`을 교체하면 OpenAI-compatible 모든 API에 사용 가능.

### 추가 필요한 SDK

```bash
# Anthropic Native SDK (tool use, streaming 완전 지원)
go get github.com/anthropics/anthropic-sdk-go@v1.34.0

# Google Gemini Native SDK
go get google.golang.org/genai
```

### Provider별 BaseURL 설정 (go-openai 사용 시)

```go
// Anthropic은 go-openai로 직접 사용 불가 (헤더 형식 다름)
// anthropic-sdk-go 별도 사용 필요

// Google Gemini (OpenAI-compat)
config := openai.DefaultConfig(os.Getenv("GEMINI_API_KEY"))
config.BaseURL = "https://generativelanguage.googleapis.com/v1beta/openai/"

// OpenRouter
config := openai.DefaultConfig(os.Getenv("OPENROUTER_API_KEY"))
config.BaseURL = "https://openrouter.ai/api/v1"

// DeepSeek
config := openai.DefaultConfig(os.Getenv("DEEPSEEK_API_KEY"))
config.BaseURL = "https://api.deepseek.com/v1"

// Groq
config := openai.DefaultConfig(os.Getenv("GROQ_API_KEY"))
config.BaseURL = "https://api.groq.com/openai/v1"

// Fireworks
config := openai.DefaultConfig(os.Getenv("FIREWORKS_API_KEY"))
config.BaseURL = "https://api.fireworks.ai/inference/v1"

// Mistral
config := openai.DefaultConfig(os.Getenv("MISTRAL_API_KEY"))
config.BaseURL = "https://api.mistral.ai/v1"

// Together
config := openai.DefaultConfig(os.Getenv("TOGETHER_API_KEY"))
config.BaseURL = "https://api.together.xyz/v1"
```

---

## Recommendations for hanimo

### Must-have (즉시 통합 가능)

- **`anthropic-sdk-go`** — Claude Sonnet 4.6 / Opus 4.6 (1M context, tool use 완전 지원)
  - API ID: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`
  - 이미 docs/08에서 "완비"로 표시됐지만, go-openai가 아닌 native SDK 추가 검토 가치 있음
- **`google.golang.org/genai`** — Gemini 2.5 Pro/Flash (1M context, 무료 티어)
  - OpenAI-compat 엔드포인트로도 go-openai 재사용 가능 (Beta)
- **OpenRouter** — 단일 키로 300+ 모델, 무료 DeepSeek/Llama 접근, 폴백 중계용

### Nice-to-have

- **Groq** — 초고속 추론 (Llama, Qwen, Mixtral), 무료 티어, 코딩 보조에 적합
- **Mistral `codestral-latest`** — 코딩 특화, 유럽 서버 (GDPR)
- **Gemini CLI OAuth 참고** — 구글 계정 로그인 flow (60 req/min 무료) 구현 참고용

### Not possible currently

- **Claude Pro/Max subscription → CLI 연결:** 2026-04-04 이후 공식 정책상 서드파티 불가. API 키 방식만 허용.
- **ChatGPT Plus/Pro subscription → API 키:** ChatGPT 구독은 OpenAI API 비용과 별개 결제. Codex CLI OAuth는 Codex 전용이며 `api.openai.com` 직접 호출과 다름.
- **Vertex AI API 키 인증:** IAM/ADC만 지원. API 키 인증 불가 (일부 문서 오류 있음 — GitHub issue #5739 확인됨).
- **Gemini 2.0 Flash:** Deprecated, 곧 종료 예정. `gemini-2.5-flash`로 교체 필요.
- **Claude 3 Haiku (`claude-3-haiku-20240307`):** 2026-04-19 퇴역. `claude-haiku-4-5-20251001`로 교체 필요.

---

## Sources

| 항목 | URL |
|------|-----|
| Anthropic API 개요 | https://platform.claude.com/docs/en/api/getting-started |
| Claude 모델 목록 | https://platform.claude.com/docs/en/docs/about-claude/models/overview |
| anthropic-sdk-go | https://github.com/anthropics/anthropic-sdk-go |
| Claude Code 인증 | https://code.claude.com/docs/en/authentication |
| LiteLLM Claude Max | https://docs.litellm.ai/docs/tutorials/claude_code_max_subscription |
| Claude API Medium 해설 | https://lalatenduswain.medium.com/claude-api-authentication-in-2026-oauth-tokens-vs-api-keys-explained-12e8298bed3d |
| OpenAI Pricing | https://openai.com/api/pricing/ |
| OpenAI Models | https://platform.openai.com/docs/models |
| Codex CLI Auth | https://developers.openai.com/codex/auth |
| Codex Pricing | https://developers.openai.com/codex/pricing |
| Gemini Quickstart | https://ai.google.dev/gemini-api/docs/quickstart |
| Gemini 모델 목록 | https://ai.google.dev/gemini-api/docs/models |
| Gemini Pricing | https://ai.google.dev/gemini-api/docs/pricing |
| Gemini OpenAI 호환 | https://ai.google.dev/gemini-api/docs/openai |
| Gemini vs Vertex AI | https://ai.google.dev/gemini-api/docs/migrate-to-cloud |
| Gemini CLI GitHub | https://github.com/google-gemini/gemini-cli |
| Gemini CLI Auth 문서 | https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html |
| OpenRouter 가격 | https://openrouter.ai/pricing |
| OpenRouter 모델 | https://openrouter.ai/docs/guides/overview/models |
| OpenRouter 무료 모델 | https://openrouter.ai/collections/free-models |
| Vertex AI API 키 이슈 | https://github.com/google-gemini/gemini-cli/issues/5739 |
