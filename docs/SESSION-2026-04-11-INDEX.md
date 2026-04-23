# Session 2026-04-11 — 산출물 인덱스

> Cowork 세션에서 생성·수집한 hanimo 플랫폼 기획 문서 전체 목록.
> 모든 파일은 `hanimo/docs/` 및 `hanimo/docs/html/` 하위에 통합 정리됨.

---

## 1. 마크다운 원본 (`hanimo/docs/`)

| # | 파일 | 내용 | 역할 |
|---|---|---|---|
| 1 | `MASTER-OVERVIEW-2026-04.md` | hanimo Code 기능·로드맵 12-섹션 총람 | Code 제품 스펙 기준점 |
| 2 | `PLATFORM-PLAN-2026-04.md` | **5-surface 아키텍처** (Code · Core · WebUI · RAG · Community) · Modol 계승 · 18주 로드맵 | 플랫폼 전략 master |
| 3 | `COMPETITIVE-LANDSCAPE-2026-04.md` | 5면 경쟁 분석 — Claude Code / Cursor / opencode / Aider / LiteLLM / Lovable / v0 / Dify / **Moltbook** 등 | 포지셔닝 근거 |
| 4 | `OPEN-SOURCE-LAUNCH-PLAN-2026-04.md` | hanimo.dev 도메인 + GitHub 레포 구조 + Apache-2.0 + `/compare` 매트릭스 + W14 공개 β 체크리스트 | 런칭 실행 계획 |
| 5 | `AGENTRANK-INTEGRATION-2026-04.md` | `AI_Comunity/agentrank` 흡수 → **AgentRank by hanimo** 서브 브랜드 / 서브도메인 / MCP 바이럴 루프 | ⑤ Community 구현 경로 |
| 6 | `SESSION-2026-04-11-INDEX.md` (이 문서) | 세션 전체 인덱스 | 네비게이션 |

---

## 2. 다크모드 HTML / DOCX / PDF (`hanimo/docs/html/`)

| 파일 | 형식 | 비고 |
|---|---|---|
| `MASTER-OVERVIEW-2026-04.html` | HTML (dark toggle) | TOC 포함 |
| `MASTER-OVERVIEW-2026-04.docx` | Word | pandoc 출력 (렌더 품질 주의) |
| `MASTER-OVERVIEW-2026-04.pdf` | PDF | soffice 변환본 |
| `PLATFORM-PLAN-2026-04.html` | HTML (dark toggle) | 5-surface 상세 |
| `ROADMAP-2026-04.html` | HTML 대시보드 | KPI 카드 + 18주 Gantt + Community 루프 다이어그램 |
| `COMPETITIVE-LANDSCAPE-2026-04.html` | HTML (dark toggle) | 외부 링크 시테이션 포함 |
| `OPEN-SOURCE-LAUNCH-PLAN-2026-04.html` | HTML (dark toggle) | 런칭 체크리스트 |
| `AGENTRANK-INTEGRATION-2026-04.html` | HTML (dark toggle) | AgentRank 통합 전략 |

> HTML 파일은 전부 self-contained 단일 파일. 다크/라이트 토글 버튼 우상단, `localStorage`에 선택 저장.

---

## 3. 핵심 결정 요약

### 3.1 플랫폼 범위 — 5 surfaces

```
① hanimo Code       ⭐ 주력 1   Go TUI (Bubble Tea v2) · Hash-anchored edit · MCP
② hanimo Core       엔진       LiteLLM 라우터 · MCP 허브 (Code/Web 공유)
③ hanimo Web        ⭐ 주력 2   Next.js 15 웹 에이전트 · hanimo-webui 디자인 계승
④ hanimo RAG        엔진       FastAPI 파이프라인 · hanimo-rag 계승 · pgvector
⑤ AgentRank         커뮤니티   벤치마크·트렌드·5 AI 필자 · 서브 브랜드 유지
```

### 3.2 브랜드 & 도메인

- **메인 도메인**: `hanimo.dev` (Apache-2.0 · HTTPS 강제 · 개발자 TLD)
- **보조 도메인**: `modol.dev`, `modol.app` → `hanimo.dev/about#lineage` 301 리다이렉트
- **커뮤니티 도메인**: `agentrank.hanimo.dev` (서브도메인, SEO·브랜드 독립)
- **GitHub org**: `hanimo-dev` — `hanimo-code` / `hanimo-web` / `agentrank` / `hanimo.dev`

### 3.3 4대 차별화 축

1. **Dual-surface** (Code + Web 한 팀 한 디자인시스템) — 경쟁사 없음
2. **Hash-anchored edits** — hanimo 고유 기능
3. **Model-agnostic** (LiteLLM + Ollama + vLLM, 75+ provider)
4. **Modol 계승** — 2+ 년 디자인/파이프라인 자산

### 3.4 일정 (AgentRank 병렬 진행 반영)

| Week | 마일스톤 |
|---|---|
| W1-3 | AgentRank 레포 이전 + 디자인 토큰 통합 + Neon/Drizzle 연결 |
| W6 | **AgentRank private β** (agentrank.hanimo.dev) |
| W9 | 🏁 hanimo Code/Web **MVP** (private) |
| W10 | AgentRank 공개 β + 크롤러 풀셋 |
| W14 | 🚀 hanimo Code/Web **공개 β** (Show HN / r/LocalLLaMA / GeekNews) |
| W18 | 🎉 **v1.0 GA** (전 제품) |

---

## 4. 다음 단계 (클로드 코드로 이관 예정)

세션 중 보류된 작업 — 클로드 코드의 디자인 전용 skill 세트(`tui-designer`, `building-glamorous-tuis`, `building-tui-apps` 등)를 활용해 진행할 것 권장:

- [ ] `hanimo.dev` 홈 랜딩 디자인 시안 (메인 히어로 + 2-product 카드 + `/compare` 매트릭스)
- [ ] `hanimo code` 제품 페이지 디자인 시안 (TUI 스크린샷 + 특징 그리드 + 벤치마크 섹션)
- [ ] `hanimo web` 제품 페이지 디자인 시안
- [ ] AgentRank 디자인 토큰 스냅샷 → `@hanimo/tokens` 패키지 설계
- [ ] hanimo Code TUI 자체 리디자인 (Charmbracelet Lip Gloss + Bubbles v2)
- [ ] MCP 도구 명세 초안 (`agentrank.query`, `agentrank.leaderboard`, `agentrank.compare`)
- [ ] 이번 주 즉시 실행: 도메인 3종 구매, GitHub org `hanimo-dev` 생성, 핸들 선점

---

## 5. 관련 자산 위치 참조

| 자산 | 경로 | 상태 |
|---|---|---|
| hanimo Code 본체 | `kimjiwon/hanimo/` | Go 프로젝트 active |
| AgentRank 프로토타입 | `kimjiwon/AI_Comunity/agentrank/` | Next.js 16 · Phase 1 MVP LIVE 배지 |
| hanimo-webui (디자인 유산) | `kimjiwon/hanimo-webui/` | shadcn/ui · AGENT_PLUGIN_SYSTEM |
| hanimo-rag (RAG 유산) | `kimjiwon/hanimo-rag/` | FastAPI · Docker Compose |

---

*Session date: 2026-04-11 · Next action: Claude Code에서 디자인 시안 착수*
