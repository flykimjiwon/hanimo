# 다음 세션 재개 가이드 — 2026-04-25 (Phase 15a + 비전 천명 시점)

> 이 문서를 새 세션에서 첫 번째로 읽으면 이전 맥락 100% 복구 가능.
> 짝꿍 문서: `docs/SESSION-2026-04-25-INDEX.md` (이번 세션 산출 요약 — §7에 후속분 추가됨)
> **비전 본문 (필독)**: `docs/strategy/VISION-2026-04-25-MULTI-MODEL-MULTI-DEVICE.md`
> 상위 전략: `docs/strategy/REPUTATION-STRATEGY-2026-04-23.md`
> 디자인 mock: `designs/hanimo-desktop-v1.html` (모든 Phase의 시각 기준)

---

## 1. 30초 컨텍스트 복구

- **프로젝트**: `hanimo-code-desktop` (Wails IDE, hanimo-code 서브디렉토리)
- **레포 상태**: `origin/main = d431f6e` · **첫 정식 release tag = `v0.2.0`** (GH Actions 4 platform 자동 빌드 트리거됨)
- **누적 진척**: Phase 0~19 + 리뷰픽스 2라운드 완성 — 멀티 프로바이더 자동 라우팅 + macOS/Windows/Linux 빌드 + 한국 MCP 35 카탈로그
- **빌드 검증**: vite ~1548 KiB · go test ok · macOS .app + Windows .exe 로컬 검증 OK
- **비전**: `docs/strategy/VISION-2026-04-25-MULTI-MODEL-MULTI-DEVICE.md` — 6축 (모든 모델 · 모든 디바이스 · 완전 OSS · IDE 풀패널 · sync · **simplicity-first**)
- **다음 자연스러운 단계**: Phase 15b2 (Anthropic transport) · Phase 21 (Capacitor 모바일) · GH Actions 첫 빌드 결과 검증 중 택1
- **사용자 정책 (반드시 준수)**:
  - hanimo-code/desktop = **완전 무료 OSS** · 유료화 금지 (목적: 명성)
  - 5-surface 중 Code + Desktop만 집중 — Code+IDE+Mobile 같은 코드베이스 (WebUI/RAG/Community/Spark는 보류)
  - Honey 팔레트가 브랜드 기본 테마
  - **Simplicity 6축** — customization bloat 거부, BYOK 패턴, 브라우저 내장 활용

---

## 2. 즉시 실행 가능한 스모크 테스트

새 세션 시작 시 5분 안에 모든 게 정상인지 확인:

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code

# 1. 동기화 상태
git status -sb
# → "## main...origin/main" 만 보여야 정상 (landing-mockups submodule는 무시 OK)

# 2. CLI 헬스체크
go test ./internal/... -count=1 2>&1 | tail -5

# 3. Desktop Go 헬스체크
cd hanimo-code-desktop
go build ./... && go test ./... -count=1 | tail -3

