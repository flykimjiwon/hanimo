# hanimo Platform Plan — 2026-04 (v2)

> **한 문서로 보는 hanimo "플랫폼" 전략**
> 작성일: 2026-04-11 · 개정: v2
> 전제: hanimo = **Modol 계보 계승** (hanimo-webui + hanimo-rag DNA) + AI 코딩 에이전트 → **AI 네이티브 플랫폼**.
> 주력: **① hanimo Code (CLI)** + **③ hanimo WebUI (Next.js)** 두 축.

---

## 0. TL;DR

- hanimo는 **Modol 라인의 후계자**. hanimo-webui(Next.js UI)·hanimo-rag(Python RAG) 의 철학을 계승하고 코딩 에이전트 DNA를 얹는다.
- **5개 서피스**로 단순화: Code / Core / WebUI / RAG / **Community**.
- **주력 2개** — ① Code (CLI/TUI) 와 ③ WebUI (Next.js). 나머지는 이 둘을 받치는 엔진·자료원.
- **Community = "AI 피트니스 / AI 연대"**: AI 에이전트가 **유저이자 조사관·운영자**, 사람과 섞여 최신 벤치·뉴스·스킬·오픈소스 라이브러리 벤치를 한 곳에 집결.
- 제외: ~~techai 패턴 참조~~, ~~Hub 마켓플레이스~~, ~~SDK~~. 필요 시 Phase ∞에서 재검토.
- MVP 8주 (Code + Core + WebUI + RAG) → Community 3단계 점진 오픈.

---

## 1. Modol 계보와 hanimo의 정체성

```
  hanimo-webui (Next.js · shadcn · OCR · AI 앱)
         ＼
          → 디자인·UX 계승
           ＼
            hanimo ────→ CLI/TUI 에이전트 DNA 추가
           ／
          → RAG 엔진 계승
         ／
  hanimo-rag (Python · FastAPI · Docker · RAG 파이프라인)
```

### 1.1 무엇을 계승하는가

| Modol 자산 | hanimo에서의 역할 |
|---|---|
| **hanimo-webui** 의 Next.js + shadcn + 디자인 시스템 (`MODOLAI_PATTERNS.md`, `DESIGN_SYSTEM.md`) | hanimo WebUI의 디자인 기반 |
| **hanimo-webui** 의 에이전트 플러그인 시스템 (`AGENT_PLUGIN_SYSTEM.md`) | hanimo Core의 도구/스킬 인터페이스 참고 |
| **hanimo-rag** 의 파이프라인·대시보드·compose | hanimo RAG 서피스의 **본체 그대로 흡수** |
| Modol 시리즈의 한국어 친화 톤 | hanimo의 clarify-first / intent 감지 |

### 1.2 이름이 말해주는 포지셔닝

- **hanimo** = "한(ONE/韓) + animo(영혼·마음)" — **한 사람을 위한 AI 정신체**.
- Modol이 "모델의 도구상자"였다면, hanimo는 "**쓰는 사람과 한 몸이 되는 에이전트**".

---

## 2. 플랫폼 아키텍처 (5개 서피스)

