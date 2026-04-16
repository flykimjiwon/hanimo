# hanimo 고도화 계획 — 룰베이스 강화 + 오픈소스 분석

> **작성일**: 2026-04-16  
> **대상 버전**: v0.7 ~ v1.0  
> **목표**: 터미널 AI 코딩 에이전트의 안정성, 자율성, 커뮤니티 생태계 강화  
> **주요 전략**: 해시라인 편집 + 한국어 우선 + 룰 엔진 + 오픈소스 협력

---

## 1. 경쟁 오픈소스 분석

### 1.1 Claude Code (Anthropic 공식)

**강점:**
- SWE-bench 80.9% (업계 최고 성능)
- Opus 4.6 모델 + 1M context window
- Agent Teams (멀티 에이전트 오케스트레이션)
- 시스템 프롬프트 기반 자기규율 (read-before-write, tool use 규칙)
- Permission 시스템 (allowedTools, blockedTools)
- Context compaction (자동 요약 + 캐시)
- Hooks 시스템 (pre/post tool use 이벤트)
- Session 영속화 + memory 시스템

**약점:**
- 단일 LLM 프로바이더 (Anthropic만)
- 구독료 필수
- 폐쇄 아키텍처

**hanimo의 대응 전략:**
- Hash-anchored edit로 Claude Code의 precise edit 초과 달성
- 14+ LLM 프로바이더로 개방성 강조
- 한국어 clarify-first 정책으로 차별화
- 오픈소스 커뮤니티 생태계 구축

---

### 1.2 OpenCode (오픈소스, 75+ 프로바이더)

**강점:**
- Bubble Tea 기반 성숙한 TUI
- 75+ LLM 프로바이더 지원
- 월 2.5M 활성 사용자
- LSP 통합 (go-to-definition, find-references)
- Diff 미리보기 + 승인 워크플로우
- `.opencode.md` 프로젝트 컨텍스트 파일

**약점:**
- 한국어 UX 약함
- Hash-anchored edit 미지원
- Repo-map 없음
- MCP 통합 미흡

**hanimo의 대응 전략:**
- Hash-anchored edit로 편집 안정성 강화
- LSP 통합 추진 (Phase D)
- Repo-map 구현으로 심볼 검색 성능 향상
- MCP ecosystem 풍성하게

---

### 1.3 Aider (오픈소스, 39K 스타)

**강점:**
- Git 자동 커밋 (변경 후 자동 staging)
- Precise edit (라인 단위 정확한 편집)
- Pair programming 문화와 커뮤니티
- Lint + test 자동 실행
- 대화 히스토리 + 편집 히스토리 분리
- `.aider.conf` 설정 시스템

**약점:**
- TUI가 투박함 (readline 기반)
- MCP 지원 약함
- 멀티 프로바이더 약함
- 한국어 미지원

**hanimo의 대응 전략:**
- Git 자동 커밋 기능 추가 (선택적, Phase C)
- TUI 품질 (Bubble Tea v2) 유지로 우월성 강조
- MCP first 정책으로 생태계 확장
- 자동 lint/test 루프 구현

---

### 1.4 Cursor Agent (IDE 통합)

**강점:**
- IDE 딥 통합 (코드 문맥 이해 최강)
- 코드베이스 자동 인덱싱
- 네이티브 LSP 지원

**약점:**
- CLI 불가능 (IDE 종속)
- 폐쇄 소스

**hanimo의 대응 전략:**
- CLI 우선 정책 유지 (IDE 독립적)
- Repo-map으로 코드베이스 이해 수준 근접
- MCP를 통한 IDE 연동 가능하게

---

### 1.5 Cline / Continue (오픈소스)

**강점:**
- BYOM (Bring Your Own Model)
- 무료, LLM 비용만 부담
- IDE+CLI 브릿지

**약점:**
- 에이전트 지능 평범
- 커뮤니티 불안정

**hanimo의 대응 전략:**
- BYOM 정책 강화 (14+ 프로바이더)
- 에이전트 지능 (Phase B, C)으로 우월성 확보
- 공식 지원 + 커뮤니티 거버넌스로 신뢰성 구축

---

## 2. hanimo 현재 수준 vs 목표

### 2.1 기능 비교 매트릭스

