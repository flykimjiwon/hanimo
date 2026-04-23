# hanimo 플랫폼 — 디자인 컨셉 브리프 (2026-04)

> 클로드 코드의 디자인 전용 스킬(`tui-designer`, `building-glamorous-tuis`, shadcn 계열)에 인풋으로 그대로 던질 수 있도록 작성한 brand & visual brief.

---

## 1. 한 줄 정의

**hanimo는 "Modol을 계승한, 오픈소스 AI 코딩 플랫폼"이다.**

터미널에서는 `hanimo code`라는 Bubble Tea v2 기반 TUI 에이전트로, 브라우저에서는 `hanimo web`이라는 Next.js 15 웹 에이전트로 동작하고, 그 둘이 같은 디자인 시스템·같은 모델 라우터·같은 MCP 백본을 공유한다. 그리고 그 세계 옆에 **AgentRank**라는 독립 운영 커뮤니티가 붙어서 모든 AI 코딩 도구와 모델을 관찰·측정·기록한다.

## 2. 한 줄 슬로건 후보

1. *"The open-source AI coding platform. Successor to Modol."* ⭐ 추천
2. *"Code in your terminal, code in your browser. One platform."*
3. *"Local-first. Model-agnostic. Apache-2.0."*
4. *모돌의 계승자, hanimo. 터미널부터 브라우저까지.*

> 톤은 **"잘 만든 개발 도구의 자신감"**. Vercel/Linear의 절제된 카피 + Charm.sh의 장난기 + Anthropic의 정직함을 섞은 정도.

---

## 3. 브랜드의 본질 — 4가지 진실

### 3.1 Dual-surface (이중 표면)
- 같은 팀이 **터미널과 브라우저 두 곳에서 동시에** 코딩 에이전트를 만든다. 이걸 하는 회사는 현재 없음 (Cursor=IDE만, Claude Code=CLI만, Lovable=웹만).
- **시각화 방향**: "두 개의 표면이 하나의 코어를 공유"하는 다이어그램이 모든 페이지의 백본이어야 함. 좌우 대칭, 중앙에 코어, 같은 색·다른 텍스처.

### 3.2 Hash-anchored edits (해시 앵커 편집)
- hanimo의 고유 기능: 파일을 수정하려는 순간 컨텐츠 해시를 검증해서, **"내가 본 그 파일"이 아니면 거부**한다. "에이전트가 내 변경을 덮어썼다" 사고가 구조적으로 불가능.
- **시각화 방향**: 손글씨 같은 SHA256 짧은 해시 (`a3f9...`) 모티프, 자물쇠/지문 아이콘. 신뢰의 증표.

### 3.3 Model-agnostic (모델 비종속)
- LiteLLM 라우터 + Ollama + vLLM. 75개 이상 provider. **Claude / GPT / Gemini / Llama / Mistral / Qwen 다 동작.** 오프라인도 가능.
- **시각화 방향**: 여러 모델 로고가 hanimo 코어로 들어왔다 나가는 라우팅 그림. "스위치/플러그/허브" 메타포. 특정 모델 회사 색을 절대 넣지 않음 (중립성).

### 3.4 Modol 계승 (Modol lineage)
- 학생 프로젝트가 아니다. **2년 전 Modol에서 시작해서, hanimo-webui 디자인 시스템과 hanimo-rag 파이프라인을 그대로 물려받았다.** 진화 서사가 있는 도구.
- **시각화 방향**: "Modol → hanimo" 로 흐르는 타임라인. 옛 로고와 새 로고를 나란히. /about 페이지의 핵심 비주얼.

---

## 4. 5개 표면 (Surfaces) — 각각의 인격

