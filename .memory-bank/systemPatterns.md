# System Patterns — command_control

## Shell Conventions

| Context | Shell | Rationale |
|---|---|---|
| Windows diagnostics (Docker, ports, processes, file ops) | PowerShell 5.1 | Native Windows tooling; `Get-Process`, `Get-NetTCPConnection`, `Get-CimInstance` give structured output |
| OpenClaw config changes, key management, tray interactions | Non-PowerShell (tray app UI, Telegram slash commands) | OpenClaw gateway state is not exposed via PowerShell; config mutation needs the gateway's own interface |
| Git operations | PowerShell via `git -C <path>` | Consistent with repo-local git identity (`petehops89-jpg`, `hops89@gmail.com`) |
| Node.js runtime execution | PowerShell direct invocation | `node <script>.js` from working directory |

## File Delivery Pattern

```powershell
# Standard pattern for moving files into the project:
# 1. File lands in Downloads folder (browser download, external source)
# 2. Move-Item to target directory
Move-Item -LiteralPath "$env:USERPROFILE\Downloads\<file>" -Destination "C:\vistamations-music\<target-path>"
```

## Container Rebuild Requirement

**Current state**: Manual. Any change to `server.js`, `Dockerfile`, or `package.json` requires:
```powershell
docker compose -f C:\vistamations-music\docker-compose.yml up -d --build app
```
**Flagged as pipeline gap**: Should be automated via file watcher or git hook. Until automated, `server.js` changes silently fail — the container runs stale code and API endpoints return 404 with no visible error.

## Process Identification

| Process | Identification | Port | Permanence |
|---|---|---|---|
| OpenClaw Gateway | `node.exe` with PID tracked manually, port 18789 | `127.0.0.1:18789` | Persistent daemon |
| n8n-mcp | 2 `node.exe` processes (npm wrapper + n8n-mcp), command line contains `n8n-mcp` | Dynamic (stdin/stdout) | Should be persistent, was accumulating orphans via npx |
| Docker containers | `docker ps` — names: `vistamations-nginx`, `vistamations-app`, `vistamations-redis`, `vistamations-prometheus` | 80, 3000, 6379, 9090 | Persistent via compose |
| Publishing runtime | `node runtime.js` — triggered by Task Scheduler or manual | None (filesystem-only) | Ephemeral (~100ms per run) |

## Known Pipeline Gaps

1. **Container rebuild**: Manual — flagged for automation in Stage 3
2. **MCP manifest**: No file declaring which MCP servers are intentional — n8n-mcp is the only active one but this is implicit
3. **Scheduled task registration**: `schedule.ps1` exists but has never been registered — 0 scheduled executions have run
4. **API write-back**: Express routes exist in source but not in the running container — evidence registry is read-only until rebuild
5. **Seed data ID migration**: `links.json` uses LINK-XXXX format; evidence registry uses VM-XXXX — schema mismatch in seed data