| 기능 | hanimo v0.6 | Claude Code | OpenCode | Aider | 목표 (v1.0) |
|---|:---:|:---:|:---:|:---:|:---:|
| 멀티 프로바이더 | ✅ 14+ | ❌ 1 | ✅ 75+ | ✅ 15+ | ✅ 20+ |
| **Hash-anchored edit** | ✅⭐ | ❌ | ❌ | ❌ | ✅⭐ |
| **한국어 clarify-first** | ✅⭐ | ❌ | ❌ | ❌ | ✅⭐ |
| MCP 지원 | ✅ | ✅ | ⚠️ | ⚠️ | ✅✅ |
| 3-stage compaction | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| TUI 품질 | ✅ | N/A | ✅ | ⚠️ | ✅ |
| Repo-map / 심볼 검색 | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Skill 시스템** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Hooks 시스템** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Subagent 병렬화** | ❌ | ✅ | ❌ | ❌ | ✅ |
| Permission 5-mode | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| LSP 통합 | ❌ | ✅ | ✅ | ❌ | ✅ |
| Prompt caching | ❌ | ✅ | ❌ | ❌ | ✅ |
| Git auto-commit | ❌ | ❌ | ✅ | ✅ | ✅ |
| Diff 미리보기 + 승인 | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| API 서버 모드 | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |

### 2.2 현재 상태 (v0.6 기준)

**이미 구현:**
- ✅ 14+ LLM 프로바이더 추상화
- ✅ Hash-anchored edit (유일한 자산)
- ✅ MCP 클라이언트 (stdio)
- ✅ 3-stage compaction (snip → micro → LLM summary)
- ✅ SQLite 세션 (save / load / fork / search)
- ✅ 프로젝트 메모리 (SQLite 기반)
- ✅ Agent 자율 모드 (/auto, 최대 20회 반복)
- ✅ Command palette (Ctrl+K 퍼지 검색)
- ✅ 5가지 테마 + 한국어 i18n
- ✅ Deep agent mode (100회 반복)

**누락:**
- ❌ Repo-map (tree-sitter 기반 심볼 인덱싱)
- ❌ Skill 시스템 (재사용 가능한 자동화)
- ❌ Hooks 시스템 (이벤트 기반 확장)
- ❌ Subagent (독립적 컨텍스트 포킹)
- ❌ Permission 5-mode (읽기 전용 → 세분화)
- ❌ LSP 통합 (go-to-definition, diagnostics)
- ❌ Prompt caching (Anthropic cache_control)
- ❌ Git auto-commit (변경 후 자동 커밋)
- ❌ API 서버 모드 (HTTP REST)

---

## 3. 룰베이스 강화 계획 (Phase별)

### Phase A: 도구 사용 규칙 강화 (v0.7, 2~3주)

**목표**: 안정성 + 보안 강화. 이미 구현된 read-before-write를 더 엄격히 하고, 위험 패턴 탐지 고도화.

#### A1. Read-Before-Write 강제화

**현재:**
- File edit 도구 호출 시 기존 파일 읽기 강제

**개선:**
- 반복 도구 호출 탐지 강화: 같은 파일 3회 이상 편집 시 경고
- 대문자 규칙: 위험한 정규표현식 차단 (예: `.*` 만으로 전체 삭제 시도)
- 심볼 인텐트 검증: 함수 시그니처 변경 감지 시 사용 처 검색

**구현 파일:**
- `internal/tools/rules.go` (신규)
- `internal/tools/safety.go` (신규)

**테스트:**
```bash
# 위험한 패턴 차단 테스트
hanimo -p ollama -m qwen:8b
> 파일의 모든 라인 삭제해줄래?
[BLOCKED] Dangerous regex pattern: .*
```

---

#### A2. 위험 명령 2차 확인

**차단 리스트:**
- `rm -rf /`, `rm -rf .`, `git push --force`, `sudo *`, `curl ... -H 'Authorization*'`
- `chmod 000 *`, `chown root *`

**구현:**
- `internal/tools/dangerous.go` 패턴 매칭
- Pre-tool use hook으로 차단 전 사용자 확인

**설정 파일:** `~/.hanimo/dangerous-cmds.yaml`

```yaml
dangerous:
  patterns:
    - cmd: "rm -rf"
      severity: critical
      require_confirmation: true
    - cmd: "git push --force"
      severity: high
      require_confirmation: true
```

---

#### A3. 파일 크기 제한 경고

**규칙:**
- 50KB 이상 파일: "이 파일은 크기가 큽니다. repo-map이나 grep으로 관련 부분만 추출하시겠어요?"
- 1MB 이상: 읽기 자체 차단

**구현:**
- `internal/tools/file.go` 의 `fileRead()` 메서드에 size check 추가

