# hanimo Open-Source Launch Plan — 2026-04

> **Scope:** hanimo **Code** (Go TUI agent) + hanimo **Web** (Next.js web agent).
> **Domain:** `hanimo.dev` (primary)
> **Goal:** Open-source both on GitHub, ship a marketing/landing site on `hanimo.dev` that positions hanimo against closed SaaS (Claude Code / Cursor / Lovable / v0) **and** the open-source pack (opencode / Aider / Bolt.new / Continue).

---

## 0. TL;DR

1. **Domain = `hanimo.dev`.** Park `modol.app` / `modol.dev` as 301-redirects + keep the "Modol lineage" narrative in /about.
2. **Two GitHub repos**, not a monorepo: `hanimo-dev/hanimo-code` and `hanimo-dev/hanimo-web`. A third repo `hanimo-dev/hanimo.dev` hosts the marketing site.
3. **Single landing site** at `hanimo.dev` with two product tabs (`/code`, `/web`) — not subdomains. Keeps SEO consolidated and lets a shared "vs. the world" comparison table live at `/compare`.
4. **License = Apache-2.0** for both products (patent grant matters for enterprise adoption; MIT-style permissiveness retained).
5. **Launch story is comparison-first**, not feature-first. Every page answers: *"Why not Claude Code? Why not opencode? Why not Cursor?"*
6. **Soft launch:** Week 9 MVP (private repo, invited testers). **Public launch:** Week 14 β (Show HN, r/LocalLLaMA, Korean dev communities). **GA:** Week 18.

---

## 1. Domain Decision — Why `hanimo.dev`

| Candidate | Score | Reason |
|---|---|---|
| **hanimo.dev** ⭐ | 10/10 | Matches product name 1:1. `.dev` is HTTPS-enforced and universally recognized as a developer TLD. Short, memorable, no Modol-era baggage. |
| modol.app | 4/10 | Ties brand to legacy name. `.app` is consumer-leaning. |
| modol.dev | 5/10 | Same lineage confusion; better than `.app` but still a step backward. |

**Recommendation**

- **Buy all three.** Domains are cheap; owning the set prevents squatting and lets the Modol story redirect cleanly.
- **Primary = `hanimo.dev`.** All canonical URLs, GitHub org homepage, docs, blog, OG tags.
- **`modol.dev` / `modol.app` → 301 → `hanimo.dev/about#lineage`.** Free backlinks + smooth handoff for anyone who remembers the Modol era.
- Reserve `@hanimo` on GitHub, X/Twitter, Hugging Face, Discord vanity, npm, pkg.go.dev handle.

---

## 2. GitHub Layout

### 2.1 Repo structure (two product repos + one site repo)

```
github.com/hanimo-dev/
├── hanimo-code         # Go TUI agent (Bubble Tea v2)
├── hanimo-web          # Next.js 15 web agent
├── hanimo.dev          # Marketing site (Next.js 15 + MDX + Fumadocs)
├── .github             # Shared org profile README, funding.yml, issue templates
└── docs                # Cross-product design docs (optional, later)
```

**Why two repos, not a monorepo?**

- Different toolchains (Go vs pnpm) — CI stays simple.
- Different release cadences — Code ships binaries, Web ships a hosted instance + Docker image.
- Separate ★ counts = two proof points on the landing page.
- Easier to transfer/sell/sunset one product independently.

### 2.2 Naming conventions

- Binary: `hanimo` (not `hanimo-code`) — shorter to type, matches Claude Code's `claude` precedent.
- Web package: `@hanimo/web` on npm, Docker image `ghcr.io/hanimo-dev/web:latest`.
- Default branch: `main`. Release tags: `v0.x.y` (SemVer). Release Please for automated changelogs.

### 2.3 Must-have files in each repo

```
README.md                 # "vs. opencode / Claude Code" table at the top
LICENSE                   # Apache-2.0
CONTRIBUTING.md
CODE_OF_CONDUCT.md        # Contributor Covenant 2.1
SECURITY.md               # PGP key + security@hanimo.dev
CHANGELOG.md              # Release Please
.github/workflows/ci.yml
.github/workflows/release.yml
.github/ISSUE_TEMPLATE/
.github/FUNDING.yml       # GitHub Sponsors + Open Collective
docs/                     # mdBook (Code) / Fumadocs (Web)
```

---

## 3. License — Apache-2.0 (not MIT)

