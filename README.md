# vcv-rack-mcp

**Status: SCAFFOLDED — no implementation yet.** PRD and TODO are ready for agentic execution; not one line of server code exists. Do not list as Active anywhere until Phase 2 of TODO.md is green.

MCP server for VCV Rack 2 built on one insight: **`.vcv` patch files are plain JSON**, so an LLM composes modular synth patches by emitting structured data — no GUI automation, ever. Live control delegates to osc-mcp's existing `vcv_manager`; every patch this server authors ships with an OSC receiver module pre-wired and a published address map, so it is born performable.

- **PRD.md** — the contract: goals, tool specs, patch conventions, risks, acceptance gate
- **TODO.md** — ordered build phases with gates (recon → catalog → patch engine → OSC e2e → agentic → ship)
- **docs/ONBOARDING.md** — fresh-machine setup (Rack 2 Free, VCV account, Library, audio check)
- Catalog mandate: 44–50 curated modules, **fifty-fifty** generative-ambient / DJ-performance; **free Library modules only** in v1
- Module management: webapp Modules page (installed diff / Library deep-links / GitHub sideload) + `rack_cycle` restart choreography — Rack loads plugins only at startup, so install-into-running-Rack = graceful close → stage → relaunch → verify. No GUI automation, by design.
- Render: ladder settled — free VCV Recorder module in patches → Cardinal (catalog-intersection caveat) → Rack Pro, each rung only on proven need

Part of the sandraschi MCP fleet. Fleet context: `mcp-central-docs\architecture\FLEET_GAP_ANALYSIS_2026-07.md` §12.2.
