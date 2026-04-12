# Hanimo Embedded Browser Plan

하니모에 내장 브라우저를 탑재하여 HTML UI 미리보기 + 개발 지원

## 현재 상태

- 하니모: 순수 터미널 TUI (BubbleTea 기반)
- Spark: 별도 Go HTTP 서버 (cmd/spark), 하니모와 분리됨
- 내장 브라우저/Webview: **없음**

## 목표

1. **HTML UI 미리보기**: 하니모가 생성하는 HTML/CSS/JS를 즉시 렌더링해서 보여줌
2. **개발 중 라이브 프리뷰**: 코드 수정 → 자동 새로고침 (Hot Reload)
3. **Spark 통합**: Spark 채팅 UI를 하니모 내에서 직접 접근

## 아키텍처 옵션

### Option A: Webview 임베딩 (권장)

Go에서 네이티브 Webview를 임베딩하는 방식

```
hanimo (Go binary)
├── TUI Mode (기존 BubbleTea)
└── Browser Mode (Webview)
    ├── 내장 HTTP 서버 (localhost)
    ├── Webview 창 (시스템 WebKit/Chromium)
    └── Go ↔ JS 브릿지
```

**후보 라이브러리**

| 라이브러리 | 엔진 | 크기 증가 | 특징 |
|-----------|------|----------|------|
| [webview/webview](https://github.com/webview/webview) | 시스템 WebKit (macOS) | ~1MB | 경량, CGo 필요, 크로스플랫폼 |
| [nicedoc-io/nicedoc](https://github.com/nicedoc-io/nicedoc) | 시스템 WebKit | 최소 | Markdown 미리보기 특화 |
| [nicklockwood/HTMLPreview](https://github.com/nicklockwood) | 시스템 WebKit | 최소 | HTML 미리보기 |

**장점**: 바이너리 크기 작음, macOS에서는 추가 의존성 없음 (시스템 WebKit 사용)
**단점**: CGo 필요, 크로스 컴파일 복잡

### Option B: Wails v2 (풀 데스크톱 앱)

Go + Webview 기반 데스크톱 앱 프레임워크

```
hanimo (Wails app)
├── Go Backend (기존 로직)
└── Frontend (HTML/CSS/JS)
    ├── React / Svelte / Vanilla
    └── 양방향 바인딩 (Go ↔ JS)
```

**후보 프레임워크**

| 프레임워크 | 특징 |
|-----------|------|
| [Wails v2](https://wails.io) | Go + Webview, 공식 macOS/Linux/Windows |
| [go-app](https://go-app.dev) | PWA 기반, 웹 + 데스크톱 |
| [Fyne](https://fyne.io) | 순수 Go UI (Webview 아님) |

**장점**: 완전한 데스크톱 앱 경험, Hot Reload 내장
**단점**: 빌드 복잡도 증가, 바이너리 크기 증가

### Option C: 내장 HTTP 서버 + 외부 브라우저 오픈 (최소 구현)

기존 Go binary에 HTTP 서버를 내장하고 시스템 브라우저를 자동으로 열기

```
hanimo (Go binary)
├── TUI Mode (기존)
└── hanimo serve / hanimo preview
    ├── 내장 HTTP 서버 (localhost:임의포트)
    ├── File Watcher (fsnotify)
    ├── WebSocket (라이브 리로드)
    └── open(1) 시스템 브라우저 오픈
```

**장점**: 구현 가장 간단, CGo 불필요, 바이너리 크기 변화 없음
**단점**: 별도 브라우저 창 필요 (하니모 내 통합 아님)

## 권장 구현 순서

### Phase 1: 내장 HTTP 서버 + 브라우저 오픈 (Option C)

가장 빠르게 구현 가능, 즉시 가치 제공

```go
// cmd/hanimo에 추가할 서브커맨드
// hanimo preview <file.html>   → HTML 파일 미리보기
// hanimo serve [dir]           → 디렉토리 서빙 + 라이브 리로드
// hanimo spark                 → Spark 채팅 UI 오픈
```

**핵심 기능**:
- `hanimo preview index.html` → localhost에 서빙 + 브라우저 자동 오픈
- File watcher로 변경 감지 → WebSocket으로 브라우저에 reload 신호
- Spark 통합: `hanimo spark` → 내장 Spark UI 실행

**필요 패키지**:
```
github.com/fsnotify/fsnotify  # 파일 변경 감지
github.com/gorilla/websocket  # 라이브 리로드 WebSocket
```

**예상 구조**:
```
internal/browser/
├── server.go        # 내장 HTTP 서버 (정적 파일 서빙)
├── watcher.go       # fsnotify 파일 변경 감지
├── livereload.go    # WebSocket 라이브 리로드
├── open.go          # 시스템 브라우저 오픈 (exec.Command("open", url))
└── inject.go        # HTML에 라이브 리로드 스크립트 자동 주입
```

### Phase 2: Webview 임베딩 (Option A)

Phase 1 안정화 후, 하니모 자체에 Webview 창을 통합

```go
// hanimo preview --embedded <file.html>  → Webview 창에서 열기
// TUI 내에서 Ctrl+B → 브라우저 모드 전환
```

**추가 구현**:
- `webview/webview` 라이브러리 통합
- TUI ↔ Webview 모드 전환
- Go ↔ JS 브릿지로 하니모 기능 접근

### Phase 3: 풀 하이브리드 앱 (Option B, 선택)

필요 시 Wails로 전면 전환하여 데스크톱 앱화

## Spark 통합 시나리오

```
사용자: hanimo spark
  → 내장 HTTP 서버 시작 (Spark UI 서빙)
  → 시스템 브라우저 자동 오픈
  → Spark API 프록시 (cmd/spark의 핸들러 재사용)

사용자: hanimo preview ./frontend/index.html
  → HTML 파일 서빙 + 라이브 리로드
  → 코드 수정 시 자동 새로고침

사용자: hanimo serve ./docs/html/
  → 디렉토리 전체 서빙
  → 파일 브라우저 + 라이브 리로드
```

## 개발 중 HTML UI 프리뷰 워크플로우

```
1. 하니모가 HTML/CSS/JS 코드를 생성
2. 자동으로 내장 서버에 반영
3. 브라우저에서 즉시 미리보기
4. 사용자 피드백 → 코드 수정 → 자동 리로드
5. 만족 시 파일 저장/커밋
```

## 기술 참고

- macOS `open` 명령어로 시스템 브라우저 오픈: `exec.Command("open", url)`
- `embed.FS`로 HTML 템플릿 바이너리에 내장 가능 (Go 1.16+)
- fsnotify는 macOS kqueue 기반으로 효율적
- WebSocket 라이브 리로드는 ~50줄 구현으로 충분

## 우선순위

```
Phase 1  [NEXT]   내장 HTTP 서버 + 시스템 브라우저 오픈 + 라이브 리로드
Phase 2           Webview 임베딩 (하니모 내 통합 렌더링)
Phase 3           Wails 기반 풀 데스크톱 앱 (선택)
```