---

#### A4. Secrets 탐지 범위 확대

**현재:**
- API 키 패턴 (sk-, nvt- 등)

**확장:**
- IP 주소 + 포트 (192.168.x.x, 10.0.x.x, localhost 제외)
- Bearer 토큰 (Authorization: Bearer eyJ...)
- DB 연결 문자열 (password= 포함)
- Private key 파일 (-----BEGIN PRIVATE KEY-----)
- AWS credential format

**구현 파일:**
- `internal/tools/secrets.go` (정규표현식 라이브러리 활용)

---

#### A5. 컨텍스트 윈도우 초과 경고

**규칙:**
- 컨텍스트 사용량 80%: "컨텍스트가 부족합니다. compaction을 권장합니다."
- 90%: "다음 도구 호출 후 자동 compaction 실행합니다."

**구현:**
- `internal/llm/client.go` 의 `RemainingTokens()` 메서드 활용

---

### Phase B: 컨텍스트 최적화 (v0.8, 2~3주)

**목표**: 대규모 코드베이스 처리 능력 강화. Repo-map + 관련 파일 자동 포함 + 프롬프트 캐싱.

#### B1. Repo-map 구현 (tree-sitter 기반)

**아키텍처:**
- `internal/repomap/` 패키지
  - `parser.go` — tree-sitter 래퍼 (smacker/go-tree-sitter CGO-free)
  - `graph.go` — symbol definition/reference 그래프 구축
  - `rank.go` — PageRank 알고리즘으로 중요도 계산
  - `cache.go` — SQLite 스키마 (symbols, refs, mtimes)
  - `inject.go` — 토큰 예산 안에서 상위 N개 심볼 마크다운 포맷

**지원 언어 (우선순위):**
1. Go, TypeScript, Python (가장 많은 사용처)
2. Rust, JavaScript, Java (차순위)
3. C, C++, C#, Ruby (필요시)

**도구:**
```
repomap_search(query: string, limit: int = 10) -> List[Symbol]
repomap_top(limit: int = 5, budget_tokens: int = 1000) -> MarkdownString
repomap_related(file: string) -> List[Symbol]
```

**세션 시작 시:**
- 프로젝트 루트에서 자동 repo-map 생성 (cold: <500ms, warm: <100ms)
- 상위 1K 토큰 분량을 `<project-map>` 블록으로 시스템 프롬프트에 주입

**성공 기준:**
- 10K 파일 레포 cold start: <300ms
- Warm query: <80ms
- 심볼 찾기 정확도: 95% 이상

---

#### B2. 관련 파일 자동 포함 (Import Graph)

**원리:**
- 사용자가 파일 편집 시, 그 파일의 import 그래프를 따라가며 관련 파일들을 자동으로 context에 추가

**구현:**
- `internal/repomap/imports.go` — import 그래프 추적
- DFS/BFS로 깊이 제한 (기본 2단계)

**설정:**
```yaml
context:
  auto_include_imports: true
  import_depth: 2
  max_related_files: 10
```

---

#### B3. Context Compaction 3단계 고도화

**현재:**
- snip (긴 파일 → 관련 함수만)
- micro (여러 파일 → 각 파일 100글자)
- llm_summary (모든 메시지 → LLM이 200글자 요약)

**개선:**
- **Stage 0 (eager)**: 사용자 입력 바로 전에 지난 10 메시지의 tool output만 마이크로로 압축
- **Stage 1 (snip)**: 파일 크기 > 10K인 경우 관련 범위만 추출
- **Stage 2 (micro)**: 5개 이상 파일이 context에 있으면 각 파일 200글자로
- **Stage 3 (llm_summary)**: 전체 메시지가 60K 토큰 초과 시, LLM 2초 요약

**설정:**
```yaml
compaction:
  snip_threshold: 10000  # bytes
  micro_files_threshold: 5
  micro_length: 200
  llm_threshold: 60000   # tokens
```

---

#### B4. 프롬프트 캐싱 (Anthropic)

**지원 프로바이더:**
- Anthropic (cache_control 지원)
- OpenAI (예정, o1-preview 이상)

**활용:**
- 시스템 프롬프트 + repo-map 캐싱 (session 동안 고정)
- 파일 snapshot 캐싱 (파일 수정 전까지 유지)

**구현:**
- `internal/llm/providers/anthropic.go` 에 cache_control headers 추가
- `internal/llm/cache.go` 에 캐시 key 관리

