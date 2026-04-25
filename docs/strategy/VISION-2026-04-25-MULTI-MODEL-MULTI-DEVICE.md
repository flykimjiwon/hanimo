# hanimo Vision — All Models · All Devices · Fully Open

> 2026-04-25 · Phase 15a 시점에 사용자가 직접 천명한 비전을 단일 문서로 고정.
> 짝꿍: [`COMPETITOR-MATRIX-2026-04-25.md`](./COMPETITOR-MATRIX-2026-04-25.md)
> 상위 전략: [`REPUTATION-STRATEGY-2026-04-23.md`](./REPUTATION-STRATEGY-2026-04-23.md)

---

## 0. 한 문장

**모든 모델(Claude/GPT/Gemini/Kimi/GLM/DeepSeek/Llama/Qwen/Ollama …) + 모든
디바이스(macOS/Windows/Linux/iOS/Android) + 완전 무료 OSS + IDE 수준 코딩
에이전트 + 디바이스 간 sync** — 이 다섯 축을 **동시에 채우는 제품은 시장에 없다**.
hanimo가 그 자리를 채운다.

---

## 1. 시장 공백 (2026-04 기준 1차 조사)

| 제품 | 모든 모델 | OSS | 데스크톱(M/W/L) | 모바일(iOS+Android) | IDE 풀패널 | Sync |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Claude Desktop / Cowork | ❌ Anthropic only | ❌ closed | ✅ M/W | ❌ | ❌ chat | proprietary |
| Cursor | 일부 | ❌ closed | ✅ M/W/L | ❌ | ✅ | proprietary |
| OpenAI Codex (CLI) | ❌ OpenAI only | partial | terminal | ❌ | ❌ | ❌ |
| OpenCode | ✅ 75+ | ✅ MIT | ✅ M/W beta | ❌ (계획) | ✅ TUI/IDE | ❌ |
| OpenClaude | ✅ 200+ | ✅ | CLI | ❌ | ❌ | ❌ |
| AionUi | ✅ | ✅ | ✅ | WebUI 모바일 (PWA, QR 로그인) | ✅ | LAN |
| Chatbox | ✅ | ✅ partial | ✅ M/W/L | ✅ iOS+Android | ❌ chat | ✅ |
| LibreChat | ✅ | ✅ | 웹 only | 웹 PWA | ❌ chat | self-host |
| Jan | ✅ | ✅ | ✅ M/W/L | ❌ | ❌ | ❌ |
| Msty | ✅ | ✅ partial | ✅ M/W/L | ❌ | ❌ | offline |
| Cherry Studio | ✅ 300+ | ✅ | ✅ M/W/L | ❌ | ❌ | ❌ |
| Lobe Chat | ✅ | ✅ | 웹+PWA | PWA | ❌ | self-host |
| AnythingLLM | ✅ | ✅ | ✅+Docker | ❌ | ❌ RAG 중심 | ❌ |
| **hanimo-code (목표)** | **✅** | **✅ MIT** | **✅ M/W/L** | **✅ iOS+Android** | **✅ IDE 풀패널** | **✅ E2E** |

**관찰**:
- Chatbox 가 "데스크톱+모바일+멀티프로바이더+OSS" 4축은 채우지만 **IDE 풀패널 + 코딩 에이전트가 없음** (chat-only).
- OpenCode 가 "코딩 에이전트 + 75 providers + OSS" 3축은 채우지만 **모바일 + sync 없음**.
- AionUi 가 가장 비슷 (Multi-AI Agent Desktop + WebUI 모바일) — 단 PWA-방식(브라우저 wrapper). 네이티브 모바일/한국어 UX/한국 MCP 통합 없음.
- **모바일에서 IDE 풀패널 + 코딩 에이전트 + 멀티 프로바이더 + OSS** 조합은 **아무도 못 함** = hanimo 의 진짜 자리.

---

## 2. hanimo 차별점 (4축)

### 2.1 모바일에서도 IDE 풀패널
- FileTree + CodeMirror Editor + Terminal + Hash-anchor gutter — 모바일에서도 동일.
- 경쟁사 모바일은 전부 chat-only. 모바일 IDE 자체가 시장 공백.

