# 시장 진단 — 2026-04-24

> **주제 1**: hanimo-code / TECHAI_CODE IDE 의 시장 가능성
> **주제 2**: "지식 위키 + 자동 구조 시각화 + 클릭→AI 수정" 플러그인 아이디어 진단
>
> 작성일: 2026-04-24
> 작성 맥락: 사용자 즉석 시장 질의 → 솔직 진단 응답을 그대로 정리
> 목적: 후속 의사결정의 근거 자료 (재발명/공백 식별)
> 관련 문서: `docs/COMPETITIVE-LANDSCAPE-2026-04.md`, `docs/DESKTOP-PLAN-2026-04.md`, `docs/strategy/REPUTATION-STRATEGY-2026-04-23.md`

---

## TL;DR

1. **IDE 시장**: "경량 + BYOK"는 이제 차별점이 아니라 입장권. opencode·Zed·Aider·Continue·Cline 이 이미 그 레인을 채움. 살길은 두 개의 좁은 wedge — **TECHAI 폐쇄망(금융 사내) 모트 + hanimo 한국어 first 명성**. 둘 다 메모리에 적힌 분리 전략과 정합.
2. **플러그인 아이디어**: 세 가지 조각이 모두 합쳐진 제품은 **시장에 거의 없음**. 다만 다이어그램/시각화 영역은 **CodeSee·SourceTrail·AppMap 이 시도하다 죽거나 축소**된 무덤터임 → 기술 가능성과 별개로 UX·동기화 난이도가 함정.
3. **권고**: 플러그인은 단독 신규 제품 X. **hanimo-code-desktop 안의 한 패널**로 통합하고, "코드 → 다이어그램 단방향 갱신 + 매 작업 후 자동 업데이트" 로만 한정해서 시작.

---

## Part 1 — IDE 시장 진단 (hanimo-code / TECHAI_CODE)

### 1.1 사용자 가설

> "VSCode·Cursor 무거움 → 초경량 IDE + 필수기능 + 터미널 + AI 붙이기 + **엔드포인트 키만 있으면 어떤 AI든 BYOK** → 시장에서 통한다."

### 1.2 경쟁 지형 (2026-04 시점)

| 카테고리 | 도구 | 사용자 가설과 겹치는 지점 |
|---|---|---|
| TUI / CLI | **opencode** (95K★, 75+ provider) | "경량 + BYOK any provider" 정확히 동일. 한국어 UX만 약함. |
| TUI / CLI | **Aider** (39K★) | BYOK + git 통합 강함. precise edit. |
| 네이티브 GUI | **Zed** (Rust) | "진짜 경량/빠름"의 끝판. AI + BYOK 추가 중. 자금·인력 두꺼움. |
| 익스텐션 | **Continue.dev / Cline / Roo Code** | VSCode 위에 BYOK + 다중 provider. 사용자 IDE 안 바꿈. |
| 헤비웨이트 | **Cursor / Windsurf** | 무거움 + 종속. 그래도 시장 점유 압도. |

### 1.3 솔직 진단

- **"가볍다"**는 마케팅 카피로는 좋지만 실제 전환율 낮음. 개발자는 익숙한 환경 안 떠남 (Atom 교훈).
- **"필수 기능만"**은 장기 사용자가 익스텐션 부재로 이탈하는 원인이 됨.
- **"BYOK any endpoint"**는 2026 시점에 **차별점이 아니라 테이블 스테이크**. 위 5개 모두 함.
- 순수 "VSCode 경량 대안" 포지션으로 가면 **Zed 한 명한테 무조건 짐**.

### 1.4 진짜 모트가 될 두 wedge

메모리(`project_hanimo_techai.md`, `project_hanimo_ecosystem_naming.md`)의 분리 전략과 정확히 맞물림:

1. **TECHAI_CODE = 폐쇄망 / 금융 사내 (신한)** ← 진짜 해자
   - Cursor / opencode / Zed 모두 신한 보안망에 못 들어감.
   - 폐쇄망 LLM 게이트웨이 + 사내 인증 + 감사 로그 = 외부 도구가 못 따라옴.
2. **hanimo-code = 한국어 first + 명성 OSS** ← 브랜드 wedge
   - Cursor 한국어 UX 약함, opencode 영어권 TUI 감성.
   - "한국 개발자가 자기 도구라 느낄 수 있는 첫 IDE" 포지션은 **공백**.
   - 메모리(`feedback_monetization_policy.md`)의 "수익은 webui, code/IDE는 명성 목적" 와 정합.

### 1.5 권고 (Part 1)

- "경량 + BYOK"는 **서술 톤**으로만 쓰고, **wedge 메시지**는 위 두 축으로 박을 것.
- TECHAI_CODE 는 **금융/공공 폐쇄망 진입**을 1년 지표로.
- hanimo-code 는 **한국 개발자 커뮤니티 명성**을 1년 지표로 (스타 수, 한국 conf 발표, 한국어 콘텐츠).
- "또 하나의 경량 VSCode 대안" 톤 카피는 폐기.

---

## Part 2 — 플러그인 아이디어 진단

### 2.1 사용자 가설

> "superpowers / gstack 같은 자체 플러그인 제작.
> ① 모든 프로젝트를 **위키처럼 지식 누적**.
> ② 매 작업마다 실시간 **작업 정리 + 구조화**.
> ③ 화면~백엔드 **자동 구조/레이어 다이어그램**.
> ④ 다이어그램에서 **클릭하고 선택해 AI에게 '이 부분 어떻게 고칠까?' 물어보기**."

### 2.2 영역별 시장 진단

#### 영역 ① 지식 위키 누적 — **이미 패턴화됨**

