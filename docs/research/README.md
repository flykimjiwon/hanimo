# hanimo Research Index & Master Synthesis

> 작성일: 2026-04-11
> 상태: 리서치 세션 산출물 인덱스 + 종합 정리
> 목적: 다른 세션의 작업물과 병합 가능한 비중복 리서치 묶음

---

## 📚 Document Index

이 디렉토리는 **두 개의 병렬 세션**에서 생성된 리서치 문서를 모읍니다. 병합 시 중복이 최소화되도록 각 문서는 서로 다른 축을 담당합니다.

| # | 문서 | 크기 | 축 | 출처 |
|---|---|---|---|---|
| 1a | [`ollama-models-survey.md`](./ollama-models-survey.md) | 28 KB / 516줄 | Ollama 모델 서베이 (요약형) | **다른 세션** |
| 1b | [`ollama-models-catalog.md`](./ollama-models-catalog.md) | 44 KB / 1011줄 | Ollama 모델 카탈로그 (상세형, 35+ 모델, Tier 1-3 + Avoid) | 이 세션 |
| 2 | [`cloud-models-and-auth.md`](./cloud-models-and-auth.md) | 44 KB / 1133줄 | 클라우드 모델 + **CLI Auth 피기백 타당성** (ToS 중심) | 이 세션 |
| 3 | [`cloud-api-integration.md`](./cloud-api-integration.md) | 22 KB / 540줄 | 클라우드 API Go 통합 (엔드포인트/헤더/SDK 레벨) | **다른 세션** |
| 4 | [`certified-model-system-plan.md`](./certified-model-system-plan.md) | 42 KB / 1022줄 | v0.3.0 Certified Model System 구현 플랜 (15섹션 + 부록) | 이 세션 |
| 5 | [`hanimo-vs-techaicode-port-analysis.md`](./hanimo-vs-techaicode-port-analysis.md) | 19 KB / 436줄 | 형제 레포 양방향 포팅 기회 + `hanimo-core` 추출 후보 | 이 세션 |
| 6 | [`open-model-harness-tactics.md`](./open-model-harness-tactics.md) | 51 KB / 1273줄 | Aider/Cline/Continue/Hermes에서 마이닝한 **32개 하네스 전술 (7 카테고리)** | 이 세션 |
| 7 | [`go-ecosystem-libraries.md`](./go-ecosystem-libraries.md) | 56 KB / 1478줄 | **17개 영역 Go 라이브러리** 평가 (Adopt/Evaluate/Skip 판정) | 이 세션 |
| 보너스 | [`reference-tools-survey-2026-04.md`](./reference-tools-survey-2026-04.md) | — / 313줄 | 참고 툴 서베이 | **다른 세션** |

**합계 (전부 완료)**: **320 KB / 7,743 줄 / 9 문서**

### Ollama 문서 2개 병합 가이드

두 Ollama 문서는 **서로 다른 깊이**로 같은 주제를 다룹니다 — 양쪽 다 유지 권장:

