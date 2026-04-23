# modol/hanimo 개선 플랜 — Claude Code 아키텍처 참고

> **작성일**: 2026-04-01
> **참고**: `docs/09-claude-code-leak-analysis.md`
> **대상**: hanimo v0.1.0 (~7,800 lines)

---

## 현재 상태 요약

### hanimo가 이미 잘하고 있는 것

| 영역 | 현재 구현 | 평가 |
|------|----------|------|
| `.hanimo.md` 계층 로딩 | CWD부터 상위까지 탐색 | Claude Code와 동등 |
| Provider 다양성 | 14개 프로바이더 (로컬 우선) | Claude Code보다 우수 |
| Hash-Anchored 편집 | MD5 해시로 stale edit 방지 | 독창적 (Claude Code에 없음) |
| Multi-Endpoint | 라운드로빈 로드밸런싱 | 독창적 |
| 경로 샌드박스 | sensitive path 패턴 차단 | 기본 수준 구현 |
| 세션 저장/복원 | JSON 파일 기반 | 기본 수준 구현 |
| MCP 통합 | stdio/SSE 지원 | 기본 수준 구현 |
| Auto Loop | [AUTO_COMPLETE]/[AUTO_PAUSE] 시그널 | 기본 수준 구현 |
| 역할 시스템 | chat/dev/plan + 커스텀 역할 | Claude Code에 없는 기능 |

### 핵심 격차 (Gap)

| 영역 | Claude Code | hanimo 현재 | 격차 |
|------|------------|-------------|------|
| 압축 전략 | 5가지 (snip/micro/collapse/auto/truncation) | 2가지 (LLM 요약 + 잘라내기) | 높음 |
| 훅 시스템 | 25+ 이벤트, 외부 스크립트 실행 | 없음 (이벤트만 존재) | **매우 높음** |
| 도구 동시성 | safe 병렬(10개), unsafe 순차 | 순차 실행만 | 높음 |
| 권한 자동화 | LLM 2단계 분류기 + glob 규칙 | ask/allow 이분법 | 중간 |
| 에이전트 통신 | SendMessage 양방향 | 결과 합성만 (단방향) | 높음 |
| 메모리 | MEMORY.md + autoDream | 없음 (skills만) | **매우 높음** |
| 세션 포크 | 대화 분기점에서 fork | 없음 | 중간 |
| 피처 플래그 | 44개 런타임 플래그 | config 토글만 | 중간 |
| Headless 모드 | JSON I/O (CI/CD) | 없음 | 중간 |
| 프롬프트 캐시 | cache_control ephemeral | 없음 | 중간 |

---

## Phase 1: 기반 인프라 (1~2주)

> 다른 모든 개선의 전제 조건이 되는 핵심 인프라

### 1.1 훅 시스템 (Hook System)

**목표**: 도구 실행 전후로 외부 스크립트/함수를 실행할 수 있는 미들웨어 레이어

**현재 문제**:
- `onEvent` 콜백이 있지만 도구 실행을 차단/수정할 수 없음
- 사용자가 커스텀 검증/로깅을 추가할 방법이 없음
- 커뮤니티 확장이 불가능

**구현 계획**:

```
src/core/hooks.ts (신규)
```

```typescript
// 핵심 인터페이스
interface HookDefinition {
  event: HookEvent;
  matcher?: string;        // 도구 이름 glob ("Bash", "write_*", "*")
  command?: string;        // 외부 쉘 명령
  handler?: HookHandler;   // 프로그래밍 방식 핸들러
  timeout?: number;        // ms (기본 10000)
}

type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'UserPromptSubmit'
  | 'SessionStart'
  | 'SessionStop'
  | 'PreCompaction'
  | 'PostCompaction';

interface HookResult {
  proceed: boolean;        // false면 도구 실행 차단
  modifiedArgs?: unknown;  // 인자 수정 (PreToolUse)
  injection?: string;      // 시스템 프롬프트에 주입할 텍스트
}
```

**변경 파일**:
- `src/core/hooks.ts` — 신규: HookManager 클래스
- `src/core/agent-loop.ts` — 수정: 도구 실행 전후 훅 호출
- `src/config/schema.ts` — 수정: hooks 필드 추가
- `src/core/system-prompt.ts` — 수정: 훅 injection 텍스트 주입

