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

## Stage 3 — Command Control Rollout: SCOPED (2026-08-07T18:37 AEST)

Confirmed by Pete. Three phases, sequenced below.

### Phase 3.1 — MODULES: Controllers & Monitoring Dashboard
Complete controllers index — dials, buttons, switches, full monitoring (visual + audio/NVDA). Layout as detachable sections/containers using the existing bento-tile system from Evidence Registry.

- **Sequencing**: FIRST. No hard dependency from 3.2 on 3.1, but the container/dashboard system should exist before agents render inside it. If agent visual identities (3.2) appear in the command control view, 3.1 must be built first.
- **Existing (reuse)**: `index.html` bento grid (13 cards), `evidence-registry.html` bento system (score-proportional sizing CSS), `monitor1.html` stats/log tabs, `prometheus.yml` metric scraping, `clock.html` live clock/weather module.
- **Net-new**: Detachable/resizable container system (drag-and-drop, snap-to-grid), dial/gauge SVG components (CPU, memory, Redis, HTTP req/s — designs exist in notes), button/switch toggle components, NVDA audio monitoring integration (Windows speech synthesis or Web Audio API alerts), unified dashboard HTML replacing or extending index.html.
- **Effort**: MEDIUM — ~2-3 sessions. Largest sub-task: the detachable container system (drag state, persistence, responsive reflow). Smallest: audio monitoring (simple TTS hook into existing healthcheck data).
- **Open question**: Is this a replacement for `index.html` (the 13-card bento grid) or a new page that coexists with it? If replacement, the existing cards (Clock, Media Player, Agents, etc.) must be preserved as modules inside the new layout.

### Phase 3.2 — COMMUNITY/PERSONNEL: Agent Formalization & Knowledge Generator
Formalize every agent — name, ID, role, persona, visual appearance. Build real-time simulation view of agents running operations (AEST). Implement the knowledge generator. Olivia's role: funnel output to Pete directly (filtered/summarized, not raw-dump).

- **Sequencing**: SECOND. Depends on 3.1 for the rendering surface if agents appear in the dashboard. The knowledge generator depends on OpenClaw runtime output (Stage 2 closeout). Independent learning (3.3) depends on the knowledge generator feed — so this phase unblocks 3.3.
- **Existing (reuse)**: Agent roster in `productContext.md` (7 agents defined), `agents` file (AG001 Trinity, AG007 vacant), `base-env` file (Trinity config), `runtime.js` DOMINIONS/PROJECT_IDS constants, OpenClaw publications pipeline (generates content assets).
- **Net-new**: Agent profile data model (JSON registry — name, ID, role, persona text, visual avatar/glyph, assigned dominion), real-time agent simulation page (SVG-based topology showing agent state: idle, researching, publishing, reviewing, error), knowledge generator module (takes OpenClaw runtime output → structured summaries → Olivia filter pipeline → Pete delivery), Olivia delivery channel (notification, Telegram, or web panel — needs decision).
- **Effort**: HIGH — ~4-5 sessions. Largest sub-task: the knowledge generator's summarization/filter logic (turning raw publications into briefs for Pete). Smallest: agent profile data model (simple JSON registry, 1 session).
- **Open question**: What channel does Olivia use to reach Pete? Notification (BurntToast), Telegram, dedicated web panel, or all three? "Funnel directly" implies real-time push — need the delivery mechanism decided before architecting.

### Phase 3.3 — SECURITY: Repo Separation & System Implementation
Separate public and private repos cleanly. Implement/document: SIM, BUSINESS, SYNCHRONICITY, AUTONOMY, and INDEPENDENT LEARNING systems. INDEPENDENT LEARNING sourced from cron job output (Stage 2) and knowledge generator feed (3.2).

- **Sequencing**: LAST. Depends on Stage 2 closeout (cron job output must be stable) AND Phase 3.2 (knowledge generator feed must exist). Cannot start until both upstream sources are producing data.
- **Existing (reuse)**: `crons/openclaw/runtime.js` (AUTONOMY core — 13-stage pipeline, PROJECT_ID/ASSET_ID hierarchy, lifecycle state machine), Stage 2 scheduled publishing (INDEPENDENT LEARNING data source), Monitor1 stats aggregation, Evidence Registry research pipeline, `.gitignore` (basic).
- **Net-new**: Repo split plan (public `command_control` vs. private config/secrets repo), SIM system architecture doc (simulation game concept referenced in notes — needs formal spec), BUSINESS system (financial tracking, asset valuation, portfolio dashboard), SYNCHRONICITY system (event correlation — agent actions → publication outputs → Monitor1 stats linked end-to-end), AUTONOMY hardening (auto-recovery on failure, retry logic, escalation paths), INDEPENDENT LEARNING loop (cron output + knowledge gen → training data → model refinement feedback loop — if feasible).
- **Effort**: HIGHEST — ~5-6 sessions. Most of these are architectural documents plus prototype implementations. INDEPENDENT LEARNING is the hardest: it requires a closed feedback loop from publication quality metrics back into topic selection. SYNCHRONICITY is the most novel — building the correlation data model across all systems.
- **Open questions**: (1) Is INDEPENDENT LEARNING meant to be actual model fine-tuning, or rule-based improvement of topic selection/scoring weights? (2) Does the repo split mean `command_control` becomes the public face and a new private repo holds config/secrets/keys? (3) Are SIM, BUSINESS, SYNCHRONICITY, AUTONOMY, and INDEPENDENT LEARNING expected as working code modules, or as architectural documentation with reference implementations?

### Cross-Phase Conflicts & Duplication Flags
- **Evidence Registry bento grid vs. 3.1 controllers**: The evidence registry uses a 6-column bento grid with score-proportional card sizing. 3.1 refers to "the existing bento-tile system from Evidence Registry" — this implies REUSE of the same CSS grid system, not a separate implementation. No conflict.
- **Monitor1 vs. 3.1 monitoring**: Monitor1 currently has 5 tabs (Dominions, Projects, Assets, Publications, Event Log). 3.1's "full monitoring (visual + audio)" may replace or extend Monitor1. If replacement, Monitor1's publishing-specific views must be preserved as one module within the new dashboard. Decision needed.
- **Stage 2 closeout vs. 3.3**: 3.3's INDEPENDENT LEARNING depends on Stage 2's scheduled publishing being stable. Stage 2 is currently blocked on container rebuild + scheduler registration. Cannot scope 3.3 execution until Stage 2 closeout completes.

## Active Git State

- Branch: `evidence-registry` (56dcf3b)
- Working tree: clean (all changes committed)
- Remote: pushed to origin
- PR status: branch is PR-ready against `publishing-engine-v2`
