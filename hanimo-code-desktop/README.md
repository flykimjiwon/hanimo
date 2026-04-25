# hanimo-code-desktop

> **상태**: 활발한 개발 중 (Phase 0-13 + 리뷰픽스 완료)
> **상위 레포**: [hanimo-code](../README.md)
> **다음 세션 가이드**: [`docs/SESSION-2026-04-25-RESUME.md`](../docs/SESSION-2026-04-25-RESUME.md)

hanimo CLI의 IDE 형제. Wails(Go + React/TS) 기반 데스크톱 IDE로, hanimo
CLI의 자산(Skills/MCP/Knowledge/Sessions/Hash-anchor)을 그대로 재사용하면서
디자인 v1 mock(`designs/hanimo-desktop-v1.html`)을 한 화면씩 코드로 만든다.

**브랜드 약속**: *"Agent can't silently overwrite your edits."*
모든 file_write가 hash-anchor gutter에 시각화되고, hashline_edit는 라인별
MD5 anchor가 일치하지 않으면 abort한다 (Phase 7-10).

---

## 정책 (변경 시 PR 차단)

| | |
|---|---|
| 라이선스 | **완전 무료 OSS** — 유료화/tier 도입 금지 (목적: 명성) |
| 스코프 | hanimo-code의 5-surface 중 **Code + Desktop**에만 집중. WebUI/RAG/Community/Spark 영역 건드리지 않음 |
| 테마 | Honey 팔레트 기본 + 8 테마 — 모든 컴포넌트는 hard-coded color 금지, `var(--*)` 사용 |
| 언어 | 한국어 UI/커밋 메시지 (코드 식별자만 영문) |
| 폐쇄망 | TECHAI 페어 — 외부망 전용 의존성(`bxm`/사내 endpoint) 포팅 금지 |

---

## Quick Start

```bash
# 사전 설치: wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 1. 의존성
cd hanimo-code-desktop
go mod download
cd frontend && npm ci && cd ..

# 2. 개발 모드 (hot reload)
wails dev

# 3. 프로덕션 빌드
wails build  # → build/bin/hanimo-code-desktop.app
```

기본 LLM endpoint는 `~/.hanimo/config.yaml`을 따른다 (CLI와 동일).
설정 없으면 `localhost:11434/v1` (Ollama) + `qwen3:8b`.

## 멀티-OS 빌드 (Phase 18 검증 완료)

| 타겟 | 명령 | 비고 |
|---|---|---|
| macOS Apple Silicon | `wails build -platform darwin/arm64` | 기본 — `.app` 산출 |
| macOS Intel | `wails build -platform darwin/amd64` | 같은 path에 덮어씀 |
| Windows 64-bit | `wails build -platform windows/amd64` | macOS에서 cross-compile OK · `.exe` |
| Linux x86_64 | `wails build -platform linux/amd64` | macOS cross-compile **불가** — Linux 머신 또는 GH Actions 필요 |

자동 멀티-OS 릴리스는 `.github/workflows/desktop-release.yml` 가 처리한다. `git tag v0.1.0 && git push origin v0.1.0` 하면 4 platform native 빌드 + GitHub Release 자동 업로드.

---

## 현재 빌드 상태

```bash
go build ./...                   # OK
go test ./... -count=1           # ok 49/49
cd frontend && npm run build     # 1532.45 KiB · 1814 modules
```

TS 경고 1건 (`navigator.platform deprecated`)은 Wails v2 종속이라 의도적 보류.

---

## 구현된 기능 (Phase 0~13 누적)

### IDE 골격
- **Activity Bar 14 아이콘** — 모든 패널 진입점 (Phase 2)
- **Top Ribbon** — Brand · ModeSwitcher · ProviderChip · Theme (Phase 1b)
- **Theme picker** — Honey 외 8 테마 즉시 전환
- **Command Palette** — 24 commands · multi-token fuzzy (Phase 4)
- **Editor** — CodeMirror 6 + diff view + split view + WebPreview iframe
- **Terminal** — pty 기반 (Unix/Windows 분기)

### 데이터 패널 (실 데이터 연결됨)
- **FileTree / Search / Git** — 기본 IDE 패널
- **Knowledge Pack 토글** — `/knowledge` 디렉토리 스캔 + enable/disable
- **Sessions** — SQLite 세션 목록 + 로드
- **Skills** — `.hanimo/skills/<name>/SKILL.md` 스캔 (Phase 11)
- **MCP Servers** — stdio 서버 라이브 연결, 도구 트리 (Phase 12)

### 라이브 메트릭 (Phase 13)
- **Context %** — 최근 호출의 prompt_tokens / 32K
- **Cache hit %** — 누적 cached_tokens / prompt_tokens
- **Saved $** — 누적 캐시 절약액 (로컬 endpoint면 0)
- **Iter / Label** — 진행 중 도구 루프 / "idle" · "thinking" · "tool_use"

### Brand promise — Hash anchor 종단 종단
- **Gutter** — CodeMirror StateField + GutterMarker (Phase 7)
- **Backend emit** — file_write 시 12 라인 flash, hashline_edit 시 정밀 라인만 (Phase 9-10)
- **hashline tools** — AI가 line range를 hash로 지정해야 수정 가능 (Phase 10)
- **Undo** — 모든 mutation 전 snapshot, ↺ 버튼 한 번으로 복구

### Placeholder만 (다음 Phase 후보)
- LSP Problems Strip (UI는 활성, 데이터 stub)
- Subagents · Permissions · Run

---

## 폴더 구조

```
hanimo-code-desktop/
├── app.go                    Wails App struct, file ops, lifecycle
├── chat.go                   chatEngine (LLM streaming + tool loop + 메트릭)
├── config.go                 TGCConfig (yaml shared with CLI)
├── bindings_phase3.go        UndoLastEdit + GetMetrics + GetProblems
├── bindings_phase6.go        GetAvailableModels (Tier1+Ollama) + SwitchModel
├── hash_anchor_emit.go       hash:anchor 이벤트 발행
├── hashline.go               hash 기반 line-precise edit tool
├── skills.go                 SKILL.md 스캐너
├── mcp.go                    MCP stdio 클라이언트 + 매니저
├── knowledge.go              .md/.txt knowledge pack 로더
├── session.go                SQLite 세션
├── git.go · terminal*.go     Git/PTY
├── toolparse.go              Qwen3 텍스트 tool-call 파서
├── settings.go               settings.json 영속화
└── frontend/src/
    ├── App.tsx                 라우팅 + Top Ribbon
    └── components/             29 컴포넌트 (panel, editor, palette, gutter…)
```

`go test ./...` 가 검증하는 영역: app/config/git/knowledge/toolparse.

---

## 기여하려면

1. `docs/SESSION-2026-04-25-RESUME.md` 의 정책(§4) + 컨셉 체크리스트(§10) 통과
2. 신규 panel은 `SkillsPanel.tsx` 패턴(파일 단위 단순) 또는 `MCPPanel.tsx`
   패턴(서버 트리 + 펼치기) 중 가까운 쪽을 따른다
3. Wails binding은 `app.go` 또는 `bindings_phaseN.go`에 추가 — `wails dev`
   한 번 돌리면 `wailsjs/go/main/App.d.ts`가 자동 재생성됨
4. 커밋 메시지에 Constraint/Rejected/Confidence 트레일러 (CLAUDE.md
   commit_protocol)
5. 자가 리뷰 금지 — `oh-my-claudecode:code-reviewer` 등 별도 lane으로 검증

## 라이선스

상위 레포(MIT)와 동일.
