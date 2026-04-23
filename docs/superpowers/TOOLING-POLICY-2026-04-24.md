# Tooling Policy — superpowers / gstack 활용 가이드

> 작성일: 2026-04-24
> 계기: 2026-04-23 세션에서 superpowers skills와 gstack을 거의 활용하지 않았음을 회고.
> 상위 문서: `docs/SESSION-2026-04-23-INDEX.md` · `docs/TODO-decisions-2026-04-23.md`

---

## 0. TL;DR

- 2026-04-23 세션에서 **superpowers 스킬 공식 invoke 0회**, **gstack 사용 0회**.
- 모든 판단·문서화를 Claude가 즉시 작성 → 빠르지만 구조적 검증·트레이드오프 문서 누락.
- **앞으로는 코드 작업 단계에 진입하면 아래 스킬을 명시적으로 invoke**.
- gstack은 Phase별 PR 분리가 필요한 순간부터 적용.

---

## 1. 지난 세션 회고 (2026-04-23)

### 1.1 안 쓴 스킬과 써야 했던 구간

| 스킬 | 써야 했던 구간 | 누락된 산출 |
|---|---|---|
| `superpowers:brainstorming` | 3 경쟁 각도 결정, Honey 브랜드 채택, 슬로건 후보 선정 | 사용자 의도 확인 라운드 · 옵션 트리 · 트레이드오프 표 |
| `superpowers:writing-plans` | REPUTATION-STRATEGY 90-day plan, HANIMO-DESKTOP-DESIGN-PLAN | Phase별 verification 기준 · rollback plan · risk matrix |
| `superpowers:executing-plans` | (해당 없음 — 이번 세션은 계획만) | — |
| `frontend-design` / `tui-designer` | `designs/hanimo-desktop-v1.html` 작성 | 디자이너 관점 리뷰 · 접근성 가이드라인 · 반응형 검증 |
| `web-design-guidelines` | 위 HTML UI 검증 | A11y · 키보드 네비·contrast ratio 체크 |
| `superpowers:verification-before-completion` | 각 문서 완료 선언 전 | 파일 문법·링크 유효성·frontmatter 일관성 점검 |

### 1.2 안 쓴 gstack과 썼어야 할 상황

- 커밋 `541fc78`에는 리브랜드 modified 파일들이 섞여 들어감.
- 커밋 `968cc90`에는 전략·디자인·TODO가 한 덩어리로 들어감.
- **stacking 적용 시**: `strategy` → `porting-analysis` → `ide-design` → `session-index` 4-stack으로 분리하면 각각 독립 리뷰/revert 가능.

---

## 2. 앞으로 적용 규칙

### 2.1 Skill Invoke 트리거

| 상황 | Skill | 비고 |
|---|---|---|
| 새 기능/컴포넌트 설계 착수 | `superpowers:brainstorming` | 1번 이상 라운드, 사용자 intent 재확인 |
| 멀티스텝 구현 계획 | `superpowers:writing-plans` | Phase별 verification 기준 필수 |
| 계획을 세션 분리해서 실행 | `superpowers:executing-plans` | 독립 세션에서 invoke |
| 단일 세션 내 구현 | `superpowers:subagent-driven-development` | 병렬 태스크 있을 때 |
| 버그·회귀·예상외 동작 | `superpowers:systematic-debugging` | fix 제안 전 필수 |
| 기능·버그픽스 구현 | `superpowers:test-driven-development` | 테스트 없는 변경 금지 대상 |
| 완료 선언 직전 | `superpowers:verification-before-completion` | "완료" 메시지 전 필수 |
| PR 만들기 전 | `superpowers:requesting-code-review` | 셀프 리뷰 체크리스트 |
| 리뷰 피드백 받은 후 | `superpowers:receiving-code-review` | 맹목 동의 금지 |
| UI/프론트엔드 작업 | `frontend-design` or `tui-designer` | 디자인 품질 검증 |
| UI 검증 | `web-design-guidelines` | a11y·keyboard·contrast |
| 커밋 전 개선 | `simplify` | 최근 변경 파일 리뷰 |
| 새 워크트리 시작 | `superpowers:using-git-worktrees` | 격리 필요 시 |
| 개발 브랜치 종료 | `superpowers:finishing-a-development-branch` | merge/PR/cleanup 선택 |

### 2.2 gstack 적용 규칙

- **Phase가 2개 이상인 plan**이면 stacking 적용
- 한 스택 = 한 논리적 변경 (strategy 문서 / 디자인 mock / 코드 구현 등)
- 스택 간 의존성이 있으면 순서대로 머지
- 리뷰어가 없는 1인 개발이어도 **히스토리 가독성**과 **revert 안전성**에서 이득

### 2.3 명시적 announce 의무

Skill invoke 시에는 `"Using [skill] to [purpose]"` 한 줄로 사용자에게 공지.
skill 결과를 받으면 checklist가 있으면 TodoWrite(=TaskCreate)로 추적.

---

## 3. 이번 세션 산출물의 품질 보정 (회고적)

이미 커밋된 문서들이 superpowers 표준을 거치지 않았으므로, 다음 세션에서 다음 검증 필요:

| 문서 | 적용할 검증 |
|---|---|
| `docs/strategy/REPUTATION-STRATEGY-2026-04-23.md` | `writing-plans` 포맷으로 재구성 — Phase별 verification 기준 추가 |
| `docs/porting/BIDIRECTIONAL-ANALYSIS-2026-04-23.md` | 본질 필터 판정 근거에 `verification-before-completion` 체크리스트 |
| `docs/porting/HANIMO-DESKTOP-DESIGN-PLAN-2026-04-23.md` | `frontend-design` + `web-design-guidelines` 리뷰 통과 |
| `designs/hanimo-desktop-v1.html` | A11y·contrast 체크 + 반응형 (<1280px) 검증 |

**우선도**: Sprint 1 착수 전 REPUTATION-STRATEGY 재구성만 필수. 나머지는 해당 Phase 직전.

---

## 4. TODO 편입

`docs/TODO-decisions-2026-04-23.md §5 세컨더리 TODO`에 다음 추가:

- [ ] Sprint 1 착수 전 `REPUTATION-STRATEGY`를 `writing-plans` 포맷으로 재구성
- [ ] `hanimo-desktop-v1.html` `web-design-guidelines` 통과
- [ ] Phase 0~5 각 진입 시 `writing-plans` → `executing-plans` 체인 적용
- [ ] 2개 이상 독립 변경 발생 시 gstack 스택 분리

---

## 5. 관련 문서

- `/Users/jiwonkim/.claude/CLAUDE.md` — OMC 전역 운영 원칙
- `docs/SESSION-2026-04-23-INDEX.md` — 지난 세션 인덱스
- `docs/TODO-decisions-2026-04-23.md` — 결정 대기 (§5에 반영 예정)
