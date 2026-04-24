# hanimo-code-desktop 포팅 + hanimo cli 역포팅 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) hanimo cli에 TECHAI_CODE의 `memory.go` + 테스트 3종 + toolparse 엣지케이스를 역포팅. (2) `TECHAI_CODE/techai-ide` v0.2.0을 `hanimo-code/hanimo-code-desktop/` 서브디렉토리로 포팅하고 Honey 브랜드 테마를 기본으로 적용하여 빌드 성공까지 도달.

**Architecture:**
- Part 1 (hanimo cli 역포팅) — TECHAI_CODE의 검증된 범용 자산만 선별 이식. bxm·사내전용 코드는 금지.
- Part 2 (hanimo-code-desktop Phase 0) — techai-ide v0.2.0을 `hanimo-code/hanimo-code-desktop/`에 복사 후 sed 일괄 치환. 별도 Go 모듈로 유지하고, 필요 시 hanimo 코어는 HTTP/바이너리로 통신.
- Part 3 (Phase 1: Honey 브랜드) — ThemePicker에 honey 테마 추가, CSS 변수 정의, 기본값으로 설정. Phase 2~5는 별도 플랜으로 분리.

**Tech Stack:**
- cli: Go 1.26, Bubble Tea v2
- desktop: Go 1.23, Wails v2, React + TypeScript + Vite, CodeMirror 6, xterm.js
- 공유: SQLite, stdio, MCP 프로토콜

**Source 상세:**
- hanimo-code cli: `/Users/jiwonkim/Desktop/kimjiwon/hanimo-code/` (module `github.com/flykimjiwon/hanimo`)
- TECHAI_CODE cli: `/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/` (module `github.com/kimjiwon/tgc`)
- techai-ide v0.2.0: `/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/techai-ide/` (module `techai-ide`, 태그 `ide-v0.2.0`)

**상위 문서:**
- `docs/porting/BIDIRECTIONAL-ANALYSIS-2026-04-23.md` — 본질 필터링 결과
- `docs/porting/IDE_PORTING_PLAN.md` — 기본 포팅 전략 (techai-ide v0.1 기준, 본 플랜으로 갱신)
- `docs/porting/HANIMO-DESKTOP-DESIGN-PLAN-2026-04-23.md` — 14개 외부망 기능 우선도
- `designs/hanimo-desktop-v1.html` — Honey 브랜드 UI mock
- `docs/strategy/REPUTATION-STRATEGY-2026-04-23.md` — 상위 전략
- `docs/superpowers/TOOLING-POLICY-2026-04-24.md` — 검증 원칙

---

## File Structure

### Part 1 — hanimo cli 역포팅 (새 파일 2 · 수정 2)

| 역할 | 파일 | 출처 |
|---|---|---|
| **메모리 스토어 도구** | `internal/tools/memory.go` (신규) | `TECHAI_CODE/internal/tools/memory.go` |
| **hooks 단위 테스트** | `internal/hooks/hooks_test.go` (신규) | `TECHAI_CODE/internal/hooks/hooks_test.go` |
| **llm capabilities 테스트** | `internal/llm/capabilities_test.go` (신규) | `TECHAI_CODE/internal/llm/capabilities_test.go` |
| **llm client 테스트** | `internal/llm/client_test.go` (신규) | `TECHAI_CODE/internal/llm/client_test.go` |
| **registry 수정** | `internal/tools/registry.go` (memory 도구 등록 추가) | — |
| **toolparse 엣지 보강** | `internal/tools/toolparse.go` (차이분 merge) | TECHAI의 최근 커밋 `55e444a`·`f62a1bd` |

### Part 2 — hanimo-code-desktop Phase 0 (디렉토리 전체)

