# OpenCode 분석 보고서 — hanimo 포팅/참고용

> 분석일: 2026-04-17
> 소스: https://github.com/anomalyco/opencode.git
> 목적: hanimo에 적용 가능한 룰베이스 기능 식별

---

## 프로젝트 개요

- **언어**: TypeScript (monorepo, `packages/opencode/src/`)
- **구조**: hanimo와 유사한 터미널 AI 코딩 에이전트
- **차별점**: LSP 통합 25+, WASM 기반 ripgrep/tree-sitter, 9단계 edit 전략

---

## 핵심 룰베이스 기능 분석

### 1. 9단계 Edit 교체 전략 (edit.ts:643-679)

LLM이 `old_string` 매칭 실패 시 점진적으로 느슨한 매칭 시도:

| 순서 | 전략 | 로직 |
|:----:|------|------|
| 1 | SimpleReplacer | 정확 일치 |
| 2 | LineTrimmedReplacer | 각 줄 양끝 공백 제거 |
| 3 | BlockAnchorReplacer | 첫/끝줄 앵커 + Levenshtein (0.0~0.3) |
| 4 | WhitespaceNormalizedReplacer | 모든 공백 통합 |
| 5 | IndentationFlexibleReplacer | 최소 들여쓰기 제거 |
| 6 | EscapeNormalizedReplacer | `\n`, `\t` 등 이스케이프 해제 |
| 7 | TrimmedBoundaryReplacer | 앞뒤 공백 제거 |
| 8 | ContextAwareReplacer | 첫/끝줄 앵커 + 50% 유사도 |
| 9 | MultiOccurrenceReplacer | 모든 정확 일치 |

**hanimo 적용 상태**: 5단계 구현 완료 (replacer.go). 6-9는 Go 환경에서 추가 가치 낮아 생략.

### 2. LSP 통합 (lsp/server.ts)

**25+ 언어 서버 자동 관리:**
- TypeScript, Deno, Vue, Gopls, Pyright, RustAnalyzer, Clangd 등
- 서버 자동 다운로드/설치
- `didOpen`/`didChange` + 150ms 디바운스 진단
- **편집 후 자동 진단**: write/edit마다 LSP에 알려서 에러 피드백

**LSP 도구 노출:**
- goToDefinition, findReferences, hover
- documentSymbol, workspaceSymbol
- prepareCallHierarchy, incomingCalls, outgoingCalls

**hanimo 적용 상태**: 미구현. 가장 높은 임팩트이지만 높은 복잡도. Go에서 LSP 클라이언트 구현 필요.

### 3. 바이너리 파일 탐지 (tool/read.ts:265-323)

- 확장자 기반 빠른 판단 (95개 바이너리 확장자, 24개 이미지, 40개 텍스트)
- **바이트 샘플링**: 첫 4096바이트 읽어 null 바이트 또는 >30% 비인쇄 문자 → 바이너리

**hanimo 적용 상태**: ✅ 구현 완료 (search.go:44-70)

### 4. 파일 분류 시스템 (file/index.ts:87-265)

| 분류 | 확장자 수 | 용도 |
|------|:---------:|------|
| binary | 95 | 검색/읽기 제외 |
| image | 24 | MIME 타입 제공 |
| text | 40 | 안전하게 읽기 가능 |
| textName | 15 | 확장자 없는 텍스트 (Makefile, Dockerfile 등) |

**hanimo 적용 상태**: 부분 구현 (binaryExts 15개). 확장 여지 있음.

### 5. 무시 패턴 (file/ignore.ts)

- 31개 디렉토리 + 파일 패턴 하드코딩
- 화이트리스트 오버라이드 지원
- `.gitignore` 연동

**hanimo 적용 상태**: ✅ ���현 (skipDirs + gitignore.go)

### 6. OS 보호 경로 (file/protected.ts)

macOS TCC 디렉토리 (Downloads, Desktop, Documents, Library/Mail 등) 스캔 차단. Windows 동등 경로 포함.

**hanimo 적용 상태**: 미구현. 낮은 우��순위.

### 7. Git 스냅샷 시스템 (snapshot/index.ts)

- **별도 git 저장소** (`~/.opencode/data/snapshot/<project-id>/<hash>`)에 파일 상태 추적
- 사용자 git과 독립적으로 undo/revert 가능
- gitignore 인식, 2MB 초과 파일 제외
- 7일 보존 + 주기적 정리
- 경로 충돌 감지

**hanimo 적용 상태**: 파일 기반 스냅샷 구현 (snapshot.go). opencode 수준의 git 기반은 미구현.