| # | 이름 | 한 마디 | 인터페이스 | 분위기 | 시그니처 색 |
|---|---|---|---|---|---|
| ① | **hanimo code** | "터미널에서 사는 에이전트" | Go TUI (Bubble Tea v2) | Charm.sh 계열 + 사이버펑크 절제판. 픽셀 그리드, 모노 폰트, 미니멀 색. | **Violet** (`#8b5cf6` 계열) |
| ② | **hanimo core** | "엔진룸" — 사용자에게는 거의 안 보임 | 헤드리스 LiteLLM 라우터 + MCP 허브 | 도식·도면 느낌. 회로도, 와이어프레임. | **Slate** (중립 회색) |
| ③ | **hanimo web** | "브라우저에서 코딩하는 에이전트" | Next.js 15 + shadcn (hanimo-webui 계승) | 깔끔한 SaaS — Linear/Vercel 톤. 화이트 스페이스 충분, 깊이감 있는 카드. | **Emerald** (`#10b981` 계열) |
| ④ | **hanimo rag** | "지식 파이프라인 엔진" | FastAPI + 대시보드 (hanimo-rag 계승) | 데이터 흐름 그림. 노드 그래프, 벡터 시각화. | **Amber** (`#f59e0b` 계열) |
| ⑤ | **AgentRank by hanimo** | "AI 코딩 세계의 측정실" | 독립 Next.js 16 사이트 | "데이터 저널리즘 × 개발자 잡지". 그리드 배경, CRT 글로우, mono accent, 표가 중요. | **Cyan** (`#22d3ee` 계열) — **이미 존재** |

> **핵심 결정**: 각 surface는 같은 디자인 시스템을 쓰되 **시그니처 색이 다르다.** Stripe가 "Stripe Atlas / Climate / Connect"를 색으로 구분하는 것과 같은 패턴. cyan은 AgentRank 전용 — 절대 다른 surface에 쓰지 않음.

---

## 5. 타겟 사용자 페르소나

### 5.1 한국 풀스택 개발자 (Primary)
- **이름**: "지원" (작명 아님, 페르소나임)
- **나이**: 27, Next.js 주력, AI 개발도 가능
- **고통**: Claude Code 비싸고 폐쇄적, Cursor는 자동 동기화가 무서움, opencode는 한국어 UX 부족, 회사 정책상 코드가 클라우드 못 나감
- **욕망**: 로컬에서 돌고, 모델 바꿀 수 있고, 한국어 UI 자연스럽고, 터미널과 브라우저 둘 다에서 똑같이 쓰고 싶음
- **랜딩에서 보고 싶은 것**: "오프라인 데모", "vs Claude Code 표", "Apache-2.0 배지"

### 5.2 OSS 메인테이너 / 인디 해커 (Secondary)
- **고통**: 매달 $40 SaaS 12개 구독에 지침. "왜 다 폐쇄형이지?"
- **욕망**: Star 박을 만한 가치 있는 OSS, MIT/Apache 라이선스, 자기 모델 붙일 수 있는 자유도
- **랜딩에서 보고 싶은 것**: GitHub Star 카운터, 컨트리뷰터 그리드, "Built by indie devs"

### 5.3 엔터프라이즈 플랫폼 엔지니어 (Tertiary, 후일)
- **고통**: 사내 LLM 게이트웨이에 어떤 코딩 에이전트를 표준으로 깔지 결정 못 함
- **욕망**: SOC2가 아니어도 좋으니 **소스가 있고 + Apache-2.0 patent grant**가 있고 + 셀프호스팅 가능한 옵션
- **랜딩에서 보고 싶은 것**: 아키텍처 다이어그램, 셀프호스트 가이드 링크, 보안 정책 페이지

---

## 6. Voice & Tone

### Do
- **정직하게 비교한다.** "vs Claude Code"를 부끄러워하지 않는다. 매트릭스가 가장 강한 자산.
- **숫자를 보여준다.** SWE-bench 점수, Terminal-Bench 점수, GitHub Star, 컨트리뷰터 수.
- **모돌 시절을 자랑스럽게 인용한다.** "We rebuilt this from scratch after 2 years of Modol"
- **개발자처럼 말한다.** `pnpm install`, `~/.config/hanimo/config.toml`, `MCP stdio` 같은 단어가 자연스럽게 본문에 들어감.

