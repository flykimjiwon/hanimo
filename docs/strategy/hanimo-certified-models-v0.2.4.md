# hanimo Certified Model Strategy v0.2.4

> **작성일**: 2026-04-11
> **베이스 조사 문서**:
> - [cloud-api-integration.md](../research/cloud-api-integration.md) (540줄)
> - [ollama-models-survey.md](../research/ollama-models-survey.md) (516줄)
> **관련 로드맵**: [v0.2-v0.4-improvement-plan.md](../roadmap/v0.2-v0.4-improvement-plan.md)

---

## Executive Summary

hanimo는 **모든 LLM을 호환**하려는 이상주의 대신, **매 버전마다 N개 모델을 완벽하게 지원**하는 실용주의 전략을 채택한다.

> "14 프로바이더 호환" → **"10 models, battle-tested, 100% certified"**

각 Certified 모델은:
- 시스템 프롬프트 최적화
- Tool calling format 지정
- 컨텍스트 윈도우 자동 관리
- Temperature/top_p 튜닝
- 릴리즈 전 20개 시나리오 자동 테스트 통과

---

## 1. Certified Model Matrix (v0.2.4 최종)

### 🥇 Tier 1 — Recommended (완전 최적화)

| # | Model | Provider | Context | License | Use Case | Cost |
|---|-------|----------|---------|---------|----------|------|
| 1 | **qwen3-coder:30b** | Ollama (로컬) | 256K | Apache 2.0 | 🏆 코딩 에이전트 (로컬 최강) | 무료 |
| 2 | **gpt-oss:20b** | Ollama, Novita, OpenRouter | 128K | Apache 2.0 | 범용 에이전트, o3-mini급 | 무료/저가 |
| 3 | **gpt-oss-120b** | Novita, OpenRouter | 128K | Apache 2.0 | 클라우드 주력, 빠른 추론 | $0.2/$0.8 per MTok |
| 4 | **gemma-4-31b-it** | Novita, Ollama | 262K | Gemma License | 긴 컨텍스트, 다국어 | $0.14/$0.4 per MTok |
| 5 | **deepseek-v3** | DeepSeek, Novita | 128K | MIT | 최고 코딩 품질, 저렴 | $0.14/$0.28 per MTok |
| 6 | **claude-sonnet-4-6** | Anthropic | **1M** | Proprietary | 프리미엄, 1M 컨텍스트 | $3/$15 per MTok |
| 7 | **gemini-2.5-flash** | Google | 1M | Proprietary | 무료 티어, 빠름 | 무료/$0.15/$0.6 |

### 🥈 Tier 2 — Supported (잘 동작, 보조)

| # | Model | Provider | Context | License | Use Case |
|---|-------|----------|---------|---------|----------|
| 8 | **qwen3:8b** | Ollama (로컬) | 32K | Apache 2.0 | 경량 로컬 채팅 |
| 9 | **devstral:24b** | Ollama (로컬) | 128K | Apache 2.0 | SWE-Bench 1위 오픈소스 |
| 10 | **llama-3.3-70b** | Groq, Together | 128K | Llama License | 고속 추론 (Groq LPU) |
| 11 | **claude-haiku-4-5** | Anthropic | 200K | Proprietary | 저가 프리미엄 |
| 12 | **gemini-2.5-pro** | Google | 1M | Proprietary | 1M 컨텍스트 프리미엄 |

### 🥉 Tier 3 — Experimental (동작만 보장)

비인증 모델. 사용 시 경고 메시지 표시. "Best effort" 품질.

- qwen2.5-coder:32b, mistral-large, gpt-4o, codellama 등 나머지 전부
- 시스템 프롬프트: generic fallback
- Tool format: openai (default)
- 테스트되지 않음

### 🚫 Excluded (사용 금지)

| Model | 이유 |
|-------|------|
| **codestral** | Non-Production License — 상업 사용 불가 |
| **create-react-app** (도구) | 2023년부터 deprecated |
| **Claude Pro/Max subscription 직접 연결** | Anthropic 2026-04-04 공식 차단 |
| **Vertex AI API 키 인증** | IAM만 지원 |

---

## 2. Model Profile Structure

### 2.1 Go 구조 정의

