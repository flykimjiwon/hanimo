# hanimo — Karpathy Loop Program

> "점수를 매길 수 있으면, 자동으로 개선할 수 있다."

## 개요

너는 hanimo(하니모) 프로젝트의 **자율 개선 에이전트**야.
hanimo은 터미널 기반 멀티 프로바이더 AI 코딩 에이전트 (TypeScript, Node.js, Ink/React TUI).

이 program.md를 읽고, 아래 루프를 **무한 반복**해.
사람 개입 없이 코드를 읽고, 한 가지를 바꾸고, 점수를 측정하고, 개선이면 커밋, 아니면 되돌려.

## 프로젝트 구조

```
src/
├── core/          # agent-loop, system-prompt, compaction, auto-loop, permission
├── tools/         # 16개 도구 (hashline, webfetch, todo, batch, diagnostics 등)
├── providers/     # 14개 LLM 프로바이더 (Ollama, OpenAI, Anthropic, Google 등)
├── tui/           # Ink/React 풀스크린 TUI (app.tsx, components/, hooks/)
├── agents/        # orchestrator, sub-agent
├── config/        # Zod 스키마, loader
├── roles/         # dev/plan/chat 역할 시스템
├── session/       # JSON 파일 기반 세션 저장
├── mcp/           # MCP 클라이언트 (stdio + SSE)
├── cli.ts         # Commander CLI 진입점
└── text-mode.ts   # readline 기반 경량 모드
tests/             # Vitest 테스트 (현재 95개)
```

## 점수 측정 방법

매 실험마다 아래 3개를 실행하고 점수를 계산해:

### Step 1: 테스트
```bash
npx vitest run 2>&1
```
→ 통과 테스트 수 (passed), 실패 수 (failed) 파싱

### Step 2: 타입 체크
```bash
npx tsc --noEmit 2>&1 | grep -v "mcp/" | grep -c "error TS" || echo 0
```
→ TypeScript 에러 수 (mcp/ 디렉토리는 기존 이슈라 제외)

### Step 3: 빌드 확인
```bash
npx tsc --noEmit 2>&1 | grep -v "mcp/"
```
→ 빌드 성공 여부

### 점수 공식
```
SCORE = (통과_테스트_수 * 2) - (실패_테스트_수 * 20) - (TS_에러_수 * 10)
```

**현재 베이스라인**: 95 passed, 0 failed, 0 TS errors → **SCORE = 190**

## 실험 루프

```
무한 반복:
  1. git stash (안전장치)
  2. 개선 아이디어 하나를 선택 (아래 목록에서)
  3. **하나의 파일만** 수정
  4. 점수 측정 (위 3단계)
  5. IF 점수 상승:
       git stash drop
       git add -A
       git commit -m "loop(#{실험번호}): {개선내용} | score={점수} (+{변화})"
     ELSE:
       git stash pop (되돌림)
  6. results.tsv에 결과 기록
  7. 다음 실험으로
```

## 결과 기록

매 실험 후 `results.tsv`에 한 줄 추가:

```
실험번호	점수	변화	통과테스트	실패테스트	TS에러	수정파일	개선내용	유지여부
```

## 개선 아이디어 목록 (우선순위순)

### Tier 1: 테스트 추가 (가장 안전, 점수 직접 상승)
- [ ] batch 도구 테스트 추가 (reads, globs 병렬 실행 검증)
- [ ] lsp-diagnostics 도구 테스트 (tsc/eslint 파싱 검증)
- [ ] compaction 모듈 테스트 (요약 + 폴백 경로)
- [ ] auto-loop 테스트 (종료 조건: AUTO_COMPLETE, AUTO_PAUSE, max iterations)
- [ ] notify 모듈 테스트 (bell 함수, macOS 분기)
- [ ] webfetch HTML→텍스트 변환 엣지 케이스 (스크립트 제거, 엔티티 디코딩)
- [ ] hashline-edit 동시 수정 충돌 테스트
- [ ] session store: 빈 세션, 대량 세션, 손상된 JSON 처리

### Tier 2: 코드 품질 (안전, 간접 개선)
- [ ] 도구 description 개선 → LLM이 도구를 더 정확하게 선택
- [ ] 에러 메시지 개선 → 디버깅 힌트 추가
- [ ] 타입 안전성 강화 (unknown → 적절한 타입)
- [ ] 사용하지 않는 import 제거
- [ ] 매직 넘버를 상수로 추출

### Tier 3: 기능 개선 (중간 위험)
- [ ] grep_search에 --context 옵션 추가 (앞뒤 N줄)
- [ ] shell_exec에 stdin 지원 추가
- [ ] read_file에 encoding 옵션 추가
- [ ] session store에 자동 정리 (30일 이상 된 세션 삭제)
- [ ] 시스템 프롬프트에 현재 시간 추가

### Tier 4: 성능 최적화 (높은 위험)
- [ ] provider 캐시 TTL 추가 (메모리 누수 방지)
- [ ] 대용량 파일 읽기 시 스트리밍 처리
- [ ] glob_search 결과 캐싱

## 제약 조건

1. **한 번에 하나의 파일만 수정** — 변경 범위를 최소화
2. **기존 95개 테스트는 절대 깨지면 안 됨** — 깨지면 즉시 되돌림
3. **mcp/ 디렉토리는 건드리지 마** — 기존 타입 이슈가 있음
4. **외부 의존성 추가 금지** — 제로 네이티브 의존성 원칙 유지
5. **README, docs 파일은 수정하지 마** — 코드만 건드려
6. **커밋 메시지에 실험 번호와 점수 변화를 반드시 포함**

## 시작 프롬프트

이 program.md를 읽었으면, 아래 순서로 시작해:

1. 현재 점수 측정 (베이스라인)
2. results.tsv 파일 생성 (헤더 행)
3. Tier 1 아이디어부터 순서대로 실험 시작
4. 멈추지 마. 계속 돌려.
