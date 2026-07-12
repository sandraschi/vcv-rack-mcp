# vcv-rack-mcp

**Status: SCAFFOLDED — no implementation yet.** PRD and TODO are ready for agentic execution; not one line of server code exists. Do not list as Active anywhere until Phase 2 of TODO.md is green.

MCP server for VCV Rack 2 built on one insight: **`.vcv` patch files are plain JSON**, so an LLM composes modular synth patches by emitting structured data — no GUI automation, ever. Live control delegates to osc-mcp's existing `vcv_manager`; every patch this server authors ships with an OSC receiver module pre-wired and a published address map, so it is born performable.

- **PRD.md** — the contract: goals, tool specs, patch conventions, risks, acceptance gate
- **TODO.md** — ordered build phases with gates (recon → catalog → patch engine → OSC e2e → agentic → ship)
- Catalog mandate: 44–50 curated modules, **fifty-fifty** generative-ambient / DJ-performance
- Render lane (Rack Pro / Cardinal): deferred pending owner decision

Part of the sandraschi MCP fleet. Fleet context: `mcp-central-docs\architecture\FLEET_GAP_ANALYSIS_2026-07.md` §12.2.
