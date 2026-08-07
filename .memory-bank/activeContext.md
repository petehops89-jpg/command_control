# Active Context — 2026-08-07T17:37 AEST

## Stage 1 — Trinity / Infrastructure: 85%

**Working**: Docker compose stack fully healthy — nginx (14h), app (15h), redis (15h), prometheus (13h). All healthchecks passing. Ports 80, 3000, 5501, 6379, 9090 bound. n8n-mcp cleaned (20 orphaned processes killed, 2 remain). OpenClaw gateway PID 14288 on port 18789.

**Missing**: Automated container rebuild on code change (currently manual `docker compose up -d --build app`). No MCP manifest file declaring intentional vs. transient MCP servers.

## Stage 2 — Crons + Media Interface: In Closeout

**Root blocker identified**: `server.js` was modified on disk to add `/research/capture` and `/research/links` Express endpoints, but the Docker `app` container was never rebuilt. The live container serves the previous revision — API returns 404. Evidence Registry reads from static JSON fallback (16 seed links) but cannot write.

**Closeout actions in progress**:
1. Container rebuild: `docker compose up -d --build app` — not yet executed
2. Port/API verification: confirm `GET /api/research/links` → 200, `POST /api/research/capture` → 200
3. Scheduled task registration: `schedule.ps1 -Action register` — not yet executed
4. VM-XXXX ID migration: seed `links.json` uses LINK-XXXX format; needs migration to VM-XXXX for schema consistency — scoped but not started

**What works end-to-end**: Monitor1 → Evidence Registry button navigation. Static HTML/CSS/JS rendering. Ink-stamp animation. Bento grid sizing. URL parsing and domain extraction. Filter/search bar. All client-side logic verified.

**What's broken**: Persistent write-back. API → nginx proxy → Express routes return 404. Scheduled publishing has never run under actual schedule — all publications are manual test invocations.

## Stage 3 — NOT YET SCOPED

Decision needed: should Stage 3 cover content scale (30-day campaign, 120 publications, registry expansion into all 5 dominions), infrastructure/CI-CD (automated container rebuild, healthcheck dashboards, MCP manifest), or both? Human decision required before architecting.

## Active Git State

- Branch: `evidence-registry` (56dcf3b)
- Working tree: clean (all changes committed)
- Remote: pushed to origin
- PR status: branch is PR-ready against `publishing-engine-v2`