**효과:**
- 반복 호출 시 캐시 히트율 80% 이상 (추정)
- 토큰 비용 30~50% 절감

---

#### B5. 토큰 예산 관리 시스템

**도구:**
```
token_budget(model: string) -> {
  total: int
  used: int
  remaining: int
  cache_hits: int
  estimated_cost_usd: float
}
```

**세션 화면:**
```
[Token Budget]
├─ Total: 200K (Claude 3.5 Sonnet)
├─ Used: 142K (71%)
├─ Cache: 35K hit (15%)
├─ Remaining: 58K
└─ Est. Cost: $2.34
```

**설정:** `~/.hanimo/budget.yaml`

```yaml
budget:
  daily_limit_usd: 10.0
  session_limit_tokens: 200000
  warn_at_percent: 75
  auto_compact_at_percent: 85
```

---

### Phase C: 자동화 + 검증 루프 (v0.9, 3~4주)

**목표**: Git 워크플로우 통합. 변경 후 자동 검증. Diff 미리보기.

#### C1. 변경 후 자동 Lint/Test 실행

**워크플로우:**
1. 파일 편집 도구 완료
2. 자동으로 해당 파일의 linter 실행 (eslint, golangci-lint, ruff 등)
3. 오류 발견 시 사용자에게 제안: "3개 linting 오류 발견. 자동 수정할까요?"
4. 사용자 동의 시 autopilot으로 수정

**구현:**
- `internal/tools/lint.go` (신규)
- `internal/agents/auto_fix.go` (신규)

**설정:** `.hanimo.md` 또는 `~/.hanimo/config.yaml`

```yaml
automation:
  lint_after_edit: true
  test_after_edit: false  # expensive
  auto_fix: true
  linters:
    - go: golangci-lint
    - ts: eslint
    - py: ruff
```

---

#### C2. Git 자동 커밋 (선택적)

**옵션 1 (Safe):** 변경 후 사용자 승인 필요
```
[Changes made]
3 files modified. Commit with message: "feat: add error handling"?
> y/n/edit
```

**옵션 2 (Auto):** 설정에서 자동 커밋 활성화
```yaml
git:
  auto_commit: true
  auto_commit_model: small  # claude-3-5-haiku
  message_template: "{{intent}}: {{files}}"
```

**구현:**
- `internal/tools/git.go` 에 `gitCommit()` 추가
- `internal/agents/commit_message.go` (AI 메시지 생성)

---

#### C3. Diff 미리보기 + 승인 워크플로우

**UI:**
```
[Modified Files]
├─ src/auth.ts (142 → 156 lines, +14)
│  └─ [View] [Approve] [Reject] [Edit]
├─ tests/auth.test.ts (89 → 110 lines, +21)
└─ README.md (50 → 52 lines, +2)

[Apply to filesystem? (y/n/view-diffs)]
```

**구현:**
- `internal/ui/diff_viewer.go` (신규, Bubble Tea component)
- `internal/tools/diff.go` 의 unified diff 생성

**특징:**
- 파일당 한 줄씩 diff preview
- Hash-anchored edit일 경우 이전 hash 표시
- Reject 선택 시 해당 파일 변경 롤백

---

#### C4. 오류 자동 수정 루프 (최대 3회)

**시나리오:**
1. 사용자 요청: "테스트 모두 통과하도록 고쳐줄래"
2. `/auto` 모드, 최대 3회 루프:
   - (Iteration 1) 코드 작성
   - (Iteration 1) `go test ./...` 실행
   - 오류 발견 → 원인 분석 (repo-map 활용)
   - (Iteration 2) 코드 수정
   - (Iteration 2) `go test ./...` 재실행
   - 통과 → 완료 (또는 최대 3회에서 중단)

**구현:**
- `internal/agents/auto.go` 의 루프 로직 강화
- Iteration counter + rollback 지점 저장

**설정:**
```yaml
auto:
  max_iterations: 5
  max_fix_iterations: 3
  test_before_commit: true
```

---

#### C5. CI/CD 상태 모니터링

**기능:**
- GitHub Actions, GitLab CI, Jenkins 등 모니터링 (MCP로 구현 가능)
- hanimo에서 변경 후, 자동으로 CI 대기 및 결과 수신

**예:**
```
[Waiting for CI...]
├─ GitHub Actions: Running (2/5 jobs done)
├─ Coverage: 84%
└─ Est. time: 2m 15s
```

---

### Phase D: 에이전트 고도화 (v1.0, 4~5주)