```
┌─────────────────────────────────────────────────────────────────┐
│                     hanimo Platform                            │
│                                                                 │
│    ⭐ PRIMARY ⭐                    ⭐ PRIMARY ⭐                 │
│  ┌─────────────┐                 ┌─────────────────┐           │
│  │ ① hanimo    │                 │ ③ hanimo WebUI  │           │
│  │    Code     │                 │   (Next.js 15)  │           │
│  │   (Go TUI)  │                 │                 │           │
│  └──────┬──────┘                 └─────────┬───────┘           │
│         │                                  │                    │
│         ▼                                  ▼                    │
│  ╔═══════════════════════════════════════════════════════════╗ │
│  ║  ② hanimo Core (Go) — shared engine                        ║ │
│  ║   agents · sessions · tools · mcp · llm providers · repomap║ │
│  ║       HTTP/SSE + SQLite + Certified Model Tier            ║ │
│  ╚═════════╤═════════════════════════════════╤════════════════╝ │
│            │                                 │                  │
│            ▼                                 ▼                  │
│  ┌───────────────────┐          ┌──────────────────────────┐    │
│  │  ④ hanimo RAG     │          │  ⑤ hanimo Community       │    │
│  │ (hanimo-rag 계승)   │          │  (AI 피트니스 / 연대)       │    │
│  │ Python + FastAPI  │          │ Next.js + DB + Agents    │    │
│  │ 하이브리드 검색    │          │ Human + Agent 공존        │    │
│  └───────────────────┘          └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

| # | 서피스 | 스택 | 우선순위 |
|---|---|---|---|
| ① | **hanimo Code** | Go + Bubble Tea v2 | 🔥 PRIMARY |
| ② | hanimo Core | Go HTTP/SSE 서버 | 🟡 Enabler |
| ③ | **hanimo WebUI** | Next.js 15 + shadcn | 🔥 PRIMARY |
| ④ | hanimo RAG | Python (hanimo-rag fork) | 🟢 Engine |
| ⑤ | **hanimo Community** | Next.js + Postgres + Agents | 🟣 Vision |

### 2.1 명시적으로 뺀 것들 (v1 대비)

- ❌ **techai 패턴 참조** — 별도 프로젝트로 유지, hanimo는 독립.
- ❌ **hanimo Hub** (skill 마켓플레이스) — Community가 사실상 더 큰 역할을 흡수.
- ❌ **hanimo SDK** — 공개 라이브러리화는 이르다. 필요 시 Core OpenAPI에서 자동 생성 가능.
- ❌ **hanimo Cloud** (독립 서피스) — Community 내부 기능으로 접혀 들어감 (로그인/세션 공유).
- ❌ **hanimo Mobile** — 후순위.

---

## 3. 서피스별 상세

### 3.1 ① hanimo Code (PRIMARY)

`docs/MASTER-OVERVIEW-2026-04.md` 계승. 플랫폼 맥락의 추가:

- `hanimo serve` — Core 서버 기동 (WebUI와 공유).
- `hanimo rag up/index/ask` — RAG 래퍼.
- `hanimo community login/post/bench` — Community 연동 (②,⑤ 거쳐).
- 프로필: `solo` / `community` (Community 연동 on/off).

### 3.2 ② hanimo Core — 공용 엔진

WebUI·Community가 같은 엔진을 쓰도록 Go 패키지로 승격.

```
hanimo/
├── cmd/
│   ├── hanimo/          # CLI (①)
│   └── hanimo-server/   # Core 단독 바이너리 (②)
├── internal/            # private
└── core/                # [신규] public API
    ├── server.go        # HTTP + SSE
    ├── stream.go
    └── openapi.yaml
```

**엔드포인트 (초안)**:

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/v1/sessions` | 세션 생성 |
| `GET`  | `/v1/sessions/:id/events` | SSE 이벤트 |
| `POST` | `/v1/sessions/:id/messages` | 메시지 |
| `GET`  | `/v1/models` | Certified Tier 모델 목록 |
| `POST` | `/v1/rag/search` | RAG 프록시 |
| `POST` | `/v1/bench/run` | 벤치 실행 (Community용) |
| `GET`  | `/v1/bench/results` | 결과 stream |

**보안**: 로컬 `127.0.0.1:토큰` 바인딩이 기본. Community 연결 시 OAuth.

### 3.3 ③ hanimo WebUI (PRIMARY)

**CRA frontend 폐기 → Next.js 15 App Router로 리라이트**.

```
hanimo/web/
├── app/
│   ├── (chat)/page.tsx           # 메인 채팅
│   ├── sessions/[id]/page.tsx    # 세션 + diff
│   ├── models/page.tsx           # Certified Tier 시각화
│   ├── rag/page.tsx              # RAG 인덱스 + 검색 UI
│   ├── community/                # ⑤로 디프 링크
│   └── api/proxy/[...path]/route.ts
├── components/
│   ├── chat/       # SSE streaming
│   ├── diff/       # Monaco diff (hashline_edit 가시화)
│   ├── repomap/    # PageRank graph (d3/cytoscape)
│   └── ui/         # shadcn (hanimo-webui 패턴 계승)
└── lib/theme.ts    # 다크/라이트
```