| Axis | MIT | Apache-2.0 ✅ |
|---|---|---|
| Permissive | ✅ | ✅ |
| Patent grant | ❌ | ✅ (crucial for enterprise legal review) |
| NOTICE file | ❌ | ✅ (attribution sanity) |
| Compatible with Claude Code / opencode dependencies | ✅ | ✅ |

Apache-2.0 is what opencode, Dify, RAGFlow, LlamaIndex, and most serious infra projects ship with. It reads as more mature than MIT to enterprise buyers.

---

## 4. Landing Site — `hanimo.dev`

### 4.1 Information architecture

```
hanimo.dev
├── /                        Hero · 60-sec demo · social proof · dual CTA
├── /code                    hanimo Code product page (TUI)
├── /web                     hanimo Web product page (Next.js)
├── /compare                 Full "vs." matrix (Code, Web, Core, RAG, Community)
│   ├── /compare/claude-code
│   ├── /compare/cursor
│   ├── /compare/opencode
│   └── /compare/lovable
├── /docs                    Product docs (Fumadocs, MDX, versioned)
├── /blog                    Releases, benchmark posts, Modol → hanimo story
├── /community               Forum, Discord, benchmark arena preview
├── /about                   Team · Modol lineage · mission
└── /brand                   Logo kit, colors, Figma file
```

**Single-domain strategy** beats `code.hanimo.dev` / `web.hanimo.dev` because:

- Google consolidates E-E-A-T signals on one host.
- One `pnpm dev`, one deploy, one analytics account.
- `/compare` can cross-link both products without awkward cross-origin flows.

### 4.2 Homepage wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  hanimo           /code  /web  /compare  /docs  /blog  GH★  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     The Open-Source AI Coding Platform                      │
│     Successor to Modol. Local-first. Model-agnostic.        │
│                                                             │
│     [▶ Watch 60s demo]  [Install hanimo code]               │
│                                                             │
│     ★ 0 on GitHub (soon)   ·  Apache-2.0   ·   Made in Korea │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  TWO PRODUCTS, ONE PLATFORM                                 │
│  ┌───────────────────┐  ┌───────────────────┐               │
│  │  hanimo code      │  │  hanimo web       │               │
│  │  Go · Bubble Tea  │  │  Next.js 15       │               │
│  │  TUI agent for    │  │  Browser agent    │               │
│  │  your terminal    │  │  with repo sync   │               │
│  │  [Learn more →]   │  │  [Learn more →]   │               │
│  └───────────────────┘  └───────────────────┘               │
├─────────────────────────────────────────────────────────────┤
│  WHY NOT CLAUDE CODE / CURSOR / OPENCODE?                   │
│  [Full comparison table — 12 rows × 6 columns]              │
├─────────────────────────────────────────────────────────────┤
│  BENCHMARKS                                                 │
│  SWE-bench Verified · Terminal-Bench 2.0 · Our own evals    │
├─────────────────────────────────────────────────────────────┤
│  HOW IT WORKS   · Hash-anchored edits · Repo-map · MCP      │
│  MODOL LINEAGE  · Why we rebuilt from Modol                 │
│  TESTIMONIALS   · Early-user quotes                         │
├─────────────────────────────────────────────────────────────┤
│  Footer · GitHub · Discord · X · RSS · security@hanimo.dev  │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 The "vs." matrix (content leverages `COMPETITIVE-LANDSCAPE-2026-04.md`)

A single 12-row × 6-column table is the single most important asset on the site.

| Feature | hanimo code | Claude Code | Codex CLI | opencode | Aider | Cursor |
|---|---|---|---|---|---|---|
| License | **Apache-2.0** | Proprietary | Apache-2.0 | MIT | Apache-2.0 | Proprietary |
| Runs offline | ✅ (Ollama, vLLM) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Model-agnostic | ✅ (75+ via LiteLLM) | ❌ (Claude only) | ❌ (OpenAI only) | ✅ | ✅ | Partial |
| **Hash-anchored edits** | ✅ (unique) | ❌ | ❌ | ❌ | Partial | ❌ |
| Repo-map (tree-sitter + PageRank) | ✅ | ✅ | ✅ | ✅ | ✅ (origin) | ✅ |
| MCP stdio + SSE | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| TUI first-class | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Web agent (same org) | ✅ (hanimo web) | ❌ | ❌ | ❌ | ❌ | IDE only |
| Korean native UX | ✅ | Partial | Partial | ❌ | ❌ | Partial |
| Telemetry opt-in | ✅ | Opt-out | Opt-out | ✅ | ✅ | Opt-out |
| Price | **Free** | $$$ | $$$ | Free | Free | $$ |
| Terminal-Bench 2.0 | TBA | 74.7% | 77.3% | N/A | N/A | N/A |

