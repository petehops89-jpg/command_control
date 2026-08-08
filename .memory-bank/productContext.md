# Product Context — Vistamations command_control

## Project Identity
- **Repository**: `command_control` (GitHub: `petehops89-jpg/command_control`)
- **Local root**: `C:\vistamations-music`
- **Domain**: `localhost` (nginx via Docker compose)
- **Purpose**: Autonomous knowledge production operating system — governed research acquisition, publication, deployment, monitoring, and archival via the OpenClaw publishing engine.

## Agent Roster — Dominion I

| Agent | ID | Role | Reports To | Runtime |
|---|---|---|---|---|
| Gordon | org AG001 | Chief Hub Agent — Docker ops, runtime monitoring, agent deployment, ticket routing, pipeline coordination, Monitor1 integration | Player | base-env |
| Trinity | org AG002 | Apprentice Systems Engineer — local server, gateway management, MCP routing, local cache/storage, deployment, recovery procedures | Gordon | base-env |
| Merlin V.II | org AG003 | Wizard Guide — tutorials, campaign guidance, world explanation, architecture reasoning, system philosophy, strategy advice | Player | Evidence Registry UI |
| Olivia | org AG004 | Executive Secretary / Operations Coordinator — calendars, schedules, reminders, task queues, project tracking, documentation, command history, backlog management, archive lifecycle, workflow orchestration | Merlin V.II | Monitor1 |
| Claw ("Dee") | org AG005 | Legacy Series MCP Specialist — MCP discovery, connector installation, skills, plugins, legacy systems, tool compatibility, workflow automation, external integrations | Trinity | OpenClaw runtime |
| Big Brother | org AG006 | Senior Software Architect (DeepSeek V4 Pro) — software architecture, code reviews, debugging, algorithms, optimisation, infrastructure, distributed systems, deployment strategy, engineering governance | Olivia | This session |
| Dee | org AG007 | Cron & Research Worker (DeepSeek V4 Flash) — cron jobs, scheduled publishing, posting, monitoring, scraping, research gathering, webhook automation, report generation, publication preparation, lightweight coding | Olivia | Subagent pool |
| Stefi | org AG008 | Graphics & Design Director — UI design, bento layouts, dashboard design, branding, icons, illustrations, cinematic presentation, animation planning, visual consistency, Stitch preparation, Google AI Studio assets | Olivia | base-env |

Agent IDs follow the convention: `org AG### base-env`.

**Reporting Chain**: Player → Merlin V.II (Guide) → Olivia (Operations) → { Gordon → Trinity → Claw, Big Brother, Dee, Stefi }

## Stack

| Layer | Technology |
|---|---|
| Edge / CDN | Cloudflare |
| AI Platform | GCP / Vertex AI Agent Platform Studio (`gen-lang-client-0110514845`) |
| Container runtime | Docker Desktop 4.84 / WSL2 |
| Reverse proxy | nginx:alpine (ports 80, 5501) |
| App server | Node.js 20 Alpine + Express (port 3000) |
| Cache / state | Redis 7 Alpine (port 6379) |
| Monitoring | Prometheus (port 9090) |
| Scheduler | Windows Task Scheduler (`schedule.ps1`) |
| Gateway | OpenClaw (PID-based, port 18789) |
| MCP | n8n-mcp (stdin/stdout, 2-process pair) |
| Version control | Git + GitHub (`petehops89-jpg`) |

## 5-Stage Build Plan

| Stage | Scope | Status |
|---|---|---|
| **Stage 1** | Trinity — Docker/MCP/server infrastructure | 85% — stack healthy, container rebuild gap |
| **Stage 2** | Crons + Media Interface — Evidence Registry, Monitor1, OpenClaw Gateway, scheduled publishing | ~70% — deployed, API broken (stale container), scheduler unregistered |
| **Stage 3** | Command Control Rollout — 3.1 MODULES (controllers, dials, monitors, audio), 3.2 COMMUNITY/PERSONNEL (agent identities, simulation view, knowledge generator, Olivia funnel), 3.3 SECURITY (repo separation, SIM/BUSINESS/SYNCHRONICITY/AUTONOMY/INDEPENDENT LEARNING) | SCOPED — not yet started; sequencing: 3.1→3.2→3.3 |
| **Stage 4** | NOT YET SCOPED | — |
| **Stage 5** | NOT YET SCOPED | — |

## Key Branches

| Branch | Commit | Content |
|---|---|---|
| `main` | `1a44669` | Initial commit — clock, media player, Docker env |
| `publishing-engine-v2` | `29498cd` | Monitor1 dashboard, 5 dominions, PROJECT_ID/ASSET_ID, 9-stage lifecycle, value scoring |
| `evidence-registry` | `56dcf3b` | Evidence Registry UI (ink-stamp animation, VM-series IDs, bento grid), Express API routes, 16 seed links |