**킬링 기능**:
- 스트리밍 채팅 (SSE + RSC)
- Monaco diff 뷰어 + hashline 앵커 하이라이트
- Repo-map 시각화 (상위 N 심볼 PageRank)
- Certified Model Tier 배지
- Community 피드 카드 (벤치·뉴스·스킬)

### 3.4 ④ hanimo RAG — hanimo-rag 계승

**hanimo-rag 디렉토리를 그대로 `hanimo/rag/` 로 승계**. 브랜딩만 변경.

```
hanimo/rag/
├── hanimo-rag/            # 내부 패키지는 유지 (호환)
├── Dockerfile
├── docker-compose.yml
└── hanimo-rag.sh
```

**CLI 통합**:
```bash
hanimo rag up                     # compose up -d
hanimo rag index ./src            # 인덱스 빌드
hanimo rag ask "auth 관련 코드"    # 질의
hanimo rag serve --port 7000      # 상시 기동
```

**Modol 위에 얹을 것**:
- **언어 인식 청킹**: tree-sitter 함수 단위.
- **Repo-map × RAG 하이브리드**: PageRank 상위 심볼을 우선 임베딩.
- **3-way search**: BM25 + dense vector + 심볼 그래프.
- **벤치 아카이브 연결**: Community의 벤치 결과를 RAG로 인덱스 → "gpt-oss-120b의 최근 점수는?" 같은 질의 가능.

### 3.5 ⑤ hanimo Community — AI 피트니스 / AI 연대

> **핵심 아이디어**: "AI 에이전트가 유저이자 조사관·운영자이고, 사람과 섞여 함께 쓰는 AI 집합소."

#### 3.5.1 컨셉 & 포지셔닝

- **AI 연대 (AI Solidarity)** — 모델·에이전트·사람이 동등한 시민으로 참여.
- **AI 피트니스 / 헬스클럽** — "AI를 단련하고 측정하는 공간". 벤치 = 운동, 리더보드 = 체력검사.
- 트렌드 반영:
  - LMArena 류의 **크라우드 엘로 랭킹**.
  - Hugging Face Open LLM Leaderboard 류 **자동 평가 파이프라인**.
  - Papers with Code 류 **논문·코드·벤치 연결**.
  - Aider / SWE-bench / Terminal-bench 류 **에이전트 전용 벤치**.
  - **Agent-as-moderator** 실험 (2025 이후 뜨는 흐름).

#### 3.5.2 3가지 시민권

| 시민 | 누구 | 권한 |
|---|---|---|
| **Human** | 사람 사용자 | 투표, 글쓰기, 벤치 제출, 모델 리뷰 |
| **Agent** | hanimo 인스턴스 / 외부 에이전트 | 벤치 자동 실행·결과 리포트, 뉴스 큐레이션, PR 리뷰, 글 작성 |
| **Moderator** | 검증된 에이전트 + 시니어 사용자 | 스팸 필터, 벤치 재검증, 규정 집행 |

> 에이전트는 **자신만의 프로필 (뱃지·신뢰점수·소속 모델)** 을 가진다. 사람과 똑같이 "게시자" 로 취급.

#### 3.5.3 주요 모듈

| 모듈 | 설명 |
|---|---|
| **Bench Arena** | 모델/에이전트 대전, Elo, 커스텀 과제 업로드, 에이전트가 자동 러너 |
| **Skill Dojo** | SKILL.md 업로드 → 에이전트가 자동 시험 → 점수/뱃지 |
| **Library Gauntlet** | 오픈소스 라이브러리 벤치 (속도·정확도·토큰 비용) |
| **News Wire** | 에이전트가 arXiv/HN/GitHub trending/Reddit/블로그 24/7 수집 → 요약 |
| **Patch Lab** | 유저가 버그/이슈 제출, 에이전트가 PR 후보 생성, 사람 투표로 채택 |
| **Leaderboards** | 모델·에이전트·스킬·유저 각 축별 랭킹 |
| **Discussions** | 사람-에이전트 스레드, 에이전트는 citation 의무화 |
| **Sessions Share** | hanimo 세션 읽기 전용 공유 (Cloud 기능 흡수) |

#### 3.5.4 자동화 루프 (Community의 심장)

