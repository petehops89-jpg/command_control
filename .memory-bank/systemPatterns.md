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

## Command Portal — Queue Spec (Stage 3.2, queued — do not build yet)

When the Command Portal UI is built (future Stage 3.2 work), the Olivia notification queue must implement:

1. **Two access paths**: (a) a link from the index.html home page, (b) a Respond button on Windows BurntToast notifications that opens the portal directly.
2. **Active queue cap**: Up to 10 unanswered messages from Olivia held active in the portal view.
3. **Overflow behavior**: When the 11th unanswered message arrives, the oldest unanswered auto-clears from the active queue, gets logged to a session log, and moves to a backlog retained for 3 weeks.
4. **Archival**: Backlog items older than 3 weeks are archived (moved to an archive directory or compressed log) — not deleted, but removed from active backlog view.
5. **No-response tracking**: Any notification not responded to within 1 hour is logged to `no-responses.json` and displayed in the portal's unanswered panel. The `/api/olivia/notified` endpoint already tracks this window; the portal's `loadNoResponses()` already reads from `/api/olivia/no-responses`.

**Current state (2026-08-07)**: The `no-responses.json` file exists with 1 tracking entry. The portal HTML (`command-portal.html`) exists with the unanswered panel UI and a placeholder agent response section. The notification scripts (`command-portal-notify.ps1`, `olivia-notify.ps1`) work. The critical missing piece is the agent-side polling loop — messages are written to `queue.json` but no agent daemon reads and responds to them.

## Olivia Message System — Known Gap

**Diagnosis (2026-08-07T22:28)**: The Olivia queue system is a one-directional write-only pipe. Pete sends a message via olivia-gate.html or command-portal.html → POST /api/olivia/respond → message written to responses.json and queue.json → end of pipeline. No agent daemon polls queue.json, reads assigned tasks, or writes agentReply back to responses.json. All 7 tasks in queue.json have status "queued" — zero have been processed. The pipe terminates at the write.

**Required for fix** (Stage 3.2): An agent-side polling loop that reads queue.json, matches tasks to agent identities, generates responses via LLM, and writes agentReply fields back to responses.json. The portal's `loadAgentResponse()` already expects `entry.agentReply.from`, `entry.agentReply.message`, and `entry.agentReply.timestamp` — the read side is built. The write side is missing.

**Notification persistence**: BurntToast uses the Windows PowerShell host (`{1AC14E77-...}\powershell.exe`) as the notification sender. Windows Action Center settings are registered — 7 notifications tracked historically with interactions logged. Notifications should persist in Action Center after the toast disappears. However, BurntToast at v1.1.0 uses default priority; to guarantee persistence, `New-BurntToastNotification` should use `-Silent` flag for Action Center-only delivery, or the Windows notification priority for PowerShell should be set to ensure they don't auto-dismiss.