**구성 예시** (`~/.hanimo/config.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "shell_exec",
        "command": "echo $TOOL_INPUT | my-validator.sh"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "command": "my-logger.sh $TOOL_NAME"
      }
    ],
    "SessionStart": [
      {
        "command": "echo 'Session started at $(date)' >> ~/.hanimo/log.txt"
      }
    ]
  }
}
```

### 1.2 메모리 시스템 (Memory)

**목표**: 세션 간 지식 축적 — 프로젝트별 학습 곡선 단축

**현재 문제**:
- skills (마크다운 파일)는 정적 지식만 저장
- 세션에서 학습한 내용이 다음 세션으로 전달되지 않음
- 사용자가 반복적으로 같은 맥락을 설명해야 함

**구현 계획**:

```
src/core/memory.ts (신규)
```

**구조**:
```
~/.hanimo/
  memory/
    MEMORY.md              ← 인덱스 (200라인 제한, 시스템 프롬프트에 자동 로드)
    patterns.md            ← 토픽별 상세 파일
    debugging.md
    project-context.md
```

**핵심 기능**:
1. `MEMORY.md` 자동 로드 → 시스템 프롬프트에 주입
2. `memory_write` 도구 → LLM이 중요 정보를 메모리에 기록
3. `memory_read` 도구 → 특정 토픽의 상세 내용 조회
4. 200라인 제한 → 초과 시 가장 오래된 항목 아카이브

**변경 파일**:
- `src/core/memory.ts` — 신규: MemoryManager
- `src/tools/memory.ts` — 신규: memory_write, memory_read 도구
- `src/tools/registry.ts` — 수정: 메모리 도구 등록
- `src/core/system-prompt.ts` — 수정: MEMORY.md 내용 주입

### 1.3 피처 플래그 시스템

**목표**: 실험적 기능을 안전하게 활성화/비활성화

**현재 문제**:
- config의 boolean 토글만 존재
- 런타임 변경 불가
- 새 기능 추가 시 항상 전체 배포 필요

**구현 계획**:

```
src/core/feature-flags.ts (신규)
```

```typescript
interface FeatureFlags {
  PARALLEL_TOOLS: boolean;       // Phase 2
  AUTO_PERMISSION: boolean;      // Phase 2
  MEMORY_SYSTEM: boolean;        // Phase 1
  HOOK_SYSTEM: boolean;          // Phase 1
  SESSION_FORK: boolean;         // Phase 3
  HEADLESS_MODE: boolean;        // Phase 3
  PROMPT_CACHE: boolean;         // Phase 2
  COORDINATOR_MODE: boolean;     // Phase 4
}
```

**제어 우선순위**: CLI 인자 > 환경변수 > config.json > 기본값

---

## Phase 2: 성능 + UX (2~3주)

> 사용 경험을 크게 개선하는 핵심 기능

### 2.1 다단계 컨텍스트 압축

**목표**: 5단계 압축으로 긴 대화에서도 컨텍스트 유지

**현재 문제**:
- LLM 요약 1가지 + 잘라내기 1가지만 존재
- 도구 결과가 매우 클 때 (파일 읽기 등) 비효율적
- 중요한 컨텍스트가 잘라내기에서 유실될 수 있음

**구현 계획**:

```
src/core/compaction.ts 확장
```

**5단계 파이프라인**:
```
1. Snip (도구 결과)
   - 도구 결과가 N줄 초과 시 "[snipped: 200 lines from read_file]"
   - 최근 3개 도구 결과는 보존, 나머지는 snip

2. Micro (개별 메시지)
   - 단일 메시지가 2000토큰 초과 시 핵심만 추출
   - 코드 블록 → 시그니처만 보존

3. Collapse (코드 블록)
   - 연속된 코드 출력 → "Code output (45 lines)" 접기
   - diff 출력 → 변경 요약만 보존

4. Auto Compact (LLM 요약)
   - 전체 토큰 80% 초과 시 발동
   - 현재 compactMessages() 확장

5. Truncation (최후 수단)
   - 처음 2개 + 최근 N개만 보존
   - 현재 truncateMessages() 유지
```

**변경 파일**:
- `src/core/compaction.ts` — 대폭 확장: 5단계 파이프라인
- `src/core/agent-loop.ts` — 수정: 압축 파이프라인 호출

### 2.2 도구 병렬 실행

**목표**: 읽기 전용 도구를 병렬 실행하여 속도 개선

**현재 문제**:
- Vercel AI SDK의 `streamText()`가 도구를 순차 실행
- 여러 파일을 읽을 때 불필요하게 느림

**구현 계획**:

```typescript
// src/core/tool-concurrency.ts (신규)

const SAFE_TOOLS = new Set([
  'read_file', 'hashline_read', 'glob_search', 'grep_search',
  'git_status', 'git_diff', 'git_log', 'webfetch', 'diagnostics',
]);

const MAX_PARALLEL = 8;

function classifyToolCall(name: string): 'safe' | 'unsafe' {
  return SAFE_TOOLS.has(name) ? 'safe' : 'unsafe';
}
```

**실행 모델**:
- LLM이 여러 도구를 한 턴에 호출할 때:
  - safe 도구끼리: `Promise.all()` (최대 8개)
  - unsafe 도구: 순차 실행
  - safe + unsafe 혼합: safe 먼저 병렬 → unsafe 순차

**변경 파일**:
- `src/core/tool-concurrency.ts` — 신규: 도구 분류 + 병렬 실행기
- `src/core/agent-loop.ts` — 수정: 도구 실행 경로 변경

### 2.3 권한 자동화 (Auto Permission)

**목표**: 매번 물어보지 않고 LLM 또는 규칙 기반으로 자동 판단

**현재 문제**:
- `requireApproval: true`면 모든 쓰기/실행에 물어봄
- 반복적인 승인 요청이 workflow를 방해
- glob 패턴 기반 세분화 규칙 없음

**구현 계획**:

```typescript
// src/core/permission.ts 확장

type PermissionMode = 'default' | 'auto' | 'plan' | 'bypass';

interface PermissionRule {
  tool: string;           // glob: "shell_exec", "write_*", "*"
  argMatch?: string;      // 인자 패턴: "npm test", "rm *"
  action: 'allow' | 'deny' | 'ask';
}
```

**설정 예시**:
```json
{
  "permissionMode": "auto",
  "permissionRules": [
    { "tool": "shell_exec", "argMatch": "npm test*", "action": "allow" },
    { "tool": "shell_exec", "argMatch": "npm run*", "action": "allow" },
    { "tool": "shell_exec", "argMatch": "rm *", "action": "deny" },
    { "tool": "write_file", "argMatch": "*.test.*", "action": "allow" },
    { "tool": "git_commit", "action": "ask" }
  ]
}
```

**변경 파일**:
- `src/core/permission.ts` — 확장: glob 규칙 매칭
- `src/core/permission-gate.ts` — 확장: 규칙 기반 판단
- `src/config/schema.ts` — 수정: permissionRules 필드

### 2.4 프롬프트 캐시 지원

**목표**: Anthropic/OpenAI의 프롬프트 캐시 API 활용

**현재 문제**:
- 매 턴마다 시스템 프롬프트 + 도구 정의 전체 과금
- 긴 대화에서 비용이 급증

**구현 계획**:

Anthropic의 `cache_control` 지원:
```typescript
// src/providers/registry.ts 확장

// Anthropic provider에 cache_control 헤더 추가
// 시스템 프롬프트와 도구 정의에 ephemeral 캐시 마킹
```

OpenAI의 automatic prompt caching 활용:
- 동일 prefix 기반 자동 캐시 (OpenAI가 자동 처리)
- 시스템 프롬프트를 항상 동일하게 유지하여 캐시 히트율 극대화

**변경 파일**:
- `src/providers/registry.ts` — 수정: 캐시 헤더 추가
- `src/core/agent-loop.ts` — 수정: 캐시 친화적 메시지 구조

---

## Phase 3: 확장 기능 (3~4주)

> 고급 사용자를 위한 차별화 기능

### 3.1 Headless 모드

**목표**: JSON stdin/stdout으로 CI/CD 파이프라인에서 사용

**구현 계획**:

```bash
# 사용법
echo '{"prompt": "fix the failing test"}' | hanimo --headless
# 출력: JSON 스트림 (도구 호출, 결과, 최종 응답)
```

```typescript
// src/headless.ts (신규)
interface HeadlessInput {
  prompt: string;
  context?: string[];      // 추가 파일 경로
  maxSteps?: number;
  tools?: string[];        // 허용할 도구 목록
}

interface HeadlessOutput {
  type: 'tool-call' | 'tool-result' | 'text' | 'done' | 'error';
  data: unknown;
  timestamp: string;
}
```

**변경 파일**:
- `src/headless.ts` — 신규: Headless 모드 엔트리
- `src/cli.ts` — 수정: `--headless` 옵션 추가

### 3.2 세션 포크 (Session Fork)

**목표**: 대화 특정 시점에서 분기하여 다른 접근 시도

**구현 계획**:

```bash
# TUI에서 Ctrl+F → 현재 시점에서 세션 분기
# CLI: hanimo --fork <sessionId> --at <messageIndex>
```

```typescript
// src/session/store.ts 확장
forkSession(
  sessionId: string,
  atMessageIndex?: number  // 없으면 마지막 메시지에서 fork
): string  // 새 세션 ID 반환
```

**변경 파일**:
- `src/session/store.ts` — 확장: forkSession 메서드
- `src/cli.ts` — 수정: `--fork` 옵션 추가
- `src/tui/app.tsx` — 수정: Ctrl+F 키바인딩

### 3.3 에이전트 간 통신 (Inter-Agent Communication)

**목표**: Worker 에이전트가 서로 메시지를 주고받을 수 있게

**현재 문제**:
- Orchestrator가 작업 분해 → 실행 → 합성만 수행
- Worker 간 컨텍스트 공유 불가
- Leader가 중간 결과를 보고 방향 수정 불가

**구현 계획**:

```typescript
// src/agents/message-bus.ts (신규)
interface AgentMessage {
  from: string;       // agent ID
  to: string;         // agent ID 또는 'leader'
  content: string;
  timestamp: number;
}

class MessageBus {
  send(msg: AgentMessage): void;
  receive(agentId: string): AgentMessage[];
  subscribe(agentId: string, callback: (msg: AgentMessage) => void): void;
}
```

**변경 파일**:
- `src/agents/message-bus.ts` — 신규
- `src/agents/orchestrator.ts` — 수정: MessageBus 통합
- `src/agents/sub-agent.ts` — 수정: 메시지 수신/발신 기능

### 3.4 도구 결과 캐싱

**목표**: 같은 파일 반복 읽기 등 중복 도구 호출 결과 캐싱

**구현 계획**:

```typescript
// src/core/tool-cache.ts (신규)
class ToolResultCache {
  private cache: Map<string, { result: unknown; timestamp: number }>;
  private ttl: number;  // ms

  getCacheKey(toolName: string, args: unknown): string;
  get(key: string): unknown | undefined;
  set(key: string, result: unknown): void;
  invalidate(pattern: string): void;  // 파일 쓰기 시 해당 파일 캐시 무효화
}
```

**캐시 가능 도구**: read_file, hashline_read, glob_search, grep_search, git_status
**무효화 트리거**: write_file, edit_file, shell_exec 실행 시 관련 캐시 제거

---

## Phase 4: 고급 아키텍처 (4~6주)

> Claude Code의 핵심 차별화 기능 벤치마킹

### 4.1 Coordinator 모드 (리더-워커 분리)

**목표**: Leader 에이전트가 직접 코드를 수정하지 않고 Worker에게만 위임

**현재 Orchestrator와의 차이**:
- 현재: LLM이 작업 분해 → 모든 Worker가 같은 도구 접근 → 결과 합성
- 목표: Leader는 계획/감독만, Worker는 실행만, 양방향 통신

**구현 계획**:

```typescript
// src/agents/coordinator.ts (신규)
class Coordinator {
  private leader: LeaderAgent;
  private workers: Map<string, WorkerAgent>;
  private taskList: SharedTaskList;
  private messageBus: MessageBus;

  async run(request: string): Promise<CoordinatorResult> {
    // 1. Leader가 작업 계획 수립
    // 2. Worker 할당 (동적 spawn)
    // 3. Worker 실행 + Leader 감독
    // 4. Leader가 결과 합성
  }
}

class LeaderAgent {
  // 도구: task_create, task_assign, send_message만 사용
  // read_file, write_file 등 코드 도구 없음
}

class WorkerAgent {
  // 전체 도구 접근 가능
  // 독립 컨텍스트
  // task_update, send_message 사용
}
```

**변경 파일**:
- `src/agents/coordinator.ts` — 신규
- `src/agents/leader-agent.ts` — 신규
- `src/agents/worker-agent.ts` — 신규
- `src/agents/shared-task-list.ts` — 신규
- `src/cli.ts` — 수정: `--coordinator` 옵션

### 4.2 autoDream (세션 종료 시 자동 메모리 추출)

**목표**: 세션 종료 시 중요 정보를 자동으로 MEMORY.md에 기록

**구현 계획**:

```typescript
// src/core/auto-dream.ts (신규)
async function extractMemories(
  model: LanguageModelV1,
  messages: Message[],
  existingMemory: string
): Promise<MemoryEntry[]> {
  // LLM에게 대화에서 학습할 만한 내용 추출 요청
  // 기존 메모리와 중복 제거
  // MEMORY.md에 append
}
```

**트리거**: 세션 종료 시 (exit, Ctrl+D, [AUTO_COMPLETE])

### 4.3 Viewer 모드 (세션 리플레이)

**목표**: 과거 세션을 읽기 전용으로 재생

```bash
hanimo --view <sessionId>
# 또는
hanimo --view --latest
```

---

## 구현 우선순위 매트릭스

| 기능 | 영향도 | 난이도 | 의존성 | Phase |
|------|--------|--------|--------|-------|
| **훅 시스템** | 매우 높음 | 중간 | 없음 | 1 |
| **메모리 시스템** | 매우 높음 | 중간 | 없음 | 1 |
| **피처 플래그** | 높음 | 낮음 | 없음 | 1 |
| **다단계 압축** | 높음 | 중간 | 없음 | 2 |
| **도구 병렬 실행** | 높음 | 높음 | AI SDK 제약 확인 | 2 |
| **권한 자동화** | 중간 | 중간 | 없음 | 2 |
| **프롬프트 캐시** | 중간 | 낮음 | Provider별 상이 | 2 |
| **Headless 모드** | 중간 | 낮음 | 없음 | 3 |
| **세션 포크** | 중간 | 낮음 | 없음 | 3 |
| **에이전트 통신** | 높음 | 높음 | 훅 시스템 | 3 |
| **도구 캐싱** | 중간 | 중간 | 없음 | 3 |
| **Coordinator 모드** | 매우 높음 | 매우 높음 | 에이전트 통신, 훅 | 4 |
| **autoDream** | 중간 | 중간 | 메모리 시스템 | 4 |
| **Viewer 모드** | 낮음 | 낮음 | 세션 저장 | 4 |

---

## 파일 변경 요약

### 신규 파일 (14개)

```
src/core/hooks.ts              ← 훅 매니저
src/core/memory.ts             ← 메모리 매니저
src/core/feature-flags.ts      ← 피처 플래그
src/core/tool-concurrency.ts   ← 도구 병렬 실행
src/core/tool-cache.ts         ← 도구 결과 캐싱
src/core/auto-dream.ts         ← 세션 종료 시 메모리 추출
src/tools/memory.ts            ← memory_write, memory_read 도구
src/agents/coordinator.ts      ← Coordinator 모드
src/agents/leader-agent.ts     ← Leader 에이전트
src/agents/worker-agent.ts     ← Worker 에이전트
src/agents/shared-task-list.ts ← 공유 태스크 리스트
src/agents/message-bus.ts      ← 에이전트 간 메시지 버스
src/headless.ts                ← Headless 모드
src/viewer.ts                  ← 세션 리플레이 뷰어
```

### 수정 파일 (8개)

```
src/core/agent-loop.ts         ← 훅/병렬/캐시 통합
src/core/compaction.ts         ← 5단계 파이프라인
src/core/permission.ts         ← 규칙 기반 확장
src/core/permission-gate.ts    ← Auto 모드 추가
src/core/system-prompt.ts      ← MEMORY.md 주입
src/config/schema.ts           ← hooks, flags, rules 필드
src/tools/registry.ts          ← 메모리 도구 등록
src/cli.ts                     ← --headless, --fork, --coordinator, --view
src/session/store.ts           ← forkSession 메서드
```

---

## hanimo만의 차별화 유지 포인트

Claude Code를 참고하되, hanimo의 독자적 강점을 유지/강화해야 함:

1. **Provider 다양성**: 14개 프로바이더 + 커스텀 프로바이더 → Claude Code는 Anthropic만
2. **로컬 모델 우선**: Ollama/vLLM/LM Studio → 프라이버시 보장
3. **Hash-Anchored 편집**: MD5 해시 기반 stale edit 방지 → Claude Code에 없는 독창적 기능
4. **Multi-Endpoint**: 같은 모델의 여러 엔드포인트 라운드로빈 → 대규모 작업 시 레이트리밋 회피
5. **역할 시스템**: chat/dev/plan + 커스텀 역할 → Claude Code에 없음
6. **경량성**: ~7,800 lines vs 512,000+ lines → 이해하기 쉽고 기여하기 쉬움

---

## 성공 지표 (KPI)

| 지표 | 현재 | Phase 2 후 목표 | Phase 4 후 목표 |
|------|------|----------------|----------------|
| 평균 응답 속도 (도구 포함) | 측정 안 됨 | 30% 개선 (병렬화) | 50% 개선 |
| 긴 대화 컨텍스트 유지율 | ~60% | ~85% (5단계 압축) | ~95% |
| 사용자 승인 클릭 수/세션 | ~15회 | ~5회 (auto permission) | ~2회 |
| 세션 간 컨텍스트 전달 | 0% | 70% (메모리) | 90% (autoDream) |
| CI/CD 통합 가능 | 불가 | 가능 (headless) | 완전 지원 |

---

*다음 단계: Phase 1 (훅 + 메모리 + 피처 플래그)부터 구현 시작. `src/core/hooks.ts`가 첫 번째 파일.*