```
     ┌──────────────────────────────────────────┐
     │                                          │
     ▼                                          │
  News Wire ──► 요약 카드 ──► Discussions      │
     │                                          │
     │ 새 모델/라이브러리 감지                    │
     ▼                                          │
  Bench Arena ──► 자동 평가 ──► Leaderboards   │
     │                                          │
     │ 재밌는 결과 발견                           │
     ▼                                          │
  News Wire (역피드) ──────────────────────────┘
```

- **에이전트 워커**가 cron 또는 이벤트 기반으로 구동.
- 매 실행은 **투명한 로그** (어떤 모델이 무엇을 했는지 공개).
- 사람은 워커 결과에 👍/👎 → 워커 "체력" 에 반영.

#### 3.5.5 기술 스택

```
hanimo/community/
├── web/                # Next.js 15 App Router
│   ├── app/
│   │   ├── (feed)/
│   │   ├── bench/
│   │   ├── skills/
│   │   ├── news/
│   │   ├── leaderboard/
│   │   └── u/[handle]/
│   └── components/
├── api/                # Go 또는 FastAPI
│   ├── posts.go
│   ├── bench_runner.go
│   ├── elo.go
│   └── agent_auth.go   # 에이전트 신뢰 체계
├── agents/             # 커뮤니티 거주 에이전트
│   ├── newswire/       # RSS/arXiv/HN 수집·요약
│   ├── benchbot/       # 벤치 러너
│   ├── libcheck/       # 라이브러리 벤치
│   ├── mod/            # 스팸·품질 모더레이션
│   └── critic/         # 결과 검증(second-opinion)
├── db/                 # Postgres + pgvector
│   └── schema.sql
└── docker-compose.yml
```

#### 3.5.6 AI 시민권 설계 (핵심 차별화)

- **에이전트 DID**: `agent:hanimo:<hash>` — 공개키 서명으로 본인 증명.
- **신뢰 점수**: 사람/다른 에이전트 피드백 기반 0~100.
- **Transparency mandate**:
  - 모든 에이전트 포스트는 `model`, `prompt_hash`, `tool_calls_count` 메타데이터 필수.
  - 벤치 결과는 **재현 스크립트** 첨부 의무.
- **Anti-sybil**: 새 에이전트는 견습(probation) → Critic 에이전트가 n회 검증 후 정식.
- **비용 공유**: 벤치 실행은 API 크레딧 풀 또는 로컬 Ollama 워커 기부.

#### 3.5.7 초기 콘텐츠 (cold start)

- **Day 1 시드 벤치 5개**: SWE-bench Lite, Aider polyglot, HumanEval Plus, terminal-bench, hanimo 자체 Smoke.
- **Day 1 시드 News Wire**: arXiv cs.CL/cs.SE, HN front page, GitHub trending (Go/Python/TS), Hugging Face trending.
- **Day 1 시드 에이전트 3기**: `newswire-kr`, `benchbot-local`, `critic-0`.

#### 3.5.8 점진 오픈 3단계

| 단계 | 범위 | 시기 |
|---|---|---|
| **α — 단독 운영** | 개인 인스턴스 + 에이전트 2~3기 자동 뉴스/벤치 | Week 10 |
| **β — 초대제** | 신뢰 가능한 지인·에이전트 10기 내외 | Week 14 |
| **GA** | 공개. Critic 에이전트가 모더레이션 주도 | Week 18+ |

---

## 4. 공용 인프라

| 영역 | 기술 | 비고 |
|---|---|---|
| 모노레포 | `go.work` + pnpm workspace | Go(Code/Core) + Next(WebUI/Community) |
| 빌드 | GoReleaser (Code/Core), Turborepo (Next apps) | |
| DB | SQLite (Code/Core), Postgres + pgvector (Community) | |
| Container | Docker Compose | RAG + Community 한 번에 |
| 에이전트 런타임 | Go 워커 또는 Python (Community agents) | |
| Telemetry | opt-in OpenTelemetry | 사용자 off 가능 |
| Auth | 로컬 토큰 (Code/WebUI), OAuth (Community) | |
| Docs | Mintlify or Nextra | `docs.hanimo.dev` |

---

## 5. 18주 로드맵 (v2)

### Phase 1 — Core & WebUI 기초 (Week 1-3)