**목표**: 기업급 기능. LSP 통합. MCP 생태계. 멀티에이전트 오케스트레이션. API 서버.

#### D1. LSP 통합 (Language Server Protocol)

**기능:**
- `go-to-definition`: 심볼 정의 위치 찾기
- `find-references`: 사용 위치 모두 찾기
- `hover`: 심볼 타입/문서 표시
- `diagnostics`: 실시간 오류/경고

**구현:**
- `internal/lsp/` 패키지 (신규)
- Tree-sitter + 정규표현식 기반 LSP 미니 구현
- 또는 `gopls`, `typescript-language-server` 등 기존 LSP 서버에 IPC로 연결

**도구:**
```
lsp_goto_definition(file: string, line: int, col: int) -> Location
lsp_find_references(file: string, line: int, col: int) -> List[Location]
lsp_hover(file: string, line: int, col: int) -> string
lsp_diagnostics(file: string) -> List[Diagnostic]
```

**세션에서:**
```
> 이 함수의 정의를 찾아줄래?
[Using LSP: typescript-language-server]
Found: src/handlers/auth.ts:42
```

---

#### D2. MCP 서버 생태계 (커뮤니티 도구 허브)

**목표:** hanimo를 MCP 클라이언트로서, 커뮤니티 MCP 서버들을 플러그인처럼 사용

**현재 상태:**
- MCP stdio client 구현 완료
- SSE transport 부분 구현