# 4. Frontend 헬스체크
cd frontend && npm run build 2>&1 | tail -5
```

각 단계 실패 시 즉시 중단하고 디버깅. 모두 OK면 그대로 진행.

---

## 3. 다음 큰 작업 후보 (우선도 순 — 2026-04-25 마감 시점)

### 🥇 Option A: GH Actions 첫 빌드 결과 검증 (즉시 · 5-30분)

**왜**: v0.2.0 tag push 후 4 platform native 빌드가 자동 실행 중. 첫 release라 yaml 문법/의존성/runner 환경 이슈가 있을 수 있음. 다음 세션 시작 시 가장 먼저 확인.

**확인 명령**:
```bash
gh run list --workflow=desktop-release.yml --limit 5
gh run view <id> --log-failed   # 실패 시
gh release view v0.2.0           # 성공 시 산출물 4개 확인
```

**예상 이슈**:
- Wails CLI 설치가 매트릭스 모든 OS에서 잘 되는지
- ubuntu의 libgtk/libwebkit2gtk 패키지 이름 호환성
- Windows runner에서 npm/go cross-compile

수정 시 desktop-release.yml 한 줄 패치 후 v0.2.1 tag 재트리거.

### 🥈 Option B: Phase 15b2 — Anthropic transport switch (中~大 · 4~6시간)

**왜**: Phase 15a 카탈로그에 Anthropic 모델은 있지만 호출 시점 깨짐 (OpenAI SDK가 messages API 못 씀). Claude Sonnet 4.6/4.7 활성화 = "모든 모델" 비전 핵심.

**입구**:
- `hanimo-code-desktop/chat.go` newChatEngine + streamResponse — provider == "anthropic" 분기
- 신규: `hanimo-code-desktop/anthropic.go` — messages API streaming + tool_use 변환
- Anthropic-go SDK 또는 직접 SSE 파서

**복잡도**: tool_calls 형식 변환, streaming 패러다임 다름.

### 🥉 Option C: Phase 21 — Capacitor 모바일 wrap 1차 (大 · 1~2일)

**왜**: 비전 5축 중 "All Devices 모바일 축" 진입. frontend는 100% 재사용, native API만 Capacitor.

**입구**:
- `hanimo-code-desktop/frontend/dist` → `npx cap init` → iOS/Android 프로젝트 생성
- 별도 sub-디렉토리 또는 별도 레포 (`hanimo-code-mobile`?) 결정 필요

**리스크**: terminal/PTY는 모바일에서 native 안 됨 → web SSH 또는 hanimo-code-server (별도 surface) 도입 검토.

### 🏅 Option D: 후속 마이크로 픽스 (小 · 30분~1시간)

이전 리뷰에서 보류된 M1 (sync.Once 경합 race) 등 안전성 강화. 큰 작업 사이의 워밍업.

### 🏵 Option E: Phase 16 LSP / Phase 17 Subagents / Phase 15b3 Google

각각 1-2일 단위 별도 세션. 비전 §4 Phase 매핑 참고.

---

## 4. 절대 잊지 말 것 (Constraints)

| # | 제약 |
|:-:|---|
| 1 | hanimo-code-desktop은 **완전 무료 OSS** · 유료화 제안 금지 |
| 2 | bxm·scrape-bxm·shinhan·사내 전용 코드는 desktop 포팅 절대 금지 |
| 3 | TECHAI 기준 작업 시 본질 필터 (외부망 vs 폐쇄망) 적용 |
| 4 | landing-mockups submodule은 **건드리지 않음** (다른 저장소) |
| 5 | main 브랜치 직접 푸시는 사용자 기존 패턴 — explicit consent 가정 |
| 6 | 커밋 메시지에 Constraint/Rejected/Confidence 트레일러 포함 (CLAUDE.md commit_protocol) |
| 7 | 한국어로 응답 · 사용자가 영어 강제하지 않는 한 |
| 8 | Self-approve 금지 — 코드/계획 리뷰는 별도 lane (`oh-my-claudecode:code-reviewer` 등) |

---

## 5. 알려진 미해결 (의도적 보류)

| 항목 | 이유 | 처리 시점 |
|---|---|---|
| `navigator.platform` deprecated 경고 | Wails 환경 종속, 대체 API 비표준 | Wails v3 마이그레이션 |
| Wails App.d.ts 자동 재생성 | `wails dev` 한 번 돌리면 해소, 현재 `(mod as any)` 캐스트로 우회 | 정식 dev 사이클 진입 시 |
| `tools/memory.go` registry 등록 | 사용자 판단 대기 (session/memory.go와 공존 여부) | 세션 매니저 정리 시 |
| ChatPanel ↔ KnowledgePanel 양방향 sync | Context provider 도입 필요 | 우선순위 낮음 |
| split editor의 hash anchor 표시 | main editor만 ref 보관 — 단일 정책 유지 | 의도된 동작 |
| MCP ensureMCP 락 안 spawn | 서버 수 적어 영향 미미 | 서버 늘어나면 |
| chat.history 동시 접근 mutex | Wails v2 직렬화로 현재 안전 | v3 마이그레이션 |
| LoadTGCConfig 4초 polling I/O | yaml 작아 비용 무시 | 핫리로드 도입 시 |
| MCP SSE/HTTP transport | "not supported" 라벨로 표시만 | 실 사용 사례 발생 시 |

---

## 6. 핵심 파일 위치 빠른 참조

```
hanimo-code-desktop/
├── app.go                    — Wails App struct, file ops, lifecycle, MCP 필드
├── chat.go                   — chatEngine + 토큰/iter 카운터(Phase 13) + tool 핸들러 + SendMessage
├── config.go                 — TGCConfig (yaml) + LoadTGCConfig
├── bindings_phase3.go        — UndoLastEdit, GetMetrics(실값 Phase 13), GetProblems(stub)
├── bindings_phase6.go        — GetAvailableModels (Tier1+Ollama), SwitchModel
├── hash_anchor_emit.go       — emitHashAnchorsFor / emitHashAnchorsForLines
├── hashline.go               — hashLine + parseAnchor + HashlineRead/Edit (Phase 10)
├── skills.go                 — GetSkills + parseSkillMeta (Phase 11)
├── mcp.go                    — MCP stdio 클라이언트 + 매니저 + 4 bindings (Phase 12)
└── frontend/src/
    ├── App.tsx               — 모든 라우팅 + Top Ribbon (mcp 라우트 → MCPPanel)
    └── components/
        ├── ActivityBar.tsx   — 14 icons (Phase 2)
        ├── ModeSwitcher.tsx  — Super/Deep/Plan
        ├── ProviderChip.tsx  — 드롭다운 + Tier 추론 (Phase 6)
        ├── MetricsRow.tsx    — 4열 · 실값 polling 4s (ChatPanel에서 GetMetrics)
        ├── ProblemsStrip.tsx — LSP 진단 strip + hash-anchor 상태
        ├── KnowledgePanel.tsx · SessionsPanel.tsx · SkillsPanel.tsx
        ├── MCPPanel.tsx      — 서버 트리 + 도구 펼치기 (Phase 12)
        ├── PlaceholderPanel.tsx — Subagents/Permissions/Run/Problems만 placeholder
        ├── CommandPalette.tsx — 24 commands · multi-token fuzzy
        └── hashAnchorGutter.ts — CodeMirror StateField + GutterMarker