```
hanimo-code/hanimo-code-desktop/            ← 신규 서브디렉토리
├── app.go                    (from techai-ide/app.go)
├── app_test.go               (from techai-ide/app_test.go)
├── chat.go                   (from techai-ide/chat.go)      ← 모듈 import 재조정
├── config.go                 (from techai-ide/config.go)    ← 경로·env var 교체
├── config_test.go            (from techai-ide/config_test.go)
├── git.go                    (from techai-ide/git.go)
├── git_test.go               (from techai-ide/git_test.go)
├── knowledge.go              (from techai-ide/knowledge.go) ← bxm 제거
├── knowledge_test.go
├── main.go                   (from techai-ide/main.go)      ← 브랜딩
├── session.go                (from techai-ide/session.go)   ← 신규 (v0.2.0)
├── settings.go
├── terminal.go
├── terminal_unix.go          (v0.2.0 신규)
├── terminal_windows.go       (v0.2.0 신규 — 외부망 불필요, 유지 OK)
├── toolparse.go
├── toolparse_test.go
├── go.mod                    (module hanimo-code-desktop)
├── go.sum
├── wails.json                (name: hanimo-code-desktop)
├── FEATURES.md
├── TEST_CHECKLIST.md
├── TODO.md
├── README.md
├── build/
│   └── (아이콘 자산 — 차후 Phase 1에서 교체)
└── frontend/
    ├── index.html            ← 브랜딩
    ├── package.json          ← name: hanimo-code-desktop-frontend
    ├── package-lock.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── style.css
        ├── App.css
        ├── utils.ts          (v0.2.0 신규)
        ├── vite-env.d.ts
        ├── assets/
        ├── wailsjs/           (Wails 자동 생성)
        └── components/
            ├── AboutDialog.tsx
            ├── ActivityBar.tsx
            ├── ChatPanel.tsx
            ├── CodeEditor.tsx
            ├── CommandPalette.tsx
            ├── DiffView.tsx  (v0.2.0 신규)
            ├── Editor.tsx
            ├── FileTree.tsx
            ├── GitGraph.tsx
            ├── GitPanel.tsx
            ├── QuickOpen.tsx
            ├── ResizeHandle.tsx
            ├── SearchPanel.tsx
            ├── SettingsPanel.tsx
            ├── StatusBar.tsx
            ├── Terminal.tsx
            ├── ThemePicker.tsx  ← Part 3에서 honey 추가
            └── Toast.tsx
```

### Part 3 — Phase 1 (Honey 브랜드) 수정

| 파일 | 변경 |
|---|---|
| `hanimo-code-desktop/frontend/src/components/ThemePicker.tsx` | honey 항목 맨 앞 추가, 기본값 설정 |
| `hanimo-code-desktop/frontend/src/style.css` | `body.t-honey { ... }` CSS 변수 블록 추가 + default `:root` 를 honey 값으로 교체 |
| `hanimo-code-desktop/frontend/src/App.tsx` | 초기 테마 state를 `'t-honey'`로 |

---

## Part 1 — hanimo cli 역포팅 (예상 1시간)

### Task 1.1: memory.go 도구 파일 복사

**Files:**
- Create: `internal/tools/memory.go`

- [ ] **Step 1: 원본을 hanimo로 복사하면서 import 경로 교체**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code
sed -e 's|github.com/kimjiwon/tgc|github.com/flykimjiwon/hanimo|g' \
    /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/internal/tools/memory.go \
    > internal/tools/memory.go
```

- [ ] **Step 2: 경로 상수 확인 — `.tgc` → `.hanimo`**

Run: `grep -n "tgc\|TGC" internal/tools/memory.go`
Expected: 결과 없음 (모두 hanimo로 치환되었어야 함)

만약 `.tgc` 같은 문자열이 남아있으면 수동으로 `.hanimo`로 바꾼다. memory 파일의 디렉토리 상수는 `~/.hanimo/memory.json` 및 `<project>/.hanimo/memory.json`이 맞는지 확인.

- [ ] **Step 3: 컴파일 확인 (도구 등록 전)**

Run: `go build ./internal/tools/...`
Expected: PASS (memory.go 단독 컴파일 성공. 아직 registry에 등록 안 해도 패키지 자체는 빌드됨)

### Task 1.2: registry.go에 memory 도구 등록

**Files:**
- Modify: `internal/tools/registry.go`

- [ ] **Step 1: TECHAI 쪽 등록부 참고**

Run: `grep -n "memory" /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/internal/tools/registry.go`
Expected: memory 관련 함수 이름·tool 정의 위치 확인 (예: `ExecuteMemory(...)`, `AllTools()`의 slice에 추가된 블록).

- [ ] **Step 2: hanimo registry.go의 유사 위치(knowledge_search 근처)에 memory 블록 추가**

위에서 찾은 TECHAI 의 블록을 그대로 복사해서 hanimo `registry.go`의 `AllTools()` 내 slice 끝·`executeInner()`의 switch 블록 양쪽에 append. import는 기존 `"github.com/flykimjiwon/hanimo/internal/tools"`로 통일되어 있으므로 경로 재조정은 불필요.

- [ ] **Step 3: 컴파일 + `grep` 재확인**

Run: `go build ./...`
Expected: 전체 PASS

Run: `grep -n "memory_save\|memory_load\|ExecuteMemory" internal/tools/registry.go`
Expected: 최소 2 라인 이상 (도구 정의 + switch case)

### Task 1.3: hooks / llm 테스트 3종 복사

**Files:**
- Create: `internal/hooks/hooks_test.go`
- Create: `internal/llm/capabilities_test.go`
- Create: `internal/llm/client_test.go`

- [ ] **Step 1: 세 파일을 import 치환과 함께 복사**

```bash
for f in internal/hooks/hooks_test.go internal/llm/capabilities_test.go internal/llm/client_test.go; do
  sed -e 's|github.com/kimjiwon/tgc|github.com/flykimjiwon/hanimo|g' \
      "/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/$f" > "$f"
