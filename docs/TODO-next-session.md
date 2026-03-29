# modol 다음 세션 TODO

> 유저 피드백 기반, 우선순위순 정리

---

## 🔴 우선순위 1: 메뉴 UX 전면 재설계

### 현재 문제
- `/endpoint add local ollama http://localhost:11434` 명령어 입력이 불편
- 메뉴에서 직접 선택하는 방식이 없음
- 모델 전환 시 사용 불가능한 모델도 보임
- 프로바이더 전환 시 API 키 없는 것도 전부 나옴
- 엔드포인트 설정이 텍스트 안내만

### 목표: 두 가지 방식 모두 지원
```
방식 1: 슬래시 커맨드 (파워유저)
  /endpoint add local ollama http://localhost:11434

방식 2: 메뉴 (일반유저) ← 신규
  Esc → 엔드포인트 관리 → 추가
  → [이름 입력] → [프로바이더 선택] → [URL 입력] → [API 키(선택)]
  → 완료
```

### 구현할 것

#### 1-1. 메뉴 구조 재설계
```
현재:                          개선:
├── 역할: Dev                  ├── 🐶 역할 & 모드
├── 모델 전환                  │   ├── 역할 (dev/plan/super/chat)
├── 프로바이더 전환             │   └── 모드 프리셋 (auto/turbo/eco)
├── 엔드포인트 설정            ├── 📡 모델 전환
├── 언어                       │   └── (사용 가능 모델만, @엔드포인트 표시)
├── 도구 ON/OFF                ├── 🔌 엔드포인트 관리
├── 테마                       │   ├── 목록 보기
├── 대화 초기화                │   ├── 추가 (단계별 입력)
├── 도움말                     │   ├── 삭제
└── 종료                       │   └── 우선순위 변경
                               ├── 🌍 언어
                               ├── 🔧 도구 ON/OFF
                               ├── 🎨 테마
                               ├── 🗑️ 대화 초기화
                               ├── ❓ 도움말
                               └── 🚪 종료
```

#### 1-2. 엔드포인트 추가 메뉴 (단계별)
```
[엔드포인트 추가]
Step 1: 이름 입력 ─────────────
  ❯ local-ollama█

Step 2: 프로바이더 선택 ────────
  1 ▸ ollama
  2   openai
  3   anthropic
  4   custom

Step 3: URL 입력 ───────────────
  ❯ http://localhost:11434█

Step 4: API 키 (선택) ──────────
  ❯ (Enter로 건너뛰기)█

✅ 엔드포인트 "local-ollama" 추가됨
```

#### 1-3. 모델 메뉴 개선
```
[모델 전환]
  1 ▸ qwen3:8b         @local-ollama     [A]
  2   qwen3:14b        @local-ollama     [A]
  3   gpt-oss:20b      @dgx              [A]
  4   gpt-oss:20b      @local-ollama     [A]  ← 같은 모델, 다른 엔드포인트
  5   deepseek-r1:32b  @dgx              [A]
  ──────────────────────────────
  같은 모델 여러 엔드포인트: 선택 또는 Auto (라운드로빈)
```

#### 1-4. 같은 모델 다중 엔드포인트 처리
```
[qwen3:8b 엔드포인트 선택]
  1 ▸ @local-ollama  (priority: 10) — http://localhost:11434
  2   @remote-ollama (priority: 3)  — http://192.168.1.100:11434
  3   Auto (라운드로빈)
```

---

## 🟡 우선순위 2: Tab 역할 전환 + 모델 연동

### 현재 문제
- Tab은 역할만 순환 (chat→dev→plan→super)
- 역할 전환 시 최적 모델은 자동 변경 안 됨

### 구현할 것
- Tab 순환: chat → dev → plan → super → chat
- 각 역할 전환 시 `/mode` 프리셋에 따라 모델도 함께 변경
- 예: super로 전환 → turbo 모드의 super 모델로 자동 전환

---

## 🟡 우선순위 3: StatusBar 좁은 터미널 대응

### 현재 문제
```
mod anthroclaude-sonnet-4 🔧  │tools:● Re0   $0
 l   ic    20250514        Dev  ON    ady tok
```
StatusBar 텍스트가 터미널 너비를 초과하면 줄바꿈되어 깨짐.

### 구현할 것
- 터미널 너비에 따라 StatusBar 항목 우선순위별 truncate
- 좁으면: `modol │ qwen3:8b [A] │ Ready`
- 넓으면: `modol │ ollama/qwen3:8b 🔧 Dev │ tools:ON │ ● Ready │ 0 tok │ $0`

---

## 🟢 우선순위 4: 이전 메뉴 `/endpoint` 메시지 중복

### 현재 문제
- Esc → 엔드포인트 설정 → 안내 메시지 표시
- 이전에 `/endpoint help` 쳤던 메시지와 중복 표시
- 메뉴 선택 결과와 슬래시 커맨드 결과가 같은 채팅 영역에 나옴

### 구현할 것
- 메뉴 선택은 **대화 메시지가 아닌** overlay/popup으로 표시
- 또는 시스템 메시지 앞에 `───` 구분선

---

## 🟢 우선순위 5: spark3 URL 완전 제거

### 현재 상태
- src에서는 제거 완료
- README, docs에 아직 남아있을 수 있음

### 할 것
```bash
grep -r "spark3-share" . --include="*.md" --include="*.json" | grep -v node_modules | grep -v .omc
```

---

## 📋 이전 세션에서 이월

- [ ] text-mode.ts 한국어/영어 i18n
- [ ] 테마 설명 i18n (현재 한국어만)
- [ ] leader key 힌트 i18n
- [ ] onboarding.ts 다국어
- [ ] 스텁 파일 삭제 (coordinator.ts, worker-pool.ts)

---

## 🔴 추가 피드백 (2026-03-29)

### StatusBar 하단 이동/요약
- 상단 StatusBar가 깜빡임 유발 (스크롤 많을 때)
- 주요 정보(모델명, 역할, 상태)를 **하단 input 밑에 요약** 표시
- 상단은 최소화하거나 제거
- 참고: 현재 하단 힌트줄 `Enter 전송 | Esc 메뉴 | ...`에 통합 가능

### 도움말 완전 i18n
- `/help` 출력이 영어 고정 → 한국어 모드면 한국어로
- 모든 커맨드 설명, 메뉴 텍스트, 에러 메시지 i18n 필요
- `currentLang`이 'ko'이면 한국어, 아니면 영어

### 도구 ON/OFF 메뉴 제거
- 역할 시스템으로 이미 통합됨
- 메뉴에서 "도구: ON → OFF" 항목 삭제