```

---

## 7. 커밋 메시지 템플릿 (CLAUDE.md commit_protocol 준수)

```
feat(desktop): Phase NN — <한 줄 요약>

<2-3 문장 본문>

## 신규/변경
- 파일별 핵심 변경

## 검증
- vite build: OK (KiB)
- go build/test: OK 49/49

## 자가 리뷰
- 트레이드오프 / 결정 근거

Constraint: <지킨 제약>
Rejected: <대안> | <기각 이유>
Directive: <후속 작업자 주의>
Confidence: high | medium | low
Scope-risk: narrow | moderate | broad
Not-tested: <엣지케이스>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. 새 세션에서 첫 메시지 권장

> "어제 9d95ea4까지 Phase 0-13 + 리뷰픽스 완성. `docs/SESSION-2026-04-25-RESUME.md` 보고 Phase 14 진행해."

또는 옵션 명시:
> "Option A (LSP) 가자" / "Option D (마이크로 픽스) 먼저" / "다른 거"

---

## 9. 메모리 인덱스 (참고)

`/Users/jiwonkim/.claude/projects/-Users-jiwonkim-Desktop-kimjiwon-hanimo-code/memory/MEMORY.md` 의 핵심 항목:

- `feedback_monetization_policy.md` — 유료화 금지
- `feedback_tooling_policy.md` — superpowers/gstack 활용 규칙
- `project_hanimo_techai.md` — hanimo ↔ TECHAI 페어
- `project_hanimo_ecosystem_naming.md` — 4-repo 네이밍
- `project_hanimo_desktop_design.md` — Honey 팔레트 + 8 테마
- `project_market_decisions_2026-04-24.md` — wedge 두 축 결정
- `project_scope_pivot_2026-04-23.md` — Code+IDE 올인
- `project_desktop_phase11_state.md` → 다음 세션에서 `phase13_state` 로 갱신 권장

새 세션이 자동으로 이들을 로드하므로 별도 호출 불필요. 단 충돌 시 SESSION-RESUME 우선.

---

## 10. 컨셉 정합성 체크리스트 (모든 Phase에서 반복 적용)

| 축 | 점검 질문 |
|---|---|
| 무료 OSS | 가격·결제·tier·라이선스 게이트 단어가 코드/UI에 들어갔나? |
| Code + IDE 집중 | 변경이 WebUI/RAG/Spark 영역을 건드리는가? (그렇다면 보류) |
| Honey 팔레트 | 새 컴포넌트가 hard-coded color를 쓰지 않고 `var(--*)`로만 작동하는가? |
| 한국어 | UI 카피·커밋 메시지·에러 라벨이 한국어인가? (코드 식별자만 영문) |
| TECHAI 폐쇄망 본질 필터 | 외부망 전용 자원(`bxm`/사내 endpoint)이 의존성으로 끼어들었나? |
| Brand promise (hash anchor) | 변경이 silent overwrite 가능성을 만드는가? |
| Wedge 강화 | 폐쇄망 운영 + 한국어 명성 두 축 중 적어도 하나를 강화하는가? |

각 체크박스가 ✅ 가 아니면 PR 못 닫음.