### Don't
- "혁신적인" / "차세대" / "AGI" / "당신의 코드를 다시 쓰는 방식" 같은 구호 금지.
- 모델 회사 이름을 마케팅 카피에 넣지 않음 ("Powered by Claude" 같은 말 금지 — 모델 비종속이 핵심).
- "Better than X" 단언 금지. 매트릭스로 보여주기.
- 이모지 남발 금지. 헤더에 1개, 본문 0개가 기본.

### Korean voice (한국어 카피일 때)
- 반말도 존댓말도 아닌 **"개발 문서체"**. "한다 / 된다 / 가능하다" 형식.
- 외래어는 살린다. "터미널 에이전트", "MCP 도구", "벤치마크" 그대로.
- **번역체 아님.** "당신의" 금지, "여러분" 금지, 주어를 생략하면 자연스러움.

---

## 7. 시각 디렉션

### 7.1 색 시스템

```
공용 (전 surface 공통)
─────────────────────
bg-base       #0a0a0b   거의 검정, 약간 푸른빛 (순검정 금지)
bg-raised     #111114   카드 배경
bg-hover      #18181c
border-dim    #27272a
border        #3f3f46
text-primary  #fafafa
text-secondary #a1a1aa
text-tertiary  #71717a

surface 시그니처
─────────────────────
hanimo code         violet  #8b5cf6   글로우: rgba(139,92,246,0.15)
hanimo web          emerald #10b981   글로우: rgba(16,185,129,0.15)
hanimo core         slate   #64748b   글로우: rgba(100,116,139,0.15)
hanimo rag          amber   #f59e0b   글로우: rgba(245,158,11,0.15)
AgentRank by hanimo cyan    #22d3ee   글로우: rgba(34,211,238,0.15) ← 이미 존재
```

**규칙**: 한 페이지에 시그니처 색은 1개만. 여러 surface가 같이 등장하는 비교 페이지에서만 동시 사용 허용. 그라데이션은 같은 surface 색의 명도 변화로만.

### 7.2 타이포

| 용도 | 폰트 | 비고 |
|---|---|---|
| 본문 | `Inter` (Latin) + `Pretendard` (Korean) | -0.011em letter-spacing |
| 모노 | `JetBrains Mono` 또는 `Geist Mono` | 코드/숫자/배지 |
| 디스플레이 | `Inter` 700/800 또는 `Geist` | 헤드라인용, italic 금지 |

- **모노 강조**: 숫자, 벤치마크 점수, 터미널 명령, 버전 태그는 **무조건 모노**. 이게 hanimo의 시각적 시그니처.
- **국문/영문 혼용**: Pretendard ↔ Inter는 폴백 체인으로 자연스럽게 연결.

### 7.3 모티프

가장 자주 등장해야 하는 시각 모티프 5개:

1. **그리드 배경** (`grid-bg`) — 격자 1px, 24px spacing, 5% opacity. AgentRank가 이미 사용 중. 모든 hero 섹션 백그라운드의 기본.
2. **글로우 라인** (`glow-line`) — 1px 수평선, 좌우 페이드, 시그니처 색. 섹션 구분자.
3. **모노 배지** — `[ MCP ENABLED ]`, `[ APACHE-2.0 ]`, `[ PHASE 1 BETA ]` 같은 대괄호 + 모노 + uppercase. 사이버펑크 영향.
4. **해시 앵커** — `a3f9...e2c1` 짧은 해시. hash-anchored edit 기능의 시각 대표. 푸터·about 페이지의 장식.
5. **2열 대칭** — 좌우에 같은 크기 카드 2개로 hanimo code/web을 항상 함께 보여주기. dual-surface 메시지 강화.

### 7.4 절대 하지 말 것

