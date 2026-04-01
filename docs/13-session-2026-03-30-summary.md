# Hanimo 개선 세션 요약 (2026-03-30 ~ 2026-04-01)

## 개요

두 세션에 걸쳐 hanimo(구 modol)의 코드 품질, 보안, 아키텍처를 전반적으로 개선했습니다.

---

## 1. 프로젝트 분석 결과

### 강점
- 14개 LLM 프로바이더 지원 (업계 최다)
- Hash-Anchored Editing (독창적 기능)
- 듀얼 UI (TUI + Text-mode)
- LLM 기반 컨텍스트 압축
- ~7,800줄의 효율적 코드
- Zero native dependency

### 발견된 주요 약점
- 보안 취약점 4건 (CRITICAL 1, HIGH 3)
- 런타임 버그 12건 (CRASH 3, ERROR 3, WRONG_BEHAVIOR 6)
- agent-loop 테스트 커버리지 0%
- retry/backoff 로직 없음
- 토큰 기반 컴팩션 부재

---

## 2. 보안 취약점 수정 (커밋: `111e5e0`)

| 심각도 | 파일 | 문제 | 수정 |
|--------|------|------|------|
| CRITICAL | `hooks.ts` | 프로젝트 config에서 임의 명령 실행 (RCE) | user config만 허용 |
| HIGH | `memory.ts` | 쓰기 경로에 크기 제한 없음 | MAX_LINES/MAX_BYTES 적용 |
| HIGH | `permission.ts` | glob 패턴 ReDoS 취약점 | 와일드카드 5개 제한 |
| HIGH | `onboarding.ts` | quickProbe 타이머 누수 | try/finally 패턴 |

---

## 3. 엔드포인트 검증 강화 (커밋: `111e5e0`)

- `type: 'unknown'` 서버 무조건 허용 → 실제 chat completion 테스트 후 수락
- SIGINT 핸들러 온보딩 후 정리 (TUI 간섭 방지)
- `testChatCompletion()` 함수 추가

---

## 4. ESM 호환성 수정 (커밋: `8ae4b8d`)

**문제**: `"type": "module"` 프로젝트에서 `require()` 사용 → "require is not defined" 크래시

**수정**: TUI 컴포넌트 17곳의 `require('node:fs/path/os')` → ESM top-level import로 변환
- `src/tui/hooks/use-commands.ts` — 12곳
- `src/tui/app.tsx` — 5곳

---

## 5. 역할 시스템 리팩토링 (커밋: `4fc8754`)

### Before → After

| Before | After | 변경 |
|--------|-------|------|
| chat (도구 없음) | **삭제** | hanimo가 대화도 처리 |
| dev (코딩 에이전트) | **유지** | 명시적 개발 작업 |
| plan (읽기 전용) | **유지** | 분석/계획 |
| super (만능) | → **hanimo** 🐶 (기본) | 의도 자동 감지 |

### 변경 파일
- `src/roles/built-in/hanimo.json` — 신규 (의도 자동 감지 프롬프트)
- `src/roles/role-manager.ts` — 3개 역할만 로드
- `src/config/defaults.ts` — 기본 역할 `hanimo`
- `src/config/schema.ts` — 기본 역할 `hanimo`
- 테스트 업데이트 (role-manager.test.ts, integration.test.ts)

---

## 6. 설정 초기화 수정 (커밋: `b91d495`)

**문제**: 초기화 후 LLM에 요청 전송 (Thinking... 무한 대기)

**수정**: config 삭제 → `process.exit(0)` 즉시 종료 → 재실행 시 온보딩 시작

---

## 7. Custom Provider 핵심 버그 수정 (커밋: `40cf5c8`)

**근본 원인**: `LOCAL_PROVIDERS`에 `'custom'`이 포함되어 있어서:
1. `tools:OFF` — custom 프로바이더가 로컬로 분류되어 도구 비활성
2. `"fetch failed"` — localhost Ollama ping 시도 → 원격 서버에서 실패
3. 사용할 때마다 발견되던 이상 동작의 주요 원인

**수정**: `LOCAL_PROVIDERS`에서 `'custom'` 제거

---

## 8. 런타임 버그 일괄 수정 (커밋: `1721964`, `06eb50c`)

### CRASH/ERROR 수정 (커밋: `1721964`)

| 문제 | 파일 | 수정 |
|------|------|------|
| `!` non-null assertion crash | `cli.ts:285` | 명시적 null 체크 + 에러 메시지 |
| `--role chat/super` 하드 exit | `cli.ts:32` | help text → `hanimo, dev, plan` |
| text-mode tools:OFF for local | `text-mode.ts:297,449` | caller가 전달한 tools 기준 판단 |
| mode-presets super/chat 참조 | `mode-presets.ts` | hanimo/dev/plan으로 통일 |
| TUI 프로바이더 메뉴 필터 | `app.tsx:589` | 모든 프로바이더 표시 |

