# hanimo Competitive Landscape — 2026-04

> **각 서피스마다 "이미 존재하는 유사 제품"을 한 번에 정리**
> 작성일: 2026-04-11
> 조사 범위: 2026-04 시점 라이브 서비스 + 오픈소스 프로젝트
> 목적: hanimo가 **무엇을 피하고 / 훔치고 / 차별화**할지 명확화

---

## 0. TL;DR

- **① Code**: 레드 오션. Claude Code / Codex CLI / opencode / Aider 가 이미 성숙. hanimo의 자산 = **hashline_edit + 한국어 clarify-first + 14+ provider**.
- **② Core**: **LiteLLM** 이 사실상 표준 게이트웨이. hanimo Core는 "게이트웨이 + 에이전트 런타임" 합본이 차별점.
- **③ WebUI**: Lovable / v0 / Bolt.new 는 "앱 생성기"라 결이 다름. hanimo WebUI는 **CLI와 세션 공유하는 로컬 개발자 UI**라는 빈칸을 노림.
- **④ RAG**: Dify / RAGFlow / LlamaIndex / Haystack / Verba / Khoj 전부 존재. **hanimo-rag 계승 + 코드 특화 청킹 + Repo-map 하이브리드** 로 좁힘.
- **⑤ Community**: **🚨 직접 경쟁자 Moltbook 존재** (2026-01 런칭, 2026-03 Meta 인수). LMArena · Open LLM Leaderboard · Agent Arena · SWE-bench-Live 도 있음. hanimo만의 각도 = **한국어 로컬 · 코딩 에이전트 특화 · Human+Agent 공존 (Moltbook은 agent-only)**.

---

## 1. ① hanimo Code — 경쟁 매트릭스

### 1.1 주요 경쟁자 (2026-04 기준)

| 도구 | 스타/사용자 | 강점 | 약점 | 벤치 |
|---|---|---|---|---|
| **Claude Code** | 공식 (Anthropic) | SWE-bench 80.9%, Opus 4.6, Agent Teams, 1M context | 단일 provider 묶임, 구독 필요 | SWE-bench 80.9% |
| **Codex CLI** | 공식 (OpenAI) | Terminal-Bench 77.3%, 240+ tok/s, deterministic | OpenAI 종속, 컴팩션 약함 | Terminal-Bench 77.3% |
| **opencode** | 95K★ · 월 2.5M 유저 | **75+ provider**, Bubble Tea TUI, 무료 | 한국어 UX 약함 | — |
| **Aider** | 39K★ · 주 15B 토큰 | Git 통합 갑, precise edit, pair programming 문화 | TUI 투박, MCP 약함 | polyglot bench 자체 운영 |
| **Gemini CLI** | 공식 (Google) | 무료 할당량 큼, Gemini 3 Pro 연동 | 한국어 약함, 아키텍처 폐쇄 | — |
| **Cursor Agent** | 공식 (IDE) | IDE 딥 통합, 코드베이스 이해 | CLI 부재 | SWE-bench 상위권 |
| **Crush** | Charm | Bubble Tea 계열, LSP 통합 | 신생, 생태계 작음 | — |
| **Continue CLI** | 오픈소스 | IDE+CLI 브릿지, 커스텀 모델 | 에이전트 지능 평범 | — |
| **Goose** | Block Inc | MCP first, 확장 풍부 | 속도 느림 | — |
| **Kilo Code / Cline** | BYOM | 무료, LLM 비용만 | 안정성 변동 | — |

### 1.2 hanimo Code 의 자리

| 속성 | hanimo | 경쟁 중위값 | 위치 |
|---|:---:|:---:|---|
| Multi-provider | ✅ 14+ | ✅ (opencode 75+) | 중상 |
| **Hash-anchored edit** | ✅⭐ | ❌ | **유일** |
| **한국어 clarify-first** | ✅⭐ | ⚠️ | **유일** |
| MCP stdio+SSE | ✅ | ⚠️ | 상위 |
| 3-stage compaction | ✅ | ⚠️ | 상위 |
| TUI 품질 (Bubble Tea v2) | ✅ | ✅ | 동등 |
| Repo-map / Skill / Hooks / Subagent | ❌ | ✅ | **격차** |
| SWE-bench 공식 제출 | ❌ | ✅ | 격차 |
| Prompt caching | ❌ | ✅ | 격차 |

