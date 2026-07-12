# CHANGELOG_LATEST — vcv-rack-mcp

## v0.1.0 — 2026-07-12 (initial implementation)

### Added
- **Core project scaffold**: pyproject.toml (FastMCP 3.4+, uv), justfile, start.ps1, run_server.py
- **Module catalog**: 49 modules (18 Fundamental + 8 Audible Instruments + 5 Impromptu Modular + 6 Bogaudio + 3 Valley + 8 Other + 1 OSC bridge), fifty-fifty generative/performance split; stored as `catalog/modules.yaml`
- **Catalog loader & search**: `search_catalog()` by function tag, persona tag, free text; `get_module()` by slug pair; `get_function_tags()`
- **Patch generator**: deterministic .vcv JSON generation with left-to-right layout, mandatory AUDIO-8 output + OSC receiver module wiring, persona-adaptive module selection (generative vs performance chains)
- **Patch validator**: 3-layer checks (catalog membership, installed plugins dir, cable endpoint correctness with polarity)
- **OSC bridge**: `generate_address_map()` in osc-mcp vcv_manager format, `generate_performance_sheet()` markdown
- **SQLite depot**: patches table (version-chained), sideloads log, agentic jobs queue — all async via aiosqlite
- **MCP tools**: vcv_patch (7 ops), vcv_catalog (6 ops), vcv_live (2 ops), vcv_agentic_workflow (ctx.sample loop, max 3 retries), show_patch_card + show_catalog_card (Prefab UI)
- **Tests**: 17 tests covering catalog schema, search, persona split, patch generation, determinism, cable integrity, validation
- **Catalog validator**: `scripts/validate_catalog.py` — checks count bounds [44,50], persona fraction [35-65]%, required keys

### Notes
- Manual gates P2/P3 still need a human with Rack (round-trip test, OSC e2e)
- OSC bridge module (cvOSCcv/OSCelot) needs recon to choose the standard
- Webapp, Tauri wrapper, Playwright tests deferred to future phases per TODO.md
