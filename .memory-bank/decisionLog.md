# Decision Log

## 2026-08-07T17:37 — Design System: Evidence Registry over generic SaaS dashboard
(previous entries preserved — see git history)

## 2026-08-08T01:30 — Publications page: auto-discovery from cron output folder
`publications.html` uses a new `/api/publications` endpoint in server.js that scans `crons/openclaw/publications/` at request time for `.html` files, extracts run IDs and modification timestamps, and sorts newest-first. No manual linking needed — new cron output appears automatically.

**Rationale**: Publications had accumulated in the folder but were invisible. Auto-discovery means any new RUN-*.html dropped by the publishing engine appears on the page on next load without configuration changes.

## 2026-08-08T01:30 — Links page: scraping notes folder for URLs
`links.html` scrapes all `.txt` files in `.vscode/pete/notes-folder/` for URLs and categorizes them. A scheduled task (`Vistamations-LinksSync`) re-runs the scrape every 4 days at 12:00 to pick up new links.

**Rationale**: Pete had URLs scattered across 4 notes files with no central index. Auto-scraping + scheduled refresh means new links appear without manual curation. The sync-links.ps1 script is self-contained and writes a complete standalone HTML page — no server dependency.

## 2026-08-08T01:30 — Command Portal: Sidebar with message history + CLEAR button
Replaced the no-response tracking panel with a scrollable left sidebar showing all message snippets. Added a CLEAR button that keeps last 5 messages and saves older ones as `.txt` to `.vscode/pete/command-portal-messages/`.

**Rationale**: The 1-hour no-response timer was causing confusion (flash messages, premature expiration). A persistent message history with user-controlled clearing is simpler and more reliable than an automated timeout.

## 2026-08-08T01:30 — Command Portal: insertAdjacentHTML instead of innerHTML
Changed message rendering from `thread.innerHTML = html` to `thread.insertAdjacentHTML('beforeend', html)` to prevent the 5s poll cycle from wiping the entire chat thread when no new messages arrive.

**Rationale**: The old code compared `if (html !== thread.innerHTML)` and when `html` was empty string on a poll with no new messages, it replaced the entire thread with nothing. Non-destructive append fixes this permanently.

## 2026-08-08T02:00 — Git auto-commit to current branch, not main
The scheduled `Vistamations-GitCommit` task uses `git push origin <current-branch>`, not a hardcoded branch name. Currently pushes to `evidence-registry`. Does not merge or PR into main.

**Rationale**: The repo uses feature branches (evidence-registry, publishing-engine-v2) that lag behind main. Auto-committing to the current branch is safer than silently merging into main. Main stays as the stable/production branch.

## 2026-08-08T07:00 — big-brother-checklists: infrastructure verification system
Created a reusable checklist system with two files: `config-criteria.json` (schema of what to verify) and `checklist-config.json` (actual values per project). The criteria file defines categories (portAndProcess, routeRegistration, requestResponseIntegrity, frontendBackendSync, reviewCadence, logicVerification). The config file holds per-project values (expectedPort, expectedRoutes, knownIssues, lastVerified). New project entries add to config; new criteria types go in the criteria schema first.

**Rationale**: Fixing the same class of bug (route mismatch, container not rebuilt, API 404) across multiple debugging sessions without a systematic checklist. This makes verification repeatable and the checklist itself a project artifact, not session memory.

## 2026-08-08T09:00 — Kilo modes: .kilo/modes/*.md, not .kilocodemodes
No `.kilocodemodes` file format exists — Kilo Code uses `.kilo/modes/*.md` files (discovered via `{mode,modes}/*.md` glob pattern from Kilo config documentation). All 8 agents defined as individual markdown files with YAML frontmatter.

**Rationale**: The original assumption that Kilo Code used a `.kilocodemodes` file was incorrect. The Kilo config docs state mode files are loaded from `{mode,modes}/*.md` within config directories. This matches the agent loading pattern (`{agent,agents}/**/*.md`).

## 2026-08-08T09:00 — Olivia model: Mistral Large 3 (intentional, not accidental)
Only Olivia has an explicit `model: mistral/mistral-large-3` in her mode file. The other 7 agents have no `model:` field, inheriting the session default (DeepSeek V4 Pro). This was intentional — Olivia as orchestrator benefits from a different model for delegation/routing decisions.

**Rationale**: Task dispatch (classifying Pete's message, deciding which agents to wake) is a different workload from code execution. A separate model for the orchestrator prevents the coding model from burning context on delegation logic.

## 2026-08-08T13:30 — Olivia dispatch: background_process + watchdog, not Task Scheduler loop
Task Scheduler's `RestartCount`/`RestartInterval` only works within a single trigger instance. AtLogOn triggers fire once and the instance completes — there's nothing left to restart when the process dies mid-session. Solution: persistent background process for the 10s loop, backed by a separate Task Scheduler watchdog (every 5 min) that checks if the process is alive and starts it if missing.

**Rationale**: Task Scheduler minimum trigger interval is 1 minute — sub-minute polling requires a persistent loop. The watchdog covers the gap where the process dies mid-session (which the AtLogOn trigger alone cannot recover from).

## 2026-08-08T13:30 — Hung-process detection: deferred
Did not add heartbeat-based hung-process detection to the watchdog. Current detection (process existence check) covers the actual failure modes: process crash, kill, or system reboot. The only hung-process risk is Invoke-RestMethod hanging on localhost, which PowerShell 5.1's 30s default timeout covers naturally.

**Rationale**: Adding heartbeat requires a second file (heartbeat JSON), a second pattern match (stale timestamp detection), and a tricky edge case (killing a hung pwsh that may have locked the file). The added complexity doesn't match the current scale — one script, one JSON file, zero I/O outside reads. Revisit if logs show "process alive but portal not updating" symptoms.
