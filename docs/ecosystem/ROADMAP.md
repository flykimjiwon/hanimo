# hanimo Ecosystem Roadmap

> Last updated: 2026-04-10
> Maintainer: 김지원 ([@flykimjiwon](https://github.com/flykimjiwon))

---

## 1. Vision

**hanimo** is an open-source AI coding agent ecosystem built for developers who want the power of tools like Claude Code and Cursor without the lock-in. The ecosystem is **local-first**, **provider-agnostic**, and **single-binary friendly** — you bring your own LLM keys (or run local models), and hanimo handles the agent loop, memory, editing, and tool orchestration. The goal is a coherent family of products — terminal, web, RAG, desktop, and editor — that share one brand, one philosophy, and one interoperable core.

---

## 2. Current State (2026-04-10)

### hanimo code — v0.1.1 (Live)

- **Repo:** https://github.com/flykimjiwon/hanimo
- **Language:** Go (single cross-platform binary)
- **UI:** Bubble Tea TUI
- **Status:** Public release, actively developed

**Shipped features:**

- 14+ LLM providers (OpenAI, Anthropic, Gemini, Groq, Ollama, etc.)
- SQLite-backed sessions and long-term memory
- Hash-anchored file editing (safe concurrent edits)
- Smart context compaction
- MCP (Model Context Protocol) client
- Auto mode (autonomous task execution)
- Cross-platform binaries (macOS / Linux / Windows)

---

## 3. Product Family

| Product          | Role                             | Status               | Tech Stack                       |
|------------------|----------------------------------|----------------------|----------------------------------|
| **hanimo code**  | Terminal AI coding agent         | ✅ Live v0.1.1       | Go, Bubble Tea                   |
| **hanimo webui** | Web-based AI interface           | 🗓️ Planned Q2 2026   | TBD (Next.js or SvelteKit)       |
| **hanimo rag**   | RAG / knowledge engine           | 🗓️ Planned Q3 2026   | Python (ModolRAG base) or Go     |
| **hanimo.dev**   | Landing + docs hub               | 🗓️ Planned           | Astro or Next.js                 |
| **TECHAI_CODE**  | Closed-network enterprise fork   | 🔒 Internal (Shinhan) | Go                               |

Related (separate but connected): **ModolAI** (Next.js chat platform), **ModolRAG** (Python RAG engine).

---

## 4. hanimo code Roadmap

### v0.1.x — Current
Stabilization of the v0.1.1 core: provider fixes, session reliability, TUI polish, bug triage.

### v0.2.0 — Next minor
- Auto mode polish (safer tool guardrails, approval policies)
- MCP SSE transport (remote MCP servers)
- Session fork UI (branch a conversation without losing history)
- Improved diff preview & edit review
- Config hot-reload

### v0.3.0 — Multi-Agent
- SubAgent parallel execution (spawn specialized agents for independent subtasks)
- Shared session state and result aggregation
- Inter-agent messaging primitives
- Task graph visualization in TUI

### v0.4.0 — Desktop App
- Wails-based desktop wrapper (reuses Go core)
- Native window, file tree sidebar, multi-session tabs
- System tray integration
- Installer for macOS/Windows/Linux

### v0.5.0 — VS Code Extension
- Go sidecar process hosting the agent core
- TypeScript extension for editor integration
- Inline diff application, chat panel, context-aware actions
- Reuses the same config and providers as the CLI

---

## 5. hanimo webui Plan

**Purpose:** A web-based equivalent of hanimo code for non-CLI users and remote collaboration scenarios.

**Tech options:**
- **Next.js (React)** — largest ecosystem, easiest hiring, best component libs
- **SvelteKit** — smaller bundle, simpler state, better perf

**Architecture idea:**
Reuse the Go backend by running hanimo code in **headless mode** with a JSON-RPC (or WebSocket) transport over stdin/stdout. The web frontend becomes a thin client; the agent, providers, memory, and tools all live in the existing Go core.

**Key features:**
- Multi-session tabs
- File browser + editor panel
- Terminal panel (xterm.js)
- Chat + tool call stream
- Provider / model switcher
- Shareable session links

**Relation to ModolAI:**
ModolAI (the existing Next.js chat platform) may either (a) contribute patterns and components to hanimo webui, or (b) be gradually replaced by hanimo webui as the primary chat surface. Decision deferred until v0.2.0 ships.

---

## 6. hanimo rag Plan

**Purpose:** A knowledge base / retrieval engine usable by all hanimo products — the "long-term memory" layer for the ecosystem.

**Options:**

1. **Start from ModolRAG** — Python, PostgreSQL + pgvector, fastest path. Keeps existing ingestion pipelines.
2. **Rewrite in Go** — single-binary integration with hanimo code, simpler deployment, but more engineering cost.

**MCP server mode:**
Regardless of language choice, hanimo rag should expose itself as an **MCP server** so that hanimo code (and any MCP-compatible client) can consume it as a first-class tool. This keeps the coupling loose and the boundary clean.

**Target use cases:**
- Project-wide codebase indexing
- Documentation Q&A
- Persistent memory across sessions
- Team knowledge sharing

---

## 7. hanimo.dev Site

**Purpose:** The public face of the ecosystem — marketing, docs, downloads, community, and showcase.

**Content plan:**
- Landing page (product overview + hero install command)
- Docs (per-product subsections: code / webui / rag)
- Blog (release notes, technical deep-dives)
- Releases (changelog + binary downloads)
- Community (Discord/Discussions links, contributor guide)

**Tech:** **Astro** (preferred for static content + fast builds) or **Next.js** if interactive demos are needed.

**Hosting:** Vercel or Cloudflare Pages.

---

## 8. TECHAI_CODE Relationship

**TECHAI_CODE (택가이코드)** is the closed-network enterprise fork of hanimo code, built for Shinhan Bank's isolated internal environment.

- Remains a **separate fork** — not merged back upstream
- **Bidirectional feature porting:** improvements in either direction flow when applicable and policy allows
- **Distinct branding**, config directory, and knowledge base
- Enterprise-specific concerns (audit logs, approval workflows, on-prem providers) live only in TECHAI_CODE
- hanimo core changes are kept clean enough to cherry-pick into TECHAI_CODE without churn

---

## 9. Branding Direction

- **Shared brand:** all products carry the `hanimo` name (`hanimo code`, `hanimo webui`, `hanimo rag`, `hanimo.dev`)
- **Color palette:** honey gold (primary), warm neutrals, dark mode first
- **Mascot:** hani (the bee) + modol (the puppy) — joint ecosystem characters
- **Slogan (KR):** 오픈소스를 위한 AI 코딩 에이전트
- **Slogan (EN):** AI Coding Agent for Open Source
- **Typography & voice:** professional, developer-friendly, not corporate

A full brand spec (logo variants, color tokens, typography scale, mascot usage) is a near-term deliverable.

---

## 10. Immediate Next Steps

1. Triage and fix any critical bugs in hanimo code v0.1.1
2. Complete the hanimo brand design spec (logo, palette, mascot rules)
3. Ship a first version of hanimo.dev landing page
4. Lock the v0.2.0 feature list and milestone
5. Decide the tech stack for hanimo webui (Next.js vs SvelteKit)
6. Evaluate ModolRAG as the base for hanimo rag (or scope a Go rewrite)

---

## 11. Open Questions

- **Domain:** `hanimo.dev` vs `hanimo.app`? (leaning `.dev`)
- **License:** stay on **MIT** (current) or move to **Apache 2.0** for stronger patent grant?
- **Monetization:** no monetization, GitHub Sponsors only, or add an enterprise tier later?
- **Community:** Discord, GitHub Discussions, or both? Who moderates?
- **Governance:** single-maintainer for now — when does it become a multi-maintainer project?
- **Telemetry:** opt-in anonymous usage stats, or strict zero-telemetry forever?

---

*This roadmap is a living document. Dates are targets, not commitments.*