**전략**:
1. "한국어 + hashline + 로컬 우선" 으로 **니치 최상위**를 먼저 잡는다.
2. Repo-map · Skill · Hooks · Subagent 4종 세트로 기능 격차를 메운다 (MASTER-OVERVIEW Phase A 참조).
3. SWE-bench / Terminal-Bench 2.0 자체 제출 → Certified Tier 홍보 소재.

**참고 출처**:
- [Top 5 CLI coding agents in 2026 — Pinggy](https://pinggy.io/blog/top_cli_based_ai_coding_agents/)
- [Gemini CLI vs OpenCode vs Claude Code vs Aider — sanj.dev](https://sanj.dev/post/comparing-ai-cli-coding-assistants)
- [The 2026 Guide to Coding CLI Tools — Tembo](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Best AI Coding Agents for 2026 — Faros.ai](https://www.faros.ai/blog/best-ai-coding-agents-2026)
- [OpenCode vs Claude Code vs OpenAI Codex — ByteBridge](https://bytebridge.medium.com/opencode-vs-claude-code-vs-openai-codex-a-comprehensive-comparison-of-ai-coding-assistants-bd5078437c01)

---

## 2. ② hanimo Core — 경쟁 매트릭스

### 2.1 주요 경쟁자

| 도구 | 카테고리 | 역할 | 비고 |
|---|---|---|---|
| **LiteLLM** | 게이트웨이 | 100+ provider OpenAI 포맷 통일, load balance, cost track, 가드레일 | **사실상 표준** |
| **Ollama** | 로컬 런타임 | 로컬 모델 서빙, 모델 registry | 로컬 추론 기본값 |
| **vLLM** | 서버 런타임 | 고성능 inference, PagedAttention | 대형 배포 표준 |
| **LangServe** | 에이전트 배포 | LangChain 체인/에이전트를 REST로 | LangChain 종속 |
| **LocalAI** | 통합 서버 | OpenAI-호환 로컬 서버 | LiteLLM 보완 |
| **text-generation-inference** | HF | HF 모델 서빙 | HF 생태계 |
| **GPT4All** | 로컬 | 로컬 챗 서버 | 경량 |
| **OpenRouter** | SaaS | 300+ 모델 단일 키 | 상업 게이트웨이 |

> **결론**: "LLM 호출 게이트웨이" 자리는 LiteLLM이 이미 장악. hanimo Core는 **"게이트웨이 + 에이전트 세션/툴/MCP 런타임 통합"** 으로 차별화해야 함.

### 2.2 hanimo Core 의 자리

| 속성 | hanimo Core | LiteLLM | LangServe | Ollama |
|---|:---:|:---:|:---:|:---:|
| 멀티 프로바이더 호출 | ✅ | ✅✅ | ⚠️ | ❌ |
| **세션/SQLite 영속** | ✅ | ❌ | ⚠️ | ❌ |
| **Tool/MCP 런타임** | ✅ | ⚠️ | ✅ (LC 에코) | ❌ |
| **Repo-map · Compaction** | ✅(예정) | ❌ | ❌ | ❌ |
| 로드밸런싱/비용 추적 | ⚠️ | ✅✅ | ❌ | ❌ |
| 단일 Go 바이너리 | ✅ | ❌ (Python) | ❌ | ✅ |
| HTTP+SSE JSONL | ✅ | ✅ | ✅ | ⚠️ |

**전략**:
1. "**우리는 게이트웨이가 아니라 에이전트 엔진**" 포지셔닝. LiteLLM과 경쟁하지 않고 **선택적으로 내장** 가능.
2. Core의 USP = `세션 영속 + 툴/MCP + 한국어 intent + hashline` 을 HTTP로 노출.
3. Config에서 `llm_backend: litellm` 옵션 허용 → LiteLLM을 하부 게이트웨이로 포용.

**참고 출처**:
- [LiteLLM: An open-source gateway for unified LLM access — InfoWorld](https://www.infoworld.com/article/3975290/litellm-an-open-source-gateway-for-unified-llm-access.html)
- [GitHub — BerriAI/litellm](https://github.com/BerriAI/litellm)
- [LiteLLM Alternatives — Pomerium](https://www.pomerium.com/blog/litellm-alternatives)
- [Top 5 LiteLLM Alternatives in 2025 — DEV](https://dev.to/debmckinney/top-5-litellm-alternatives-in-2025-1pki)

---

## 3. ③ hanimo WebUI — 경쟁 매트릭스

### 3.1 두 가지 카테고리 구분

**A. "AI 앱 생성기" (vibe coding)** — 비개발자 지향. hanimo WebUI와 **결이 다름**.

| 도구 | 포지션 | 차별점 |
|---|---|---|
| **Lovable** | 대화로 풀스택 앱 생성 | Agent/Chat/Visual 3 모드, 풀스택 + 원클릭 배포 |
| **v0 (Vercel)** | React/Next.js UI 생성 | shadcn/ui 기본, 랜딩·대시보드 쾌속 |
| **Bolt.new** | WebContainer 브라우저 Node.js | 네트워크 지연 0, 즉시 기동 |
| **Replit Agent** | 풀 IDE + 배포 | 학습용, 초보자 친화 |
| **Windsurf** | AI IDE 웹 | Cascade 에이전트 |
| **Magic Patterns** | UI 컴포넌트 생성 | 디자인 시스템 강조 |
| **Mocha** | AI 앱 빌더 | 가볍고 빠름 |

**B. "개발자 로컬 코드베이스용 웹 에이전트 UI"** — hanimo WebUI의 진짜 이웃.

| 도구 | 포지션 | 차별점 |
|---|---|---|
| **Cursor** | AI 네이티브 IDE (데스크톱 앱) | 코드베이스 이해, Apply/Tab, 강력한 Agent |
| **Continue (web panel)** | VSCode+JetBrains 확장 + 웹 콘솔 | 커스텀 모델 연결 |
| **Open WebUI** | Ollama/LocalAI 용 로컬 챗 UI | 로컬 LLM 프론트, 코딩 특화 X |
| **LibreChat** | 오픈소스 ChatGPT 대체 UI | 다중 provider + 채팅 히스토리 |
| **Open Interpreter** | 로컬 실행 + UI | Python 중심, 터미널 UI 지향 |
| **AnythingLLM** | 로컬 RAG + 채팅 UI | 문서 기반 질답 |
| **opencode desktop** | opencode의 데스크톱 버전 | TUI와 동일 엔진 |

### 3.2 hanimo WebUI 의 자리

**핵심 빈칸**: "**로컬 CLI와 세션/상태를 실시간 공유**하는 브라우저 UI" — 로컬 개발자 지향.

| 기능 | Cursor | Continue | Lovable | Open WebUI | **hanimo WebUI** |
|---|:---:|:---:|:---:|:---:|:---:|
| 로컬 CLI와 동일 엔진 공유 | ⚠️ | ⚠️ | ❌ | ❌ | ✅⭐ |
| Monaco diff + hashline 가시화 | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| Repo-map 그래프 뷰 | ⚠️ | ❌ | ❌ | ❌ | ✅ (예정) |
| 한국어 i18n + 디자인 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ |
| shadcn 기반 (Modol 계승) | ❌ | ❌ | ✅ (v0) | ❌ | ✅ |
| 단일 바이너리 + 번들 | ❌ | ❌ | ❌ | ⚠️ | ✅ |

**전략**:
1. "앱 생성기" 카테고리(Lovable/v0/Bolt)와 **명시적으로 선 긋기**. hanimo WebUI는 **개발자 본인 코드베이스**를 편집.
2. "**Cursor의 오픈·로컬·한국어 대안**" 포지션.
3. CRA 폐기 → Next.js 15 + shadcn (hanimo-webui 디자인 계승) 로 업계 표준 트렌드 합류.

**참고 출처**:
- [15 Best Vibe Coding Tools — index.dev](https://www.index.dev/blog/vibe-coding-tools)
- [Cursor vs Bolt vs Lovable 2026 — Lovable](https://lovable.dev/guides/cursor-vs-bolt-vs-lovable-comparison)
- [Choosing your AI prototyping stack — Medium](https://annaarteeva.medium.com/choosing-your-ai-prototyping-stack-lovable-v0-bolt-replit-cursor-magic-patterns-compared-9a5194f163e9)
- [12 Best Bolt.new Alternatives in 2026 — Superblocks](https://www.superblocks.com/blog/bolt-new-alternative)

---

## 4. ④ hanimo RAG — 경쟁 매트릭스

### 4.1 주요 경쟁자 (2026 OSS RAG 지형도)

| 도구 | 핵심 특기 | 사용 포인트 | hanimo와의 관계 |
|---|---|---|---|
| **LangChain / LangGraph** | 오케스트레이션 프레임워크 | 체인·에이전트 조립 | 참고 추상만 |
| **LlamaIndex** | 데이터 인제스천 인덱싱 | 구조화 접근 | 청킹 전략 참고 |
| **Haystack** | 프로덕션 파이프라인 | 대규모 NLP | 파이프라인 디자인 참고 |
| **Dify** | RAG + 에이전트 + 앱 관리 올인원 | 비기술자 친화 | 별개 카테고리 |
| **RAGFlow** | 딥 문서 이해 (PDF 표·레이아웃) | 문서 중심 | PDF 처리 레버리지 고려 |
| **Verba (Weaviate)** | 사용자 친화 UI out-of-box | PoC 친화 | UI 아이디어 참고 |
| **Khoj** | "제2의 두뇌", Obsidian/Emacs 연동 | 개인 지식 | 철학 유사 |
| **QAnything** | 기업 문서 QA | 중국어권 강함 | — |
| **Cognita** | 모듈형 프로덕션 RAG | 경량 | — |
| **Mem0** | 장기 메모리 레이어 | 에이전트 메모리 | hanimo knowledge store와 유사 |
| **pgvector + custom** | 직접 구축 | 완전 통제 | hanimo-rag 기반 |

### 4.2 hanimo RAG 의 자리

hanimo-rag를 계승하되, **"코드 중심 하이브리드 RAG"** 로 포지셔닝.

| 속성 | LangChain | Dify | RAGFlow | Verba | Khoj | **hanimo RAG** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 범용 문서 RAG | ✅ | ✅ | ✅✅ | ✅ | ✅ | ✅ (계승) |
| **언어 인식 청킹 (tree-sitter)** | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅⭐ |
| **Repo-map × RAG 하이브리드** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅⭐ |
| CLI 한 줄 통합 (`hanimo rag up`) | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| 코딩 에이전트 세션과 공유 | ❌ | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| 한국어 토크나이즈 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ✅ (Modol 계승) |

**전략**:
1. "범용 RAG"에서 싸우지 않는다. **"코드 에이전트 전용 RAG"** 로 한정.
2. 3-way search (BM25 + dense vector + 심볼 그래프) 를 킬링 기능화.
3. 인덱스가 Core와 동일 프로세스에서 소비되는 것 자체가 차별화 (`rag_search` 도구).

**참고 출처**:
- [15 Best Open-Source RAG Frameworks in 2026 — Firecrawl](https://www.firecrawl.dev/blog/best-open-source-rag-frameworks)
- [8 Open Source RAG Projects Compared — Meursault](https://liduos.com/en/ai-develope-tools-series-1-open-source-rag-projects.html)
- [Top 10 RAG Frameworks on GitHub (Jan 2026) — Medium](https://florinelchis.medium.com/top-10-rag-frameworks-on-github-by-stars-january-2026-e6edff1e0d91)
- [15 Best Open-Source RAG Frameworks for Developers in 2026 — Apidog](https://apidog.com/blog/best-open-source-rag-frameworks/)

---

## 5. ⑤ hanimo Community — 경쟁 매트릭스 🚨

### 5.1 ⚠️ 직접 경쟁자: Moltbook

> **반드시 알아야 할 사실**: "AI 에이전트가 유저인 커뮤니티" 컨셉은 이미 **Moltbook** 이 2026-01-28 에 런칭했고, **2026-03-10 Meta가 인수**해 Superintelligence Labs에 편입됨.

| 항목 | Moltbook | **hanimo Community (제안)** |
|---|---|---|
| 런칭 | 2026-01-28 | 계획 (Week 10 α) |
| 모회사 | Meta (2026-03 인수) | 개인 / OSS |
| 시민권 | **Agent-only** + 인간은 관람자 | **Human + Agent 공존** ⭐ |
| 구조 | Reddit 유사 (Submolt 서브레딧) | 벤치·스킬·뉴스·라이브러리·토론 멀티 모듈 |
| 접속 | 4시간마다 API로 에이전트가 방문 | hanimo Code/WebUI에서 직결 |
| 초점 | 범용 (크립토/오늘배움 등) | **코딩 에이전트 + AI 피트니스** (벤치 중심) |
| 규모 | 250만+ agent, 20만 human 검증 | 0 (신생) |
| 철학 | "AI들의 문화" 관찰 | "AI 단련소, 인간-AI 연대" |

**차별화 포인트 4가지**:
1. **Human-Agent 공존** — Moltbook은 agent-only (인간은 읽기만). hanimo는 사람도 1등 시민.
2. **코딩/벤치 특화** — 범용 포럼이 아니라 "AI 피트니스 + 라이브러리 체육관".
3. **로컬 우선** — Moltbook은 Meta 중앙화. hanimo는 **각자 로컬 인스턴스** 운영 가능 (연합).
4. **한국어 네이티브** — Moltbook은 영어 중심.

### 5.2 기타 경쟁 / 인접 플랫폼

| 도구 | 카테고리 | 강점 | hanimo와 관계 |
|---|---|---|---|
| **LMArena** (구 Chatbot Arena) | 크라우드 엘로 랭킹 | 공식 Elo 표준, Agent/Search/Coding Arena, 2026-04 Opus 4.6 1504 Elo | 리더보드 표준 참조 |
| **Open LLM Leaderboard** (HF) | 벤치 리더보드 | 자동 평가 파이프라인 | 평가 자동화 벤치마크 |
| **SWE-bench Live** (MS NeurIPS 2025 D&B) | 코딩 에이전트 벤치 | 월별 업데이트, 1,890 tasks, 오염 방지, Windows/Multi-Language 확장 | **직접 차용** 가능 |
| **Terminal-Bench 2.0** (Stanford/Laude) | 터미널 에이전트 벤치 | 2025-11 릴리스, Gemini 3.1 Pro 78.4%, GPT-5.3-Codex 77.3%, Opus 4.6 74.7% | **Certified Tier 근거** |
| **Papers with Code** | 논문·벤치·코드 연결 | 학술 표준 | 뉴스와이어 데이터 소스 |
| **Hugging Face Hub** | 모델·데이터셋·Space | 생태계 허브 | 뉴스와이어 데이터 소스 |
| **Aider polyglot leaderboard** | 코딩 에이전트 자체 벤치 | Aider 포지셔닝 도구 | 벤치 참조 |
| **Agent Arena (LMArena 산하)** | 에이전트 대전 | Arena 프레임 위 | 형식 참고 |
| **OpenClaw Social** | AI 에이전트 커뮤니티 | 소규모 실험 | 레퍼런스 |

### 5.3 hanimo Community 의 자리

```
                       [Agent-only]
                            │
           Moltbook ◀───────┼──────▶ (비어있음)
                            │
                            │
      [Topic: 범용]─────────┼─────────[Topic: 코딩/벤치]
                            │
           LMArena ◀────────┼────────▶ hanimo Community ⭐
           Agent Arena      │          (여기!)
                            │
                       [Human+Agent 공존]
```

**빈칸 = Human + Agent 공존 × 코딩/벤치 중심 × 로컬/연합 × 한국어**.

**리스크 & 대응**:
- 🔴 **Moltbook + Meta** 이 동일 컨셉을 확장하면 선점 경쟁 어려움 → 차별 축 4개를 초반부터 강하게.
- 🟡 **벤치 비용** → 로컬 Ollama 기반 smoke 벤치부터 / 공인 벤치 결과는 인용만.
- 🔴 **컨텐츠 모더레이션** → Critic 에이전트 + 사람 투표 hybrid.
- 🟡 **법적 크롤링** → arXiv/HN/GitHub trending 공식 API만 사용.

**전략**:
1. **"Moltbook의 개발자·코딩 특화 로컬 버전"** 포지션으로 시작 → 빠른 이해.
2. 초기 타깃 = "hanimo 사용자 + 한국어 AI 개발자 커뮤니티" (범위 제한).
3. Phase 4 α는 **에이전트 2~3기 + 10명 내외 dogfooding** 수준으로 소규모 검증.
4. 벤치는 **SWE-bench Live / Terminal-Bench 2.0 의 공식 결과를 임베드**. 자체 벤치는 "hanimo Smoke" 하나만.

**참고 출처**:
- [Moltbook — Wikipedia](https://en.wikipedia.org/wiki/Moltbook)
- [What is Moltbook? The Social Network for AI Agents — DigitalOcean](https://www.digitalocean.com/resources/articles/what-is-moltbook)
- [Humans welcome to observe: This social network is for AI agents only — NBC News](https://www.nbcnews.com/tech/tech-news/ai-agents-social-media-platform-moltbook-rcna256738)
- [AI Bots Built Their Own Social Network With 32,000 Members — Technology.org](https://www.technology.org/2026/02/02/ai-bots-built-their-own-social-network-with-32000-members-now-things-are-getting-strange/)
- [LMArena — Grokipedia](https://grokipedia.com/page/lmarena)
- [Arena Leaderboard — Hugging Face](https://huggingface.co/spaces/lmarena-ai/arena-leaderboard)
- [What is LMArena? Community Benchmark — Skywork](https://skywork.ai/blog/lmarena-community-benchmark-large-language-models/)
- [SWE-bench Goes Live — OpenReview](https://openreview.net/forum?id=OGWkr7gXka)
- [SWE-bench Live Leaderboard](https://swe-bench-live.github.io/)
- [Terminal-Bench 2.0 Leaderboard (2026) — Morph](https://www.morphllm.com/terminal-bench-2)
- [8 benchmarks shaping the next generation of AI agents — AI Native Dev](https://ainativedev.io/news/8-benchmarks-shaping-the-next-generation-of-ai-agents)
- [OpenClaw Social](https://openclawsocial.org/index.html)

---

## 6. 종합 포지셔닝 맵

```
                     많은 기능 / 상업적 성숙
                            │
            Claude Code ▲   │   ▲ Cursor
            Codex CLI       │     Lovable
                            │     Moltbook (Meta)
                            │     LMArena
  ─────────── 단일 provider ┼ 다중 provider ───────────
            Aider ▲          │    ▲ opencode
            Crush            │      Continue
            Gemini CLI       │      hanimo ⭐
                            │      LiteLLM
                            │
                       오픈소스 / 개인
```

### hanimo 포지션 (한 문장)
> "**14+ provider 지원 + hash-anchored 정밀 편집 + 한국어 네이티브 + 로컬 우선**의 **단일 바이너리 코딩 에이전트**로, **Modol 계보(UI/RAG) 계승** + **Human-Agent 공존 코딩 커뮤니티**까지 포함한 개인 AI 개발 플랫폼."

---

## 7. 공통 교훈 (각 서피스 공통 인사이트)

1. **"올인원" 도구들은 이미 넘침**. hanimo의 승부처는 **깊이/정밀도** (hashline, 한국어, 로컬) 이지 **폭** 이 아님.
2. **LiteLLM / Ollama / Claude Code / LMArena** 같은 표준은 **싸우지 말고 엎고/품어라**. Core가 LiteLLM을 내부 게이트웨이로 선택 가능하게, Community가 LMArena 결과를 임베드 가능하게.
3. **Moltbook이 먼저 자리 잡았다** → Community는 "개발자·코딩·로컬·한국어" 4각 차별 축으로 좁혀야 함.
4. **Modol 계승이 사실상 유일한 스토리텔링 자산**. 내러티브를 플랫폼 전반에 일관.
5. **벤치에 찍히지 않으면 존재하지 않는다 (2026 기준)**. Phase A 완료 후 SWE-bench Live / Terminal-Bench 2.0 에 공식 제출을 목표 KPI로.

---

## 8. 다음 액션 체크리스트

- [ ] SWE-bench Live / Terminal-Bench 2.0 공식 repo 분석 → 제출 파이프라인 초안
- [ ] LiteLLM 내장 시 아키텍처 결정 (`llm_backend: litellm` 옵션 설계)
- [ ] Moltbook 가입해서 agent 포스팅 패턴 실제 관찰 (정탐)
- [ ] hanimo-rag 언어 인식 청킹 PoC (tree-sitter Go/TS)
- [ ] hanimo WebUI 경쟁 매트릭스를 WebUI 디자인 페이지에 표시 (`/compare` 라우트, 마케팅)
- [ ] Community α 전에 "Human-Agent 공존 헌장" 문서 작성
- [ ] Certified Model Tier JSON에 Terminal-Bench 2.0 공식 점수 필드 추가

---

## 9. 이 문서와 관련 문서

```
COMPETITIVE-LANDSCAPE (본 문서) — 시장/경쟁 전체
    │
    ├─→ PLATFORM-PLAN v2 — 플랫폼 전략 (서피스 5개)
    │       │
    │       └─→ MASTER-OVERVIEW — hanimo Code 상세
    │               ├─→ enhancement-plan
    │               ├─→ research-survey (도구별 테크 인사이트)
    │               └─→ sync-tracker (TECHAI_CODE)
    │
    └─→ (예정) COMMUNITY-DESIGN — Moltbook 대응 상세 설계
        (예정) BENCH-STRATEGY — SWE-bench/Terminal-Bench 제출 가이드
```

---

_Last updated: 2026-04-11 · 조사 기준 2026-04 라이브 상태_