### 8. Bash 명령 AST 분석 (tool/bash.ts:303-328)

- **Tree-sitter WASM**으로 bash/PowerShell 명령 파싱
- 명령 이름, 인자, 경로 추출
- 외부 디렉토리 접근 감지 (권한 체크)
- 파일 수정 명령 식별 (rm, cp, mv, mkdir 등)

**hanimo 적용 상태**: 문자열 패턴 매칭으로 위험 명령 탐지 (tools/shell.go). AST 수준은 미구현.

### 9. Mtime 기반 검색 정렬 (tool/grep.ts:70-100)

- grep/glob 결과를 파일 수정 시간 역순으로 정렬
- 최근 수정 파일 = 더 관련 있을 가능성

**hanimo 적용 상태**: ✅ 구현 완료 (search.go)

### 10. Patch 시스템 (patch/index.ts)

- `*** Begin Patch` / `*** End Patch` 형식 파서
- 4단계 컨텍스트 시킹: exact → rstrip → trim → unicode normalized
- 유니코드 정규화 (스마트 따옴표, em-dash 등 → ASCII)

**hanimo 적용 상태**: 미구현. diff.go + file_edit으로 대체 가능.

### 11. 퍼지 파일 검색 (file/index.ts:614-643)

- `fuzzysort` 라이브러리로 파일명 퍼지 매칭
- 숨김 파일은 `.`으로 시작할 때만 표시
- ripgrep 기반 파일 목록 캐싱

**hanimo 적용 상태**: 커맨드 팔레트(Ctrl+K)에서 퍼지 검색. 파일명 퍼지 검색은 미구현.

### 12. 줄바꿈 보존 (tool/edit.ts:22-33)

- 파일의 CRLF/LF 감지 후 편집 시 원본 줄바꿈 유지

**hanimo 적용 상태**: 미구현. 대부분 Unix 환경이라 낮은 우선순위.

---

## 포팅 우선순위 매트릭스

```
            높은 영향도
                │
    LSP 통합    │  Edit 교체전략 ✅
    (높은 노력) │  (중간 노력)
                │
 ───────────────┼───────────────
                │
    Git 스냅샷  │  바이너리 탐지 ✅
    (높은 노력) │  Mtime 정렬 ✅
                │  Smart Context ✅
            낮은 영향도
```

✅ = hanimo에 이미 구현됨

---

## hanimo vs opencode 기능 비교

| 기능 | opencode | hanimo |
|------|:--------:|:------:|
| LLM 프로바이더 | 75+ | 14+ |
| 내장 도구 수 | ~15 | **35** |
| LSP 통합 | ✅ 25+ 서버 | ❌ |
| Edit 전략 | 9단계 | **5단계** ✅ |
| Import Graph | ❌ | **✅** |
| FindReferences | LSP 기반 | **regex 기반** ✅ |
| 순환 의존성 탐지 | ❌ | **✅** |
| 변경 영향도 분석 | ❌ | **✅** |
| 테스트 커버리지 갭 | ❌ | **✅** |
| 코드 품질 스캐너 | ❌ | **✅** |
| Git Blame/HotFiles | ❌ | **✅** |
| Smart Context | ❌ | **✅** |
| 멀티에이전트 | ❌ | **✅** |
| 컴패니언 대시보드 | ❌ | **✅** |
| 스킬 시스템 | ❌ | **✅** |
| 바이너리 탐지 | 바이트 샘플링 | **바이트 샘플링** ✅ |
| Mtime 정렬 | ✅ | **✅** |
| 스냅샷/Undo | git 기반 | **파일 기반** ✅ |
| 플랜 모드 | ❌ | **✅** |
| 다국어 | ❌ | **✅** (한/영) |
| 프롬프트 캐싱 | ❌ | **인프라 있음** |
| Tree-sitter | WASM | ❌ |
| Patch 시스템 | 자체 포맷 | ❌ |

---

## 결론

opencode는 **LSP 통합**과 **edit 전략**에서 강하지만, hanimo는 **코드 분석 도구** (import graph, cross-ref, coverage gap, quality scan, change impact)와 **에이전트 기능** (multi-agent, plan mode, companion)에서 우위.

### 다음 단계 (hanimo)
1. **LSP 클라이언트** — gopls + tsserver부터 시작 (가장 큰 갭)
2. **바이너리 확장자 목록 확장** — 95개로 (opencode 참고)
3. **파일명 ���지 검색 도구** — glob_search에 fuzzy 모드 추가
4. **줄바꿈 보존** — FileEdit에 CRLF 감지 추가