```go
// internal/llm/profiles.go

package llm

type Tier int

const (
    TierRecommended Tier = iota + 1  // Tier 1
    TierSupported                     // Tier 2
    TierExperimental                  // Tier 3
    TierExcluded                      // 사용 금지
)

type ToolFormat string

const (
    ToolFormatOpenAI   ToolFormat = "openai"    // GPT, Qwen, Gemma, DeepSeek
    ToolFormatAnthropic ToolFormat = "anthropic" // Claude
    ToolFormatGenAI    ToolFormat = "genai"     // Gemini native
    ToolFormatNone     ToolFormat = "none"      // Chat only
)

type ModelProfile struct {
    // Identity
    ID       string  // canonical ID used by hanimo
    Aliases  []string // alternate names across providers
    Family   string  // "qwen3", "gpt-oss", "gemma", "claude", "gemini", "deepseek", "llama"
    Tier     Tier
    License  string

    // Capacity
    ContextWindow int
    MaxOutput     int
    SupportsVision bool
    SupportsJSON   bool
    SupportsTools  bool
    SupportsSystemRole bool

    // Tuning (optimized per model)
    Temperature    float64
    TopP           float64
    ToolFormat     ToolFormat
    ToolCallRetries int

    // System prompt customization
    PrefersShortPrompts bool   // 작은 모델
    NeedsStricterJSON   bool   // JSON 강제용
    SystemPromptVariant string // "default", "short", "chat-only", "claude", "gemini"

    // Providers offering this model
    AvailableOn []ProviderRoute

    // Metadata
    BestFor     []string // "chat", "coding", "planning", "reasoning", "vision"
    ReleaseDate string   // "2026-03-28"
    Notes       string
}

type ProviderRoute struct {
    Provider string  // "ollama", "novita", "openrouter", "anthropic", "google", ...
    ModelID  string  // provider-specific ID (e.g., "google/gemma-4-31b-it")
    BaseURL  string
    Pricing  Pricing
}

type Pricing struct {
    InputPerMTok  float64
    OutputPerMTok float64
}
```

### 2.2 Profile 예시 — qwen3-coder:30b

```go
"qwen3-coder:30b": {
    ID:      "qwen3-coder:30b",
    Aliases: []string{"qwen3-coder-30b", "qwen/qwen3-coder-30b"},
    Family:  "qwen3",
    Tier:    TierRecommended,
    License: "Apache 2.0",

    ContextWindow: 262144,
    MaxOutput:     8192,
    SupportsTools: true,
    SupportsJSON:  true,
    SupportsSystemRole: true,

    Temperature: 0.2, // 코딩용 낮게
    TopP:        0.95,
    ToolFormat:  ToolFormatOpenAI,
    ToolCallRetries: 1,

    SystemPromptVariant: "default",
    BestFor: []string{"coding", "planning"},
    ReleaseDate: "2025-09-15",

    AvailableOn: []ProviderRoute{
        {
            Provider: "ollama",
            ModelID:  "qwen3-coder:30b",
            BaseURL:  "http://localhost:11434/v1",
            Pricing:  Pricing{0, 0},
        },
        {
            Provider: "novita",
            ModelID:  "qwen/qwen3-coder-30b",
            BaseURL:  "https://api.novita.ai/v3/openai",
            Pricing:  Pricing{0.08, 0.30},
        },
    },

    Notes: "Best open-source coding model. SWE-Bench RL trained. 256K context. 19GB Q4.",
},
```

### 2.3 Profile 예시 — claude-sonnet-4-6

```go
"claude-sonnet-4-6": {
    ID:      "claude-sonnet-4-6",
    Aliases: []string{"claude-sonnet-4"},
    Family:  "claude",
    Tier:    TierRecommended,
    License: "Proprietary",

    ContextWindow: 1000000, // 1M (2026-04 확장)
    MaxOutput:     8192,
    SupportsVision: true,
    SupportsTools:  true,
    SupportsJSON:   true,
    SupportsSystemRole: true,

    Temperature: 0.3,
    TopP:        1.0,
    ToolFormat:  ToolFormatAnthropic,
    ToolCallRetries: 1,

    SystemPromptVariant: "claude",
    BestFor: []string{"coding", "reasoning", "planning", "vision"},
    ReleaseDate: "2026-03-01",

    AvailableOn: []ProviderRoute{
        {
            Provider: "anthropic",
            ModelID:  "claude-sonnet-4-6",
            BaseURL:  "https://api.anthropic.com",
            Pricing:  Pricing{3.0, 15.0},
        },
    },

    Notes: "Premium quality. 1M context as of 2026-04. Best for complex multi-file refactoring.",
},
```

