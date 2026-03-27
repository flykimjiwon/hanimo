# 07. TUI 디자인 가이드 — 터미널 AI 코딩 어시스턴트 UI/UX

> 작성일: 2026-03-26 | 대상: modol (TypeScript + Ink)

---

## 1. TUI 디자인 원칙

### 확립된 가이드가 있는가?

웹의 Material Design 같은 단일 표준은 없지만, 사실상의 표준 출처 3곳이 있다:

1. **Charm.sh** — TUI 디자인 시스템에 가장 가까운 존재
   - 터미널을 1급 UI 표면으로 취급
   - Elm Architecture (Model / Update / View) — 단방향 데이터 흐름
   - CSS 영감의 선언적 스타일링 (Lipgloss)
   - 기능 저하 우아하게: 터미널 능력에 따라 컬러 자동 다운샘플링

2. **"네이티브 느낌" 계약** (커뮤니티 합의)
   - 입력 → 시각 피드백 지연 제로
   - 깜빡임/전체 리드로우 없음 — 변경 영역만 다시 그림
   - 익숙한 탈출구: `q`/`Esc`으로 나가기, `?`로 도움말
   - 리사이즈 안전 — 터미널 크기 변경시 레이아웃 재계산
   - 조용한 실패 없음 — 모든 에러에 스타일된 메시지

3. **readline 규약** (수십 년 유닉스 표준 — 절대 오버라이드 금지)
   - `Ctrl+A` = 줄 시작, `Ctrl+E` = 줄 끝
   - `Ctrl+C` = 취소, `Ctrl+D` = EOF
   - `Ctrl+Z` = 일시정지

---

## 2. 컴포넌트 라이브러리

### Ink 에코시스템 (우리 스택)

| 패키지 | 용도 | 상태 |
|--------|------|------|
| `ink` v6.x | 코어 렌더러, Yoga Flexbox | Active |
| `@inkjs/ui` | 공식 컴포넌트 — TextInput, Select, MultiSelect, Spinner, ProgressBar, Badge, StatusMessage, Alert | Active |
| `pastel` | Ink 위 CLI 프레임워크 (파일 기반 라우팅) | Active |
| `chalk` | 저수준 컬러 문자열 | Active |

> **중요**: `@inkjs/ui`가 산재한 `ink-*` 커뮤니티 패키지를 대체. `ink-select-input`, `ink-spinner` 개별 설치 대신 `@inkjs/ui` 사용 권장.

### Ink 핵심 훅

```typescript
useInput(handler, {isActive})    // 키보드 입력, 수정자 키 지원
useFocus() / useFocusManager()   // Tab 포커스 시스템
useWindowSize()                  // 반응형 터미널 크기
useStdout()                      // stdout 직접 접근
```

### Ink 레이아웃 모델

Yoga (Facebook Flexbox) 기반 — `<Box>`가 기본 `display: flex`:
- `flexDirection`, `gap`, `alignItems`, `justifyContent`
- `width`, `height`, `minWidth`, `flexGrow`, `flexShrink`
- CSS Flexbox와 동일한 시맨틱. Grid는 없음 (Box 중첩으로 시뮬레이션)

### 참고할 다른 TUI 에코시스템

| 프레임워크 | 언어 | 참고 포인트 |
|-----------|------|------------|
| **Bubbletea + Lipgloss** | Go | CSS 스타일 API, 컬러 다운샘플링, 컴포넌트 설계 |
| **Textual** | Python | CSS 기반 레이아웃, 위젯 갤러리, 마크다운 렌더러 |
| **Ratatui** | Rust | 게이지, 테이블, 스파크라인 위젯 |

---

## 3. 컬러 & 타이포그래피

### 터미널 컬러 감지 체인

```
1. $NO_COLOR 설정 → 모든 컬러 제거
2. $COLORTERM == "truecolor" or "24bit" → 24비트 RGB
3. $COLORTERM == "256color" → 256색
4. $TERM에 "256color" 포함 → 256색
5. $TERM → 기본 16색
6. 폴백 → 흑백
```