done
```

- [ ] **Step 2: 각 테스트 실행으로 통과 확인**

Run: `go test ./internal/hooks/... ./internal/llm/... -count=1 -run 'Test'`
Expected: 모두 PASS (혹은 기존 테스트와 중복·signature 불일치 시 실패 리포트). 실패하면 unused import 또는 비공개 함수 접근 여부 확인.

실패 케이스별 조치:
- `undefined: ...` → hanimo에서 해당 함수명이 다름 → 이름 매핑 확인 (예: `parseDoc` → `parseUserDoc`)
- `package ... is not in std` → import 경로 미치환 잔재
- `cannot use X as Y` → 타입 정의 변경됨, 해당 테스트는 skip 대상으로 별도 TODO

### Task 1.4: toolparse.go 엣지케이스 보강

**Files:**
- Modify: `internal/tools/toolparse.go`
- Modify/Add: `internal/tools/toolparse_test.go`

- [ ] **Step 1: TECHAI 최근 커밋 3개 변경분 확인**

Run:
```bash
git -C /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE show --stat 55e444a 5628e06 6044126
```
Expected: 각 커밋의 변경 파일과 영향 라인 수 표시 (주로 `toolparse.go`, `toolparse_test.go`).

- [ ] **Step 2: 해당 변경분을 diff로 추출**

```bash
git -C /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE show 55e444a -- internal/tools/toolparse.go > /tmp/tp_a.diff
git -C /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE show 5628e06 -- internal/tools/toolparse.go > /tmp/tp_b.diff
git -C /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE show 6044126 -- internal/tools/toolparse.go > /tmp/tp_c.diff
cat /tmp/tp_a.diff /tmp/tp_b.diff /tmp/tp_c.diff | less
```
Expected: 변경된 파싱 블록(`<parameter=key> value`, `<function=name>`, think 태그 제거 등)이 확인됨.

- [ ] **Step 3: 위 변경분을 hanimo `toolparse.go`에 수동 반영**

hanimo 쪽에 이미 있는 코드와 비교하며 누락된 엣지케이스만 선별적으로 추가. **주의**: 함수 시그니처가 바뀌는 변경은 hanimo 쪽 caller 호환성 확인 필수.

- [ ] **Step 4: 기존+신규 테스트 실행**

Run: `go test ./internal/tools/... -run 'TestParseToolCalls' -v -count=1`
Expected: 전체 PASS. 새로 추가한 엣지케이스 테스트 최소 3개가 PASS로 찍혀야 함.

### Task 1.5: 커밋

- [ ] **Step 1: 단위 변경 확인**

Run: `git status --short`
Expected: 4 수정/신규 파일 (memory.go, hooks_test.go, capabilities_test.go, client_test.go, registry.go, toolparse.go, toolparse_test.go)

- [ ] **Step 2: add + commit**

```bash
git add internal/tools/memory.go internal/tools/registry.go internal/tools/toolparse.go internal/tools/toolparse_test.go internal/hooks/hooks_test.go internal/llm/capabilities_test.go internal/llm/client_test.go
git commit -m "$(cat <<'EOF'
feat: port memory tool + regression tests + toolparse edge cases from TECHAI

hanimo cli에 TECHAI_CODE의 검증된 범용 자산 4종 역포팅:
- internal/tools/memory.go — JSON 기반 /remember 스토어 (local + global)
- internal/hooks/hooks_test.go — hook 이벤트 회귀 테스트
- internal/llm/capabilities_test.go · client_test.go — LLM 클라이언트 테스트
- internal/tools/toolparse.go — Qwen3 프록시 엣지케이스 3건 보강