---

## 3. System Prompt Variants

모델 패밀리별로 다른 시스템 프롬프트를 사용한다.

### 3.1 Variants

| Variant | 대상 | 특징 |
|---------|------|------|
| `default` | Qwen, GPT-OSS, Gemma, DeepSeek | OpenAI 스타일 |
| `short` | qwen3:8b, gemma-3-12b (작은 모델) | 축약된 프롬프트 (토큰 절약) |
| `chat-only` | llama3.1:8b 등 tool 못 쓰는 모델 | 도구 없이 대화만 |
| `claude` | Claude 계열 | XML-style thinking, Claude 특유 패턴 |
| `gemini` | Gemini 계열 | 간결한 지시, Google 스타일 |

### 3.2 Variant 선택 로직

```go
func SystemPromptForModel(mode Mode, profile ModelProfile) string {
    variant := profile.SystemPromptVariant
    if variant == "" {
        variant = "default"
    }

    switch variant {
    case "short":
        return shortSystemPrompt(mode)
    case "chat-only":
        return chatOnlySystemPrompt(mode)
    case "claude":
        return claudeSystemPrompt(mode)
    case "gemini":
        return geminiSystemPrompt(mode)
    default:
        return defaultSystemPrompt(mode)
    }
}
```

---

## 4. Auth Methods Summary

| Provider | Auth Type | hanimo 사용 가능 | 비고 |
|----------|-----------|:---:|------|
| **Ollama** (로컬) | 없음 | ✅ | localhost, 인증 불필요 |
| **Anthropic** | API Key (`sk-ant-...`) | ✅ | 공식 Go SDK |
| **OpenAI** | API Key (`sk-...`) | ✅ | go-openai 사용 중 |
| **Google Gemini** | API Key (AI Studio) | ✅ | 무료 티어 有, OpenAI-compat 있음 |
| **Google Gemini CLI** | Google OAuth | ⚠️ | 1000 req/day 무료, 통합 복잡 |
| **Novita** | API Key (`sk-...`) | ✅ | OpenAI-compat |
| **OpenRouter** | API Key (`sk-or-...`) | ✅ | OpenAI-compat, 무료 모델 多 |
| **DeepSeek** | API Key | ✅ | OpenAI-compat, 저가 |
| **Groq** | API Key | ✅ | 초고속 (LPU) |
| **Together** | API Key | ✅ | 오픈소스 호스팅 |
| **Fireworks** | API Key | ✅ | 고속 추론 |
| **Mistral** | API Key | ✅ | 유럽 옵션 |
| **Claude Pro/Max 구독** | OAuth (sk-ant-oat01) | ❌ | **2026-04-04 공식 차단** |
| **ChatGPT Plus** | OpenAI OAuth | ❌ | API 비용 별개 |
| **Vertex AI** | IAM/ADC | ❌ | API 키 미지원 |

---

## 5. 구현 계획 (v0.2.4)

### Phase A — Profile 인프라 (Day 1)

- [ ] `internal/llm/profiles.go` 생성
  - ModelProfile 구조 정의
  - ToolFormat enum
  - Tier enum
- [ ] `internal/llm/certified.go` 생성
  - Tier 1/2/3 모델 12개 전부 Profile 작성
  - AvailableOn routing 정보
- [ ] `internal/llm/prompts_variants.go` 생성
  - default, short, chat-only, claude, gemini 5개 변형
- [ ] 기존 `capabilities.go`를 profiles.go로 마이그레이션
  - 하위 호환 유지

### Phase B — Provider Integration (Day 2)

- [ ] `internal/llm/providers/anthropic.go` 실제 구현
  - `github.com/anthropics/anthropic-sdk-go` 사용
  - tool use 지원
  - streaming
