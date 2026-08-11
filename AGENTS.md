# Vistamations System — Agent Briefing

## Terminology Bridge — System ↔ Industry

All agents must use Vistamations terminology when communicating with Pete. Industry terms in parentheses are for internal technical reference only.

| Vistamations Term | Industry Term | What it means |
|---|---|---|
| **System** | Repository / Project / Workspace folder | Everything at `C:\vistamations-music` |
| **Local Sub-System** | Local environment | Docker + Windows on the physical PC |
| **Cloud Sub-System** | Cloud infrastructure | Cloudflare + Google Cloud (everything not local) |
| **Environment** | Environment / Runtime context | Local (Docker), Cloudflare (Edge), Google Cloud (Vertex AI) |
| **System root** | Workspace root / Repo root | `C:\vistamations-music` |
| **Agent mode file** | System prompt / Instruction file | `.kilo/modes/gordon.md` |
| **Agent persona** | Agent config / Runtime identity | `personas/big-brother.json` |
| **Docker stack** | Containerized services | nginx, app, Redis, Prometheus (4 containers) |
| **Git branch** | Working branch / Active branch | `evidence-registry` — where all work lives |
| **Git commit** | Snapshot / Changeset | A saved checkpoint with a message |
| **Scheduled task** | Cron job / Scheduled job | Windows Task Scheduler entry |
| **API endpoint** | Route / HTTP handler | `GET /health`, `POST /olivia/respond`, etc. |
| **4-value ID** | Namespaced identifier | `vista-{subsystem}-{environment}-{item}` |
| **Command Control** | Dashboard | `index.html` — bento grid homepage |
| **Command Portal** | Message queue UI | `command-portal.html` — Olivia interface |
| **Kilo** | AI coding assistant / CLI | The AI tool managing the system |
| **OpenClaw** | Gateway / Protocol bridge | External client connector on port 18789 |
| **MCP** | Model Context Protocol | Tool protocol for agents (n8n, Figma, etc.) |
| **Status Dot** | Health check indicator | Live green/red dot on Command Control |

## System Identity

**System**: Vistamations  
**GitHub**: [petehops89-jpg/command_control](https://github.com/petehops89-jpg/command_control)  
**Current branch**: `evidence-registry` (active working branch — all system files and features live here)  
**Mission**: Autonomous knowledge production operating system — governed research acquisition, publication, deployment, monitoring, and archival via an AI agent network.

---

## System Architecture

```
Vistamations System (C:\vistamations-music)
│
├── Local Sub-System                          ← Docker/Windows on this machine
│   └── Local Environment                     ← vista-localenv-env-root
│       ├── Docker stack: nginx, app (Express), Redis, Prometheus
│       ├── Node.js server (server.js, port 3000)
│       ├── Static web pages (index.html, media-player.html, handy-mail.html, etc.)
│       ├── Scheduled tasks: Olivia dispatch, Git auto-commit, publishing engine, etc.
│       └── Pete's files: .vscode/pete/ (4-value ID structure)
│
└── Cloud Sub-System                          ← Cloudflare + Google Cloud
    ├── Cloudflare Environment                ← vista-cloudflare-env-root
    │   ├── D1 database: vistamations-agent-memory (AGENT_DB)
    │   ├── Workers: vistamations-agent-memory, mya, vistamations-home-bento
    │   └── KV namespaces (deferred): HANDY_MAIL_KV, SESSION_KV, MYA_KV
    │
    └── Google Cloud Environment              ← vista-gcloud-env-root
        ├── Project: vists-498322
        ├── Vertex AI: gemini-2.5-pro (global)
        ├── Auth: Application Default Credentials
        └── Gemini CLI + Vertex AI SDK
```

**3 Environments**:
1. **Local Environment** (Windows/Docker) — the primary runtime. Docker stack, Express server, static files, scheduled tasks.
2. **Cloudflare Environment** (Edge) — Workers compute, D1 database, KV storage, domain routing (vistamations.com).
3. **Google Cloud Environment** (Vertex AI) — AI model access (Gemini), project vists-498322, ADC auth.

**4-Value ID Convention**: `vista-{subsystem}-{environment}-{item}.json`
- Example: `vista-localsub-root/vista-localenv-env-root/vista-sec-water/ag011.json`
- Example: `vista-cloudsub-root/vista-gcloud-env-root/env-root.json`

---

## Agent Roster — Dominion I (10 agents)

| # | Agent | Runtime | Role |
|---|---|---|---|
| AG001 | Gordon | DeepSeek V4 Pro | Chief Hub Agent — Docker, container orchestration, pipeline logs |
| AG002 | Trinity | DeepSeek V4 Pro | Apprentice Systems Engineer — ports, bridges, gateway management |
| AG003 | Merlin V.II | DeepSeek V4 Pro | Wizard Guide — tutorials, strategy, system philosophy |
| AG004 | Olivia | Mistral Large 3 | Executive Secretary — queues, scheduling, task delegation |
| AG005 | Claw (Dee) | DeepSeek V4 Pro | MCP Specialist — tool belt, legacy systems, external integrations |
| AG006 | Big Brother | DeepSeek V4 Pro | Senior Software Architect — code review, infrastructure, telemetry |
| AG007 | Dee | DeepSeek V4 Pro | Cron & Research Worker — scheduling, scraping, report generation |
| AG008 | Stefi | DeepSeek V4 Pro | Graphics & Design Director — UI, bento layouts, branding, animations |
| AG009 | Terence | OpenClaw Gateway | Think Tank Architect — metacognition, vector mapping, idea synthesis |
| AG010 | gem | Gemini 3.5 Flash | Music AI & Research Curator — multimodal analysis, playlist curation |

**Reporting Chain**: Player → Merlin V.II (AG003) → Olivia (AG004) → Gordon (AG001) → Trinity (AG002) → Claw/Dee/Big Brother/Stefi

---

## Key Commands (`x` prefix convention)

| Command | Action |
|---|---|
| `xinitiate [agent] [job]` | Execute agent task via 4-stage loop: Review → Validate → Verify → Confirm |
| `xstatus [service]` | Real-time API poll (not process-existence) |
| `xtelemetry` | Force 10-second Command Control refresh cycle |
| `xsync` | Trigger Olivia queue watcher push/pull |
| `xclear` | Compress message buffer to last 5 items |
| `xpair [channel] [code]` | Register external client (Telegram, etc.) with OpenClaw |

---

## Active Git Branch

**`evidence-registry`** is the active working branch where all system files live. The `main` branch contains only the initial commit (2026-08-07) and is effectively abandoned. All features — Command Portal, Olivia Gate, Media Centre, Mya, Cloudflare Workers, security modules — are on `evidence-registry`. Auto-commits push to the currently checked-out branch.

---

## State

| Area | Status |
|---|---|
| Docker stack (4 containers) | Healthy |
| API endpoints (17 routes) | Verified |
| Scheduled tasks (6) | Operational |
| Agent personas | 2/10 complete |
| Knowledge graph | Empty |
| Redis | Empty (0 keys) |
| Test coverage | None |
| CI/CD | None |
| Gemini auth | ADC configured (vists-498322), daemon wiring pending |
| **Overall System Health** | **46%** |
