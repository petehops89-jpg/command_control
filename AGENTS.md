# Vistamations System — Agent Briefing

## Terminology Bridge — System ↔ Industry

All agents must use Vistamations terminology when communicating with Pete. Industry terms in parentheses are for internal technical reference only.

| Vistamations Term | Industry Term | What it means |
|---|---|---|
| **System** | Repository / Project / Workspace folder | Everything at `C:\vistamations-music` |
| **Local Sub-System** | Local environment | Docker + Windows on the physical PC |
| **Cloud Sub-System** | Cloud infrastructure | Cloudflare + Google Cloud (everything not local) |
| **Environment** | Environment / Runtime context | Local (Docker), Cloudflare (Edge), Google Cloud (Vertex AI) |
| **Division** | Business unit / Org unit | Broad organizational function (Operations, Creative, Executive, Public) |
| **Department** | Team / Functional group | Specialized unit within a Division (Engineering, Design, Sales, etc.) |
| **System root** | Workspace root / Repo root | `C:\vistamations-music` |
| **Agent mode file** | System prompt / Instruction file | `.kilo/modes/gordon.md` |
| **Agent persona** | Agent config / Runtime identity | `personas/big-brother.json` |
| **Docker stack** | Containerized services | nginx, app, Redis, Prometheus (4 containers) |
| **Git branch** | Working branch / Active branch | `evidence-registry` — where all work lives |
| **Git commit** | Snapshot / Changeset | A saved checkpoint with a message |
| **Scheduled task** | Cron job / Scheduled job | Windows Task Scheduler entry |
| **API endpoint** | Route / HTTP handler | `GET /health`, `POST /olivia/respond`, etc. |
| **6-value ID** | Namespaced identifier | `vista-{subsystem}-{environment}-{division}-{department}-{item}` |
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
├── LOCAL SUB-SYSTEM (Docker/Windows)
│   └── Local Environment
│       │
│       ├── OPERATIONS DIVISION (runs the system)
│       │   ├── Infrastructure Department — Gordon (AG001)
│       │   │   Docker stack: nginx, app, Redis, Prometheus
│       │   │   Scheduled tasks, container rebuilds, CI/CD
│       │   │
│       │   ├── Engineering Department — Trinity (AG002), Big Brother (AG006), Claw (AG005), Dee (AG007)
│       │   │   server.js, API routes, ports, bridges, gateway
│       │   │   agent-daemon.js, code review, telemetry, cron research
│       │   │
│       │   └── Security Department
│       │       Gate Manager, vault, rate limiter, nonce cache, envelope signatures
│       │
│       ├── CREATIVE DIVISION (builds the product)
│       │   ├── Design Department — Stefi (AG008)
│       │   │   UI design, bento layouts, branding, animations, Figma
│       │   │
│       │   ├── Production Department
│       │   │   Media Centre, PDF Toolkit, publishing engine, static pages
│       │   │
│       │   └── Music Department — gem (AG010)
│       │       Multimodal analysis, playlist curation, audio research
│       │
│       ├── EXECUTIVE DIVISION (runs the business)
│       │   ├── Administration Department — Olivia (AG004)
│       │   │   Command Portal, queues, scheduling, task delegation
│       │   │
│       │   ├── Strategy Department — Merlin V.II (AG003)
│       │   │   Architecture pathfinding, tutorials, system philosophy, STATUS.md
│       │   │
│       │   ├── Think Tank Department — Terence (AG009)
│       │   │   Metacognition, vector mapping, idea synthesis, cluster formation
│       │   │
│       │   └── Accounts Department (GAccounts)
│       │       Google account monitoring, PIN-protected vault, conflict-free
│       │       email zone. Pete only — no agent access. Separate from GCloud
│       │       ecosystem (vista-gcloud-env-root). Agents must request permission.
│       │
│       └── PUBLIC DIVISION (faces outward)
│           ├── Marketing Department
│           │   Advertising, branding, outreach, content strategy
│           │
│           ├── Sales Department
│           │   Client acquisition, contracts, pricing, partnerships
│           │
│           └── Vistamations Committee
│               Pete + agent governance — decisions, policy, direction
│
└── CLOUD SUB-SYSTEM (Cloudflare + Google Cloud)
    │
    ├── Cloudflare Environment
    │   └── CLOUD OPERATIONS DIVISION
    │       ├── Edge Department
    │       │   Workers: vistamations-agent-memory, mya, vistamations-home-bento
    │       │   Domain routing (vistamations.com), CDN
    │       │
    │       └── Data Department
    │           D1 database (AGENT_DB), KV namespaces (deferred)
    │
    └── Google Cloud Environment
        └── AI DIVISION
            ├── Model Department
            │   Vertex AI, gemini-2.5-pro (global), ADC auth
            │
            └── Research Department
                Gemini CLI, agent experiments, prompt engineering