- [ ] `internal/llm/providers/google.go` 실제 구현
  - `google.golang.org/genai` 사용
  - OpenAI-compat fallback 옵션
- [ ] 각 프로바이더의 ListModels() 구현
  - Ollama: /api/tags
  - OpenAI-compat: /v1/models
  - Anthropic: hardcoded list
  - Google: hardcoded list
- [ ] `hanimo --list-models` 커맨드 추가
  - Tier별 색상 구분 출력

### Phase C — System Integration (Day 3)

- [ ] 모델 선택 시 자동으로 Profile 로드
- [ ] Profile 기반 시스템 프롬프트 주입
- [ ] Profile 기반 Temperature/TopP 적용
- [ ] Context window 체크 (초과 시 compaction 트리거)
- [ ] 비인증 모델 사용 시 경고 메시지
- [ ] `/model` 슬래시 커맨드 개선
  - Tier 표시
  - 스위치 시 profile 자동 적용

### Phase D — Testing (Day 4)

- [ ] `test/certified/` 디렉터리 생성
- [ ] 20개 시나리오 yaml 작성
  - 간단한 대화
  - 파일 읽기/쓰기
  - shell_exec
  - git_status
  - /plan 사용
  - /auto 사용
  - ASK_USER 처리
  - 긴 컨텍스트 (50K+)
  - 한국어
  - 에러 복구
- [ ] `make test-certified-models` 타겟 추가
- [ ] CI 통합 (GitHub Actions 선택)

### Phase E — Documentation (Day 4)

- [ ] README.md에 Certified Models 섹션 추가
- [ ] `docs/models/` 폴더에 각 모델별 문서
  - 성능 특성
  - 알려진 이슈
  - 튜닝 노트
- [ ] CHANGELOG 업데이트

---

## 6. Release Process

### 6.1 새 모델 추가 시

1. 모델 출시 감지 (수동 or 자동 모니터링)
2. `internal/llm/certified.go`에 Profile 임시 추가 (Tier Experimental)
3. 20개 시나리오 테스트 실행
4. 통과율 ≥ 90% → Tier 2 승격
5. 통과율 ≥ 95% + 2주 안정성 → Tier 1 승격
6. 릴리즈 노트 작성
7. 버전 태그 + GitHub Release

### 6.2 정기 재검증

- 매 hanimo 릴리즈마다 전체 Certified 모델 재테스트
- Deprecated 모델 감지 (API 퇴역 통보)
- 새 모델 업데이트 (qwen3 → qwen4 등)

---

## 7. 프로바이더별 통합 상세

### 7.1 Anthropic (Claude 4.6)

```bash
go get github.com/anthropics/anthropic-sdk-go@latest
```

```go
// internal/llm/providers/anthropic.go
import "github.com/anthropics/anthropic-sdk-go"

type AnthropicProvider struct {
    client *anthropic.Client
}

func NewAnthropic(apiKey string) Provider {
    return &AnthropicProvider{
        client: anthropic.NewClient(
            anthropic.WithAPIKey(apiKey),
        ),
    }
}

// Messages.Stream() 사용
// tool_use content block → hanimo ToolCall 변환
```

### 7.2 Google Gemini

옵션 1 (권장): OpenAI-compat 사용
```go
base_url: "https://generativelanguage.googleapis.com/v1beta/openai/"
// 기존 go-openai 재사용, 변경 최소
```

옵션 2: Native SDK
```bash
go get google.golang.org/genai
```

### 7.3 Ollama (로컬)

현재 구현 그대로 사용. `/api/tags`로 사용 가능 모델 자동 감지.

### 7.4 OpenRouter

무료 모델 폴백으로 활용:
```go
// Tier 1 모델 실패 시 OpenRouter 무료 모델로 자동 fallback
fallback_providers: ["openrouter:gemma-2-9b-it:free"]
```

---

## 8. 사용자 경험

### 8.1 `hanimo --list-models`

