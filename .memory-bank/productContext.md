# Product Context — Vistamations command_control

## Project Identity
- **Repository**: `command_control` (GitHub: `petehops89-jpg/command_control`)
- **Local root**: `C:\vistamations-music`
- **Domain**: `localhost` (nginx via Docker compose)
- **Purpose**: Autonomous knowledge production operating system — governed research acquisition, publication, deployment, monitoring, and archival via the OpenClaw publishing engine.

## Agent Roster

| Agent | ID | Role | Runtime |
|---|---|---|---|
| Trinity | org AG001 | Infrastructure orchestration — Docker, MCP, localhost, healthchecks, port binding | base-env |
| Gordon | — | Docker container management, image builds, compose lifecycle, port registry | base-env |
| Merlin | — | Step-by-step wizard engine, form flows, UI/UX state machines, animation logic | Evidence Registry UI |
| Olivia | — | Orchestration secretary — navigation verification, end-to-end flow testing, link integrity | Monitor1 |
| Claw | — | Content ideation, research scope selection, source diversity auditing, topic generation | OpenClaw runtime |
| Big Brother | — | Oversight and coordination — runs DeepSeek V4 Pro, stage completion reports, architectural decisions | This session |
| Dee | — | Fast task worker — runs DeepSeek V4 Flash, low-latency diagnostics, quick fixes | Subagent pool |

Agent IDs follow the convention: `org AG### base-env`.

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
| **Stage 3** | NOT YET SCOPED | Needs decision: content scale vs infrastructure/CI-CD vs both |
| **Stage 4** | NOT YET SCOPED | — |
| **Stage 5** | NOT YET SCOPED | — |

## Key Branches

| Branch | Commit | Content |
|---|---|---|
| `main` | `1a44669` | Initial commit — clock, media player, Docker env |
| `publishing-engine-v2` | `29498cd` | Monitor1 dashboard, 5 dominions, PROJECT_ID/ASSET_ID, 9-stage lifecycle, value scoring |
| `evidence-registry` | `56dcf3b` | Evidence Registry UI (ink-stamp animation, VM-series IDs, bento grid), Express API routes, 16 seed links |