### 2.2 한국어 UX 1순위 + 한국 MCP 50+ 생태계 기본 통합
- 참조: [`awesome-mcp-korea`](https://github.com/darjeeling/awesome-mcp-korea) — 한국 법률/공공데이터/금융/부동산/지도/관광/기상/한국어 NLP MCP 50+
- hanimo 가 한국 사용자 1차 진입점 = 한국 시장 명성 wedge
- 글로벌 OSS 코드 에이전트 중 한국어/한국 MCP를 1순위로 두는 도구 0개

### 2.3 TECHAI 페어 — 폐쇄망 운영 가능
- 모든 cloud endpoints disable 시 Ollama 로컬만으로 완전 동작
- 신한 사내 등 폐쇄망에서도 IDE 그대로 사용 — TECHAI 도 같은 코드베이스 위에서 사내 모델 라우팅만 추가
- Cloud-first OSS 경쟁사 (Lobe/AnythingLLM 등) 가 못 따라옴

### 2.4 Brand promise — Hash anchor silent overwrite 방지
- 라인별 MD5 anchor → mismatch 시 abort
- AI 의 부주의한 덮어쓰기로부터 사용자 의도 보호 — hanimo만의 제약 (다른 어떤 도구도 채택 안 함)

---

## 3. Surface 로드맵

| Surface | 상태 | 다음 단계 |
|---|---|---|
| **CLI** (Bubble Tea TUI) | Phase 11 까지 출시 · 14+ providers | 안정 운영 |
| **Desktop macOS** | Phase 15a 진행 중 · Wails 빌드 OK | Phase 15-17 멀티프로바이더 마무리 |
| **Desktop Windows** | Wails build -platform windows/amd64 한 줄 | Phase 18 — 빌드 + 코드사인 + 인스톨러 |
| **Desktop Linux** | Wails build -platform linux/amd64 한 줄 | Phase 18 — .deb · .AppImage 패키징 |
| **Mobile iOS** | 미구현 | Phase 21+ — Tauri Mobile / Capacitor / Lynx 후보 평가 |
| **Mobile Android** | 미구현 | Phase 21+ — 위와 동일 |
| **Sync (E2E)** | 미구현 | Phase 26+ — 사용자 device 키로 암호화, optional self-hosted relay |

### 3.1 모바일 기술 후보
1. **Tauri Mobile** (alpha) — Rust 기반, 데스크톱과 같은 코어 재사용 가능. 하지만 Wails 와 다른 stack.
2. **Capacitor** + 기존 React 프론트 — 데스크톱 frontend 그대로 모바일에 wrap. 가장 빠른 path. PWA 한계 일부 상속.
3. **Lynx** (TikTok 오픈소스) — high-perf cross-platform. 학습 곡선 ↑.
4. **Native (SwiftUI + Compose)** — 가장 좋은 UX, 가장 큰 비용.
5. **Flutter** — 단일 코드베이스, frontend 재작성 필요.

**1차 권장: Capacitor** — `frontend/dist` 그대로 wrap, native API (filesystem/notifications/push) 만 native. Wails 데스크톱과 동일 UI 코드 100% 공유.

---

## 4. Phase 매핑 (현재 → 비전)

| Phase | 단위 | 비전 기여 |
|:-:|---|---|
| 0~11 | hanimo-code-desktop 골격 | Desktop macOS 기반 |
| 12 | MCP 클라이언트 | 멀티-도구 통합 |
| 13 | Live metrics | 운영 가시성 |
| 14a | Run / Permissions UI 골격 | IDE 풀패널 강화 |
| 14b | Mode 위치 / Model sync / 아이콘 | UX 폴리시 |
| **15a** | **멀티 프로바이더 자동 라우팅** | **"모든 모델" 1단계** |
| 15b (다음) | SettingsPanel 키 입력 + Anthropic/Google transport | "모든 모델" 완성 |
| 16 | LSP 통합 | IDE 깊이 |
| 17 | Subagents 라이브 | 코딩 에이전트 깊이 |
| 18 | Multi-OS 빌드 + 코드사인 + 배포 | "모든 데스크톱" 채움 |
| 19 | 한국 MCP 50+ 기본 통합 | 한국 wedge |
| 20 | TECHAI 폐쇄망 모드 검증 | 외부망/폐쇄망 페어 |
| 21~24 | Capacitor wrap → iOS / Android 빌드 | "모든 디바이스" 1단계 |
| 25 | 모바일-전용 UX (제스처 · 음성 · 작은 화면) | 모바일 최적화 |
| 26~28 | Sync 프로토콜 (E2E 암호화 · self-host relay) | "디바이스 간 연동" |
| 29+ | Plugin marketplace · 커뮤니티 | 생태계 |

---

## 5. 한국어 / 한국 MCP wedge — 즉시 적용 가능

awesome-mcp-korea 의 50+ MCP 서버를 hanimo 의 `~/.hanimo/config.yaml`
프리셋으로 묶어 "한국 MCP 팩" 한 줄 활성화 제공:

```yaml
mcp:
  preset: korean   # 50+ 한국 MCP 자동 등록
  # 또는 카테고리별
  presets: [korean-legal, korean-finance, korean-maps]
```

영어권 OSS 코드 에이전트 중 누구도 안 하는 작업. 한국어 UX (이미 한국어 1순위)
+ 한국 MCP 기본 통합 = **한국 시장 명성 wedge** (사용자 정책 §3.6 일치).

Phase 19 단위로 분리.

---

## 6. 컨셉 정합성 (모든 Phase 게이트)

비전 확장 후에도 기존 7축 그대로 유지:

| 축 | 검증 |
|---|---|
| 무료 OSS | 비전 자체가 "fully open" — 모든 surface 무료 |
| Code+IDE 집중 | "All-models · All-devices" 는 IDE 깊이를 모바일까지 확장하는 것이지 다른 surface로 분산하는 게 아님 |
| Honey 팔레트 | 데스크톱과 모바일에서 동일 (CSS 변수 그대로 재사용) |
| 한국어 | 모바일까지 한국어 UX 1순위 |
| TECHAI 폐쇄망 | 모바일에서도 cloud disable + 사내 endpoint 만 접근 가능 |
| Brand promise | hash anchor 모바일에도 |
| Wedge 강화 | 모바일+한국 MCP 두 wedge 모두 강화 |

---

## 7. 즉시 행동 (이 비전 천명 후)

1. **Phase 15b** — Anthropic/Google transport switch + SettingsPanel API 키 입력 UI (multi-model 완성)
2. **Phase 18** — 데스크톱 Windows / Linux 빌드 검증 (Wails 한 줄)
3. **한국 MCP 팩 프리셋** Phase 19 로 분리 — awesome-mcp-korea 의 카테고리(법률/공공데이터/금융/부동산/지도/관광/기상/한국어 NLP) 매핑

세 갈래 모두 1주 이내 마일스톤. 모바일은 데스크톱이 안정된 후 별도 사이클.

---

## 8. Simplicity 6축 (2026-04-25 보강)

> "앞으로는 AI agent 시대라 고급 커스텀 기능은 필요 없고 단순 지금같은
> 심플한게 오히려 먹힐거라 생각함. 브라우저 내장도 그중 하나. 점점 이걸
> 사용하도록, 각자가 결제한 API를 여기서 쓰도록 활성화시키자!"
> — 사용자 (Phase 19 진행 중)

비전 5축에 **6축: simplicity-first** 추가. 모든 신규 Phase 시작 전 검증.

### 6.1 simplicity 게이트 (신규 기능 추가 전)

| 추가 OK | 추가 보류 |
|---|---|
| 사용자가 매일 쓰는 흐름에 직접 도움 | 한 달에 한 번 쓸까 말까 |
| 기존 패턴 복제 (Skills/MCP/Run/Korea MCP) | 새 customization 모드 |
| BYOK 강화 (새 프로바이더 / 키 관리) | hanimo 자체 LLM 호스팅 |
| 외부 링크 / 카탈로그 / 안내 | 자동 설치 + 상태 추적 |
| 브라우저 내장 활용 | 별도 native 윈도우 |
| 한국어 UX 강화 | 다국어 i18n 시스템 풀구현 |

### 6.2 BYOK 패턴 — 사용자가 결제한 API 그대로 사용

- hanimo 자체 수익 모델 0 (정책 §1 일치)
- OpenAI / Anthropic / Novita / OpenRouter / DeepSeek / Mistral / Groq /
  Together — 모두 사용자가 직접 계약, hanimo 는 라우팅만
- "한 도구로 모든 모델" → 키 관리 부담 ↓ → 매일 사용 ↑

### 6.3 브라우저 내장 활용

- 외부 링크는 항상 새 탭 (target="_blank")
- WebPreview / iframe / SSE 가 이미 브라우저 내장의 일부 — 추가 native 윈도우 X
- 향후 모바일 (Capacitor) 도 같은 WebView 재사용 — 한 frontend 코드베이스

### 6.4 Phase 19 의 simplicity 적용

awesome-mcp-korea 35+ MCP 자동 설치 ❌. 카탈로그 + 외부 GitHub 링크만 ✅.
사용자가 직접 README 따라 yaml 편집 — hanimo 는 발견/안내만 담당.

---

## 9. 한 줄로 다시

> **"hanimo 생태계는 이제 시작일 뿐이다."** — 사용자 (2026-04-25)
> All models. All devices. Fully open. Korean-first. Closed-net capable. **Simple.**
> 시장에 없는 자리, 우리가 채운다.