Constraint: TECHAI 사내 전용 코드(bxm·scrape-bxm·audit)는 포팅 금지
Rejected: 이모지 제거·한국어 고정 변경 | hanimo는 i18n 유지
Confidence: high
Scope-risk: narrow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

Run: `git push origin main`
Expected: main 브랜치에 변경 푸시 완료

---

## Part 2 — hanimo-code-desktop Phase 0 포팅 (예상 반나절)

### Task 2.1: 디렉토리 생성 + techai-ide 전체 복사

**Files:**
- Create: `hanimo-code-desktop/` (전체 디렉토리)

- [ ] **Step 1: 목적지 확인 및 복사**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code
test ! -d hanimo-code-desktop || { echo "이미 존재, 중단"; exit 1; }
cp -R /Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/techai-ide hanimo-code-desktop
```
Expected: `hanimo-code-desktop/` 디렉토리 생성됨

- [ ] **Step 2: 복사 대상 불필요 산출물 정리**

```bash
cd hanimo-code-desktop
rm -f techai-ide techai-ide-debug.log
rm -rf frontend/node_modules frontend/dist build/bin build/darwin/*.app
```
Expected: 기존 바이너리·로그·빌드 결과물 제거 (소스만 남김)

- [ ] **Step 3: 복사 결과 검증**

Run: `ls -la; echo "---"; ls frontend/src/components | wc -l`
Expected: Go 파일 17개 내외 + frontend/ 존재, components 파일 18개

### Task 2.2: Go 소스 sed 일괄 치환 (브랜딩)

**Files:**
- Modify: `hanimo-code-desktop/*.go`

- [ ] **Step 1: 치환 규칙 정의**

| 원본 | 대체 |
|---|---|
| `module techai-ide` | `module hanimo-code-desktop` |
| `github.com/kimjiwon/tgc` | `github.com/flykimjiwon/hanimo` |
| `"techai-ide"` | `"hanimo-code-desktop"` (ClientInfo 등) |
| `"택가이코드 IDE"` | `"hanimo Desktop"` |
| `"TECHAI IDE"` | `"hanimo Desktop"` |
| `.tgc-onprem/` → 제거 (외부망은 해당 없음) | — |
| `.tgc/` | `.hanimo/` |
| `TGC_` | `HANIMO_` |
| `.techai.md` | `.hanimo.md` |

- [ ] **Step 2: Go 파일에 sed 적용**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code/hanimo-code-desktop
# .tgc-onprem 경로는 외부망 무관 — 해당 블록을 후속 수동 단계에서 정리
find . -maxdepth 1 -name "*.go" -exec sed -i '' \
  -e 's|module techai-ide|module hanimo-code-desktop|g' \
  -e 's|github.com/kimjiwon/tgc|github.com/flykimjiwon/hanimo|g' \
  -e 's|"techai-ide"|"hanimo-code-desktop"|g' \
  -e 's|택가이코드 IDE|hanimo Desktop|g' \
  -e 's|TECHAI IDE|hanimo Desktop|g' \
  -e 's|\.tgc-onprem|.hanimo|g' \
  -e 's|\.tgc|.hanimo|g' \
  -e 's|TGC_|HANIMO_|g' \
  -e 's|\.techai\.md|.hanimo.md|g' \
  {} \;
```

- [ ] **Step 3: go.mod·go.sum 에도 적용**

```bash
sed -i '' \
  -e 's|module techai-ide|module hanimo-code-desktop|g' \
  -e 's|github.com/kimjiwon/tgc|github.com/flykimjiwon/hanimo|g' \
  go.mod go.sum
```

- [ ] **Step 4: 잔존 문자열 확인**

Run:
```bash
grep -rn "techai\|TECHAI\|택가이\|\.tgc\|TGC_\|kimjiwon/tgc" --include="*.go" .
```
Expected: 결과 없음 (있으면 수동 교체)

### Task 2.3: Frontend sed 치환

**Files:**
- Modify: `hanimo-code-desktop/frontend/**`

- [ ] **Step 1: tsx/ts/json/html/css에 적용**

```bash
cd frontend
find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
  -e 's|techai-ide|hanimo-code-desktop|g' \
  -e 's|TECHAI IDE|hanimo Desktop|g' \
  -e 's|택가이코드 IDE|hanimo Desktop|g' \
  -e 's|택가이코드|hanimo|g' \
  -e 's|TECHAI|hanimo|g' \
  -e 's|techai|hanimo|g' \
  -e 's|\.tgc|.hanimo|g' \
  -e 's|\.techai\.md|.hanimo.md|g' \
  {} \;

sed -i '' \
  -e 's|"name": "techai-ide-frontend"|"name": "hanimo-code-desktop-frontend"|g' \
  -e 's|"name": "techai-ide"|"name": "hanimo-code-desktop"|g' \
  -e 's|techai-ide|hanimo-code-desktop|g' \
  package.json package-lock.json

sed -i '' \
  -e 's|TECHAI IDE|hanimo Desktop|g' \
  -e 's|택가이코드 IDE|hanimo Desktop|g' \
  -e 's|techai-ide|hanimo-code-desktop|g' \
  index.html
```

- [ ] **Step 2: 루트 `wails.json` 치환**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code/hanimo-code-desktop
sed -i '' \
  -e 's|"name": "techai-ide"|"name": "hanimo-code-desktop"|g' \
  -e 's|"outputfilename": "techai-ide"|"outputfilename": "hanimo-code-desktop"|g' \
  -e 's|택가이코드 IDE|hanimo Desktop|g' \
  -e 's|TECHAI IDE|hanimo Desktop|g' \
  wails.json
```

- [ ] **Step 3: 잔존 확인**

Run: `grep -rn "techai\|TECHAI\|택가이" --include="*.tsx" --include="*.ts" --include="*.json" --include="*.html" --include="*.css" .`
Expected: 결과 없음 (있으면 수동 정리)

### Task 2.4: config.go — 기본 엔드포인트·모델 교체

**Files:**
- Modify: `hanimo-code-desktop/config.go`

- [ ] **Step 1: techai-ide 기본값 파악**

Run: `grep -n "api.novita.ai\|qwen/qwen3-coder\|BaseURL\|DefaultModel" config.go`
Expected: Novita endpoint + `qwen/qwen3-coder-30b-a3b-instruct` 기본값이 보임

- [ ] **Step 2: 하드코딩 기본값을 교체**

수동 편집. 교체 규칙:

| 기존 | 신규 |
|---|---|
| `https://api.novita.ai/openai` | `http://localhost:11434/v1` (Ollama 로컬 기본) |
| `qwen/qwen3-coder-30b-a3b-instruct` | `qwen3:8b` |
| 기본 provider 단일 endpoint 로직 | 단일 OpenAI-compat 유지 (멀티 프로바이더는 Phase 2에서 추가) |

`Edit` 도구로 config.go의 해당 상수 블록만 정확히 교체.

- [ ] **Step 3: 환경변수 접두사 확인**

Run: `grep -n "os.Getenv" config.go`
Expected: 이미 Task 2.2에서 `TGC_` → `HANIMO_`로 치환됨. 아니라면 이 단계에서 마무리.

### Task 2.5: knowledge.go — bxm 팩 제거

**Files:**
- Modify: `hanimo-code-desktop/knowledge.go`

- [ ] **Step 1: 팩 정의 위치 파악**

Run: `grep -n "bxm\|BXM\|shinhan\|Shinhan" knowledge.go`
Expected: bxm 관련 목록(13개 문서) 또는 카테고리 정의

- [ ] **Step 2: bxm 블록 제거**

`Edit` 도구로 bxm 카테고리 블록과 관련 detect 로직 삭제.

- [ ] **Step 3: 팩 경로를 hanimo knowledge로 전환**

techai-ide의 knowledge.go는 자체 임베드 또는 `/knowledge/docs/` 경로를 참조. hanimo-code 기존 `knowledge/docs/` (62개)를 그대로 사용하도록 수정.

옵션 A: 별도 knowledge 디렉토리 embed (techai-ide 패턴)
옵션 B: hanimo 상위 디렉토리 참조 (`../knowledge/docs/` 상대 경로)

**결정:** 옵션 A 유지 (embed 자립) — 단 bxm 13개 제거 후 hanimo의 62 문서로 symlink/copy. 어느 쪽이든 **팩 개수 62 확인** 필수.

- [ ] **Step 4: 팩 개수 검증 테스트**

Run: `go test ./... -run 'TestKnowledge' -v`
Expected: 팩 카운트 테스트가 있으면 bxm 제거 반영한 값으로 재설정

### Task 2.6: 빌드 검증 — Go 컴파일

**Files:**
- None (verification only)

- [ ] **Step 1: go mod tidy**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code/hanimo-code-desktop
go mod tidy
```
Expected: 새 module 이름 기준 의존성 정리. 에러 없어야 함.

- [ ] **Step 2: 전체 Go 패키지 컴파일**

Run: `go build ./...`
Expected: 전체 PASS. 실패 시 import 미치환·시그니처 변경 의심.

- [ ] **Step 3: 기존 테스트 5종 실행**

Run: `go test ./... -count=1`
Expected: 전체 PASS (app_test / config_test / git_test / knowledge_test / toolparse_test)

실패 시 우선 `knowledge_test`(bxm 제거 영향), `config_test`(endpoint 기본값 변경 영향)을 먼저 확인.

### Task 2.7: 빌드 검증 — Frontend + Wails

**Files:**
- None (verification)

- [ ] **Step 1: npm install**

```bash
cd frontend
npm install
```
Expected: PASS. 경고는 무시 가능.

- [ ] **Step 2: vite 빌드만 단독 확인**

Run: `npm run build`
Expected: `dist/` 생성. 실패 시 import 미치환 의심.

- [ ] **Step 3: wails build (개발용 —debug)**

```bash
cd ..
wails build -debug -skipbindings
```
Expected: `build/bin/hanimo-code-desktop.app` (macOS) 또는 `.exe` (Windows) 생성. 빌드 시간 약 1~2분.

- [ ] **Step 4: 앱 최초 실행 확인**

Run: `open build/bin/hanimo-code-desktop.app` (macOS)
Expected: 앱 창이 열리고 제목에 "hanimo Desktop" 표기. 파일 트리·채팅 영역이 techai 테마(기본 Slate 계열)로 보임.

### Task 2.8: 커밋 (Phase 0 완료)

- [ ] **Step 1: 변경 전체 확인**

Run: `git status --short | head -30`
Expected: 새 폴더 `hanimo-code-desktop/` 하위의 수많은 신규 파일

- [ ] **Step 2: add + commit**

```bash
cd /Users/jiwonkim/Desktop/kimjiwon/hanimo-code
git add hanimo-code-desktop/
git commit -m "$(cat <<'EOF'
feat(desktop): port techai-ide v0.2.0 as hanimo-code-desktop (Phase 0)

TECHAI_CODE/techai-ide v0.2.0 (ide-v0.2.0 태그) 전체를 hanimo-code-desktop/ 
서브디렉토리로 복사. import 경로·모듈명·설정 경로·환경변수를 일괄 sed 치환.
기본 엔드포인트는 Ollama 로컬(http://localhost:11434/v1)·모델은 qwen3:8b.
knowledge.go의 bxm 13팩 제거, hanimo 62 문서만 포함.

소스 커밋: techai-ide ide-v0.2.0 (f90e4b9)
- Go 파일 13개 + 테스트 5종 포함
- React 컴포넌트 18개 (DiffView 포함 v0.2.0 신규)
- xterm.js 실 터미널, 세션, 아이콘 자산 승계

Constraint: bxm/scrape-bxm/사내 Jira-Wiki MCP 번들은 포팅 금지
Rejected: Windows 폐쇄망 호환 코드 제거 | terminal_windows.go는 외부망에도 무해하므로 유지
Directive: 멀티 프로바이더·Honey 테마·14 Activity 아이콘은 Phase 1+ 별도 플랜
Confidence: high
Scope-risk: moderate (대규모 디렉토리 복사)
Not-tested: wails build Windows·Linux 타깃 (macOS만 로컬 확인)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

Run: `git push origin main`

---

## Part 3 — hanimo-code-desktop Phase 1: Honey 브랜드 (예상 0.5일)

### Task 3.1: CSS 변수로 Honey 팔레트 정의

**Files:**
- Modify: `hanimo-code-desktop/frontend/src/style.css`

- [ ] **Step 1: 기존 테마 클래스 구조 확인**

Run: `grep -n "^body\." frontend/src/style.css | head`
Expected: `body.t-cursor`, `body.t-linear` 등 테마 클래스 블록이 있음

- [ ] **Step 2: designs/hanimo-desktop-v1.html 에서 honey 블록 추출**

`designs/hanimo-desktop-v1.html`의 `:root { --bg-base:#1a1410; ... }` 블록이 honey 기본값. 해당 변수 set을 style.css의 `:root` 대체 또는 `body.t-honey` 블록으로 이식.

권장 구조:
```css
:root {
  /* Honey (hanimo default) — from designs/hanimo-desktop-v1.html */
  --bg-base: #1a1410;
  --bg-activity: #14100d;
  --bg-sidebar: #1f1813;
  --bg-editor: #1a1410;
  --bg-panel: #221a14;
  --bg-terminal: #14100d;
  --bg-hover: rgba(245,166,35,0.06);
  --bg-active: rgba(245,166,35,0.1);
  --bg-input: #1a1410;
  --border: rgba(245,166,35,0.1);
  --border-focus: #f5a623;
  --fg-primary: #f4ecd8;
  --fg-secondary: #c9b890;
  --fg-muted: #8a7858;
  --fg-dim: #554532;
  --accent: #f5a623;
  --accent-glow: rgba(245,166,35,0.22);
  --accent-text: #1a1410;
  --success: #6cae75;
  --warning: #e8a317;
  --error: #e06666;
  --syn-kw: #e8a317;
  --syn-fn: #c9b890;
  --syn-str: #98c379;
  --syn-num: #e4a65e;
  --syn-cmt: #6e5d42;
  --syn-typ: #f5c76e;
  --syn-op: #c9b890;
  --status-bg: #f5a623;
  --status-fg: #1a1410;
  --bubble-user-bg: rgba(245,166,35,0.08);
  --bubble-ai-bg: rgba(255,255,255,0.02);
  --bubble-ai-border: rgba(245,166,35,0.12);
}
```

실제 코드는 `designs/hanimo-desktop-v1.html` line 11-48 참조.

- [ ] **Step 3: body.t-honey 클래스도 동일 값으로 추가**

(테마 전환 시 다른 테마에서 honey로 복귀하기 위함)

```css
body.t-honey {
  /* 위 :root 와 동일 */
}
```

### Task 3.2: ThemePicker에 Honey 항목 추가

**Files:**
- Modify: `hanimo-code-desktop/frontend/src/components/ThemePicker.tsx`

- [ ] **Step 1: 기존 테마 목록 파악**

Run: `grep -n "t-cursor\|t-linear\|t-github" frontend/src/components/ThemePicker.tsx`
Expected: 테마 배열 또는 버튼 목록 위치 확인

- [ ] **Step 2: honey 를 배열 맨 앞에 추가**

`Edit` 도구로 테마 배열에 아래 항목을 **첫 번째**로 삽입:

```tsx
{ id: '', label: 'Honey', dot: 'linear-gradient(135deg,#f5a623,#e8a317)' },
```

(id가 빈 문자열인 이유: honey는 기본값이라 `body.className`이 비어 있을 때 적용됨. 기존 배열의 기본값 처리 패턴을 그대로 따름.)

- [ ] **Step 3: 기본 선택 상태 반영**

컴포넌트의 `currentTheme` 초기값을 `''` (honey) 로 설정. 이미 `''`이 기본값이면 변경 불필요.

### Task 3.3: App.tsx — 초기 테마 state

**Files:**
- Modify: `hanimo-code-desktop/frontend/src/App.tsx`

- [ ] **Step 1: 초기 state 확인**

Run: `grep -n "useState.*theme\|currentTheme" frontend/src/App.tsx`
Expected: `const [theme, setTheme] = useState<string>(...)` 라인

- [ ] **Step 2: 기본값을 `''` (honey) 로 설정**

```tsx
const [theme, setTheme] = useState<string>('')  // '' = honey default
```

- [ ] **Step 3: localStorage 키 호환성**

localStorage에서 이전 테마 값을 복원하는 경우, 복원 실패 시 `''` 로 폴백되는지 확인:

```tsx
const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') ?? '')
```

### Task 3.4: 빌드 + 시각 검증

- [ ] **Step 1: Frontend dev 빌드**

```bash
cd hanimo-code-desktop/frontend
npm run build
```
Expected: PASS

- [ ] **Step 2: Wails 재빌드**

```bash
cd ..
wails build -debug -skipbindings
```
Expected: PASS

- [ ] **Step 3: 앱 실행 후 시각 확인**

Run: `open build/bin/hanimo-code-desktop.app`
Expected:
- 기본 진입 시 Honey 테마(앰버/크림/깊은갈색) 표시
- ThemePicker 첫 번째 항목이 "Honey" 이고 선택된 상태
- 다른 테마 버튼 클릭 시 정상 전환, 다시 Honey 클릭 시 복귀

- [ ] **Step 4: 회귀 테스트 실행**

Run: `go test ./... -count=1`
Expected: 전체 PASS (Go 측 변경 없음)

### Task 3.5: 커밋

- [ ] **Step 1: 변경 확인**

Run: `git status --short`
Expected: style.css, ThemePicker.tsx, App.tsx 3 파일 수정

- [ ] **Step 2: add + commit**

```bash
git add hanimo-code-desktop/frontend/src/style.css hanimo-code-desktop/frontend/src/components/ThemePicker.tsx hanimo-code-desktop/frontend/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(desktop): Phase 1 — Honey brand theme as default