A parallel table lives at `/web` for hanimo Web vs. Lovable / v0 / Bolt.new / Continue / Open Interpreter.

### 4.4 Tech stack for the site

- **Next.js 15** App Router · React Server Components · Partial Prerendering
- **Fumadocs** (MDX, built-in search, versioned docs) — better than Nextra for 2026
- **Tailwind v4** + **shadcn/ui** (direct Modol inheritance — you already own this stack)
- **Contentlayer 2** for blog posts
- **Vercel** for hosting (free tier is enough pre-launch) OR Cloudflare Pages if you want zero lock-in
- **Umami** (self-hosted, GDPR-clean) for analytics
- **Giscus** for blog comments (GitHub Discussions-backed)

---

## 5. Positioning & Copy

### 5.1 One-liner candidates

1. *"The open-source AI coding platform. Successor to Modol."* ← **recommended**
2. *"Claude Code, but yours. Cursor, but open. Aider, but in 2026."*
3. *"Local-first, model-agnostic, Apache-2.0. Code and Web, one platform."*

### 5.2 Four differentiation pillars (reuse across all pages)

1. **Dual-surface** — one team, one design system, one MCP backbone, two products (Code + Web). Nobody else ships both under one brand.
2. **Hash-anchored edits** — the only agent that refuses to write to a file whose content hash drifted mid-turn. Ends the "agent overwrote my change" nightmare.
3. **Model-agnostic by design** — LiteLLM router + Ollama + vLLM under the hood. Swap providers without changing config.
4. **Modol lineage** — not a student project. Carries 2+ years of battle-tested design system (hanimo-webui) and RAG pipeline (hanimo-rag).

### 5.3 Things NOT to say on the landing page

- "Better than Claude Code" — unprovable, invites ridicule. Use the matrix instead.
- "GPT-5 powered" — model names churn. Say "model-agnostic."
- "AGI" / "autonomous" / "replaces developers." Keep it grounded.

---

## 6. Release Strategy

### 6.1 Timeline (maps to `hanimo-ROADMAP-2026-04.html`)

| Week | Gate | Scope |
|---|---|---|
| **W6** | Repos scaffolded | Private repos, CI green, LICENSE + README stubs |
| **W9** | 🏁 **MVP (private β)** | Invite-only (~20 testers), no public announcement |
| **W11** | Landing site v0.1 | Homepage + /code + /web, no blog yet |
| **W14** | 🚀 **Public β** | Repos flipped public, Show HN, r/LocalLLaMA, r/golang, Korean dev forums, Product Hunt pending |
| **W16** | Docs + /compare finalized | `/compare/*` pages, benchmark post |
| **W18** | 🎉 **v1.0 GA** | Stable tags, Homebrew tap, `apt` repo, signed binaries |

### 6.2 Launch-day checklist (Week 14)

- [ ] README hero GIF (≤ 5MB, VHS or Asciinema)
- [ ] 60-second demo video (YouTube + `/` hero)
- [ ] `/compare` matrix complete for at least 3 competitors
- [ ] `hanimo.dev/blog/hello-world` — the launch post (Modol → hanimo narrative)
- [ ] Show HN title drafted: *"Hanimo — Apache-2.0 TUI + Web coding agent (successor to Modol)"*
- [ ] r/LocalLLaMA post focusing on offline/Ollama story
- [ ] Korean Velog/GeekNews cross-post (native audience)
- [ ] `security@hanimo.dev` MX live, PGP key published
- [ ] Discord server with #releases, #bug-reports, #benchmarks
- [ ] Sentry (or GlitchTip, self-hosted) wired for hanimo Web
- [ ] Crash telemetry **opt-in** with clear toggle
- [ ] All GitHub Actions cached and < 6 min

### 6.3 Who to tag / DM on launch day

- **HN** — user accounts with 500+ karma in your network (karma = visibility)
- **opencode maintainers** — ask for a friendly RT; cite them as an inspiration
- **Aider's Paul Gauthier** — polite mention; Aider originated repo-map
- **Simon Willison** — writes about local LLMs / offline agents; hanimo fits his beat
- **Korean dev Twitter** — 향로 (Spring), 이선협 (Toss), 조코딩
- **Charm** — Bubble Tea authors; they RT cool TUIs from their stack
- **Ollama** — official account loves "runs on Ollama" demos