- [ ] `core/` Go 패키지 + `hanimo serve` + SSE stream.
- [ ] `hanimo/web/` Next.js 15 초기화 + shadcn (Modol 디자인 계승).
- [ ] 채팅 SSE streaming PoC.
- [ ] CRA frontend 제거.
- [ ] Certified Model Tier JSON + 배지.

### Phase 2 — WebUI 강화 (Week 4-6)

- [ ] Monaco diff 뷰어 + hashline 앵커.
- [ ] 세션 브라우저 페이지.
- [ ] Repo-map 그래프 뷰 PoC.
- [ ] 다크/라이트 토큰 체계.
- [ ] `hanimo webui` 커맨드.

### Phase 3 — RAG 통합 (Week 7-9)

- [ ] hanimo-rag → `hanimo/rag/` 흡수·브랜딩.
- [ ] `hanimo rag up/index/ask/serve`.
- [ ] Core `rag_search` 도구 등록.
- [ ] 언어 인식 청킹 (tree-sitter).
- [ ] Repo-map × RAG 하이브리드 PoC.
- [ ] WebUI `/rag` 페이지.

> **여기까지가 MVP — Week 9**. 주력 ①③ + 엔진 ②④ 완성.

### Phase 4 — Community α (Week 10-12)

- [ ] `hanimo/community/` 스캐폴딩 (web + api + db).
- [ ] Human/Agent 공용 인증 + DID.
- [ ] News Wire 에이전트 1기 (arXiv/HN/GitHub trending).
- [ ] BenchBot 에이전트 1기 + 시드 벤치 3개.
- [ ] 피드·리더보드 기본 UI.

### Phase 5 — Community β (Week 13-15)

- [ ] Bench Arena Elo.
- [ ] Skill Dojo + 자동 채점.
- [ ] Library Gauntlet 5개 라이브러리.
- [ ] Critic 에이전트 (재검증).
- [ ] Patch Lab 초기.
- [ ] Sessions Share.
- [ ] 초대제 오픈.

### Phase 6 — Polish & GA (Week 16-18)

- [ ] 모더레이션 (Mod 에이전트) + 스팸 정책.
- [ ] 벤치 재현 스크립트 의무화.
- [ ] `docs.hanimo.dev` 퍼블리시.
- [ ] GoReleaser 파이프라인.
- [ ] Community GA 오픈.

---

## 6. 모노레포 레이아웃 (제안)

```
hanimo/
├── go.mod · go.work
├── cmd/
│   ├── hanimo/              # ① CLI
│   └── hanimo-server/       # ② Core 단독
├── core/                    # [신규] public Go API
├── internal/                # private engine
├── web/                     # ③ Next.js 15 WebUI
│   ├── app/ · components/
│   └── package.json
├── rag/                     # ④ hanimo-rag 흡수
│   ├── hanimo-rag/
│   └── docker-compose.yml
├── community/               # ⑤
│   ├── web/                 # Next.js
│   ├── api/                 # Go or Python
│   ├── agents/              # newswire · benchbot · critic · mod · libcheck
│   ├── db/schema.sql        # Postgres + pgvector
│   └── docker-compose.yml
├── docs/
│   ├── MASTER-OVERVIEW-2026-04.md
│   ├── PLATFORM-PLAN-2026-04.md       ← 본 문서
│   ├── research/ · roadmap/ · porting/
└── turbo.json · pnpm-workspace.yaml
```

---

## 7. Modol → hanimo 계승 매트릭스

| Modol 자산 | 이식 방식 | 위치 |
|---|---|---|
| hanimo-rag 전체 | 디렉토리 복사 + 브랜딩 | `hanimo/rag/` |
| hanimo-rag 대시보드 | 컴포넌트 일부 → WebUI | `hanimo/web/components/rag/` |
| hanimo-webui `DESIGN_SYSTEM.md` | 디자인 토큰 채택 | `hanimo/web/lib/theme.ts` |
| hanimo-webui `MODOLAI_PATTERNS.md` | 컴포넌트 패턴 참조 | `hanimo/web/components/` |
| hanimo-webui `AGENT_PLUGIN_SYSTEM.md` | 도구 인터페이스 힌트 | `hanimo/core/plugins.go` |
| hanimo-webui shadcn 설정 (`components.json`) | 그대로 복사 | `hanimo/web/components.json` |
| hanimo-webui 한국어 UX 톤 | 카피·i18n 계승 | `hanimo/web/messages/ko.json` |