designs/hanimo-desktop-v1.html 의 Honey 팔레트(앰버 #f5a623 + 크림 #f4ecd8
+ 깊은 갈색 #1a1410)를 style.css :root 및 body.t-honey 블록으로 이식.
ThemePicker에 Honey를 첫 번째 항목으로 추가하고 App.tsx 초기 state를
빈 문자열로 설정하여 기본 진입 시 Honey가 선택된다.

Constraint: hanimo-code-desktop 의 브랜드 팔레트는 Honey 확정
Rejected: 기존 Slate를 유지 | 브랜드 식별성 부족
Confidence: high
Scope-risk: narrow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push**

Run: `git push origin main`

---

## 이후 Phase (별도 플랜으로 분리)

- **Phase 2** — Activity Bar 확장 (14 아이콘: Problems / Knowledge / Skills / MCP / Subagents / Sessions / Web Preview / Permissions), Top Ribbon 재구성 (Mode Switcher + Provider Chip + Brand)
- **Phase 3** — Right Panel Metrics Row (Context % · Cache hit · Iter · Provider tier), Status Bar 확장
- **Phase 4** — Hash-anchor gutter 표시 + Tools log `↺ undo` 버튼 + Problems Strip (LSP)
- **Phase 5** — 전역 Command Palette (Ctrl+K) + 한국어 토글 배지
- **Phase 6** — 멀티 프로바이더 드롭다운 (Ollama /api/tags 포함 14+)

각 Phase 진입 시 `superpowers:writing-plans` 로 별도 플랜 작성 후 착수 (TOOLING-POLICY-2026-04-24 준수).

---

## Self-Review Checklist

**1. 스펙 커버리지**
- hanimo cli 역포팅 memory + 테스트 3종 + toolparse 엣지 → Part 1 ✅
- 디렉토리 복사 + sed 치환 → Task 2.1–2.3 ✅
- 기본 엔드포인트 변경 (Ollama) → Task 2.4 ✅
- bxm 제거 → Task 2.5 ✅
- 빌드 검증 (go / vite / wails) → Task 2.6–2.7 ✅
- Honey 테마 적용 → Part 3 ✅
- Phase 2~6 는 의도적으로 별도 플랜 ✅

**2. 플레이스홀더 스캔**
- TODO / implement later / 필요시 구현 같은 단어 없음 ✅
- 각 Step에 실행 가능한 커맨드 또는 구체적 편집 지시 포함 ✅
- memory/registry 등록 위치는 "hanimo registry.go의 유사 위치(knowledge_search 근처)"로 기존 코드 패턴 기준 명시 ✅

**3. 타입/식별자 일관성**
- module 이름 `hanimo-code-desktop` 전 태스크 일관 ✅
- import 경로 `github.com/flykimjiwon/hanimo` 전 태스크 일관 ✅
- 설정 경로 `.hanimo/` / `HANIMO_*` 일관 ✅
- 기본 엔드포인트 `http://localhost:11434/v1` · 모델 `qwen3:8b` 일관 ✅
- 테마 id `''` (honey 기본) · `t-cursor` 등 기존 패턴 따름 ✅

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-24-hanimo-code-desktop-porting.md`.

**실행 방식 선택:**

1. **Subagent-Driven (권장)** — Task 별 fresh subagent 파견 + 단계 간 리뷰. 병렬성·격리성 최고.
2. **Inline Execution** — 현 세션에서 `executing-plans` 로 Task 단위 체크포인트 실행.

**어느 방식으로 진행할까요?**
