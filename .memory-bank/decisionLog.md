# Decision Log

## 2026-08-07T17:37 — Design System: Evidence Registry over generic SaaS dashboard

The research capture UI was re-architected from a basic form layout to the "Evidence Registry" design system. Palette: ink-black `#0A0C0F` background, card surface `#14171C`, amber `#E8A33D` for ID stamps and primary actions, cyan `#4FD1C5` for verified/assessed status, rust `#C44536` for flagged/rejected. Typography: JetBrains Mono for IDs/headers/case-file labels, Inter for body/descriptions. Bento grid cards scale with composite score (9-10: large, 7-8: medium, 5-6: small, <5: minimal). Ink-stamp CSS animation slams VM-XXXX IDs onto cards via 700ms cubic-bezier keyframe.

**Rationale**: The Evidence Registry is a research intake tool, not a generic dashboard. A case-file/investigative aesthetic reinforces the "evidence collection" workflow metaphor. Rating-proportional card sizing gives immediate visual priority to high-quality sources.

## 2026-08-07T17:37 — OpenClaw Gateway: single Scheduled-Task process, port 18789

Confirmed that OpenClaw Gateway runs as a single long-lived process (PID 14288, listening on `127.0.0.1:18789`), not as a tray application or competing with Windows Task Scheduler. No tray-app/task collision exists. The `schedule.ps1` script registers a separate scheduled task for the publishing engine runtime — these are distinct processes with no overlap.

**Rationale**: Earlier ambiguity about whether the gateway and scheduler would conflict is resolved. They target different ports (18789 vs. none for the runtime) and different lifecycles (persistent daemon vs. triggered execution).

## 2026-08-07T17:37 — Deprecated npx-spawned MCP servers for long-running use

22 n8n-mcp node.exe instances accumulated between 01:38 and 16:46 AEST — each npx invocation spawned a new pair without cleaning up previous ones. 20 orphaned processes were killed, keeping 2 most recent. Long-running MCP servers should not use `npx` — they must be built from source or installed globally to avoid process accumulation.

**Rationale**: `npx` is designed for transient execution. Each invocation creates a new temp-directory installation and spawns a new process. For persistent MCP servers, `npm install -g` or build-from-source prevents duplication.

## 2026-08-07T17:37 — Memory bank as persistent context solution

Adopted a `.memory-bank/` directory in the repo root as the single shared context source for all agents. Files: `productContext.md`, `activeContext.md`, `decisionLog.md`, `systemPatterns.md`, `progress.md`. One bank per repo — not per agent. Build-from-source, not npx-based MCP.

**Rationale**: Previous approach relied on session-scoped context injection (startup memory blocks) and per-agent recall. A shared, version-controlled memory bank ensures all agents — Trinity, Gordon, Merlin, Olivia, Claw, Big Brother, Dee — operate from the same ground truth. Committed to git, it survives session restarts and survives across agent instances.