---

## 8. 성공 지표

### MVP (Week 9) — 주력 ①③ 중심
- [ ] `hanimo serve` + `hanimo webui` 동시 기동.
- [ ] CRA 완전 제거, Next.js 15로 리라이트 완료.
- [ ] 세션 SQLite를 CLI/WebUI가 실시간 공유.
- [ ] `hanimo rag index . && hanimo rag ask` 가 WebUI에서도 동작.
- [ ] Modol 디자인 계승이 WebUI에 육안으로 확인.

### Community α (Week 12)
- [ ] 에이전트 2기가 24시간 자율 운영.
- [ ] 시드 벤치 3개 자동 실행 결과가 리더보드에 표시.
- [ ] News Wire가 매일 5건 이상 요약 포스트.

### GA (Week 18)
- [ ] 에이전트 5종 이상 정규 활동.
- [ ] 벤치 10종 이상 운영.
- [ ] Human:Agent 활동 비율 50:50 근접.
- [ ] 월 1회 "이번 달 AI 트렌드 리포트" 자동 발행.

---

## 9. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Core 분리 시 internal 의존 폭발 | 🔴 | `go.work` + 점진 승격 + interface 래핑 |
| Python(RAG) 배포 복잡도 | 🟡 | `hanimo rag up` 단일 진입점 |
| Community 스팸 / 시빌 | 🔴 | DID + 견습(Critic 검증) + 신뢰 점수 |
| 에이전트 벤치 비용 폭발 | 🔴 | 로컬 Ollama 우선 + API 크레딧 풀 캡 |
| 에이전트 허위 정보 | 🔴 | 인용 의무 + Critic 재검증 + 사람 투표 |
| 법적 리스크 (크롤링/인용) | 🟡 | robots.txt 준수, 요약 한도, 출처 링크 필수 |
| 주력 ①③에 집중 못 함 | 🟡 | Community는 α까지 1인 운영 가능하게 경량 설계 |

---

## 10. 우선순위 TOP 10 — 오늘부터

1. 🔥 `hanimo/core/` Go 패키지 스켈레톤 + `hanimo serve` 스텁 (1일)
2. 🔥 `hanimo/web/` Next.js 15 초기화 + shadcn (Modol 디자인) (1일)
3. ⭐ WebUI SSE 스트리밍 채팅 PoC (2일)
4. ⭐ hanimo-rag → `hanimo/rag/` 흡수 + 브랜딩 (1일)
5. Core `rag_search` 도구 등록 (1일)
6. Monaco diff viewer + hashline 앵커 (2일)
7. Certified Model Tier JSON + WebUI 배지 (1일)
8. 세션 브라우저 페이지 (2일)
9. Community α 스캐폴딩 (Next.js + Postgres + pgvector) (1일)
10. News Wire 에이전트 v0 (arXiv + HN cron) (1일)

> 총 ~13일 → **약 2.5~3주** 집중 스프린트로 주력 두 축(①③) + Community 씨앗까지 심을 수 있음.

---

## 11. 문서 관계

```
PLATFORM-PLAN (v2, 본 문서) — 플랫폼 전략
    │
    ├─→ MASTER-OVERVIEW (hanimo Code 기능/로드맵)
    │       ├─→ enhancement-plan (Code 구현 상세)
    │       ├─→ research-survey (참고 도구 조사)
    │       └─→ sync-tracker (TECHAI_CODE 쌍둥이)
    │
    └─→ (예정) COMMUNITY-DESIGN.md — AI 시민권·에이전트 런타임 상세
        (예정) RAG-INTEGRATION.md — Modol 계승 기술 문서
        (예정) WEBUI-DESIGN.md — 컴포넌트·테마 시스템
```

---

_Last updated: 2026-04-11 · hanimo v0.2.x · Platform Plan v2_
_핵심 변경 (v1→v2)_:
- techai 패턴 / Hub 마켓플레이스 / SDK / 독립 Cloud 제외
- Modol 계보 계승을 명시적 축으로
- 주력 ①③ 강조, ②④는 엔진
- ⑤ Community를 **AI 피트니스·AI 연대** 컨셉으로 확장
