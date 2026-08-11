# Vistamations System

## Terminology Bridge — System ↔ Industry

| Vistamations Term | Industry Term (what VS Code/Git/Docker call it) | What it means |
|---|---|---|
| **System** | Repository / Project / Workspace folder | The whole thing. `C:\vistamations-music`. Everything lives here. |
| **Local Sub-System** | Local environment / Local machine | Docker + Windows running on your physical PC. All local services. |
| **Cloud Sub-System** | Cloud infrastructure | Everything NOT local: Cloudflare + Google Cloud. |
| **Environment** | Environment / Runtime | A specific execution context: Local (Docker), Cloudflare (Edge), Google Cloud (Vertex AI). |
| **System root** | Workspace root / Repo root | `C:\vistamations-music` — the top-level directory. |
| **System directory** | Working directory / Project folder | The folder you're in. Files live here. |
| **Agent mode file** | Markdown instruction file / System prompt | `.kilo/modes/gordon.md` — tells an agent who they are and what they do. |
| **Agent persona** | Agent config / Runtime identity | `personas/big-brother.json` — structured identity data for an agent. |
| **Docker stack** | Containerized services | 4 containers: nginx, app (Express), Redis, Prometheus. |
| **Reverse proxy** | Ingress / Router | nginx — routes traffic from port 80 to internal services. |
| **Git branch (evidence-registry)** | Working branch / Active branch | The line of commits where all work lives. `main` is a dead branch. |
| **Git commit** | Snapshot / Changeset | A saved point in time with a message describing what changed. |
| **Scheduled task** | Cron job / Scheduled job | Windows Task Scheduler entry. Runs scripts on a timer. |
| **API endpoint** | Route / HTTP handler | `GET /health` — a URL that returns data when called. |
| **4-value ID** | Namespaced identifier | `vista-localsub-root/vista-localenv-env-root/vista-sec-water/ag011.json` |
| **Command Control** | Dashboard | `index.html` — the bento grid homepage. |
| **Command Portal** | Message queue UI | `command-portal.html` — Olivia messaging interface. |
| **Kilo** | AI coding assistant / CLI tool | The AI tool running in VS Code that manages the system via agents. |
| **OpenClaw** | Gateway / Protocol bridge | A gateway service on port 18789 that connects external clients (Telegram). |
| **MCP** | Tool protocol (Model Context Protocol) | Allows agents to use external tools (n8n, Figma, etc.). |
| **Status Dot** | Health indicator | The green/red dot on Command Control showing live service state. |

## System Architecture

The Vistamations System is an autonomous knowledge production operating system governing research acquisition, publication, deployment, monitoring, and archival via an AI agent network.

```
Vistamations System (C:\vistamations-music)
│
├── LOCAL SUB-SYSTEM
│   └── Local Environment (Docker + Windows)
│
└── CLOUD SUB-SYSTEM
    ├── Cloudflare Environment (Edge — Workers, D1, KV)
    └── Google Cloud Environment (Vertex AI — Gemini)
```

**3 environments to date**: 1 Local, 2 Cloud (Cloudflare + Google Cloud).  
**GitHub**: [petehops89-jpg/command_control](https://github.com/petehops89-jpg/command_control)  
**Active branch**: `evidence-registry` (all system files live here; `main` is a dead branch with only the initial commit)  
**4-Value ID convention**: `vista-{subsystem}-{environment}-{item}` (e.g. `vista-localsub-root/vista-localenv-env-root/vista-sec-water/ag011.json`)

## Local Sub-System — Local Environment

**Host**: Windows 11 Pro, Intel Core i5-1135G7 @ 2.40GHz, 16 GB RAM. Docker Desktop 4.84.0 (WSL2), Node.js 20 Alpine. VS Code + Kilo AI toolchain.

**Docker stack** (4 containers, all healthy):

| Service | Image | Port | Role |
|---------|-------|------|------|
| `nginx` | nginx:alpine | 80, 5501 | Reverse proxy, static file serving |
| `app` | node:20-alpine | 3000 | Express API (17 routes) |
| `redis` | redis:7-alpine | 6379 | Cache/state (empty — 0 keys) |
| `prometheus` | prom/prometheus:latest | 9090 | Metrics (15s scrape) |

**Scheduled tasks** (6 active): Olivia Dispatch, Olivia Watchdog, Git Auto-Commit, Olivia Status, Links Sync, OpenClaw Publishing Engine.

**Applications**: Command Control (bento grid dashboard), Command Portal (Olivia message queue), Media Centre (8-agent grid), Mya (AI wizard + chat), Handy Mail (8-step security gate), PDF Toolkit, Gem Chat, Clock (Wagga Wagga + world time), Publications, Links.

## Cloud Sub-System — Cloudflare Environment

| Resource | Name | Status |
|---|---|---|
| D1 Database | `vistamations-agent-memory` (AGENT_DB) | Active |
| Worker | `vistamations-agent-memory` | Active |
| Worker | `mya-vistamations` | Active (`www.vistamations.com/mya`) |
| Worker | `vistamations-webworker` | Active (vistamations.com) |
| KV Namespaces | HANDY_MAIL_KV, SESSION_KV, MYA_KV | Deferred |

## Cloud Sub-System — Google Cloud Environment

| Resource | Detail | Status |
|---|---|---|
| Project | `vists-498322` | Active |
| Vertex AI | gemini-2.5-pro (global) | Configured |
| Auth | Application Default Credentials | Configured |
| Gemini CLI | Trusted workspace | Configured |
| Gemini daemon | AG010 gem daemon wiring | Pending |

## Agent Roster — Dominion I (10 agents)

| # | Agent | Runtime | Role |
|---|---|---|---|
| AG001 | Gordon | DeepSeek V4 Pro | Chief Hub Agent |
| AG002 | Trinity | DeepSeek V4 Pro | Systems Engineer |
| AG003 | Merlin V.II | DeepSeek V4 Pro | Wizard Guide |
| AG004 | Olivia | Mistral Large 3 | Executive Secretary |
| AG005 | Claw (Dee) | DeepSeek V4 Pro | MCP Specialist |
| AG006 | Big Brother | DeepSeek V4 Pro | Software Architect |
| AG007 | Dee | DeepSeek V4 Pro | Cron & Research |
| AG008 | Stefi | DeepSeek V4 Pro | Graphics & Design |
| AG009 | Terence | OpenClaw Gateway | Think Tank |
| AG010 | gem | Gemini 3.5 Flash | Music AI |

**Reporting chain**: Player → Merlin V.II → Olivia → Gordon → Trinity → Claw/Dee/Big Brother/Stefi

## System Health

| Area | Status |
|---|---|
| Docker stack | Healthy |
| API endpoints (17 routes) | Verified |
| Scheduled tasks (6) | Operational |
| Agent personas | 2/10 complete |
| Knowledge graph | Empty |
| Redis | Empty (0 keys) |
| Test coverage | None |
| CI/CD | None |
| **Overall Health** | **46%** |

## Mission

Vistamations is a qualitative and quantitative, broadly resourced, concurrent real-time runtime simulator — a platform that transforms computing infrastructure into a living, self-governing ecosystem. The mission: build an orchestration layer where AI agents govern growth according to user-defined policies, not scripted automation. Core principle: Sovereignty — users own their infrastructure; Vistamations is the orchestration layer, not the host.
