# hanimo 클라우드 모델 및 인증 연구 보고서
# hanimo Cloud Models & Authentication Research

> 작성일 / Written: 2026-04-11  
> 대상 / Target: hanimo v0.2.x+ — Go terminal coding agent  
> 목적 / Purpose: CLI 인증 재사용 가능성 분석 + 지원 가능 클라우드 모델 카탈로그

---

## 목차 / Table of Contents

1. [Part 1 — CLI 인증 재사용 가능성 매트릭스](#part-1)
2. [Part 2 — 벤더별 클라우드 모델 카탈로그](#part-2)
3. [Part 3 — 애그리게이터 비교](#part-3)
4. [Part 4 — hanimo 통합 우선순위 권고](#part-4)
5. [Part 5 — ToS / 법적 사항](#part-5)
6. [Appendix — Go 코드 스니펫](#appendix)

---

<a name="part-1"></a>
## Part 1 — CLI 인증 재사용 가능성 매트릭스

### 요약 판정표

| CLI | 인증 방식 | 자격증명 파일 위치 | 재사용 가능성 | ToS 위반 여부 | 권장 대안 |
|-----|-----------|-------------------|--------------|--------------|----------|
| **Claude Code** | OAuth 2.0 (구독) | macOS: Keychain / Linux: `~/.claude/.credentials.json` | ❌ **차단** | **위반** (2026-02 공식 금지) | API 키 (`ANTHROPIC_API_KEY`) |
| **Codex CLI** | ChatGPT OAuth (구독) | `~/.codex/auth.json` | ❌ **차단** | **위반** (계정 공유 금지 조항) | OpenAI API 키 |
| **Gemini CLI** | Google OAuth / API 키 | `~/.gemini/oauth_creds.json` | ❌ **차단** | **위반** (Google ToS 명시 금지) | `GEMINI_API_KEY` / Vertex SA |

**결론: 세 CLI 모두 OAuth 토큰 재사용은 ToS 위반이며 기술적으로도 서버 측 차단이 이미 시행 중이다.**

---

### 1-A. Claude Code (Anthropic)

#### 인증 흐름

Claude Code는 OAuth 2.0 Authorization Code Flow를 사용한다. `claude login` 실행 시 브라우저를 열어 Anthropic 서버에서 인증 코드를 발급받고, 이를 access token + refresh token으로 교환한다.

#### 자격증명 저장 위치

| 플랫폼 | 저장 위치 |
|--------|----------|
| macOS | **암호화된 macOS Keychain** (파일 직접 접근 불가) |
| Linux | `~/.claude/.credentials.json` (퍼미션 `0600`) |
| Windows | `%USERPROFILE%\.claude\.credentials.json` |
| 커스텀 | `$CLAUDE_CONFIG_DIR/.credentials.json` |

> **중요**: 이 연구에서 확인한 `~/.claude/auth.json`은 **oh-my-claudecode** (OMC) 확장의 설정 파일이며, Claude Code 자체의 인증 토큰이 아니다. Claude Code의 실제 OAuth 토큰은 macOS에서 Keychain에 저장되므로 파일로 직접 읽을 수 없다.

#### 인증 우선순위 (공식 문서 기준)

```
1. CLAUDE_CODE_USE_BEDROCK / USE_VERTEX / USE_FOUNDRY → 클라우드 프로바이더
2. ANTHROPIC_AUTH_TOKEN → Bearer 헤더 (LLM 게이트웨이용)
3. ANTHROPIC_API_KEY → X-Api-Key 헤더 (직접 API 접근)
4. apiKeyHelper 스크립트 → 동적/로테이팅 자격증명
5. CLAUDE_CODE_OAUTH_TOKEN → 장기 OAuth 토큰 (claude setup-token으로 생성)
6. 구독 OAuth (/login) → Claude Pro/Max/Team/Enterprise
```

#### Claude Max 구독 OAuth vs API 키

- **구독 OAuth**: Claude Pro/Max/Team/Enterprise 사용자를 위한 인증. `claude setup-token`으로 1년짜리 장기 토큰 생성 가능 (환경변수 `CLAUDE_CODE_OAUTH_TOKEN`). **단, 이 토큰도 Claude Code/Anthropic 네이티브 앱 전용이며 제3자 앱에서 사용 불가**.
- **API 키**: `platform.claude.com`의 Console에서 발급. 제3자 앱에서 자유롭게 사용 가능. `ANTHROPIC_API_KEY` 환경변수로 전달.

#### ToS 위반 여부 — 공식 확인

Anthropic의 [Legal and Compliance 페이지](https://code.claude.com/docs/en/legal-and-compliance) (2026-02-20 업데이트) 직접 인용:

> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications. [...] Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users."

**2026-01-09에 서버 측 차단이 배포되었다.** OpenCode, OpenClaw 등 제3자 도구들이 하룻밤 사이에 작동을 중단했다.

#### hanimo가 취해야 할 접근법

```
✅ ANTHROPIC_API_KEY 환경변수 (직접 API 접근) — 유일하게 허용된 방법
✅ AWS Bedrock / Google Vertex AI 경유 (엔터프라이즈)
❌ ~/.claude/.credentials.json 읽기 — ToS 위반 + macOS에서 불가능
❌ claude 서브프로세스 실행 후 출력 캡처 — 의도된 사용법 아님, ToS 회색 지대
```

#### Subprocess 방식 (headless `-p`) 분석

Claude Code는 `claude -p "질문"` 형태의 non-interactive 모드를 지원한다. 기술적으로는 hanimo에서 `exec.Command("claude", "-p", prompt)`로 호출하고 stdout을 파싱할 수 있다. 그러나:

- **성능 문제**: 매 호출마다 Node.js 프로세스 스핀업 (~500ms 오버헤드)
- **의존성**: 사용자 머신에 Claude Code가 설치되어 있어야 함
- **ToS 회색 지대**: 명시적으로 금지되지는 않았으나, 구독 사용량을 hanimo가 소비하는 것이 "ordinary individual usage"에 해당하는지 불명확
- **권고**: 구현하지 않는 것이 안전

---

### 1-B. Codex CLI (OpenAI)

#### 인증 흐름

Codex CLI는 ChatGPT 계정 OAuth (구독 기반) 또는 OpenAI API 키를 지원한다. 브라우저 OAuth 또는 Device Code Flow (`codex login --device-auth`)로 인증한다.

#### 자격증명 저장 위치

| 설정 (`cli_auth_credentials_store`) | 저장 위치 |
|-------------------------------------|----------|
| `file` (기본) | `~/.codex/auth.json` |
| `keyring` | OS 자격증명 저장소 |
| `auto` | Keyring 우선, 없으면 `~/.codex/auth.json` |

#### `~/.codex/auth.json` 실제 구조 (이 머신에서 확인)

```json
{
  "auth_mode": "chatgpt",
  "OPENAI_API_KEY": null,
  "tokens": {
    "id_token": "<JWT — ChatGPT 구독 정보 포함>",
    "access_token": "<JWT — aud: https://api.openai.com/v1>",
    "refresh_token": "rt_2wUK2QjTIGH5bx_...",
    "account_id": "8b5f3966-..."
  },
  "last_refresh": "2026-03-30T13:48:15Z"
}
```

JWT `id_token`을 디코딩하면 `chatgpt_plan_type: "plus"`, `chatgpt_subscription_active_until` 등 구독 정보가 포함된다. `access_token`의 `aud`는 `https://api.openai.com/v1` — 즉 이 토큰은 **OpenAI API에 직접 사용할 수 있는 Bearer 토큰**이다.

#### 기술적 재사용 가능성

`~/.codex/auth.json`의 `access_token`을 `Authorization: Bearer <token>`으로 `https://api.openai.com/v1/chat/completions`에 전송하면 기술적으로는 동작할 수 있다. 그러나:

- **ToS 위반**: OpenAI 서비스 약관은 계정 자격증명 공유 및 API 키/토큰의 제3자 이전을 명시적으로 금지한다.
- **토큰 만료**: Access token은 단기 유효 (일 단위). Refresh token 갱신 로직까지 구현해야 하는 복잡성.
- **모델 접근 제한**: ChatGPT 구독 토큰으로는 ChatGPT 모델만 접근 가능, OpenAI API 모델과 완전히 동일하지 않음.

#### hanimo가 취해야 할 접근법

```
✅ OPENAI_API_KEY 환경변수 — 표준 방법
✅ OpenAI API 키를 hanimo 설정 파일에 저장
❌ ~/.codex/auth.json 읽어서 Bearer 토큰 재사용 — ToS 위반
```

---

### 1-C. Gemini CLI (Google)

#### 인증 흐름

Gemini CLI는 세 가지 인증 모드를 지원한다:

| 모드 | 설명 | 무료 한도 |
|------|------|----------|
| **Google OAuth (개인)** | 브라우저에서 Google 계정 로그인 | 60 req/min, 1,000 req/day |
| **Gemini API 키** | AI Studio에서 발급, `GEMINI_API_KEY` | 1,000 req/day (무료 티어) |
| **Vertex AI** | `GOOGLE_CLOUD_PROJECT` + `GOOGLE_GENAI_USE_VERTEXAI=true` | 엔터프라이즈, 사용량 기반 과금 |

#### 자격증명 저장 위치 (이 머신에서 확인)

```
~/.gemini/
├── oauth_creds.json      # Google OAuth 토큰
├── google_accounts.json  # 활성 계정 정보
├── settings.json         # CLI 설정 (auth 타입 포함)
└── state.json            # 상태 정보
```

#### `~/.gemini/oauth_creds.json` 실제 구조 (이 머신에서 확인)

```json
{
  "access_token": "ya29.a0Aa7MYiot...",
  "scope": "openid https://www.googleapis.com/auth/userinfo.email ...",
  "token_type": "Bearer",
  "id_token": "<JWT>",
  "expiry_date": 1775137274490,
  "refresh_token": "1//0ef_AVDuXj0c6CgYIARAAGA4SNwF-..."
}
```

`settings.json`에서 `"selectedType": "oauth-personal"` 확인 — 개인 Google 계정 OAuth 사용 중.

#### 기술적 재사용 가능성

파일은 읽을 수 있고 access token 형태도 확인했다. 그러나 Google OAuth access token은:
- Gemini Code Assist 서비스 엔드포인트에 접근하는 토큰
- 일반 Gemini Developer API (`generativelanguage.googleapis.com`)와는 다른 스코프
- **ToS 위반**: Gemini CLI [Terms of Service](https://google-gemini.github.io/gemini-cli/docs/tos-privacy.html) 명시:
  > "Directly accessing the services powering Gemini CLI using third-party software, tools, or services is a violation of applicable terms and policies."

#### hanimo가 취해야 할 접근법

```
✅ GEMINI_API_KEY 환경변수 → generativelanguage.googleapis.com (AI Studio 발급)
✅ Vertex AI 서비스 계정 → GOOGLE_APPLICATION_CREDENTIALS 환경변수
✅ Google AI Studio 무료 티어: 1,000 req/day — 개발/테스트에 충분
❌ ~/.gemini/oauth_creds.json access_token 재사용 — ToS 위반
```

---

### 최종 판정 요약

```
Claude Code OAuth  → ❌ ToS 위반 + 서버 측 차단 시행 중
Codex CLI OAuth    → ❌ ToS 위반 (계정 자격증명 공유 금지)
Gemini CLI OAuth   → ❌ ToS 위반 (명시적 금지 조항 존재)

합법적이고 안전한 방법:
  Anthropic  → ANTHROPIC_API_KEY (platform.claude.com에서 발급)
  OpenAI     → OPENAI_API_KEY (platform.openai.com에서 발급)
  Google     → GEMINI_API_KEY (aistudio.google.com에서 발급) 또는 Vertex SA JSON
```

---

<a name="part-2"></a>
## Part 2 — 벤더별 클라우드 모델 카탈로그

### 2-A. Anthropic (Claude)

**API 엔드포인트**: `https://api.anthropic.com/v1/messages`  
**인증**: `x-api-key: <ANTHROPIC_API_KEY>` + `anthropic-version: 2023-06-01`  
**hanimo 현재 상태**: `providers/anthropic.go` 구현됨 (OpenAI 호환 레이어 사용)

> **주의**: Anthropic 네이티브 API는 OpenAI `/v1/chat/completions`와 다르다. 현재 hanimo의 Anthropic 프로바이더는 OpenAI 호환 레이어를 사용하는데, 이는 Anthropic이 공식적으로 `/v1/messages` 엔드포인트를 별도로 운영하기 때문에 실제 동작 여부를 확인해야 한다.

#### 현재 모델 (2026-04 기준)

| 모델 ID | 별칭 | 컨텍스트 | 최대 출력 | 입력 가격 | 출력 가격 | 도구 사용 | hanimo 적합도 |
|---------|------|----------|----------|----------|----------|----------|--------------|
| `claude-opus-4-6` | `claude-opus-4-6` | **1M 토큰** | 128k | $5/MTok | $25/MTok | ✅ 최상 | ⭐ 최우선 |
| `claude-sonnet-4-6` | `claude-sonnet-4-6` | **1M 토큰** | 64k | $3/MTok | $15/MTok | ✅ 최상 | ⭐ 최우선 |
| `claude-haiku-4-5-20251001` | `claude-haiku-4-5` | 200k | 64k | $1/MTok | $5/MTok | ✅ 우수 | ✅ 권장 |

#### 레거시 모델 (사용 가능, 마이그레이션 권장)

| 모델 ID | 컨텍스트 | 입력 가격 | 출력 가격 | 비고 |
|---------|----------|----------|----------|------|
| `claude-sonnet-4-5-20250929` | 200k | $3/MTok | $15/MTok | 이전 세대 |
| `claude-opus-4-5-20251101` | 200k | $5/MTok | $25/MTok | 이전 세대 |
| `claude-opus-4-1-20250805` | 200k | $15/MTok | $75/MTok | 고비용 |
| `claude-sonnet-4-20250514` | 200k | $3/MTok | $15/MTok | 안정적 |
| `claude-opus-4-20250514` | 200k | $15/MTok | $75/MTok | 고비용 |
| `claude-3-haiku-20240307` | 200k | $0.25/MTok | $1.25/MTok | **2026-04-19 deprecated** |

#### AWS Bedrock ID (엔터프라이즈)

| 모델 | Bedrock ID |
|------|-----------|
| Claude Opus 4.6 | `anthropic.claude-opus-4-6-v1` |
| Claude Sonnet 4.6 | `anthropic.claude-sonnet-4-6` |
| Claude Haiku 4.5 | `anthropic.claude-haiku-4-5-20251001-v1:0` |

#### Google Vertex AI ID (엔터프라이즈)

| 모델 | Vertex ID |
|------|----------|
| Claude Opus 4.6 | `claude-opus-4-6` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Haiku 4.5 | `claude-haiku-4-5@20251001` |

#### 특수 기능

- **Extended Thinking**: Opus 4.6, Sonnet 4.6, Haiku 4.5 모두 지원 — 복잡한 추론 작업에 유리
- **Prompt Caching**: 최대 90% 비용 절감 (긴 시스템 프롬프트/컨텍스트 재사용 시)
- **Batch API**: 50% 비용 절감 (비실시간 작업)
- **300k 출력 (Beta)**: Opus 4.6, Sonnet 4.6 — `output-300k-2026-03-24` beta 헤더 사용

**소스**: [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview)

---

### 2-B. OpenAI

**API 엔드포인트**: `https://api.openai.com/v1/chat/completions`  
**인증**: `Authorization: Bearer <OPENAI_API_KEY>`  
**hanimo 현재 상태**: `openai_compat.go`에서 지원, `defaultBaseURLs["openai"]` 설정됨

#### 현재 모델 (2026-04 기준)

| 모델 ID | 컨텍스트 | 최대 출력 | 입력 가격 | 출력 가격 | 도구 사용 | 비전 | hanimo 적합도 |
|---------|----------|----------|----------|----------|----------|------|--------------|
| `gpt-4.1` | **1M 토큰** | — | $2/MTok | $8/MTok | ✅ 우수 | ✅ | ⭐ 최우선 |
| `gpt-4.1-mini` | **1M 토큰** | — | $0.40/MTok | $1.60/MTok | ✅ 우수 | ✅ | ⭐ 최우선 |
| `gpt-4.1-nano` | — | — | $0.10/MTok | $0.40/MTok | ✅ | ✅ | ✅ 빠른 작업 |
| `gpt-4o` | 128k | — | $2.50/MTok | $10/MTok | ✅ 우수 | ✅ | ✅ 안정적 |
| `gpt-4o-mini` | 128k | — | $0.15/MTok | $0.60/MTok | ✅ 우수 | ✅ | ✅ 저비용 |
| `o3` | 200k | — | $2/MTok | $8/MTok | ✅ | ❌ | ✅ 추론 작업 |
| `o4-mini` | 200k | — | $1.10/MTok | $4.40/MTok | ✅ | ✅ | ✅ 추론 저비용 |

#### 모델 계열 설명

- **gpt-4.1 계열**: 2025년 출시. 1M 컨텍스트 창. GPT-4o를 대체하는 주력 생산 모델. 코딩 벤치마크에서 탁월한 성능.
- **gpt-4o / gpt-4o-mini**: 128k 컨텍스트. 검증된 안정성. 도구 호출 성능 우수.
- **o3 / o4-mini**: 추론 특화 모델. 200k 컨텍스트. 지식 컷오프 2024-06. 복잡한 계획/분석에 적합.

#### Codex 전용 모델 (Codex CLI 구독)

이 머신의 `~/.codex/config.toml`에서 확인:
```toml
model = "gpt-5.4"
```
`gpt-5.4`는 Codex CLI의 ChatGPT 구독 전용 모델로, 일반 OpenAI API를 통해서는 접근 불가.

**소스**: [platform.openai.com/docs/models](https://platform.openai.com/docs/models), [openai.com/index/gpt-4-1/](https://openai.com/index/gpt-4-1/)

---

### 2-C. Google (Gemini)

**AI Studio 엔드포인트**: `https://generativelanguage.googleapis.com/v1beta/openai` (OpenAI 호환)  
**Vertex AI 엔드포인트**: `https://{region}-aiplatform.googleapis.com/v1/...`  
**인증**: `Authorization: Bearer <GEMINI_API_KEY>` 또는 서비스 계정  
**hanimo 현재 상태**: `providers/google.go` 구현됨 (OpenAI 호환 엔드포인트 사용)

#### 현재 모델 (2026-04 기준)

| 모델 ID | 컨텍스트 | 입력 가격 | 출력 가격 | 도구 사용 | 비전 | hanimo 적합도 |
|---------|----------|----------|----------|----------|------|--------------|
| `gemini-2.5-pro` | **1M 토큰** | $1.00/MTok | $10/MTok | ✅ 우수 | ✅ | ⭐ 최우선 |
| `gemini-2.5-flash` | **1M 토큰** | $0.30/MTok | $2.50/MTok | ✅ 우수 | ✅ | ⭐ 최우선 |
| `gemini-2.5-flash-lite` | 1M | ~$0.10/MTok | ~$0.40/MTok | ✅ | ✅ | ✅ 저비용 |
| `gemini-2.0-flash` | 1M | $0.10/MTok | $0.40/MTok | ✅ | ✅ | ✅ 저비용 |
| `gemini-1.5-pro` | **2M 토큰** | $1.25/MTok | $5/MTok | ✅ | ✅ | ✅ 초장문 |
| `gemini-1.5-flash` | 1M | $0.075/MTok | $0.30/MTok | ✅ | ✅ | ✅ 저비용 |

#### Gemini 3.x 시리즈 (Preview, 2026-04)

| 모델 | 상태 | 비고 |
|------|------|------|
| `gemini-3.1-pro-preview` | Preview | 고급 추론 |
| `gemini-3-flash-preview` | Preview | 프론티어급 성능 |
| `gemini-3.1-flash-lite-preview` | Preview | 저비용 |

> Preview 모델은 GA 전 변경 가능. 프로덕션 사용 비권장.

#### AI Studio vs Vertex AI

| 항목 | AI Studio (`generativelanguage.googleapis.com`) | Vertex AI (`aiplatform.googleapis.com`) |
|------|------------------------------------------------|----------------------------------------|
| 인증 | API 키 | 서비스 계정 JSON / ADC |
| 무료 티어 | ✅ (1,000 req/day) | ❌ |
| SLA | 없음 | 있음 (엔터프라이즈) |
| 데이터 보존 | Google 기본 정책 | 고객 제어 가능 |
| hanimo 적합 | ✅ 기본 통합 | 엔터프라이즈 옵션 |

**소스**: [ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing), [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)

---

<a name="part-3"></a>
## Part 3 — 애그리게이터 플랫폼 비교

### 3-A. OpenRouter

**웹사이트**: https://openrouter.ai  
**API 엔드포인트**: `https://openrouter.ai/api/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["openrouter"]` 이미 설정됨 ✅

#### 개요

- **500+ 모델**, 60+ 활성 프로바이더 (Anthropic, OpenAI, Google, Meta, Mistral, xAI, DeepSeek 등)
- **단일 API 키**로 모든 프로바이더 접근
- OpenAI 호환 인터페이스 → hanimo 즉시 사용 가능

#### 요금제

| 티어 | 설명 | 한도 |
|------|------|------|
| **무료 모델** | 토큰당 $0, 크레딧 불필요 | 20 req/min, 200 req/day |
| **Pay-as-you-go** | 월 최소 없음 | 사용량 기반 |
| **BYOK (Bring Your Own Key)** | 월 1M 요청 무료, 이후 동일 모델 가격의 5% | 자체 키 사용 |
| **Enterprise** | 분산 인프라, 컴플라이언스, 커스텀 데이터 정책 | 협의 |

#### 주요 무료 모델 (2026-04)

- `google/gemini-2.0-flash-exp:free`
- `meta-llama/llama-3.1-8b-instruct:free`
- `mistralai/mistral-7b-instruct:free`
- `qwen/qwen-2.5-72b-instruct:free`

#### hanimo 통합 가치

OpenRouter는 hanimo의 **멀티-프로바이더 전략의 핵심**이다. 단일 API 키로 Anthropic, OpenAI, Google을 모두 테스트할 수 있어 개발 및 데모에 최적. 사용자가 특정 프로바이더 API 키 없이도 hanimo를 사용할 수 있게 하는 진입 장벽 최소화 전략으로 활용 가능.

**소스**: [openrouter.ai/docs](https://openrouter.ai/docs/guides/overview/models)

---

### 3-B. Novita AI

**웹사이트**: https://novita.ai  
**API 엔드포인트**: `https://api.novita.ai/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["novita"]` 이미 설정됨 ✅ — **현재 사용 중**

#### 개요

- **200+ 오픈소스 모델** API
- vLLM PagedAttention 기반 고성능 서빙
- GPU 인스턴스 / 서버리스 GPU도 제공

#### 주요 모델 및 가격 (2026-04)

| 모델 | 입력 가격 | 컨텍스트 |
|------|----------|----------|
| `llama3.1-8b-instruct` | $0.02/MTok | 128k |
| `qwen3-4b` | $0.03/MTok | — |
| `deepseek-v3` | $0.28/MTok | 64k |
| `deepseek-r1` | $0.55/MTok | 128k |
| `qwen3-coder-30b` | — | 256k |
| `openai/gpt-oss-120b` | $0.05/MTok | — |

> hanimo의 현재 기본 모델 (`openai/gpt-oss-120b`, `qwen/qwen3-coder-30b`)이 모두 Novita에서 서빙됨.

#### 장점/단점

| 장점 | 단점 |
|------|------|
| 최저가 오픈소스 모델 | 프론티어 독점 모델 없음 |
| OpenAI 호환 API | Claude/GPT-4 없음 |
| 빠른 스케일링 | 상대적으로 작은 커뮤니티 |
| 현재 hanimo에서 사용 중 | 업타임 SLA 불분명 |

**소스**: [novita.ai/docs/guides/llm-api](https://novita.ai/docs/guides/llm-api)

---

### 3-C. Together AI

**웹사이트**: https://www.together.ai  
**API 엔드포인트**: `https://api.together.xyz/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["together"]` 이미 설정됨 ✅

#### 개요

- **136+ 오픈소스 모델** (Llama, Mistral, Mixtral, Qwen 등)
- 서브 100ms 지연 목표
- 파인튜닝, 임베딩 API도 제공

#### 주요 모델 및 가격

| 모델 | 입력 가격 | 출력 가격 |
|------|----------|----------|
| Llama 3.3 70B | $0.88/MTok | $0.88/MTok |
| Llama 3.1 8B | $0.18/MTok | $0.18/MTok |
| Mixtral 8x7B | $0.60/MTok | $0.60/MTok |
| Qwen2.5 72B | $1.20/MTok | $1.20/MTok |

**소스**: [api.together.xyz/models](https://api.together.xyz/models)

---

### 3-D. Fireworks AI

**웹사이트**: https://fireworks.ai  
**API 엔드포인트**: `https://api.fireworks.ai/inference/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["fireworks"]` 이미 설정됨 ✅

#### 개요

- **고속 추론** 특화 (NVIDIA Blackwell 플랫폼)
- Serverless 및 Dedicated GPU 옵션
- FireFunction-v2 (함수 호출 특화 모델)

#### 가격

| 유형 | 가격 |
|------|------|
| Serverless (소형 모델) | $0.20/MTok~ |
| Serverless (대형 모델) | $0.90~$3/MTok |
| On-demand A100 80GB | $2.90/hr |
| On-demand H100/H200 | $6.00/hr |
| On-demand B200 | $9.00/hr |

**소스**: [fireworks.ai/pricing](https://fireworks.ai/pricing)

---

### 3-E. Groq

**웹사이트**: https://groq.com  
**API 엔드포인트**: `https://api.groq.com/openai/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["groq"]` 이미 설정됨 ✅

#### 개요

Groq는 LPU(Language Processing Unit) 커스텀 하드웨어 기반의 **세계 최고속 추론 플랫폼**이다.

- Llama 3.3 70B: **750~900 tokens/sec** (GPU 대비 ~20배)
- Llama 3.1 8B: **2,358 tokens/sec**
- Time-to-first-token: **300ms 이하**

#### 주요 모델 및 가격

| 모델 | 입력 가격 | 출력 가격 | 속도 |
|------|----------|----------|------|
| Llama 4 Scout | $0.11/MTok | $0.34/MTok | 초고속 |
| Llama 3.3 70B | $0.59/MTok | $0.79/MTok | 초고속 |
| Llama 3.1 8B | $0.05/MTok | $0.08/MTok | 최고속 |
| Qwen3 32B | — | — | 고속 |
| Kimi K2 | — | — | 고속 |

#### 무료 티어

| 한도 | 값 |
|------|---|
| 분당 요청 | 30 |
| 일일 요청 | 14,400 |
| 분당 토큰 | 6,000 |

#### hanimo 적합성

Groq는 hanimo의 **셸 명령어 스트리밍 / 인터랙티브 응답** 시나리오에 최적. 사용자가 즉각적인 응답을 기대하는 Super 모드에서 탁월한 UX를 제공. **무료 티어가 풍부하여 신규 사용자 온보딩에 활용 가능**.

**소스**: [groq.com/pricing](https://groq.com/pricing), [console.groq.com/docs/models](https://console.groq.com/docs/models)

---

### 3-F. Cerebras

**웹사이트**: https://www.cerebras.ai  
**API 엔드포인트**: `https://api.cerebras.ai/v1` (OpenAI 호환)  
**hanimo 현재 상태**: 미구현 — 추가 필요

#### 개요

CS-3 웨이퍼 스케일 칩 기반 **극한 추론 속도** 플랫폼.

- Llama 3.1 405B: **969 tokens/sec** (GPT-4o 대비 12배)
- Llama 3.1 8B: **2,358 tokens/sec**

#### 가격

| 모델 | 입력 가격 | 출력 가격 |
|------|----------|----------|
| Llama 3.1 8B | $0.10/MTok | $0.10/MTok |
| Llama 3.1 70B | $0.60/MTok | $0.60/MTok |
| Llama 3.1 405B | $6.00/MTok | $12.00/MTok |
| Qwen3 235B | — | — |

**소스**: [cerebras.ai/pricing](https://www.cerebras.ai/pricing)

---

### 3-G. DeepSeek

**웹사이트**: https://platform.deepseek.com  
**API 엔드포인트**: `https://api.deepseek.com/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["deepseek"]` 이미 설정됨 ✅

#### 주요 모델 및 가격

| 모델 | 입력 가격 | 출력 가격 | 컨텍스트 | 특징 |
|------|----------|----------|----------|------|
| `deepseek-v4` | $0.30/MTok | $0.50/MTok | 1M | 최신 플래그십 |
| `deepseek-v3.2` | $0.028/MTok (캐시) / $0.28/MTok | $0.42/MTok | — | 매우 저렴 |
| `deepseek-r1` | $0.55/MTok | $2.19/MTok | 128k | 추론 특화 |

> 신규 계정: 5M 무료 토큰 지급 (30일 유효)

**소스**: [api-docs.deepseek.com/quick_start/pricing/](https://api-docs.deepseek.com/quick_start/pricing/)

---

### 3-H. Mistral Platform

**웹사이트**: https://mistral.ai  
**API 엔드포인트**: `https://api.mistral.ai/v1` (OpenAI 호환)  
**hanimo 현재 상태**: `defaultBaseURLs["mistral"]` 이미 설정됨 ✅

#### 주요 모델 및 가격

| 모델 | 입력 가격 | 출력 가격 | 컨텍스트 |
|------|----------|----------|----------|
| `mistral-large-latest` | $2/MTok | $6/MTok | 128k |
| `mistral-medium-3` | $0.40/MTok | $2/MTok | 131k+ |
| `mistral-small-latest` | $0.10/MTok | $0.30/MTok | 32k |
| `mistral-nemo` | $0.02/MTok | $0.02/MTok | 128k |
| `codestral-latest` | $0.30/MTok | $0.90/MTok | 256k | 코딩 특화 |

> `codestral-latest`는 코드 완성 특화 모델로 hanimo의 코딩 에이전트 용도에 적합.

**소스**: [mistral.ai/products/la-plateforme](https://mistral.ai/products/la-plateforme)

---

### 3-I. DeepInfra

**웹사이트**: https://deepinfra.com  
**API 엔드포인트**: `https://api.deepinfra.com/v1/openai` (OpenAI 호환)

#### 개요

- **71+ 모델** (H100/A100 최적화)
- 오픈소스 모델 최저가 중 하나
- 신뢰성과 가격 사이 균형

#### 대표 가격

| 모델 | 가격 |
|------|------|
| Llama 3.1 8B | $0.06/MTok |
| Llama 3.1 70B | $0.35/MTok |
| DeepSeek V3 | $0.28/MTok |

---

### 3-J. 엔터프라이즈 게이트웨이

#### AWS Bedrock

| 항목 | 내용 |
|------|------|
| 지원 모델 | Claude (Anthropic), Llama, Mistral, Titan 등 |
| 인증 | AWS Credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) |
| 특수 환경변수 | `CLAUDE_CODE_USE_BEDROCK=1` (Claude Code용), `AWS_BEDROCK_ENDPOINT` |
| Go SDK | `github.com/aws/aws-sdk-go-v2/service/bedrockruntime` |
| OpenAI 호환 | AWS가 2025-08에 OpenAI 호환 엔드포인트 공식 출시 (gpt-oss 모델만, 도구 호출 미지원) |
| hanimo 구현 | 별도 Bedrock 프로바이더 필요 (또는 OpenRouter 경유) |

#### Google Vertex AI

| 항목 | 내용 |
|------|------|
| 지원 모델 | Gemini 전 시리즈, Claude (Anthropic), Llama |
| 인증 | 서비스 계정 JSON (`GOOGLE_APPLICATION_CREDENTIALS`) 또는 ADC |
| 특수 환경변수 | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_GENAI_USE_VERTEXAI=true` |
| 엔드포인트 | `https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:streamGenerateContent` |
| OpenAI 호환 | Beta (2025-01 기준, 도구 호출 이슈 있음) |
| hanimo 구현 | `providers/google.go` 확장 또는 별도 프로바이더 |

#### Azure OpenAI

| 항목 | 내용 |
|------|------|
| 지원 모델 | GPT-4.1, GPT-4o, o3, o4-mini 등 OpenAI 모델 |
| 인증 | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` |
| 엔드포인트 | `https://{resource}.openai.azure.com/openai/deployments/{deployment}/chat/completions?api-version=2024-02-01` |
| Go 통합 | `github.com/sashabaranov/go-openai`의 `openai.DefaultAzureConfig()` 사용 가능 |
| hanimo 구현 | `openai_compat.go`의 baseURL 커스터마이즈로 비교적 쉬운 추가 |

**소스**: [reintech.io/blog/aws-bedrock-vs-google-vertex-ai-vs-azure-ai-studio-comparison](https://reintech.io/blog/aws-bedrock-vs-google-vertex-ai-vs-azure-ai-studio-comparison)

---

### 애그리게이터 종합 비교표

| 플랫폼 | 모델 수 | 가격 수준 | 속도 | 무료 티어 | 도구 호출 | OpenAI 호환 | hanimo 구현 |
|--------|---------|----------|------|----------|----------|------------|------------|
| **OpenRouter** | 500+ | 중 | 중 | ✅ (20 req/min) | ✅ | ✅ | ✅ 구현됨 |
| **Novita** | 200+ | 최저 | 중 | ✅ | ✅ | ✅ | ✅ 구현됨 (현재 사용) |
| **Groq** | 20+ | 저 | **최고속** | ✅ (14,400/day) | ✅ | ✅ | ✅ 구현됨 |
| **Together AI** | 136+ | 저 | 중-고 | ✅ | ✅ | ✅ | ✅ 구현됨 |
| **Fireworks** | 50+ | 저-중 | 고속 | ❌ | ✅ | ✅ | ✅ 구현됨 |
| **Cerebras** | 10+ | 저 | **극한 속도** | ❌ | ✅ | ✅ | ❌ 미구현 |
| **DeepSeek** | 5+ | **최저** | 중 | ✅ (5M 무료) | ✅ | ✅ | ✅ 구현됨 |
| **Mistral** | 8+ | 저-중 | 중-고 | ❌ | ✅ | ✅ | ✅ 구현됨 |
| **DeepInfra** | 71+ | 저 | 중-고 | ❌ | ✅ | ✅ | ❌ 미구현 |

---

<a name="part-4"></a>
## Part 4 — hanimo 통합 우선순위 권고

### 4-A. 모델 use-case 분류

#### 코딩/에이전트 작업 (hanimo 핵심)

| 티어 | 모델 | 프로바이더 | 근거 |
|------|------|-----------|------|
| **1위** | `claude-sonnet-4-6` | Anthropic | 1M 컨텍스트, 최상의 도구 호출, 코딩 특화 |
| **1위** | `gpt-4.1` | OpenAI | 1M 컨텍스트, SWE-bench 최상위 |
| **2위** | `gemini-2.5-pro` | Google | 1M 컨텍스트, 강력한 추론 |
| **2위** | `claude-haiku-4-5` | Anthropic | 빠른 도구 호출, 저비용 |
| **3위** | `qwen3-coder-30b` | Novita | 256k 컨텍스트, 코딩 특화 오픈소스 |
| **3위** | `codestral-latest` | Mistral | 코드 완성 특화, 256k |

#### 빠른 채팅 / 인터랙티브 (Super 모드)

| 티어 | 모델 | 프로바이더 | 근거 |
|------|------|-----------|------|
| **1위** | `llama-3.3-70b` | Groq | 900 tok/sec, 무료 티어 |
| **1위** | `gpt-4.1-nano` | OpenAI | $0.10/MTok, 빠름 |
| **2위** | `gemini-2.5-flash` | Google | 1M 컨텍스트, $0.30/MTok |
| **2위** | `llama3.1-8b` | Cerebras | 2,358 tok/sec |

#### 추론/계획 (Plan 모드)

| 티어 | 모델 | 프로바이더 | 근거 |
|------|------|-----------|------|
| **1위** | `claude-opus-4-6` | Anthropic | Extended Thinking 지원 |
| **1위** | `o3` | OpenAI | 추론 특화 |
| **2위** | `deepseek-r1` | DeepSeek | 저비용 추론, $0.55/MTok |

#### 초장문 컨텍스트

| 모델 | 컨텍스트 | 프로바이더 |
|------|----------|-----------|
| `claude-opus-4-6` | 1M 토큰 | Anthropic |
| `claude-sonnet-4-6` | 1M 토큰 | Anthropic |
| `gpt-4.1` | 1M 토큰 | OpenAI |
| `gemini-2.5-pro` | 1M 토큰 | Google |
| `gemini-1.5-pro` | **2M 토큰** | Google |

---

### 4-B. 신뢰도 티어 분류

#### Rock-Solid Frontier (프로덕션 권장)
- Anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`
- OpenAI: `gpt-4.1`, `gpt-4o`
- Google: `gemini-2.5-pro`, `gemini-2.5-flash`

#### Reliable Mid (안정적, 저비용)
- `claude-haiku-4-5`, `gpt-4.1-mini`, `gpt-4o-mini`
- `gemini-2.0-flash`, `mistral-medium-3`

#### Budget / Experimental (비용 최적화)
- Groq + Llama 3.3 70B (속도 최우선)
- Novita + 오픈소스 (비용 최우선)
- DeepSeek V3.2 (가성비 최우선)
- Cerebras + Llama (지연시간 최우선)

---

### 4-C. 통합 단계별 로드맵

#### Phase 1 — 즉시 (현재 상태 완성)
> hanimo에 이미 `defaultBaseURLs`가 설정된 프로바이더들을 완전히 활성화

1. **Anthropic** (`providers/anthropic.go`)
   - 현재: OpenAI 호환 레이어 사용 (실제 동작 미확인)
   - 필요: Anthropic 네이티브 API (`/v1/messages`) 구현 또는 OpenAI 호환 엔드포인트 확인
   - `ANTHROPIC_API_KEY` 환경변수 지원

2. **Google Gemini** (`providers/google.go`)
   - 현재: AI Studio OpenAI 호환 엔드포인트 사용
   - 필요: `GEMINI_API_KEY` 환경변수 지원 확인
   - 무료 티어로 즉시 사용 가능

3. **OpenAI** (완성)
   - `gpt-4.1`, `gpt-4.1-mini` 모델 ID 추가

4. **OpenRouter** (완성)
   - 사용자에게 "모든 모델 한 번에" 접근 방법 안내

#### Phase 2 — 단기 (다음 스프린트)

5. **Groq 활성화**
   - `GROQ_API_KEY` 지원
   - 기본 모델: `llama-3.3-70b-versatile`
   - Super 모드의 기본 빠른 모드로 채택 고려

6. **DeepSeek 활성화**
   - `DEEPSEEK_API_KEY` 지원
   - `deepseek-chat` (V3), `deepseek-reasoner` (R1)

7. **Mistral 활성화**
   - `MISTRAL_API_KEY` 지원
   - `codestral-latest` — 코딩 에이전트 특화

#### Phase 3 — 중기 (로드맵)

8. **Cerebras** 추가
   - 엔드포인트: `https://api.cerebras.ai/v1`
   - 인터랙티브 응답 속도 극대화

9. **AWS Bedrock** 지원
   - `github.com/aws/aws-sdk-go-v2/service/bedrockruntime` 사용
   - 엔터프라이즈 사용자 대상

10. **Google Vertex AI** 지원
    - 서비스 계정 인증 추가
    - 엔터프라이즈 Gemini 접근

---

### 4-D. 권장 기본 모델 구성 (사용자 페르소나별)

| 페르소나 | Super 모드 | Deep 모드 | Plan 모드 | 비용/일 |
|---------|-----------|----------|----------|---------|
| **무료 사용자** | Groq/Llama-70B | Novita/Qwen3-Coder | DeepSeek R1 | ~$0 |
| **개인 개발자** | Claude Haiku 4.5 | Claude Sonnet 4.6 | Claude Opus 4.6 | ~$0.50 |
| **전문 개발자** | GPT-4.1-mini | Claude Sonnet 4.6 | o3 | ~$2 |
| **팀/엔터프라이즈** | Gemini 2.5 Flash | Claude Opus 4.6 | o3 | ~$5+ |

---

<a name="part-5"></a>
## Part 5 — ToS / 법적 사항

### 5-A. Anthropic — 명시적 금지 (2026-02 시행)

**공식 출처**: [code.claude.com/docs/en/legal-and-compliance](https://code.claude.com/docs/en/legal-and-compliance)

**핵심 조항** (직접 인용):
> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
>
> "Anthropic does not permit third-party developers to offer Claude.ai login or to route requests through Free, Pro, or Max plan credentials on behalf of their users."
>
> "Anthropic reserves the right to take measures to enforce these restrictions and may do so without prior notice."

**시행 현황**:
- 2026-01-09: 서버 측 차단 배포 (OpenCode, OpenClaw 등 즉시 중단)
- 2026-02-20: 공식 법적 조항 업데이트

**hanimo에 대한 함의**:
- `ANTHROPIC_API_KEY` 사용은 허용됨 (Console에서 발급)
- `CLAUDE_CODE_OAUTH_TOKEN`을 hanimo에서 읽어 사용하는 것은 **금지**
- 서브프로세스(`claude -p`)를 통한 구독 우회는 법적 회색 지대이며 피해야 함

---

### 5-B. OpenAI — 계정 공유/토큰 이전 금지

**공식 출처**: [openai.com/policies/service-terms/](https://openai.com/policies/service-terms/)

**핵심 조항**:
- API 키를 제3자에게 판매, 이전, 공유하는 것 금지
- 계정 자격증명 공유 금지 ("you may not share your account credentials")
- ChatGPT 구독은 개인 사용 목적 (ChatGPT Plus/Pro)

**hanimo에 대한 함의**:
- `~/.codex/auth.json`의 access token을 읽어 OpenAI API에 직접 사용하는 것은 **금지**
- `OPENAI_API_KEY` (platform.openai.com에서 발급)는 허용됨
- Codex CLI의 ChatGPT 구독 모델(예: `gpt-5.4`)은 API로 접근 불가

---

### 5-C. Google — Gemini CLI 특정 조항

**공식 출처**: [google-gemini.github.io/gemini-cli/docs/tos-privacy.html](https://google-gemini.github.io/gemini-cli/docs/tos-privacy.html)

**핵심 조항** (직접 인용):
> "Directly accessing the services powering Gemini CLI (e.g., the Gemini Code Assist service) using third-party software, tools, or services is a violation of applicable terms and policies."

**적용 약관 (인증 방식별)**:
| 인증 방식 | 적용 약관 |
|----------|----------|
| Google AI Pro/Ultra 구독 OAuth | Google ToS + Google One 추가 약관 |
| Code Assist Standard/Enterprise | Google Cloud Platform ToS |
| Gemini API 키 | Gemini API ToS |

**hanimo에 대한 함의**:
- `~/.gemini/oauth_creds.json` 토큰 재사용 → **금지**, 계정 정지 위험
- `GEMINI_API_KEY` (aistudio.google.com에서 발급) → **허용**
- Vertex AI 서비스 계정 → **허용** (엔터프라이즈)

---

### 5-D. ToS 정책 위험도 요약

| 행위 | 위험도 | 결과 |
|------|--------|------|
| Claude Code OAuth 토큰 재사용 | 🔴 **매우 높음** | 서버 측 차단 + 계정 정지 위험 |
| Codex CLI OAuth 토큰 재사용 | 🔴 **높음** | ToS 위반, 계정 정지 위험 |
| Gemini CLI OAuth 토큰 재사용 | 🔴 **높음** | ToS 위반, 계정 정지 위험 |
| `claude -p` 서브프로세스 | 🟡 **회색 지대** | 명시적 금지 없으나 피해야 함 |
| 각 공식 API 키 사용 | 🟢 **허용** | 정상적인 API 사용 |
| OpenRouter 경유 | 🟢 **허용** | OpenRouter가 직접 계약 |

---

<a name="appendix"></a>
## Appendix — Go 코드 스니펫

### A-1. Anthropic API 직접 통합 (네이티브)

Anthropic의 `/v1/messages` API는 OpenAI 호환이 아니다. 현재 `providers/anthropic.go`는 OpenAI 라이브러리를 사용하는데, 실제로 Anthropic이 OpenAI 호환 엔드포인트를 제공하지 않으므로 네이티브 구현이 필요하다.

```go
// providers/anthropic_native.go
package providers

import (
    "bufio"
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "strings"
)

const anthropicAPIURL = "https://api.anthropic.com/v1/messages"
const anthropicVersion = "2023-06-01"

type anthropicNativeProvider struct {
    apiKey  string
    baseURL string
    client  *http.Client
}

type anthropicRequest struct {
    Model     string             `json:"model"`
    MaxTokens int                `json:"max_tokens"`
    Messages  []anthropicMessage `json:"messages"`
    System    string             `json:"system,omitempty"`
    Stream    bool               `json:"stream"`
    Tools     []anthropicTool    `json:"tools,omitempty"`
}

type anthropicMessage struct {
    Role    string `json:"role"`
    Content string `json:"content"`
}

type anthropicTool struct {
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    InputSchema map[string]interface{} `json:"input_schema"`
}

func (p *anthropicNativeProvider) Chat(ctx context.Context, req ChatRequest) (<-chan ChatChunk, error) {
    // 시스템 메시지 분리
    var system string
    var msgs []anthropicMessage
    for _, m := range req.Messages {
        if m.Role == "system" {
            system = m.Content
        } else {
            msgs = append(msgs, anthropicMessage{Role: m.Role, Content: m.Content})
        }
    }

    body := anthropicRequest{
        Model:     req.Model,
        MaxTokens: req.MaxTokens,
        Messages:  msgs,
        System:    system,
        Stream:    true,
    }

    // 도구 변환
    for _, t := range req.Tools {
        body.Tools = append(body.Tools, anthropicTool{
            Name:        t.Name,
            Description: t.Description,
            InputSchema: t.Parameters,
        })
    }

    data, err := json.Marshal(body)
    if err != nil {
        return nil, err
    }

    httpReq, err := http.NewRequestWithContext(ctx, "POST", anthropicAPIURL, bytes.NewReader(data))
    if err != nil {
        return nil, err
    }
    httpReq.Header.Set("x-api-key", p.apiKey)
    httpReq.Header.Set("anthropic-version", anthropicVersion)
    httpReq.Header.Set("content-type", "application/json")

    resp, err := p.client.Do(httpReq)
    if err != nil {
        return nil, err
    }

    ch := make(chan ChatChunk, 16)
    go func() {
        defer close(ch)
        defer resp.Body.Close()

        scanner := bufio.NewScanner(resp.Body)
        for scanner.Scan() {
            line := scanner.Text()
            if !strings.HasPrefix(line, "data: ") {
                continue
            }
            payload := strings.TrimPrefix(line, "data: ")
            if payload == "[DONE]" {
                ch <- ChatChunk{Done: true}
                return
            }
            var event map[string]interface{}
            if err := json.Unmarshal([]byte(payload), &event); err != nil {
                continue
            }
            // content_block_delta 이벤트 처리
            if event["type"] == "content_block_delta" {
                if delta, ok := event["delta"].(map[string]interface{}); ok {
                    if text, ok := delta["text"].(string); ok {
                        ch <- ChatChunk{Content: text}
                    }
                }
            }
        }
        ch <- ChatChunk{Done: true}
    }()
    return ch, nil
}
```

---

### A-2. Gemini API 키 읽기 (허용된 방법)

```go
// internal/config/auth.go
package config

import (
    "os"
)

// GetGeminiAPIKey returns GEMINI_API_KEY from environment.
// Reading ~/.gemini/oauth_creds.json is ToS violation — do NOT do that.
func GetGeminiAPIKey() string {
    return os.Getenv("GEMINI_API_KEY")
}

// GetAnthropicAPIKey returns ANTHROPIC_API_KEY from environment.
func GetAnthropicAPIKey() string {
    return os.Getenv("ANTHROPIC_API_KEY")
}

// GetOpenAIAPIKey returns OPENAI_API_KEY from environment.
func GetOpenAIAPIKey() string {
    return os.Getenv("OPENAI_API_KEY")
}
```

---

### A-3. Groq 프로바이더 추가 (OpenAI 호환)

`openai_compat.go`의 `defaultBaseURLs`에 이미 Groq가 있으므로, 등록만 추가하면 된다:

```go
// providers/groq.go
package providers

func init() {
    Register("groq", func(baseURL, apiKey string) Provider {
        return NewOpenAICompat("groq", baseURL, apiKey)
    })
}
```

사용:
```go
provider, _ := providers.Get("groq", "", os.Getenv("GROQ_API_KEY"))
```

---

### A-4. Cerebras 프로바이더 추가

```go
// providers/cerebras.go
package providers

const defaultCerebrasURL = "https://api.cerebras.ai/v1"

func init() {
    Register("cerebras", func(baseURL, apiKey string) Provider {
        if baseURL == "" {
            baseURL = defaultCerebrasURL
        }
        return NewOpenAICompat("cerebras", baseURL, apiKey)
    })
}
```

---

### A-5. OpenRouter로 Claude 접근 (API 키 없이 테스트)

```go
// OpenRouter를 통해 Claude Sonnet 4.6 접근
// 사용자의 OpenRouter API 키만 필요
provider := providers.NewOpenAICompat(
    "openrouter",
    "https://openrouter.ai/api/v1",
    os.Getenv("OPENROUTER_API_KEY"),
)

req := providers.ChatRequest{
    Model: "anthropic/claude-sonnet-4-6",  // OpenRouter 모델 경로
    Messages: []providers.Message{
        {Role: "user", Content: "Hello"},
    },
}
```

---

### A-6. Vertex AI 서비스 계정 인증 (엔터프라이즈)

```go
// Vertex AI는 서비스 계정 JSON 기반 인증 사용
// GOOGLE_APPLICATION_CREDENTIALS 환경변수로 경로 지정
// 또는 GOOGLE_CLOUD_PROJECT + ADC(Application Default Credentials)

// Google AI Studio 호환 엔드포인트 (API 키 기반) — 더 간단
provider := providers.NewGoogle(
    "https://generativelanguage.googleapis.com/v1beta/openai",
    os.Getenv("GEMINI_API_KEY"),
)
```

---

## 참고 문헌 / References

### 공식 문서

- [Claude Code Authentication](https://code.claude.com/docs/en/authentication) — Anthropic
- [Claude Code Legal & Compliance](https://code.claude.com/docs/en/legal-and-compliance) — Anthropic (ToS 원문)
- [Claude Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Anthropic
- [Codex CLI Authentication](https://developers.openai.com/codex/auth) — OpenAI
- [Gemini CLI Terms of Service](https://google-gemini.github.io/gemini-cli/docs/tos-privacy.html) — Google
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) — Google
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Google
- [OpenRouter Documentation](https://openrouter.ai/docs/guides/overview/models) — OpenRouter
- [Groq Models](https://console.groq.com/docs/models) — Groq
- [DeepSeek API Docs](https://api-docs.deepseek.com/quick_start/pricing/) — DeepSeek

### 뉴스/분석

- [Anthropic Bans Third-Party OAuth Tools](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/) — The Register (2026-02-20)
- [Anthropic Cracks Down on Unauthorized Claude Usage](https://venturebeat.com/technology/anthropic-cracks-down-on-unauthorized-claude-usage-by-third-party-harnesses) — VentureBeat
- [Claude Code OAuth Token Policy](https://openclaw.rocks/blog/anthropic-oauth-ban) — OpenClaw Blog
- [OpenRouter Review 2026](https://aiagentslist.com/agents/openrouter) — AI Agents List

---

*이 문서는 2026-04-11 기준으로 작성되었습니다. 가격 및 정책은 변경될 수 있으므로 정기적인 업데이트가 필요합니다.*  
*This document was written as of 2026-04-11. Prices and policies are subject to change and require periodic updates.*