> **주의**: SSH/sudo에서 `COLORTERM`이 전달되지 않음. 256색을 기본값으로 하고 truecolor는 opt-in 권장.

### 추천 컬러 팔레트 (Catppuccin Mocha 기반, 색각이상 테스트 완료)

| 역할 | Hex | 용도 |
|------|-----|------|
| `rosewater` | `#F5E0DC` | 사용자 입력 텍스트 |
| `blue` | `#89B4FA` | AI 어시스턴트, 주요 액션 |
| `green` | `#A6E3A1` | 성공, 파일 작성, 테스트 통과 |
| `red` | `#F38BA8` | 에러, 거부, 삭제 |
| `yellow` | `#F9E2AF` | 경고, 대기, 비용 알림 |
| `mauve` | `#CBA6F7` | 도구 호출, 함수명 |
| `teal` | `#94E2D5` | 정보, 스트리밍 표시 |
| `overlay0` | `#6C7086` | 비활성 텍스트 |
| `base` | `#1E1E2E` | 배경 |
| `surface0` | `#313244` | 패널 배경 |
| `surface1` | `#45475A` | 테두리, 구분선 |

### 라이트/다크 테마 감지

```typescript
function isDarkTerminal(): boolean {
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const bg = parseInt(colorfgbg.split(';').pop() || '0');
    return bg < 8;
  }
  return true; // 개발자 터미널 대부분 다크
}
```

### 타이포그래피 규칙

- **고정폭만** — 터미널은 모노스페이스 그리드
- **Nerd Fonts** 아이콘: 미설치 가정하고 ASCII 폴백 제공
- **유니코드 박스 문자** (U+2500–U+257F): 모든 모던 터미널에서 안전
- **이모지**: 폭 계산 깨짐 가능 → 레이아웃 핵심 영역에선 피하기
- **Bold**: 신뢰 가능 / **Italic**: 터미널마다 다름 → 중요 정보엔 피하기
- **Blink**: 절대 사용 금지

---

## 4. 레이아웃 패턴 — AI 코딩 어시스턴트

### OpenCode 검증된 레이아웃 (120K stars)

```
┌─────────────────────────────────────────────┐
│  Status Bar (모델명, 세션, 비용)              │
├─────────────────────────────────────────────┤
│                                             │
│  Messages Viewport (스크롤)                  │
│  ├── 사용자 메시지 (스타일 박스)              │
│  ├── 어시스턴트 메시지 (마크다운)             │
│  └── 도구 호출 결과 (접기/펼치기)             │
│                                             │
├─────────────────────────────────────────────┤
│  Input Editor (멀티라인, vim 키)             │
├─────────────────────────────────────────────┤
│  Key Hints  [?] help  [ctrl+k] cmds         │
└─────────────────────────────────────────────┘

오버레이 다이얼로그 (중앙, 모달):
  - CommandDialog (ctrl+k)   퍼지 명령 검색
  - SessionDialog (ctrl+s)   세션 전환
  - ModelDialog              모델 선택
  - ThemeDialog              테마 선택
  - HelpDialog (?)           단축키 레퍼런스
```

### 채팅 메시지 시각 계층

```
  ╭─ You ─────────────────────────────────────╮
  │  JSON 파일 파싱하는 함수 만들어줘            │
  ╰────────────────────────────────────────────╯

  ╭─ Assistant ────────────────────────────────╮
  │  에러 처리가 포함된 JSON 파서를 만들겠습니다. │
  │                                            │
  │  ▶ WriteFile: src/parser.ts                │  ← 접기 가능
  │  ▶ RunCommand: npx tsc --noEmit            │  ← 접기 가능
  │                                            │
  │  함수가 잘못된 JSON을 만나면...               │
  ╰────────────────────────────────────────────╯
```