### LOW 수정 (커밋: `06eb50c`)

| 문제 | 파일 | 수정 |
|------|------|------|
| selectMenu stdin listener leak | `text-mode.ts` | cleanup에 `stdin.pause()` 추가 |
| Esc 핸들러 누적 | `text-mode.ts` | 핸들러 참조 저장 + 정리 |
| 세션 저장 무음 실패 | `session/store.ts` | console.warn 추가 |
| 세션 동시 쓰기 | `session/store.ts` | write lock (Set) 추가 |
| webfetch 중첩 태그 | `webfetch.ts` | 제한사항 문서화 |

---

## 9. DGX SPARK 가이드 문서 (커밋: `111e5e0`, `d22f8d9`)

`docs/12-custom-model-guide.md` — 한국어 가이드:

- 빠른 시작 (5분 설정)
- 직접 설정 (config.json 편집)
- 실제 설정 예시 (DGX SPARK, Ollama, vLLM)
- 여러 서버 동시 등록 (customProviders)
- 모델 전환 방법
- 연결 테스트 (curl)
- API 키 관리
- 문제 해결 7가지 시나리오
- **팀 배포 가이드** — 4가지 배포 방법:
  1. 설치 스크립트에 config 포함
  2. `--share-config` / `--import-config`
  3. 환경변수
  4. 프로젝트별 `.hanimo.json`

---

## 10. Level 2 스킬 시스템 설계 (커밋: `b3f4d54`)

### 설계 문서
`docs/superpowers/specs/2026-03-30-skill-system-design.md`

### 구현 계획
`docs/superpowers/plans/2026-03-30-skill-system.md` — 10개 TDD 태스크

### 설계 요약

| 항목 | 내용 |
|------|------|
| 파일 포맷 | YAML frontmatter + 마크다운 |
| 트리거 | 키워드 자동 감지 + `/skill` 슬래시 커맨드 |
| 게이트 | `none`(자동) / `soft`(프롬프트 지시) / `strict`(코드 강제) |
| 빌트인 스킬 | 8개 (brainstorming, debugging, git-workflow, planning, tdd, code-review, refactoring, security-check) |
| 구현 범위 | ~1,400줄 예상 |
| agent-loop 수정 | ~15줄 (strict 게이트만) |
| 하위호환 | 기존 `~/.hanimo/skills/*.md` 계속 동작 |

### 구현 상태: **미착수** (설계 + 계획만 완료)

---

## 11. 멀티 플랫폼 전략

| 플랫폼 | 상태 | UI 기술 |
|--------|------|---------|
| Terminal (text-mode) | 완성 | readline |
| TUI (fullscreen) | 완성 | Ink/React |
| Desktop App | **개발 중** (Tauri v2) | Web React |
| VSCode Extension | 계획 | webview |

### 아키텍처 원칙
- `core/` 엔진은 UI 독립적 유지
- `headless.ts` (JSON-line 프로토콜)이 앱/익스텐션 통신 기반
- core 수정은 4개 플랫폼에 자동 반영
- UI 특화 로직은 각 UI 레이어에서만 처리

---

## 커밋 히스토리

| 커밋 | 메시지 |
|------|--------|
| `b3f4d54` | docs(skills): Level 2 스킬 시스템 설계 + 구현 계획 |
| `111e5e0` | fix(security): CRITICAL+HIGH 취약점 수정 + 엔드포인트 검증 강화 |
| `8ae4b8d` | fix(tui): require() → ESM imports |
| `4fc8754` | refactor(roles): 3모드 (hanimo/dev/plan) |
| `b91d495` | fix(tui): 설정 초기화 즉시 종료 |
| `d22f8d9` | docs: 팀 배포 가이드 추가 |
| `40cf5c8` | fix(providers): custom을 LOCAL_PROVIDERS에서 제거 |
| `1721964` | fix: CRASH+ERROR 5건 수정 |
| `06eb50c` | fix: LOW 5건 수정 |

---

## 다음 단계 (우선순위)

1. **스킬 시스템 구현** — 10개 태스크 (설계 완료, 계획 완료)
2. **Desktop App 완성** — Tauri v2 (현재 다른 세션에서 진행 중)
3. **Core 엔진 분리** — headless.ts 확장, UI 의존성 완전 제거
4. **agent-loop 안정화** — retry/backoff, 토큰 기반 컴팩션
5. **VSCode Extension** — 계획 단계