**확장 계획:**
- MCP registry (https://smithery.ai 스타일) 구축
- `.hanimo/mcp-servers.yaml` 설정 파일
- 자동 설치 + lifecycle 관리

**예시 서버:**
```yaml
mcp_servers:
  - name: github
    type: stdio
    command: npx -y @modelcontextprotocol/server-github
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    tools: [list_repos, create_pr, get_issue]
  
  - name: postgres
    type: stdio
    command: python3 /path/to/postgres-mcp-server.py
    env:
      DATABASE_URL: postgresql://...
    tools: [query, list_tables, explain]
```

**구현:**
- `internal/mcp/registry.go` — MCP 서버 관리
- `internal/mcp/auto_install.go` — 자동 설치 (npm, pip, etc.)

---

#### D3. 멀티에이전트 전략 자동 선택

**현재:**
- Super mode: 일반 목적 (GPT-4 수준)
- Dev mode: 코딩 전문 (짧은 컨텍스트)
- Plan mode: 분석 전용 (읽기만)

**확장 (v1.0):**
- **Clarifier Agent**: 사용자 의도 명확화 (소형 모델, 1회)
- **Researcher Agent**: 코드베이스 탐색 (repo-map 활용)
- **Implementer Agent**: 코드 작성 (대형 모델)
- **Tester Agent**: 테스트 작성 및 검증
- **Reviewer Agent**: 코드 리뷰 (소형 모델)

**자동 선택 로직:**
```
user_input
  → Clarifier (의도 파악)
  → Researcher (필요 파일 찾기)
  → Implementer (코드 작성)
  → Tester (테스트)
  → Reviewer (리뷰)
  → Result
```

**구현:**
- `internal/agents/orchestrator.go` (신규)
- Skill + repo-map 조합으로 에이전트 간 정보 전달

---

#### D4. 플랜 → 실행 → 검증 파이프라인

**3단계 워크플로우:**
1. **Plan**: AI가 단계별 계획 수립 (읽기만, Plan mode)
2. **Execute**: 각 단계별로 Dev mode로 구현
3. **Verify**: 전체 결과 검증 (테스트, 리뷰)

**UI:**
```
[Task: Implement user authentication]

[Plan]
1. Create models/user.go
2. Implement bcrypt hashing
3. Create handlers/auth.go
4. Write tests/auth_test.go
5. Update README with usage

[Executing Step 1 of 5...]
✅ Step 1 done
⏳ Step 2 in progress...

[Verification]
├─ Tests: 12/12 passed
├─ Lint: 0 issues
├─ Coverage: 92%
└─ Result: SUCCESS
```

---

#### D5. API 서버 모드 (HTTP REST)

**목표:** hanimo를 로컬 API 서버로 실행, 외부 도구/IDE에서 호출 가능

**시작:**
```bash
hanimo --server --port 8765
```

**API 엔드포인트:**
```
POST /chat                 — 메시지 전송 (SSE response)
GET  /sessions             — 세션 목록
POST /sessions             — 새 세션 생성
GET  /sessions/{id}        — 세션 조회
POST /sessions/{id}/fork   — 세션 분기
POST /tools/*/exec         — 도구 실행
GET  /models               — 모델 목록
POST /mcp/discover         — MCP 서버 목록
```

**WebSocket 지원:**
```
ws://localhost:8765/chat/{session_id}
```

**구현:**
- `internal/server/` 패키지 (신규)
- Gin or Echo 웹 프레임워크

---

## 4. 구현 우선순위 매트릭스

### 4.1 영향도 vs 난이도 2x2

```
                 HIGH IMPACT
                     │
                 A   │   C
                     │
    LOW──────────────────────────HIGH
    EFFORT           │            EFFORT
                 B   │   D
                     │
                LOW IMPACT


A (High Impact, Low Effort) — 최우선 순위
├─ Hash-anchored edit 강화 (이미 구현, 개선만)
├─ 위험 명령 2차 확인 (간단, 효과 높음)
├─ Repo-map 기본 (tree-sitter, 높은 수익)
└─ Skill 시스템 (문법만 정의, 재사용 효과)

B (Low Impact, Low Effort) — 빠른 승리
├─ Dangerous command list
├─ File size warning
├─ Secrets detection 확장
└─ Token budget display

C (High Impact, High Effort) — 핵심 투자
├─ Subagent with context fork
├─ Prompt caching (Anthropic)
├─ Git auto-commit
├─ LSP integration
└─ MCP ecosystem

D (Low Impact, High Effort) — 선택적/미래
├─ API server mode
├─ CI/CD monitoring
├─ IDE extensions
└─ 멀티 에이전트 orchestrator
```

---

### 4.2 타임라인

| Phase | 기간 | 작업 | 릴리즈 |
|-------|------|------|--------|
| A | 2~3주 | 도구 규칙 강화 | v0.7 |
| B | 2~3주 | 컨텍스트 최적화 | v0.8 |
| C | 3~4주 | 자동화 + 검증 | v0.9 |
| D | 4~5주 | 에이전트 고도화 | v1.0 |
| **합계** | **11~15주** | 4 Phase | **v1.0** |

---

## 5. 기술 명세 (핵심 항목)

### 5.1 Phase A 세부 사항

#### Repo-map (tree-sitter)

**파일 구조:**
```
internal/repomap/
├─ parser.go          (tree-sitter 언어별 쿼리)
├─ graph.go           (심볼 정의/참조 그래프)
├─ rank.go            (PageRank 알고리즘)
├─ cache.go           (SQLite 스키마)
├─ inject.go          (마크다운 생성)
└─ repomap_test.go    (테스트)
```

**예상 코드량:** 800~1200줄

**의존성:**
- `smacker/go-tree-sitter` (CGO-free)
- 기존 `internal/session/` SQLite 사용

**테스트 전략:**
- 샘플 코드베이스 (Go, TS, Python) 각 100~500줄
- 심볼 추출 정확도: 95% 이상
- 성능: 10K 파일 < 300ms

---

#### Skill 시스템

**파일 구조:**
```
internal/skills/
├─ loader.go          (SKILL.md 파싱 및 로드)
├─ registry.go        (skill 캐시)
├─ executor.go        (skill 실행)
├─ learned.go         (자동 학습)
└─ skills_test.go     (테스트)
```

**SKILL.md 포맷:**
```markdown
---
name: deploy-vercel
description: Vercel에 Next.js 배포
effort: medium
allowed-tools: [shell, file_read]
---

# Deploy to Vercel

1. Check build: `!`npm run build``
2. Deploy: `!`vercel --prod``
3. Visit https://vercel.com/deployments
```

**예상 코드량:** 600~900줄

---

#### Hooks 시스템

**파일 구조:**
```
internal/hooks/
├─ types.go           (Hook, Event 정의)
├─ registry.go        (hooks.yaml 파싱)
├─ executor.go        (hook 실행)
└─ hooks_test.go      (테스트)
```

**hooks.yaml 예시:**
```yaml
hooks:
  - event: PreToolUse
    matcher:
      tool: shell_exec
      args_regex: "rm -rf|sudo"
    handler:
      type: prompt
      message: "정말 실행할까요?"
    on_exit: { 0: allow, 1: block }
```

**예상 코드량:** 400~600줄

---

### 5.2 Phase B 세부 사항

#### Compaction 3단계 고도화

**기존:**
- snip, micro, llm_summary 3단계

**신규:**
- eager (tool output 마이크로화)
- snip (관련 범위 추출)
- micro (파일 단위 축약)
- llm_summary (전체 요약)

**파일:** `internal/llm/compaction.go`

**예상 추가 코드:** 300~500줄

---

#### Context Compaction 캐싱

**스키마:**
```sql
CREATE TABLE compaction_cache (
  id TEXT PRIMARY KEY,
  content TEXT,
  compressed TEXT,
  tokens_before INT,
  tokens_after INT,
  created_at TIMESTAMP,
  mtime INT
);
```

**파일:** `internal/session/compaction_cache.go`

**예상 코드량:** 200~300줄

---

### 5.3 Phase C 세부 사항

#### Auto Lint/Test

**파일 구조:**
```
internal/tools/
├─ lint.go            (linter 실행)
└─ test.go            (테스트 실행)
```

**Linter 매핑:**
```go
var linterMap = map[string]string{
  ".go":   "golangci-lint run {{file}}",
  ".ts":   "eslint {{file}}",
  ".py":   "ruff check {{file}}",
  // ...
}
```

**예상 코드량:** 400~600줄

---

#### Git Auto-commit

**파일:** `internal/tools/git_commit.go`

**로직:**
1. 변경된 파일 목록 수집
2. `git add` 실행
3. 커밋 메시지 생성 (소형 모델)
4. `git commit` 실행

**예상 코드량:** 300~500줄

---

### 5.4 Phase D 세부 사항

#### LSP Mini (Tree-sitter 기반)

**파일 구조:**
```
internal/lsp/
├─ definitions.go      (go-to-definition)
├─ references.go       (find-references)
├─ hover.go            (hover info)
├─ diagnostics.go      (linter 결과)
└─ lsp_test.go         (테스트)
```

**예상 코드량:** 800~1200줄

---

#### MCP Registry + Auto Install

**파일 구조:**
```
internal/mcp/
├─ registry.go         (MCP 서버 관리)
├─ installer.go        (npm/pip 자동 설치)
├─ lifecycle.go        (start/stop/restart)
└─ discovery.go        (서버 도구 탐색)
```

**예상 코드량:** 600~900줄

---

## 6. 커뮤니티 생태계 전략

### 6.1 Skill 마켓플레이스 (.hanimo/skills/)

**개념:**
- 프로젝트별/전역 `.hanimo/skills/*/SKILL.md` 저장소
- GitHub hanimo-skills 조직에서 공식 스킬 배포

**예시:**
```
github.com/hanimo-skills/
├─ deploy-vercel/
│  ├─ SKILL.md
│  ├─ test.sh
│  └─ README.md
├─ setup-eslint/
├─ generate-migration/
└─ ...
```

**설치:**
```bash
hanimo --install-skill github:hanimo-skills/deploy-vercel
# → ~/.hanimo/skills/deploy-vercel/SKILL.md
```

---

### 6.2 MCP 서버 레지스트리

**개념:**
- hanimo만의 공식 MCP 서버 라이브러리
- Smithery와 차별화: **코딩 에이전트 특화 도구**

**예시 서버:**
```
hanimo-mcp-servers/
├─ github-issues/         (Issue 생성, PR 열기)
├─ cloud-deploy/          (AWS, GCP, Azure 배포)
├─ db-query/              (PostgreSQL, MySQL 쿼리)
├─ docs-search/           (내 프로젝트 문서 검색)
├─ code-review/           (AI 코드 리뷰)
└─ ...
```

**설치 및 활성화:**
```bash
hanimo --mcp-add github.com/hanimo-community/github-issues
# → ~/.hanimo/mcp-servers.yaml에 자동 추가
```

---

### 6.3 Knowledge 문서 공유

**저장소:** `github.com/hanimo-community/knowledge`

**목표:**
- 프로젝트별 최적화 가이드
- 모델별 프롬프트 팁
- 문제 해결 문서

**구조:**
```
knowledge/
├─ next-js/
│  ├─ setup.md
│  ├─ optimization.md
│  └─ best-practices.md
├─ go/
├─ rust/
└─ ...
```

---

### 6.4 플러그인 아키텍처 (v1.1+)

**목표:** hanimo 확장을 WASM으로 포팅 가능하게

**구현:**
- hanimo core API 공개 (OpenAPI spec)
- WASM 바인딩 (tinygo)
- Plugin SDK (Go, Rust, etc.)

**예:**
```go
// Plugin code
package main

import "github.com/hanimo/plugin"

type MyPlugin struct{}

func (p *MyPlugin) Execute(ctx context.Context, input string) (string, error) {
  // ...
}

func init() {
  plugin.Register("my-plugin", &MyPlugin{})
}
```

---

## 7. 성공 지표

### 7.1 정량적 지표

| 지표 | 목표 (v1.0) | 측정 방법 |
|------|-----------|---------|
| Repo-map 정확도 | 95% | 심볼 추출 정확도 테스트 |
| Skill 재사용률 | 30% | 세션당 skill 호출 수 |
| 컨텍스트 압축 효율 | 50% | 압축 전후 토큰 수 |
| Git auto-commit 성공률 | 99% | 실패 로그 수 |
| 테스트 자동 수정 성공률 | 70% | 성공 케이스 / 시도 케이스 |
| LSP 응답 시간 | <100ms | go-to-definition 시간 |
| MCP 에러율 | <1% | 에러 로그 수 |

### 7.2 정성적 지표

- **커뮤니티 신뢰:** Skill 마켓플레이스 100+ 등록
- **개발자 만족도:** GitHub 리뷰 4.8/5.0 이상
- **생태계:** MCP 서버 20+ 개발사 참여
- **한국어 지원:** 문서, 에러 메시지, 팀 응답 100% 한국어

---

## 8. 리스크 및 완화 전략

### 8.1 주요 리스크

| 리스크 | 영향도 | 확률 | 완화 전략 |
|--------|--------|------|---------|
| Tree-sitter 성능 부족 | 높음 | 중 | Pure-Go 대안 조사 (comrak, lingo) |
| LLM 캐싱 호환성 | 중 | 중 | Anthropic 우선, OpenAI 추후 |
| MCP 서버 보안 | 높음 | 낮음 | Sandbox (seccomp), 권한 검증 |
| 한국어 모델 품질 편차 | 중 | 높음 | 모델별 테스트 + fallback |
| 단일 바이너리 유지 의도와 충돌 | 중 | 낮음 | MCP로 모든 확장 흡수, CGO-free 라이브러리만 사용 |

---

## 9. 참고 자료

### 9.1 경쟁 도구 공식 문서

- [Claude Code - System Prompt](https://docs.anthropic.com/en/docs/build-a-system-prompt-library) (Agent Teams 참고)
- [OpenCode - GitHub Repository](https://github.com/openai/opencode)
- [Aider - Documentation](https://aider.chat)
- [Tree-sitter - Language Documentation](https://tree-sitter.github.io/tree-sitter)

### 9.2 오픈소스 레퍼런스

- **LSP:** [LSP Specification](https://microsoft.github.io/language-server-protocol)
- **MCP:** [Model Context Protocol](https://modelcontextprotocol.io)
- **Prompt Caching:** [Anthropic Cache Control](https://docs.anthropic.com/en/docs/build-a-system-prompt-library)
- **Tree-sitter Go Binding:** [smacker/go-tree-sitter](https://github.com/smacker/go-tree-sitter)

### 9.3 한국 개발자 커뮤니티

- GitHub 이슈: 기능 요청 투표 시스템
- 디스코드: `#hanimo-dev` 채널에서 실시간 피드백
- 월간 커뮤니티 회의: 첫 번째 금요일 7PM KST

---

## 10. 결론

hanimo는 **해시라인 편집**, **한국어 우선**, **14+ 프로바이더** 조합으로 이미 강력한 기반을 갖추었습니다. v0.7~v1.0 로드맵은 이 기반 위에:

1. **도구 규칙 (Phase A)**로 보안 강화
2. **컨텍스트 최적화 (Phase B)**로 대규모 코드베이스 처리
3. **자동화 루프 (Phase C)**로 개발 생산성 향상
4. **에이전트 고도화 (Phase D)**로 기업급 기능 완성

이를 통해 Claude Code와 경쟁할 수 있는 **오픈소스 터미널 AI 코딩 에이전트**의 위상을 확립합니다.

**핵심 전략:**
- 폐쇄형 SaaS (Claude Code)와 경쟁하지 말고, **한국어 + 로컬 + 오픈**으로 차별화
- MCP + Skill로 **커뮤니티 중심 생태계** 구축
- 규칙 기반 안정성으로 **엔터프라이즈 신뢰** 확보

---

**수정 히스토리:**
- **2026-04-16**: 초판 작성 (v0.6 기반, 1단계 로드맵)
- **추후 예정**: Phase별 완료 후 상세 조정

---

*이 문서는 정기적으로 갱신됩니다. 최신 버전은 GitHub discussions에서 확인하세요.*