```
hanimo certified models (v0.2.4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 TIER 1 — Recommended (Battle-tested)

  🏠 Local (Ollama)
  ├─ qwen3-coder:30b      256K   Coding    ⚡ 19GB  Apache 2.0
  ├─ gpt-oss:20b          128K   General   ⚡ 14GB  Apache 2.0
  ├─ devstral:24b         128K   SWE       ⚡ 14GB  Apache 2.0

  ☁️  Cloud
  ├─ gpt-oss-120b         128K   General   $0.2    Novita, OR
  ├─ gemma-4-31b-it       262K   Long ctx  $0.14   Novita
  ├─ deepseek-v3          128K   Coding    $0.14   DeepSeek
  ├─ claude-sonnet-4-6    1M     Premium   $3      Anthropic
  └─ gemini-2.5-flash     1M     Fast      Free    Google

🥈 TIER 2 — Supported

  qwen3:8b, llama-3.3-70b, claude-haiku-4-5, gemini-2.5-pro, ...

🥉 TIER 3 — Experimental

  Any other model (use at own risk)
  $ hanimo -p <provider> -m <model>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Use: hanimo -m <model>
     or /model in TUI
Docs: https://hanimo.dev/models
```

### 8.2 비인증 모델 사용 시

```
$ hanimo -m some-unknown-model

⚠ This model is not in the v0.2.4 certified list.
It may work, but:
  - System prompt may not be optimized
  - Tool calling format may differ
  - Context window detection may fail

Continue anyway? [y/N]
```

---

## 9. 다음 단계 (Day 1 아침 Action Items)

### 🌅 내일 일어나면 즉시 할 일

1. **frontend/ 쓰레기 삭제**
   ```bash
   cd ~/Desktop/kimjiwon/hanimo
   git rm -r frontend/
   git commit -m "chore: remove accidental create-react-app scaffold"
   ```

2. **v0.2.4 Phase A 시작**
   - `internal/llm/profiles.go` 생성
   - Tier 1 모델 7개 Profile 작성
   - 단계별 커밋

3. **Claude 4.6 SDK 추가**
   ```bash
   go get github.com/anthropics/anthropic-sdk-go@latest
   ```

4. **Gemini SDK 추가**
   ```bash
   go get google.golang.org/genai
   ```

### 📋 1주일 목표

- v0.2.4 전체 완료
- 20 시나리오 테스트 통과
- Tier 1 모델 7개 실제 동작 확인
- README 업데이트
- GitHub Release v0.2.4 발행

### 🎯 2주일 목표

- `hanimo.dev` 랜딩 페이지 배포
- v0.2.4 블로그 포스트 ("hanimo-certified: why we limit to 10 models")
- Reddit r/golang, Hacker News 포스팅
- 첫 외부 기여자 유치

---

## 10. 전략적 차별화

### 시장 포지셔닝

| 제품 | 프로바이더 | 전략 | 문제점 |
|------|-----------|------|--------|
| **Claude Code** | Anthropic only | 벤더 종속 | 선택권 없음 |
| **Cursor** | OpenAI + Anthropic | 2개 한정 | 폐쇄적 |
| **Aider** | 다수 | "뭐든 호환" | 품질 불확실 |
| **Continue** | 다수 | "뭐든 호환" | 불안정 |
| **hanimo (v0.2.4+)** | **12 certified** | **완벽 + 선택권** | **최고의 균형** |

### 마케팅 메시지

> **Before**: "14 providers supported"
> **After**: **"12 models. Battle-tested. Certified. Open source."**

- 각 모델 페이지 (hanimo.dev/models/qwen3-coder)
- 테스트 결과 공개
- 성능 벤치마크 투명성
- 새 모델 추가 공식 프로세스

---

## 참고 문서

- [cloud-api-integration.md](../research/cloud-api-integration.md) — API 상세
- [ollama-models-survey.md](../research/ollama-models-survey.md) — Ollama 모델 전수 조사
- [v0.2-v0.4-improvement-plan.md](../roadmap/v0.2-v0.4-improvement-plan.md) — 전체 로드맵
- [hanimo-to-techaicode-plan.md](../porting/hanimo-to-techaicode-plan.md) — TECHAI_CODE 역포팅

---

**결론**: hanimo는 v0.2.4에서 Certified Model 시스템을 구축하여, **"오픈소스를 위한 AI 코딩 에이전트"** 슬로건을 구체화한다. 이는 Claude Code/Cursor/Aider 어느 것과도 다른, hanimo만의 포지셔닝이다.
