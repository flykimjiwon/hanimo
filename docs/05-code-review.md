# 05. 코드 리뷰 — 현재 소스 품질 및 구조 분석

> 작성일: 2026-03-26 | 대상: hanimo v0.1.0 (커밋 `4395a0f`)

---

## 빌드 상태

- `tsc --noEmit`: **통과** (타입 에러 없음)
- `npm install`: 정상 완료

---

## 전체 이슈 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| CRITICAL | 2 | 반드시 수정 |
| HIGH | 5 | 수정 권장 |
| MEDIUM | 6 | 고려 |
| LOW | 4 | 선택 |

---

## CRITICAL 이슈

### 1. API 키 평문 저장
- **파일**: `src/onboarding.ts:191`
- **문제**: `~/.hanimo/config.json`에 API 키가 평문 JSON으로 저장됨
- **영향**: 홈 디렉토리 읽기 권한 있는 누구나 키 탈취 가능
- **수정안**: 파일 권한 `0600` 설정, 가능하면 시스템 키체인(`keytar`) 사용

### 2. 캐시 키에 API 키 포함
- **파일**: `src/providers/registry.ts:84`
- **문제**: `providerCache`의 Map 키에 API 키 원문이 포함됨
- **영향**: 힙 덤프, 디버거, 로깅 시 비밀키 노출
- **수정안**: `crypto.createHash('sha256').update(apiKey).digest('hex').slice(0,16)` 사용

---

## HIGH 이슈

### 3. `--resume` 플래그 미구현
- **파일**: `src/cli.ts:22, 30`
- **문제**: CLI 옵션 파싱만 하고 실제 세션 복원 로직 없음
- **수정안**: `SessionStore.getSession()`으로 이전 메시지 로드 → messages 배열에 주입

### 4. SessionStore 미사용 (죽은 코드)
- **파일**: `src/session/` 전체
- **문제**: `--list-sessions`에서만 인스턴스 생성, 실제 대화 중 세션 저장 안 됨
- **수정안**: text-mode/TUI에서 `createSession()` + `saveMessage()` 호출 연결

### 5. 토큰 사용량 이중 카운팅
- **파일**: `src/core/agent-loop.ts:67-71, 110-113`
- **문제**: `onStepFinish`에서 누적 + `finalResult.usage`로 덮어쓰기 → 이중 로직
- **수정안**: `onStepFinish` 누적 제거, `finalResult.usage` (AI SDK 누적 합산값)만 사용

### 6. Coordinator/멀티에이전트 미연결
- **파일**: `src/agents/` 전체
- **문제**: `Coordinator`, `WorkerPool`, `FileLockManager` 구현되어 있으나 CLI에서 호출 안 됨
- **수정안**: 통합하거나, experimental로 문서화 후 `index.ts`에서 export

### 7. `text-mode.ts` 모놀리스 (632줄)
- **파일**: `src/text-mode.ts`
- **문제**: ANSI 렌더링, 메뉴, 슬래시 명령, 모델 전환, 대화 관리 모두 한 파일에 혼재
- **영향**: VS Code 익스텐션에서 대화 관리 로직 재사용 불가
- **수정안**: 아래처럼 분리
  ```
  core/slash-commands.ts      — 명령 파싱/실행 (UI 무관)
  core/conversation-manager.ts — 메시지 히스토리, 모델 전환
  text-mode/renderer.ts       — ANSI, 메뉴, 배너
  text-mode/index.ts          — 위 모듈 조합
  ```

---

## MEDIUM 이슈

| # | 이슈 | 파일 |
|---|------|------|
| 8 | `listOllamaModels()` 중복 구현 | `onboarding.ts:25` / `text-mode.ts:164` |
| 9 | `emptyUsage()` 헬퍼 중복 | `agents/coordinator.ts:24` / `worker-pool.ts:20` |
| 10 | `modelId` 추출시 unsafe 타입 단언 | `tui/hooks/use-agent.ts:90` |
| 11 | `FileDiff` 컴포넌트 미사용 | `tui/components/file-diff.tsx` |
| 12 | `estimateCost` 가격 데이터 하드코딩 | `core/agent-loop.ts:10-31` |
| 13 | onboarding 저장 스키마 ↔ config 스키마 불일치 가능 | `onboarding.ts:14` vs `config/schema.ts` |

---

## LOW 이슈

| # | 이슈 | 파일 |
|---|------|------|
| 14 | shell 위험 명령 감지 우회 용이 | `tools/shell-exec.ts:5-15` |
| 15 | `requireApproval` 설정 정의만, 미적용 | `config/schema.ts:20` |
| 16 | React key에 배열 index 사용 | `tui/components/chat-view.tsx:83` |
| 17 | `void origWrite` 미사용 변수 | `text-mode.ts:602` |

---

## 코어/UI 분리 현황

| 레이어 | VS Code 재사용 가능? | 비고 |
|--------|---------------------|------|
| `core/agent-loop.ts` | **Yes** | 순수 async 함수, UI 의존 없음 |
| `core/system-prompt.ts` | **Yes** | 순수 문자열 빌더 |
| `providers/` | **Yes** | 깔끔한 팩토리 패턴 |
| `tools/` | **Yes** | Zod 검증 도구 정의 |
| `config/` | **Yes** | Zod + 파일시스템 |
| `session/` | **부분적** | SQLite OK, 실제 미사용 |
| `agents/` | **이론적** | 미연결, 미테스트 |
| `text-mode.ts` | **No** | 터미널 전용 모놀리스 |
| `tui/` | **No** | Ink/React 전용 |

### 긍정적 평가

1. `index.ts`가 TUI 없이 코어만 깔끔하게 export
2. 도구 정의(`tools/`)가 Zod 검증 + 일관된 패턴
3. 설정 시스템 4단 레이어링 (defaults → user → project → env)
4. `FileLockManager` 동시성 처리 잘 설계됨
5. TUI를 dynamic import로 필요시만 로드
6. TODO/FIXME 없음 — 깨끗한 코드베이스