| 도구 | 비고 |
|---|---|
| **Cline Memory Bank** / **Roo Code Memory Bank** | 사용자 가설과 거의 동일. `memory-bank/` 마크다운 + 매 작업 갱신. 깃허브 수만 스타. |
| **Aider repo map** | 자동 코드맵 생성 후 컨텍스트 주입. |
| **Cursor Notepads / Rules** | 가벼운 버전. |
| **Continue.dev `@codebase`** | 인덱싱 기반. |
| **Sourcegraph Cody / Greptile** | 검색 중심 codebase Q&A. |
| **OMC `notepad`, `project_memory`, `state_*`** | 본인 도구가 이미 이 카테고리에 위치. |

→ **재발명 위험**. 차별화 지점 없음. OMC 기존 도구로 커버됨.

#### 영역 ② 자동 구조 / 레이어 시각화 — **시장 공백 + 무덤터**

| 도구 | 상태 |
|---|---|
| **CodeSee** | 정확히 이 비전이었음. **사실상 지원 중단/축소**. |
| **AppMap** | 런타임 시퀀스 다이어그램. 정적 구조는 약함. |
| **SourceTrail** | **2021년 단종**. |
| **Eraser.io DiagramGPT** | 일회성 다이어그램, 코드와 동기화 안 됨. |
| **Understand (SciTools)** | 비싸고 엔터프라이즈, AI 결합 없음. |
| **CodeScene** | 핫스팟 분석 위주, AI 결합 약함. |
| **JetBrains 내장 다이어그램** | IDE 안에 묻혀 있고 AI 못 붙임. |

→ **공백은 진짜 있음**. 하지만 다들 시도하다 죽은 이유 = **"코드 ↔ 다이어그램 동기화"**. 어긋나는 순간 사용자 신뢰 무너짐.

#### 영역 ③ 다이어그램 클릭 → AI 수정 인터랙션 — **상용 제품 거의 없음**

| 도구 | 한계 |
|---|---|
| **GitHub Copilot Workspace** | 파일 단위 plan, 비주얼 그래프 아님. |
| **Cursor Composer / Windsurf Cascade** | 파일 picker, 시각적 아님. |
| **v0.dev** | UI 컴포넌트 한정. |

→ "레이어 박스 클릭 → 그 부분에 대해 AI 대화/수정" 인터랙션은 데모/해커톤급은 봤어도 **상용 제품에 없음**. 진짜 wedge 가능 영역.

### 2.3 함정 (Why CodeSee/SourceTrail died)

1. **동기화 부채**: 코드 변경 → 다이어그램 자동 갱신이 어긋나면 가치 0. AI 시대에는 LLM 으로 자동 갱신이 가능해진 게 새로운 변수.
2. **UX 부채**: "어디 클릭해야 하지?" 가 명확하지 않으면 사용자가 안 씀.
3. **수익화 부채**: B2B 엔터프라이즈로 안 가면 매출 안 남. (메모리상 hanimo는 명성 목적이라 이건 회피 가능)

### 2.4 권고 (Part 2)

세 가지 영역을 동시에 만들지 말 것. **한 축씩 깎기**:

1. **영역 ①(지식 위키)는 재발명 X** — OMC `notepad` / `project_memory` 그대로 사용. 굳이 만들면 기존 도구의 **얇은 UI 래퍼** 정도로만.
2. **영역 ②(다이어그램)는 단방향만** — "코드 → 다이어그램, 매 작업 후 LLM 이 자동 갱신" 으로 한정. **양방향(다이어그램 → 코드)부터 노리면 죽음** (CodeSee 길).
3. **영역 ③(클릭 인터랙션)은 IDE 내장으로만** — 단독 플러그인으로는 UX 한계. **hanimo-code-desktop 의 한 패널**로 통합 (`docs/DESKTOP-PLAN-2026-04.md` 의 14 Activity 아이콘 중 하나로 자리잡힘).
4. **출시 순서**: hanimo-code-desktop MVP → 그 안에 "Architecture" 패널을 v2 로 추가 → 클릭 인터랙션을 v3 로.

---

## 종합 액션 (이 문서 이후 결정 대기)

- [ ] hanimo-code 마케팅/README 문구에서 "경량 VSCode 대안" 제거하고 wedge 두 축으로 재작성
- [ ] TECHAI_CODE 폐쇄망 차별화 항목 별도 문서화 (보안 모델, 사내 LLM 게이트웨이, 감사 로그)
- [ ] 플러그인 아이디어 → `docs/DESKTOP-PLAN-2026-04.md` 의 Architecture 패널 항목으로 흡수, 단독 제품화는 보류
- [ ] OMC `notepad` / `project_memory` 기능을 hanimo-code-desktop 에 어떤 UI로 노출할지 별도 설계 세션
- [ ] 다이어그램 단방향 갱신 PoC: 작은 Go 프로젝트에서 LLM 으로 mermaid 자동 생성 + 매 commit 후 갱신

---

## 부록 — 본 진단의 신뢰도/한계

- **신뢰도 (Part 1)**: 높음. 위 도구들은 2026-04 시점 모두 라이브 확인됨.
- **신뢰도 (Part 2)**: 중간. CodeSee 의 "사실상 지원 중단"은 공개 활동 둔화 기반 추정 — 공식 종료 발표 X. 의사결정 전 한 번 더 fact-check 권장.
- **편향**: 사용자가 "솔직 진단" 요청했고 메모리(`feedback_tooling_policy.md` 등)에 "flattery 금지" 시그널 있어 의도적으로 비관 톤 강화. 낙관 시나리오는 별도 문서 필요.