### Diff 표시 패턴

```
  ┌── src/parser.ts ──────────────────────────┐
  │  @@ -12,6 +12,10 @@                       │
  │  - const data = JSON.parse(raw);           │  ← red
  │  + try {                                   │  ← green
  │  +   const data = JSON.parse(raw);         │  ← green
  │  + } catch (e) {                           │  ← green
  │  +   throw new ParseError(e.message);      │  ← green
  │  + }                                       │  ← green
  └───────────────────────────────────────────┘
```
> `+`/`-` 접두사 + 컬러 — 컬러만으로 구분하지 않는다.

---

## 5. 스트리밍 렌더링 최적화 (핵심!)

Ink + LLM 토큰 스트리밍은 **성능 병목**. React reconciler가 매 state 업데이트마다 실행되므로:

### 16ms 배치 패턴 (60fps)

```typescript
function useStreamingText(stream: AsyncIterable<string>) {
  const buffer = useRef('');
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      if (buffer.current !== displayed) {
        setDisplayed(buffer.current);
      }
    }, 16); // ~60fps

    (async () => {
      for await (const chunk of stream) {
        buffer.current += chunk;
      }
    })();

    return () => clearInterval(interval);
  }, [stream]);

  return displayed;
}
```

### 추가 최적화

- `<Static>` — 완료된 메시지는 Static에 넣어 리렌더 방지
- 활성 메시지만 스트리밍 컴포넌트로 렌더
- **OpenCode 참고**: `PartCache` 패턴 — 완료된 메시지의 마크다운 렌더 캐싱

### 스피너 규약

- `dots` — 유니버설 기본값
- 항상 진행 내용 표시: `⠋ claude-sonnet-4-6 호출 중...` (스피너만 돌리지 않기)
- 프로그레스 바: 측정 가능한 총량이 있을 때만. LLM 생성은 스피너 + 토큰 카운터.

---

## 6. 인터랙션 패턴

### 키보드 단축키 규약

**절대 오버라이드 금지 (OS/터미널 레벨)**:
| 키 | 기능 |
|----|------|
| `Ctrl+C` | SIGINT / 취소 |
| `Ctrl+D` | EOF / 종료 |
| `Ctrl+Z` | SIGTSTP / 일시정지 |

**modol 추천 키맵**:
| 키 | 기능 |
|----|------|
| `Ctrl+K` | 커맨드 팔레트 (퍼지 검색) |
| `Ctrl+N` | 새 세션 |
| `Ctrl+/` | 사이드바 토글 |
| `Ctrl+X, M` | 모델 선택 |
| `Ctrl+X, S` | 세션 목록 |
| `Ctrl+X, T` | 테마 선택 |
| `?` | 도움말 |
| `Esc` | 다이얼로그 닫기 / 입력 취소 |
| `@` | 파일/심볼 선택 (인라인) |
| `/` | 슬래시 명령 접두사 |
| `!` | 셸 명령 (인라인) |

> **리더 키 패턴** (`Ctrl+X` + 키): readline 충돌 방지를 위한 2키 코드. 상태바에 표시.

### 모달 vs 모달리스

- **모달**: 확인/선택 — 오버레이, 배경 흐리게, 포커스 트랩, `Esc` 닫기
- **모달리스**: 지속 컨텍스트 (파일 트리, 에이전트 상태) — 분할 패널

### 스크롤

```typescript
// 자동 스크롤: 새 메시지시 바닥으로
// 사용자가 위로 스크롤하면 고정
// 사용자가 바닥에 도달하면 자동 스크롤 재개
```

---

## 7. 접근성

### 필수 사항

