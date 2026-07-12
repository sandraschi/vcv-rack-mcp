# AGENTS.md — vcv-rack-mcp

Instructions for any coding agent (DeepSeek V4/OpenCode, Claude Code, Cursor) working in this repo.

## Read first, in order
1. `PRD.md` (this repo) — the contract
2. `TODO.md` (this repo) — work TOP TO BOTTOM, respect the GATEs
3. `D:\Dev\repos\mcp-central-docs\standards\AGENT_PROTOCOLS.md`
4. `D:\Dev\repos\mcp-central-docs\standards\WEBAPP_SOTA_STANDARDS.md`
5. `D:\Dev\repos\mcp-central-docs\architecture\FLEET_GAP_ANALYSIS_2026-07.md` §12.2 and §0

## Hard rules
- NO stubs presented as implementations. Unimplemented = `NotImplementedError("see TODO.md Phase N")`.
- NEVER write a catalog entry from training-data memory. Every module entry is verified against a real saved patch's JSON (TODO Phase 1).
- NEVER guess the osc-mcp address-map contract — read `D:\Dev\repos\osc-mcp` source (vcv_manager).
- NO GUI automation of the Rack window under any circumstances.
- `fastmcp>=3.2.0,<4`, uv, Bun, Biome, ruff, justfile. Scaffold from `D:\Dev\repos\mcp-server-template`.
- Manual gates (P2, P3) need a human with Rack open — STOP and ask Sandra; do not fake the evidence.
- Every completed phase: update CHANGELOG_LATEST.md and check the TODO boxes in the same commit.

## Kickoff prompt (paste into OpenCode)
> Read AGENTS.md, PRD.md, and TODO.md in D:\Dev\repos\vcv-rack-mcp, plus the standards docs AGENTS.md lists. Begin TODO Phase 0. Stop at every GATE and at every task marked ASK Sandra. Show real command output; never claim a gate passed without evidence.