---

## 7. CI/CD & Supply-chain

### 7.1 hanimo-code (Go)

- `golangci-lint` + `go test -race` + `go vet` on every PR
- `goreleaser` for multi-arch builds: `darwin/arm64`, `darwin/amd64`, `linux/amd64`, `linux/arm64`, `windows/amd64`
- **Cosign** keyless signing (Sigstore) for release binaries
- **SLSA Level 3** provenance via GitHub Actions reusable workflow
- Homebrew tap: `hanimo-dev/homebrew-tap`
- Scoop bucket for Windows
- `curl hanimo.dev/install.sh | sh` — signed, checksum-verified installer

### 7.2 hanimo-web (Next.js)

- `pnpm lint` + `pnpm test` + `pnpm build` + Playwright smoke on every PR
- Docker image: `ghcr.io/hanimo-dev/web:${SHA}` and `:latest`
- **Dependabot** weekly, grouped by patch/minor
- **Snyk** or **GitHub Advanced Security** for secret scanning (free for public repos)
- Chromatic (or Ladle) for component visual regression

### 7.3 Both

- Conventional Commits enforced by `commitlint` + Husky
- Release Please for automated CHANGELOG + version bumps
- Pre-commit hook runs `typos` to catch embarrassing typos in comments

---

## 8. Community & Support Infra

| Channel | Tool | Purpose |
|---|---|---|
| Real-time chat | **Discord** | Users, bug triage, early design feedback |
| Async discussion | **GitHub Discussions** | Versioned Q&A, feature requests (indexable by Google) |
| Bug reports | **GitHub Issues** | Strict templates — no "it doesn't work" allowed |
| Security | `security@hanimo.dev` + PGP | Private disclosure, 90-day window |
| Monthly sync | **Open dev call** (Google Meet) | Recorded → YouTube |
| Sponsors | GitHub Sponsors + Open Collective | Optional; don't gate features |

**Hard rule:** every issue gets a human reply within 48h for the first 3 months post-launch. Missed SLAs murder OSS momentum.

---

## 9. Risks & Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| "Yet another coding agent" fatigue | **High** | Lead with `/compare` matrix, not features. Make the dual-surface story the headline. |
| Claude Code / Cursor undercut further | High | Apache-2.0 + offline story is structural moat, not a price war. |
| Moltbook-style acquihire temptation for Community | Med | Launch Code + Web first; Community is phase 2. Defer exposure. |
| opencode already has 95K★ — why would they switch? | Med | Target Korean market first where opencode has weak localization; ride hash-edit as a unique asset. |
| Maintainer burnout (solo founder) | **High** | Hard-cap issue response to office hours; auto-close stale issues at 60 days. |
| Brand confusion with "hanime"/"hentai" typos | Low-Med | Own the SEO by publishing early and often; "hanimo" is one letter off but `.dev` signals dev audience. |

---

## 10. Immediate Next Actions (this week)

1. **Buy all three domains** (hanimo.dev + modol.app + modol.dev) — ~$60/yr total
2. **Create `hanimo-dev` GitHub organization**, reserve repo names
3. **Reserve handles**: X/Twitter `@hanimo_dev`, Discord vanity, Hugging Face org, npm `@hanimo`
4. **Scaffold `hanimo.dev` repo** with Next.js 15 + Fumadocs (copy shadcn/ui from hanimo-webui)
5. **Draft the `/compare` matrix** in MDX using content from `COMPETITIVE-LANDSCAPE-2026-04.md`
6. **Write `README.md` v0** for both product repos — lead with the matrix, not the install command
7. **Apply for GitHub Sponsors** (takes 1-2 weeks to approve)
8. **File trademark search** for "hanimo" (USPTO TESS + KIPRIS); avoid collisions before launch

---

## 11. Relation to other docs

- `MASTER-OVERVIEW-2026-04.md` — what hanimo Code *does*
- `PLATFORM-PLAN-2026-04.md` — 5-surface architecture (Code/Core/WebUI/RAG/Community)
- `COMPETITIVE-LANDSCAPE-2026-04.md` — raw competitor research; this doc turns it into launch copy
- `hanimo-ROADMAP-2026-04.html` — 18-week timeline; weeks referenced here map to that Gantt

---

*Document owner: kimjiwon · Last updated: 2026-04-11*
