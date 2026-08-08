# Vistamations — Command Control

## Environment

**Host**: Windows 11 Pro (build 2009), 11th Gen Intel Core i5-1135G7 @ 2.40GHz, 16 GB RAM. Docker Desktop 4.84.0 running on WSL2 backend (`desktop-linux` context), Docker Engine 29.6.2, Compose v5.3.1. Node.js 20 Alpine for application runtime. GitHub repository: [petehops89-jpg/command_control](https://github.com/petehops89-jpg/command_control).

**Development toolchain**: VS Code with LiveServer (port 5501), GitHub CLI v2.97.0 authenticated as `petehops89-jpg`. Project configuration via `.kilo/` skill and agent definitions, with project notes, instructions, and design links in `.vscode/`. Figma prototypes reference `vista-merlin-webcraft-engine.ai.studio` for UI/UX mockups and community design templates.

**Network**: Local Wi-Fi at 192.168.20.19, WSL virtual ethernet at 172.26.128.1. All services exposed on localhost: nginx (80/5501), app (3000), Redis (6379), Prometheus (9090). External API integrations: Open-Meteo for Wagga Wagga weather data, jsDelivr CDN for hls.js, WebTorrent, and ffmpeg.wasm browser libraries.

## Infrastructure

**The Trinity** — `docker | mcp | localhost` — defines the base environment stack. Agent Trinity (ID: `org AG001 base-env`) governs infrastructure orchestration and environment management. A second agent slot (`org AG007 base-env`) is reserved for expansion.

**Container stack** (4 services, all healthy):

| Service | Image | Port | Role |
|---------|-------|------|------|
| `nginx` | nginx:alpine | 80, 5501 | Reverse proxy, static file serving, gzip |
| `app` | custom node:20-alpine | 3000 | Express API server, health/metrics endpoints, Redis client |
| `redis` | redis:7-alpine | 6379 | Cache/state backend, AOF persistence, password auth, 256MB memory limit |
| `prometheus` | prom/prometheus:latest | 9090 | Metrics collection, persistent TSDB storage, 15s scrape interval |

**Application layer**: `clock.html` (real-time Wagga Wagga clock with weather, 24hr toggle, 8-city world clock), `vista-moonlight` (Video.js-based legacy media player), `media-player/index.html` (modular media stack: Web Audio API equalizer with 8 presets, HLS/IPTV streaming with 5 default channels, WebTorrent streaming, fetch-based download manager, ffmpeg.wasm transcoder, localStorage-backed settings), `index.html` (Next.js-style bento grid command control dashboard with `command-control.png` full-page background).

**Monitoring**: Prometheus scrapes app `/metrics` endpoint (uptime, Redis connectivity). All 4 containers have healthchecks with 15s intervals and failure retries. Nginx auto-restarts on failure. App exposes `/health` returning JSON status with Redis connection state.

**Git**: Single branch `main` tracking `origin/main`. 29 tracked files, 5398 lines. Clean working tree.

## Vistamations Mission Statement

Vistamations is a qualitative and quantitative, broadly resourced, concurrent real-time runtime simulator — a platform that transforms computing infrastructure into a living, self-governing ecosystem. The mission: build an orchestration layer where AI agents govern growth according to user-defined policies, not scripted automation.

**Core principle — Sovereignty**. Users own their infrastructure; Vistamations is the orchestration layer, not the host. The platform connects the user's own GitHub accounts, cloud providers (Google Cloud, Cloudflare), Docker hosts, local machines, NAS devices, and edge platforms into a unified command plane.

**Architecture — Four layers**:

1. **Simulation** — The visual game layer. Users see kingdoms, territories, cities, and departments, not cloud terminology. Infrastructure is gamified as a world they govern.
2. **Digital Twin** — Every simulation object maps to real infrastructure. A capital city is a Google Cloud project; an industrial zone is a Docker cluster; a research centre is a GitHub repository.
3. **Infrastructure** — Three operating modes: Sandbox (fully simulated, no credentials), Hybrid (partial real resources like GitHub and Cloudflare), Production (fully live: Cloud Run, Vertex AI, Workers, D1, R2, local servers).
4. **Sovereignty** — The differentiator. The platform does not own anything. Users supply their keys, accounts, and hardware. Vistamations provides governance, orchestration, and AI management.

**AI governance model** — Policy-driven agents monitor domains: capacity, security, cost, deployment, documentation, architecture, compliance. Each agent watches its domain, raises flags backed by confidence scores and cost estimates, and proposes structural changes — not as alerts, but as decision points with actionable recommendations.

**Distributed compute** — Local compute (desktop, laptop, Docker host, Raspberry Pi), cloud compute (Google Cloud Run, Vertex AI, storage), and edge compute (Cloudflare Workers, D1, KV) all report through a unified command bus to a single control plane.

**Infrastructure Genome** — A portable, versioned blueprint of every user's environment: cloud providers, machines, containers, databases, agents, permissions, network topology, deployment policies, and automation rules. Changes through the platform update the genome; the genome renders the simulation. This makes environments reproducible and redeployable.

**Narrative mode — Thomas Bresche** — A fictional campaign following a protagonist who starts with nothing and builds a kingdom. The story teaches systems thinking through consequences: early game challenges (cash flow, technical debt, scaling), mid game (competitors, acquisitions, regulatory compliance), late game (multinational operations, geopolitical risk, sanctions). The endgame generates a comprehensive Kingdom Analysis across infrastructure, security, leadership, and resilience — lessons from one campaign seed the starting architecture for the next.

**Immediate goal**: Build the command control centre as an interactive SVG dashboard with real-time system telemetry, boot sequence visualization, agent status monitoring, network topology graphs, and event logging — establishing the visual foundation for the full simulation engine.
