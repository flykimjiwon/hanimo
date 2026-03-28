# modol 스킬 & 지식 시스템 가이드

> 저사양 모델에 지식을 주입하여 고사양 모델 수준의 성능을 달성하는 방법

## 1. 저작권 — 합법적으로 지식을 넣는 방법

### 사용 가능 (합법)

| 소스 | 라이선스 | 주의사항 |
|------|---------|---------|
| 공식 문서 (MDN, React docs 등) | CC / MIT | 요약/재구성 OK, 원문 복사 지양 |
| GitHub README/코드 (MIT/Apache) | MIT/Apache | 라이선스 표기 필요 |
| Stack Overflow 답변 | CC BY-SA 4.0 | 출처 표기 필요 |
| API 문서 (OpenAI, Anthropic 등) | 공개 문서 | 기술 사실(fact)은 저작권 불가 |
| 공식 튜토리얼 | 대부분 허용 | 출처 기록 권장 |

### 사용 불가 (위험)

| 소스 | 이유 |
|------|------|
| 유료 교육 콘텐츠 (Udemy, 인프런 등) | 저작권 보호 |
| 유료 서적 전문 복사 | 저작권 보호 |
| 비공개 API 문서 | NDA/ToS 위반 가능 |

### 안전한 방법

1. 공식 문서를 **요약/재구성**해서 넣기 (원문 통째 복사 X)
2. 라이선스가 명확한 것만 사용
3. 출처를 스킬 파일에 기록
4. 기술적 사실(API 시그니처, 설정 방법 등)은 저작권 대상 아님

---

## 2. 성능 효과 — 왜 도움이 되나

### 저사양 모델의 문제

```
qwen3:8b가 아는 것:        Claude Opus가 아는 것:
├── Python 기본 문법        ├── Python 기본 문법
├── 일반적인 패턴           ├── 일반적인 패턴
└── (여기서 끝)             ├── Next.js 15 App Router 세부 설정
                            ├── Drizzle ORM 마이그레이션 패턴
                            ├── Tailwind v4 breaking changes
                            └── ... (훨씬 많음)
```

### 문서 주입 후

```
qwen3:8b + .modol.md + skills:
├── Python 기본 문법
├── 일반적인 패턴
├── Next.js 15 App Router 세부 설정  ← skills에서
├── Drizzle ORM 마이그레이션 패턴     ← skills에서
├── Tailwind v4 변경사항              ← skills에서
└── 프로젝트 특화 규칙               ← .modol.md에서
```

### 측정된 효과 (연구 기반)

| 방법 | 정확도 향상 |
|------|------------|
| RAG (문서 검색 → 주입) | +20~40% (소형 모델에서 특히 효과적) |
| Few-shot 예제 | +10~30% |
| System prompt에 규칙 | 일관성 +50% |
| 도구 description 개선 | 도구 선택 정확도 +15~25% |

---

## 3. modol에 적용하는 방법

### 계층 1: 프로젝트 지식 — `.modol.md`

프로젝트 루트에 `.modol.md` 파일을 만들면 자동으로 시스템 프롬프트에 주입됩니다.

```markdown
# 프로젝트: My App

## 기술 스택
- Next.js 15 App Router
- TypeScript strict mode
- PostgreSQL + Drizzle ORM
- Tailwind CSS v4

## 규칙
- 컴포넌트는 서버 컴포넌트가 기본값
- 'use client'는 필요한 곳에만
- 테스트: Vitest, 파일명 *.test.ts
- 커밋: conventional commits 형식
```

모노레포의 경우 각 패키지에 `.modol.md`를 넣으면 상위까지 모두 수집됩니다.

### 계층 2: 프레임워크 스킬 — `~/.modol/skills/` (계획 중)

재사용 가능한 프레임워크/라이브러리 지식 파일:

```
~/.modol/skills/
├── nextjs15.md          # Next.js 15 변경사항, App Router 패턴
├── drizzle-orm.md       # Drizzle 마이그레이션, 쿼리 패턴
├── tailwind-v4.md       # v3→v4 마이그레이션, @theme 사용법
├── typescript-strict.md # strict 모드 패턴, 타입 가드
└── react19.md           # React 19 새 기능, use() 훅
```

스킬 파일 예시:

```markdown
# Next.js 15 App Router

출처: https://nextjs.org/docs (공식 문서 요약)

## Server Components (기본값)
- 'use client' 없으면 서버 컴포넌트
- 서버 컴포넌트에서 직접 DB 조회 가능
- async 컴포넌트 지원

## Metadata
- generateMetadata() export로 SEO
- opengraph-image.tsx로 OG 이미지 자동 생성

## Route Handlers
- app/api/route.ts에서 GET/POST export
- NextResponse.json() 사용

## 주의사항
- useState/useEffect는 'use client'에서만
- fetch()의 캐시 동작이 v14와 다름 (기본값: no-store)
```

### 계층 3: 실시간 조회 — `webfetch`

모르는 내용은 실시간으로 웹에서 가져옴:

```
사용자: Drizzle ORM의 마이그레이션 방법 알려줘
modol: → webfetch https://orm.drizzle.team/docs/migrations
       → 최신 정보로 답변
```

---

## 4. 권장 구성

```
~/.modol/
├── config.json          # 프로바이더/엔드포인트 설정
├── skills/              # 프레임워크/라이브러리 지식 (전역)
│   ├── nextjs15.md
│   ├── drizzle-orm.md
│   ├── tailwind-v4.md
│   └── typescript-patterns.md
└── roles/               # 커스텀 역할
    └── senior-dev.json

프로젝트/
├── .modol.md            # 프로젝트 특화 규칙 (자동 로드)
└── src/
```

---

## 5. 핵심 원칙

> "측정할 수 있으면 개선할 수 있다" — Karpathy

> "문서로 넣을 수 있으면 모델이 알 수 있다" — modol 원칙

저사양 모델 + 좋은 문서 = 고사양 모델의 80% 성능을 10% 비용으로.

---

## 6. 다음 단계 (개발 예정)

- [ ] `~/.modol/skills/` 디렉토리 자동 로드
- [ ] `/skill add <url>` — 공식 문서 URL에서 스킬 파일 자동 생성
- [ ] `/skill list` — 로드된 스킬 목록
- [ ] 스킬 버전 관리 (최신 문서로 자동 업데이트)
- [ ] 커뮤니티 스킬 공유 (modol.app/skills)