- `NO_COLOR` 환경변수 지원 ([no-color.org](https://no-color.org))
- `--plain` 모드: 스피너, 프로그레스 바, ANSI 포매팅 비활성화
- **컬러만으로 정보 전달 금지** — 항상 텍스트 라벨 병행
  - `✓ ` 성공, `✗ ` 에러, `! ` 경고, `i ` 정보

### 대비 비율 (WCAG 2.1 AA)

| 텍스트 유형 | 필요 비율 | Catppuccin 예시 |
|------------|----------|----------------|
| 일반 텍스트 | 4.5:1 | `#CDD6F4` on `#1E1E2E` = 13.7:1 |
| 굵은/큰 텍스트 | 3:1 | `#A6E3A1` on `#1E1E2E` = 8.7:1 |
| 힌트/비활성 | 3:1 이상 | `#9399B2` 사용 (`#6C7086`은 경계선) |

### 색각이상 대응

- 빨강 vs 초록을 유일한 상태 구분자로 사용 금지
- 파랑과 노랑은 보편적으로 구분 가능
- Catppuccin 팔레트는 제2색각이상(deuteranopia) 테스트 완료

---

## 8. 참고 자료

### 디자인 레퍼런스 프로젝트

| 프로젝트 | 참고 포인트 |
|----------|------------|
| **OpenCode** (Go, 120K stars) | 전체 레이아웃, 다이얼로그 패턴, 슬래시 명령 |
| **Charm.sh Bubbles** | 컴포넌트 설계, 뷰포트, 리스트, 텍스트 영역 |
| **gh-dash** | 탭 네비, 컬럼 레이아웃, 인라인 프리뷰 |
| **Warp** | 블록 개념 (명령+출력 그룹핑), 모던 텍스트 편집 |
| **Textual Widget Gallery** | 종합 위젯 레퍼런스 |

### 링크

- [Charm.sh Bubbletea](https://github.com/charmbracelet/bubbletea)
- [Charm.sh Lipgloss](https://github.com/charmbracelet/lipgloss)
- [Ink GitHub](https://github.com/vadimdemedes/ink)
- [Ink UI](https://github.com/vadimdemedes/ink-ui)
- [Textual Widget Gallery](https://textual.textualize.io/widget_gallery/)
- [awesome-tuis](https://github.com/rothgar/awesome-tuis)
- [termstandard/colors](https://github.com/termstandard/colors)
- [no-color.org](https://no-color.org)
- [marked-terminal](https://github.com/mikaelbr/marked-terminal) — TS 마크다운→ANSI

---

## 9. 구현 체크리스트

### Phase 1 — 기반
- [ ] `useWindowSize()` + 반응형 레이아웃
- [ ] `@inkjs/ui` ThemeProvider + Catppuccin 테마 토큰
- [ ] `NO_COLOR` + `COLORTERM` 감지
- [ ] 2레벨 키맵: readline + `Ctrl+X` 리더키
- [ ] 하단 키 힌트 바: `[?] help  [ctrl+k] commands  [ctrl+n] new`

### Phase 2 — 채팅 인터페이스
- [ ] `<Static>` 완료 메시지 + 스트리밍 활성 메시지
- [ ] 16ms 배치 플러시 스트리밍
- [ ] 스크롤 뷰포트 + 자동 스크롤/고정
- [ ] 접기/펼치기 도구 호출 결과
- [ ] 사용자/어시스턴트 메시지 스타일 구분 (둥근 테두리)

### Phase 3 — 개발자 경험
- [ ] 통합 diff 렌더러 (`+`/`-` + 컬러)
- [ ] 커맨드 팔레트 (`Ctrl+K`) + `fuse.js` 퍼지 검색
- [ ] `@` 파일/심볼 선택기
- [ ] 모델 선택 다이얼로그 + 상태바 표시
- [ ] 세션 목록 (검색 가능)

### Phase 4 — 마무리 & 접근성
- [ ] `--no-color` / `--plain` 플래그
- [ ] 모든 상태 표시: 심볼 + 컬러 + 라벨
- [ ] 리사이즈 안전 (`SIGWINCH` 대응)
- [ ] Nerd Font 글리프 + ASCII 폴백 설정