- **그라데이션 보라→핑크 SaaS 클리셰** (Stripe/Notion 따라하기) 금지
- **3D 일러스트** 금지 (Vercel이 한참 했다가 버린 그것)
- **흰 배경 라이트 모드 강제** 금지 (다크 우선, 라이트는 옵션)
- **AI 생성 사진 (사람 얼굴)** 금지 (불쾌한 골짜기)
- **"코딩하는 두 손" 스톡 사진** 절대 금지
- **glassmorphism** 금지 (지났음)

### 7.5 레퍼런스 (mood board)

| 사이트 | 무엇을 차용 |
|---|---|
| **charm.sh** | TUI 미학, 모노 폰트 사용법, ASCII 배지 |
| **linear.app** | 절제된 카피, 다크모드 디테일, 그라데이션 글로우 사용법 |
| **vercel.com (2024 버전, 2026 아님)** | 카드 그림자, hover 트랜지션, /docs 구조 |
| **astro.build** | 컬러풀한 surface 분리, 친근한 OSS 톤 |
| **cursor.com** (반면교사) | "마케팅스러움" 피하기 |
| **planetscale.com** | 진지한 dev tool 톤, 표 디자인 |
| **opencode 레포 README** | OSS 정직함, 비교 표 배치 |
| **ghostty.org** | 터미널 제품의 마케팅 방식, 다크모드 우선 |
| **AgentRank의 현재 디자인** | 그리드 배경, 글로우 라인, mono 배지, 카드 패턴 — **그대로 계승** |

---

## 8. 사이트 구조 (`hanimo.dev`)

```
/                 메인 랜딩 — 히어로·dual-surface 카드·top vs 매트릭스·CTA
/code             hanimo code 제품 페이지 (보라 톤)
/web              hanimo web 제품 페이지 (에메랄드 톤)
/compare          전체 비교 매트릭스 (Claude Code · Cursor · opencode · Aider · Lovable)
/compare/[slug]   개별 비교 페이지
/docs             Fumadocs MDX 문서
/blog             릴리스 노트, 벤치마크 포스트, Modol 시절 회고
/community        AgentRank 소개 + 외부 링크
/about            팀 · Modol 계승 서사 · 미션
/brand            로고 키트, 색 토큰, Figma 파일
```

`agentrank.hanimo.dev` 는 별도 사이트 (cyan 톤, AgentRank 자체 디자인 보존).

### 8.1 페이지별 분위기 한 줄

| 페이지 | 한 줄 |
|---|---|
| `/` | "조용한 자신감." 첫 화면에서 dual-surface와 Modol 계승 둘 다 인지되어야 함 |
| `/code` | "터미널 안의 영화관." 큰 TUI 스크린샷 + 키바인딩 다이어그램이 주인공 |
| `/web` | "Linear가 코딩하는 모습." 깔끔한 채팅 UI + 코드 diff 패널 스크린샷 |
| `/compare` | "스프레드시트의 미학." 12행 × 6열 표가 페이지의 90%. 카피는 최소 |
| `/about` | "회고록." Modol 시절 옛 로고, 옛 스크린샷, 왜 다시 만들었는지의 narrative |
| `/blog` | "긴 글 OK." 본문 65ch 폭, 인라인 코드 블록 강조 |

---

## 9. 핵심 시각 — 메인 히어로 컴포지션 가이드

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│         [ APACHE-2.0 · PHASE 1 BETA ]                      │
│                                                            │
│         The open-source AI coding platform.                │
│         Successor to Modol.                                │
│                                                            │
│         [▶ Watch demo]   [pnpm i @hanimo/code]             │
│                                                            │
│    ┌────────────────┐         ┌────────────────┐           │
│    │  hanimo code   │  ◀─▶   │  hanimo web    │           │
│    │  [violet glow] │  core   │  [emerald glow]│           │
│    │  > prompt...   │         │  ▌ chat ui     │           │
│    └────────────────┘         └────────────────┘           │
│                                                            │
│         Modol 2024 ─────► hanimo 2026                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
                  [ 그리드 배경 · 글로우 라인 ]
