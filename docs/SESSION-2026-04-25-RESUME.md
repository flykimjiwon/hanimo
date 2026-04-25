# 다음 세션 재개 가이드 — 2026-04-25 (Phase 15a + 비전 천명 시점)

> 이 문서를 새 세션에서 첫 번째로 읽으면 이전 맥락 100% 복구 가능.
> 짝꿍 문서: `docs/SESSION-2026-04-25-INDEX.md` (이번 세션 산출 요약 — §7에 후속분 추가됨)
> **비전 본문 (필독)**: `docs/strategy/VISION-2026-04-25-MULTI-MODEL-MULTI-DEVICE.md`
> 상위 전략: `docs/strategy/REPUTATION-STRATEGY-2026-04-23.md`
> 디자인 mock: `designs/hanimo-desktop-v1.html` (모든 Phase의 시각 기준)

---

## 1. 30초 컨텍스트 복구

- **프로젝트**: `hanimo-code-desktop` (Wails IDE, hanimo-code 서브디렉토리)
- **레포 상태**: `origin/main = 9d95ea4` (Phase 13 + 리뷰픽스 푸시 완료)
- **누적 진척**: Phase 0~13 + 리뷰픽스 1라운드 완성 — 디자인 v1 mock의 Cache·MCP·Skills 모두 실값화
- **빌드 검증**: vite 1532.45 KiB · go test 49/49 · TS clean (기존 navigator.platform 경고 1건)
- **다음 자연스러운 단계**: 큰 작업 3종(LSP / Subagents / Permissions) 중 택1, 또는 후속 마이크로 픽스
- **사용자 정책 (반드시 준수)**:
  - hanimo-code/desktop = **완전 무료 OSS** · 유료화 금지 (목적: 명성)
  - 5-surface 중 Code + Desktop만 집중 (WebUI/RAG/Community/Spark는 보류)
  - Honey 팔레트가 브랜드 기본 테마

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

## 3. 다음 큰 작업 후보 (우선도 순)

### 🥇 Option A: LSP 서버 통합 (中~大복잡도 · 1~2일)

**왜**: ProblemsStrip이 진짜 진단을 표시 → Brand promise 강화 (hash anchor + LSP가 같은 라인을 참조). hanimo CLI에 `internal/lsp` 자산 이미 존재.

**입구 파일**:
- `internal/lsp/` (CLI 자산 — desktop은 별도 모듈이라 포팅 필요)
- `hanimo-code-desktop/bindings_phase3.go` GetProblems (현재 빈 슬라이스 반환)
- `frontend/src/components/ProblemsStrip.tsx` — UI는 이미 있음

**작업 단위 (예상)**:
1. `hanimo-code-desktop/lsp.go` 신규 — gopls/tsserver 프로세스 관리
2. App.GetLSPDiagnostics(filePath) 바인딩
3. textDocument/didOpen + textDocument/publishDiagnostics 구독
4. GetProblems가 실 진단 반환
5. 빌드 + 커밋 + 푸시

**리스크**: 프로세스 라이프사이클 + LSP 프로토콜 + textDocument sync. 별도 세션 강력 권장.

### 🥈 Option B: Subagents 패널 (大 · 큰 작업)

**왜**: hanimo CLI의 `internal/agents/auto.go`/`plan.go` 자산을 IDE에서 실시간 시각화. 컨텍스트 분기 + 요약 반환, git worktree 동시 실험.

**입구**:
- `internal/agents/` (CLI 자산)
- `frontend/src/components/PlaceholderPanel.tsx` (현재 subagents 분기)

**복잡도 ↑**: 라이브 스트림 + 결과 머지 UI. 별도 세션.

### 🥉 Option C: Permissions 엔진 (大 · 큰 작업)

**왜**: 5-mode 퍼미션 (allow/ask/deny + dangerous block + learning yaml). credential scrubbing 기반.

**입구**:
- 새로 작성 (CLI에도 미포팅)
- `frontend/src/components/PlaceholderPanel.tsx` (permissions 분기)

### 🏅 Option D: 후속 마이크로 픽스 (小 · 30분~1시간)

리뷰에서 "보류" 분류된 항목들:
- M2 — ensureMCP 락 밖 spawn (서버 수 증가 시 UX 개선)
- M3 — chat.history mutex (Wails v3 마이그레이션 대비)
- M4 — LoadTGCConfig 캐시 (4초 polling 비용 미세 절감)

서버 수가 적고 Wails v2 직렬화에 의존하는 한 안전 — 큰 작업 사이의 워밍업으로 적합.

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