```

**3 Environments, 6 Divisions, 15 Departments:**

| Sub-System | Environment | Division | Department | Lead |
|---|---|---|---|---|
| Local | Local | Operations | Infrastructure | Gordon |
| Local | Local | Operations | Engineering | Big Brother |
| Local | Local | Operations | Security | — |
| Local | Local | Creative | Design | Stefi |
| Local | Local | Creative | Production | — |
| Local | Local | Creative | Music | gem |
| Local | Local | Executive | Administration | Olivia |
| Local | Local | Executive | Strategy | Merlin V.II |
| Local | Local | Executive | Think Tank | Terence |
| Local | Local | Executive | Accounts (GAccounts) | Pete only |
| Local | Local | Public | Marketing | — |
| Local | Local | Public | Sales | — |
| Local | Local | Public | Committee | Pete |
| Cloud | Cloudflare | Cloud Operations | Edge | — |
| Cloud | Cloudflare | Cloud Operations | Data | — |
| Cloud | Google Cloud | AI | Model | — |
| Cloud | Google Cloud | AI | Research | — |

**6-Value ID Convention**: `vista-{subsystem}-{environment}-{division}-{department}-{item}`
- Example: `vista-localsub-localenv-ops-sec-water/ag011.json` (Local Sub-System → Local Environment → Operations Division → Security Department → Key Vault)
- Example: `vista-cloudsub-cfenv-cloudops-edge-worker.json` (Cloud Sub-System → Cloudflare Environment → Cloud Operations Division → Edge Department → Worker)
- Example: `vista-localsub-localenv-exec-admin-olivia.json` (Local Sub-System → Local Environment → Executive Division → Administration Department → Olivia persona)

---

## Agent Roster — Dominion I (10 agents)

| # | Agent | Runtime | Division | Department | Role |
|---|---|---|---|---|---|
| AG001 | Gordon | DeepSeek V4 Pro | Operations | Infrastructure | Chief Hub Agent — Docker, container orchestration, pipeline logs |
| AG002 | Trinity | DeepSeek V4 Pro | Operations | Engineering | Apprentice Systems Engineer — ports, bridges, gateway management |
| AG003 | Merlin V.II | DeepSeek V4 Pro | Executive | Strategy | Wizard Guide — tutorials, strategy, system philosophy |
| AG004 | Olivia | Mistral Large 3 | Executive | Administration | Executive Secretary — queues, scheduling, task delegation |
| AG005 | Claw (Terence) | DeepSeek V4 Pro | Operations | Engineering | MCP Specialist — tool belt, legacy systems, external integrations |
| AG006 | Big Brother | DeepSeek V4 Pro | Operations | Engineering | Senior Software Architect — code review, infrastructure, telemetry |
| AG007 | Dee | DeepSeek V4 Pro | Operations | Engineering | Cron & Research Worker — scheduling, scraping, report generation |
| AG008 | Stefi | DeepSeek V4 Pro | Creative | Design | Graphics & Design Director — UI, bento layouts, branding, animations |
| AG009 | Terence | OpenClaw Gateway | Executive | Think Tank | Think Tank Architect — metacognition, vector mapping, idea synthesis |
| AG010 | gem | Gemini 3.5 Flash | Creative | Music | Music AI & Research Curator — multimodal analysis, playlist curation |

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
| `xchat-save` | Save session transcript to next sequential chat-results file |

---

## Active Git Branch

**`evidence-registry`** is the active working branch where all system files live. The `main` branch contains only the initial commit (2026-08-07) and is effectively abandoned. All features — Command Portal, Olivia Gate, Media Centre, Mya, Cloudflare Workers, security modules — are on `evidence-registry`. Auto-commits push to the currently checked-out branch.

---

## System Health

| Area | Status |
|---|---|
| Docker stack (4 containers) | Healthy |
| API endpoints (17 routes) | Verified |
| Scheduled tasks (6) | Operational |
| Agent personas | 10/10 complete |
| Knowledge graph | Empty |
| Redis | Empty (0 keys) |
| Test coverage | None |
| CI/CD | None |
| Gemini auth | ADC configured (vists-498322), daemon wiring pending |
| Secrets | Segregated to env vars (G-3 resolved) |
| **Overall System Health** | **54%** |