| 속성 | `ollama-models-survey.md` (다른 세션) | `ollama-models-catalog.md` (이 세션) |
|---|---|---|
| 길이 | 516줄 | 1011줄 |
| 깊이 | 개요형 서베이 | 상세 카탈로그 (모델별 source URL, caveats) |
| 커버리지 | 주요 모델 | 35+ 모델 × 4 Tier |
| **Tier 1 권장** | — | **qwen3-coder:30b, qwen2.5-coder:32b, devstral-small-2, gemma4:31b, gpt-oss:20b, llama3.3:70b, deepseek-v3, qwen3:30b, qwen3.5:27b, devstral-24b** (10개) |
| Avoid 리스트 | — | 10개 (CodeLlama, DeepSeek-Coder v1, CodeGemma, Mistral 7B, LLaVA, Phi-3, Gemma 2 등) |
| 에이전틱 caveats | — | Qwen2.5-Coder tool calling unreliable (GitHub #7051/#180), Qwen3.5 Ollama #14493 |
| 라이선스 변경 노트 | — | Gemma 4 (Apache 2.0, 2026-04-02), DeepSeek-V3 (MIT, 2025-03-24), GPT-OSS (첫 OpenAI open weight) |

**병합 권장**: `catalog.md`를 정식 레퍼런스로, `survey.md`를 간이 요약으로 역할 분리.

---

## 🎯 Cross-Document Synthesis

### 1. 컨셉 — "Honey Harness"

하니모 = **"하네스(harness) + 모돌(우리집 강아지)"** 의 줄임말. 요즘 유행하는 "LLM 하네스" 컨셉에 브랜드 정체성을 겹친 포지셔닝:

> **"The Harness for Open-Source & Hybrid Coding with LLMs"**

**4대 기둥**:
1. **Priming** — 사전정보 풍부화로 작은 모델도 고사양처럼
2. **Budgeting** — 재귀 컴팩션·청킹으로 컨텍스트 초과 견디기
3. **Guarding** — 툴 호출 검증·재시도·포맷 폴백으로 소형모델 실수 복구
4. **Routing** — 서브에이전트 격리 + intent detection으로 모컨텍스트 보호

---

### 2. 핵심 결론 — "무한 호환 → Certified 전환"

사용자 지시: *"매번 업데이트에서 지원하는 모델을 강제하는 것도 방법이겠다. 이미 최적화된 상태로 쓰는 것이지."*

세 문서가 이 전략을 서로 다른 각도로 뒷받침:

| 문서 | 기여 |
|---|---|
| `ollama-models-survey.md` | Tier 1/2/3 후보 오픈 모델 **14-20개 명단 + 벤치마크** |
| `cloud-models-and-auth.md` | 클라우드 모델 Tier 1 후보 + **ToS 리스크 경고** |
| `certified-model-system-plan.md` | 실제 `ModelProfile` Go 구조체·YAML 스키마·5-Phase 마이그레이션 |
| `hanimo-vs-techaicode-port-analysis.md` | 기존 `capabilities.go` 19개 모델의 이관 경로 |

**v0.3.0 Tier 1 후보 — 두 문서 교차 확인**

| 출처 | 모델 | 유형 |
|---|---|---|
| Plan §12 (cert system) | qwen3:8b | Local |
| Plan §12 | qwen3:32b | Local |
| Plan §12 + Ollama catalog | **qwen3-coder:30b** ⭐ 기본값 | Local |
| Plan §12 | gemma-4-26b-a4b-it | Cloud (Novita) |
| Plan §12 | gpt-4o / gpt-4o-mini | Cloud |
| Plan §12 | claude-sonnet-4 | Cloud |
| Plan §12 | deepseek-chat | Cloud |
| Plan §12 | gemini-2.5-flash | Cloud |
| Ollama catalog | qwen2.5-coder:32b | Local |
| Ollama catalog | devstral-small-2 (24B) | Local |
| Ollama catalog | gemma4:31b (Apache 2.0 since 2026-04-02) | Local |
| Ollama catalog | gpt-oss:20b | Local |
| Ollama catalog | llama3.3:70b | Local |
| Ollama catalog | qwen3:30b (thinking mode) | Local |
| Ollama catalog | qwen3.5:27b (최신, SWE-bench 72.4%) | Local |

**하니모 v0.3.0 기본 모델 + Fallback Chain**:
```
qwen3-coder:30b  →  qwen2.5-coder:32b  →  devstral-small-2  →  qwen3:8b  →  gpt-oss:20b
```

**즉시 지원 가능 (v0.3.0 릴리즈일)**: qwen3-coder:30b, qwen2.5-coder:32b, qwen3:8b, gpt-oss:20b
**v0.3.1 추가 예정**: gemma4:31b, devstral-small-2

**주의**: Qwen2.5-Coder는 Ollama에서 tool calling이 불안정 (GitHub #7051, #180) — hanimo에 prompt 기반 폴백 필요. Catalog 문서 "에이전틱 사용 시 주의사항" 섹션 참조.

---

### 3. 핵심 결론 — **CLI Auth 피기백은 전부 ToS 차단** ⚠️

`cloud-models-and-auth.md` 최대 발견:

| CLI | 기술적 | 법적 | 결론 |
|---|---|---|---|
| Claude Code | ❌ macOS Keychain 암호화 | ❌ **2026-01-09 서버측 차단 + 2026-02-20 법적 업데이트** | 불가 |
| Codex CLI | ✅ `~/.codex/auth.json` JWT 읽음 | ❌ OpenAI ToS 토큰 이전 금지 | 불가 |
| Gemini CLI | ✅ `~/.gemini/oauth_creds.json` 읽음 | ❌ Gemini CLI ToS 명시 금지 | 불가 |

**중요 히스토리**: OpenCode / OpenClaw 등 써드파티 하네스가 **2026-01-09 이후 Anthropic 서버측 차단으로 일괄 중단**. 하니모가 이 경로를 택하면 동일 운명.

**안전한 경로만 허용**:
- `ANTHROPIC_API_KEY` (platform.claude.com)
- `OPENAI_API_KEY` (platform.openai.com)
- `GEMINI_API_KEY` (aistudio.google.com)
- OAuth 토큰은 공식 Anthropic의 `CLAUDE_CODE_OAUTH_TOKEN`만 (Bearer 방식, 1년짜리)

**Directive for v0.3.0**:
> 하니모는 "자체 크레덴셜 수집형 하네스" 설계를 고수한다. 써드파티 CLI 크레덴셜 reuse는 시도하지 않는다. ToS를 준수해 Anthropic/OpenAI/Google의 차단 리스트에 오르는 것을 회피.

---

### 4. 핵심 결론 — 통합 우선순위 (실행 가능 순서)

**Phase 1 — 즉시 (1-2주)**
1. **Anthropic 네이티브 프로바이더 수정** — 현재 `anthropic.go`가 OpenAI-compat stub. `/v1/messages` 네이티브로 재작성 (`cloud-api-integration.md` Part 1)
2. **`.hanimoignore` + `.gitignore` 파서** — 현재 하드코딩 skip map만 존재
3. **토큰 기반 컴팩션 트리거** — `len(messages) < 40` → `ContextWindow * 0.65` (Plan 문서 §5)
4. **gitinfo 패키지 포팅** — TECHAI_CODE에서 복사 (`port-analysis.md` §1.1)
5. **Context warning levels** — TECHAI에서 복사 (`port-analysis.md` §1.2)

**Phase 2 — Priming (2-3주)**
1. `hanimo init` — `.hanimo/project.md` 자동 생성
2. Repo-map (AST 기반 랭킹) — `go-ecosystem-libraries.md` 결과로 백엔드 결정
3. Model Profile 시스템 — YAML 프로파일 + `_generic` 폴백 (Plan 문서 §2)
4. JIT 컨텍스트 주입 — 사용자 입력 파싱 → 관련 파일 선주입
5. autoDream 메모리 추출

**Phase 3 — Guarding (1-2주)**
1. 모델 probe (첫 호출로 포맷 판정)
2. Tool-call 검증/재시도 루프
3. Edit-format 자동 스위칭 (Aider 스타일: whole/diff/udiff/search-replace)
4. Degraded mode fallback

**Phase 4 — Routing (2주)**
1. Subagent 3종: Explore / Verify / Review
2. 읽기 도구 병렬 실행 (goroutine)
3. 훅 시스템
4. MCP lazy loading

**Phase 5 — 확장성**
1. Groq / DeepSeek / Cerebras / Bedrock 신규 프로바이더
2. 에이전트 매니페스트 (hanimo-webui 이식)
3. 세션 fork/replay, 헤드리스 모드

---

### 5. 차별화 — 아무도 안 하는 것 6가지

| 차별점 | 경쟁자 중 동일기능 | 어느 문서에 근거 |
|---|---|---|
| Go-native + 오픈모델 1급 + Priming 파이프라인 + UI 블록 구분 | 없음 | 모든 문서 |
| `.hanimoignore` + 3단계 context 분류 (read_never/read_only/context_free) | 없음 | README 상위 요약 |
| 파일탐색 자동 drill-down (500 cap → 서브트리 청킹) | 없음 | README 상위 요약 |
| 툴 결과 **사전** 청킹 (삽입 전) | 없음 | README 상위 요약 |
| Hash-anchored 편집 (hashline_edit) | 없음 | `port-analysis.md` |
| Certified-per-release 모델 보증 + promotion/demotion 룰 | 없음 (Aider가 per-model config만 가짐) | `certified-model-system-plan.md` §9 |

---

### 6. UI 재설계 — 질문/답변 시각 구분

사용자 요구: *"UI적으로도 질문과 답변 영역을 배경색 등으로 명확히 구분"*

**Chat 뷰포트 재설계 블록**:
```
╭─ 👤 You ────────────────────────╮
│ (배경: 은은한 Amber tint #2a1f0a) │
│ 사용자 메시지 본문                 │
╰──────────────────────────────────╯

  ╭─ 🍯 Hanimo ────────────────────╮
  │ (배경: 딥 Honey tint #1a1608)   │
  │ 어시스턴트 응답 본문              │
  ╰──────────────────────────────────╯

┌─ 🔧 tool: grep_search ────────┐
│ (회색 tint, 접힘 가능)           │
└─────────────────────────────────┘
```

- 좌/우 비대칭 배치 (iMessage 스타일)
- 5개 테마 전부 Q/A 배경쌍 정의 (honey/ocean/dracula/nord/forest)
- 긴 툴 결과는 접힘 블록
- 상단 컨텍스트 게이지: `[██████░░░░] 62% of 32K` (TECHAI context warning level 이식, 70/80/90 경고)

---

### 7. 브랜딩 — "HANIMO CODE"

현재 상태 (다른 세션 작업 결과):
- 마스코트 왼쪽 (Honey Gold) + HANIMO 블록 (그라데이션) + 구분선 + CODE 블록 (Lavender 그라데이션)
- 로고는 유지, 구분선 시안 A 선택됨

**추가 제안** (Plan 문서에서 파생):
- `hanimo --list-models` 출력 포맷에도 tier 이모지 일관성 (🥇🥈🥉⚠️)
- README "Supported Models" 섹션을 `<!-- BEGIN:MODELS -->` 마커로 자동 생성

---

## 🗺️ 병합 가이드 (다른 세션과)

다른 세션이 이미 만든 파일:
- `docs/roadmap/v0.2-v0.4-improvement-plan.md` (이전 세션)
- `docs/research/cloud-api-integration.md` (이 디렉토리)
- `docs/branding/hanimo-brand-design.html`
- `docs/ecosystem/ROADMAP.md`
- `docs/landing/` (hanimo.dev 랜딩 페이지)
- `docs/porting/hanimo-to-techaicode-plan.md`

**중복/교차 가능성**:
| 이 세션 | 다른 세션 | 병합 방식 |
|---|---|---|
| `cloud-models-and-auth.md` (ToS/모델 카탈로그 중심) | `cloud-api-integration.md` (Go SDK/엔드포인트 중심) | **두 문서 유지** — 서로 보완. 인덱스에서 역할 명시 |
| `certified-model-system-plan.md` | `v0.2-v0.4-improvement-plan.md` | **인증 시스템 플랜이 개선 플랜의 Phase 2로 편입** |
| `hanimo-vs-techaicode-port-analysis.md` | `porting/hanimo-to-techaicode-plan.md` | **양방향 병합** — 이 세션은 양방향, 다른 세션은 단방향 |
| `ollama-models-survey.md` | (없음) | **이 세션만 보유** — Tier 분류 기준 문서로 등록 |

---

## ✅ 다음 실행 체크리스트 (우선순위)

### 🔥 Critical (내일 아침 바로)
1. [ ] `frontend/` 삭제 (다른 세션에서 create-react-app 쓰레기 생성됨)
2. [ ] Anthropic 네이티브 프로바이더 수정 (`/v1/messages`) — 현재 stub, `cloud-api-integration.md` Part 1
3. [ ] **429 자동 재시도 + 사용자 친화 메시지** — `cenkalti/backoff v4` 도입
4. [ ] **`.hanimoignore` / `.gitignore` 파서** — `go-git/gitignore` 사용 (negation/nested 지원)
5. [ ] **MCP 클라이언트 업그레이드** — `internal/mcp/client.go`가 `2024-11-05` 하드코딩, `mark3labs/mcp-go` 교체

### ⚡ Important (이번 주)
6. [ ] **`list_tree` 도구 신설** — `saracen/walker` 사용 (10배 빠름)
7. [ ] **프로젝트 경계 인식** — hanimo 자기 레포 안에서 실행 감지 → 경고
8. [ ] **토큰 기반 컴팩션 트리거** — `pkoukk/tiktoken-go` 도입 (neutral deps, zero-cost)
9. [ ] **gitinfo 패키지 포팅** — TECHAI `/internal/gitinfo/` 262 LOC 복사
10. [ ] **Context warning levels UI** — TECHAI `/internal/ui/context.go` 54 LOC 복사 (70/80/90%)
11. [ ] **log/slog 전환** — 현재 log 패키지 → stdlib slog (Go 1.26+, JSON handler for `--debug`)
12. [ ] **Strip reasoning tags** (`<think>`) — DeepSeek R1/QwQ CoT flood 방지 (Aider 패턴)

### 🎯 Phase 1 — Certified System (1-2주)
10. [ ] `ModelProfile` Go 구조체 + YAML 스키마 (Plan §1, §2)
11. [ ] `internal/llm/profiles/*.yaml` 엠베드 + `~/.hanimo/models/*.yaml` 오버라이드
12. [ ] `hanimo --list-models` 커맨드
13. [ ] 기존 19개 모델 `capabilities.go` → 새 프로파일로 마이그레이션 (백워드 호환)
14. [ ] Tier 1 9개 모델 프로파일 작성

### 📋 Phase 2 — Priming (2-3주)
15. [ ] `hanimo init` — `.hanimo/project.md` 자동 생성
16. [ ] Repo-map (LSP 또는 tree-sitter 기반)
17. [ ] JIT 컨텍스트 주입 (사용자 입력 파싱)
18. [ ] autoDream 메모리 추출

### 🛡️ Phase 3 — Guarding (1-2주)
19. [ ] 모델 probe + 포맷 폴백 (JSON/XML/ReAct)
20. [ ] Tool-call 검증/재시도 루프 (max 3)
21. [ ] Edit-format 자동 스위칭 (whole/diff/search-replace)

### 🎭 Phase 4 — Routing (2주)
22. [ ] Subagent 3종 (Explore/Verify/Review)
23. [ ] 안전 도구 goroutine 병렬 실행
24. [ ] 훅 시스템 (`~/.hanimo/hooks/`)
25. [ ] MCP lazy loading

### 🚀 Phase 5 — 확장
26. [ ] Groq / DeepSeek / Cerebras / Codestral 프로바이더
27. [ ] 에이전트 매니페스트 (`~/.hanimo/agents/*/agent.yaml`)
28. [ ] 세션 fork/replay
29. [ ] 헤드리스 모드 (JSON stdin/stdout)

---

## 🔬 리서치 방법론

- **6개 병렬 에이전트**가 비중복 축으로 동시 조사
- **Explore / document-specialist / planner** 서브에이전트 타입 혼용
- **WebFetch + context7 + 소스 마이닝** (GitHub raw URLs)
- **교차검증**: 3개 이상 소스에서 확인된 사실만 "권장"으로 표기
- **ToS/법적 리스크**: 4개 일차 출처(공식 정책 페이지 + 뉴스 기사 2건) 교차 확인

---

## 🧪 Harness Tactics 요약 (문서 6)

`open-model-harness-tactics.md` — Aider/Cline/Continue.dev/Hermes-Function-Calling 소스 마이닝. **32개 전술, 7 카테고리, 1273줄**.

### 🏗️ 3-Layer Defense Architecture

프로덕션급 오픈모델 하네스가 모두 공유하는 3-층 방어 구조 (합성 인사이트):

```
┌─ Pre-send Layer ──────────────────────────────────┐
│ 모델 family 감지 → 올바른 chat template 적용      │
│ + 행동 플래그 (lazy/CoT-strip/temperature)         │
└────────────────────────────────────────────────────┘
                     ↓ LLM 호출
┌─ Post-receive Layer ──────────────────────────────┐
│ CoT 스트립 → XML/JSON 툴 호출 파싱 (폴백)          │
│ → 스키마 검증 → 오류 주입 → 최대 3회 복구          │
└────────────────────────────────────────────────────┘
                     ↓ 툴 실행 결과
┌─ Loop Layer ──────────────────────────────────────┐
│ Max iterations + 동일인자 루프 감지 + 컴팩션       │
└────────────────────────────────────────────────────┘
```

**하니모 현재 상태**: Layer 3만 존재. **Layer 1, 2는 거의 비어있음 — 이것이 "작은 모델에서 안 돌아가는" 진짜 원인**.

### Top 12 MUST-HAVE 전술 (v0.3.0)

| # | 전술 | 출처 | 해결하는 문제 |
|---|---|---|---|
| 1 | **Model Capability Registry** | Aider `models.py` + Continue.dev | 모델별 template/edit format/tool mode/CoT 태그 중앙 관리 |
| 2 | **Strip Reasoning Tags** (`<think>`) | Aider `remove_reasoning` | DeepSeek R1/QwQ가 수천 토큰 CoT를 파서에 flood |
| 3 | **XML Tool Call Parser + JSON Fallback** | Hermes `utils.py` | 모델이 `<tool_call>{...}</tool_call>` 이상 포맷 내보냄 |
| 4 | **Schema-Validated Repair Loop** (max 3) | Hermes `functioncall.py` | 잘못된 인자 타입/필드 누락 — 구체 오류 주입 재시도 |
| 5 | **Chat Template Engine** | Continue.dev `chat.ts` + `autodetect.ts` | 템플릿 틀리면 모델이 지시 무시 (ChatML/Llama3/Gemma) |
| 6 | **Lazy/Overeager Correction Prompts** | Aider `base_coder.py` | `# ... existing code ...` 절단·미요청 파일 편집 방지 |
| 7 | **Reminder Injection 매 3턴** | Aider `base_coder.py:975-1009` | 작은 모델은 대화 중간에 system prompt 규칙 망각 |
| 8 | **Head+Tail Output Truncation** | Aider + Cline | shell 출력이 컨텍스트 flood — 앞 2/3 + 뒤 1/3 유지 |
| 9 | **Tool Result Role Injection** | Hermes `sys_prompt.yml` | `<|im_start|>tool` vs `<|start_header_id|>tool` 모델별 일치 |
| 10 | **Same-Tool-Same-Args Loop Detector** | 합성 패턴 | `run_shell("ls")` 무한 반복 방지 |
| 11 | **Context Prune From Top** | Continue.dev `index.ts` | 오래된 메시지부터 drop; system prompt 절대 보존 |
| 12 | **Sequential Tool Execution** | Hermes `sys_prompt.yml` | 오픈모델이 병렬 요청받으면 malformed 출력 |

**실행 포인트**: 전술 1(레지스트리) 부터 시작. 나머지 11개는 전부 레지스트리에 의존. 이게 없으면 하드코딩 조건문이 코드베이스 곳곳에 흩어짐.

---

## 📦 Go Ecosystem Libraries 요약 (문서 7)

`go-ecosystem-libraries.md` — 17개 영역 평가. **1478줄, 56KB**.

### Tier 1 — Adopt Immediately (8개)

| 순위 | 라이브러리 | 버전 | 라이선스 | 임팩트 |
|---|---|---|---|---|
| 1 | **pkoukk/tiktoken-go** | v0.1.8 | MIT | OpenAI 모든 모델 토큰 카운팅. **`dlclark/regexp2` 이미 indirect dep으로 있어서 신규 deps 0** |
| 2 | **bmatcuk/doublestar** | v4 | MIT | `**` glob 필터링, 10 LOC 통합 |
| 3 | **cenkalti/backoff** | v4.3.0 | MIT | 429/529 재시도 — 업계 표준 |
| 4 | **mark3labs/mcp-go** | v0.45.0 | MIT | **hanimo MCP 클라이언트가 `2024-11-05`에 멈춰있음. mcp-go는 `2025-11-25` 지원** |
| 5 | **saracen/walker** | v0.1.4 | MIT | **10배 빠른 파일 워킹** (133ms vs 1437ms for 100K 파일) |
| 6 | **log/slog** | stdlib | — | Zero deps, JSON 핸들러, `--debug`/세션 replay용 |
| 7 | **zalando/go-keyring** | v0.2.8 | MIT | 보안 API 키 저장 |
| 8 | **aymanbagabas/go-udiff** | v0.4.0 | BSD/MIT | 편집 승인 TUI용 unified diff |

### 🚨 Critical 발견사항

1. **MCP 클라이언트 outdated** — `internal/mcp/client.go`가 `protocolVersion: "2024-11-05"` 하드코딩. 현재 스펙은 `2025-11-25`. **mark3labs/mcp-go가 backward-compat 처리함** → 교체 권장

2. **Anthropic 로컬 토크나이저 없음** — Go용 Claude 3+ 토크나이저 미공개. 공식 경로는 `POST /v1/messages/count_tokens` API (무료, rate-limited). 로컬 폴백은 `len(runes)/3` 휴리스틱만 가능

3. **sqlite-vec 호환 불가** — `asg017/sqlite-vec-go-bindings`는 CGO `mattn/go-sqlite3`만 지원. 하니모의 `modernc.org/sqlite`와 비호환. 전환 시 pure-Go 빌드 보증 깨짐 → **embedding은 chromem-go 검토**

4. **양대 interactive prompt 라이브러리 둘 다 사망** — `AlecAivazis/survey` 2024-04 아카이브 (maintainer가 bubbletea 추천). `manifoldco/promptui` 2021-10 이후 dormant. **setup wizard도 bubbletea로** — 신규 의존성 불필요

5. **tiktoken-go가 하니모에 신규 deps 0** — 이 점 결정적. `dlclark/regexp2`가 `charmbracelet/chroma`의 indirect dep으로 이미 존재

6. **go-git의 gitignore 패키지가 유일하게 negation + nested 제대로 처리** — `sabhiram/go-gitignore`는 기능 부족, `denormal/go-gitignore`는 6년 dormant

### 버전 노트
- hanimo Go 1.26.1 → `log/slog.MultiHandler` (Go 1.26+), `slog.DiscardHandler` 사용 가능
- Tier 1 전부 pure Go (no CGO) → **pure-Go 빌드 보증 유지**
- `smacker/go-tree-sitter`는 CGO 필요 → 바이너리 배포 전략 결정 후 도입

---

## 📌 메모

- 이 리서치는 **플랜 전용**. 코드 변경 없음.
- 다른 병렬 세션(Claude Code v2.1.87)에서 실제 구현 작업이 진행 중이며, 이 문서는 그 세션의 최종 병합 입력으로 사용됨
- 모든 문서는 한국어+영어 혼용 (bilingual), 코드 샘플은 Go, 테이블/표 중심
- 버전: v0.3.0 타겟, 현재 구현 상태는 v0.2.1