```

**규칙**:
- 좌우 카드는 **정확히 같은 크기**, 같은 padding. dual-surface 메시지 = 시각 대칭.
- 가운데 ◀─▶ 화살표는 `hanimo core`를 상징. 호버 시 해당 라우터 다이어그램이 modal로 뜰 수 있음.
- "Modol 2024 → hanimo 2026" 마이크로 타임라인은 hero 하단에 작게. 자랑하지 말고 흘리듯이.

---

## 10. 첫 컨셉 시안에서 받고 싶은 결과물

클로드 코드 디자인 스킬에 이 브리프를 넣었을 때 1차로 나왔으면 하는 산출물 6종:

1. **`hanimo.dev` 홈** 단일 HTML 시안 (다크 기본, 라이트 토글)
2. **`/code` 제품 페이지** 단일 HTML 시안 (보라 톤, TUI 스크린샷 placeholder 포함)
3. **`/web` 제품 페이지** 단일 HTML 시안 (에메랄드 톤, 채팅 UI 목업 포함)
4. **`/compare` 매트릭스 페이지** 단일 HTML 시안 (12×6 표가 주인공)
5. **hanimo code TUI 자체** 리디자인 mockup (Lip Gloss + Bubbles, ANSI 컬러 시안 또는 SVG 캡처)
6. **로고 시안 3안** — wordmark 위주, 모노 폰트 베이스, 가능하면 hash-anchor 모티프 포함

---

## 11. 기술 제약 (디자인이 알아야 할 것)

- 사이트는 **Next.js 15 App Router + Tailwind v4 + Fumadocs MDX**로 만들 예정. 디자인은 RSC 환경에서 동작 가능해야 함.
- 색 변수는 **CSS Custom Properties**(`--accent-*`)로 정의. Tailwind v4의 `@theme` 디렉티브 사용 권장.
- 컴포넌트 베이스는 **shadcn/ui** (hanimo-webui 계승). 새 컴포넌트도 shadcn 패턴 따를 것.
- 다크 우선, `prefers-color-scheme` 지원 + 수동 토글 + `localStorage` 저장 (이미 hanimo/docs/html/* 에 적용된 패턴 그대로).
- TUI는 **Charmbracelet Lip Gloss + Bubbles v2**. ANSI 256 + truecolor 두 모드 지원해야 함.
- 폰트는 자체 호스팅 (Google Fonts CDN 의존 금지) — 개인정보 정책상.

---

## 12. 5초 안에 답해야 할 질문 (랜딩의 기능 테스트)

방문자가 5초 안에 다음 5개 질문에 답할 수 있어야 함. 디자인이 이걸 만족하지 못하면 실패:

1. **이게 뭐야?** → "오픈소스 AI 코딩 플랫폼"
2. **무료야?** → "Apache-2.0" 배지
3. **어디서 돌아?** → 좌우 카드의 "Terminal | Browser"
4. **누가 만들었어?** → "Modol 계승" 한 줄
5. **어떻게 시작해?** → 큰 install 명령어 1개

---

## 13. 디자인 시안 거절 사유 (Quality Bar)

다음 중 하나라도 해당하면 시안 reject:

- 어떤 모델 회사 로고/색이 hero에 등장
- "AI" 단어가 헤드라인에 3회 이상
- dual-surface 시각화가 없거나 좌우 비대칭
- 라이트 모드만 디자인되어 있음
- 표 디자인이 없음 (compare 페이지 핵심)
- Pretendard 또는 Inter가 아닌 폰트 사용
- 그라데이션 보라→핑크 또는 그라데이션 청록→파랑 사용
- 스톡 사진 사용

---

*Document owner: kimjiwon · Last updated: 2026-04-11 · Use as: design brief input for Claude Code design skills*
