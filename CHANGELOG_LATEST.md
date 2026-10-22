# CHANGELOG_LATEST — vcv-rack-mcp

## v0.2.0 — 2026-10-22 (Transit module data)

### Added
- **Stoermelder TRANSIT catalog entry** (`Stoermelder-P1`/`Transit`, GPL-3.0, free): 15 params, 3 inputs, 1 output, `data_schema` for the 12-slot preset blob. Source-verified against PackOne v2 (plugin.json 2.7.0, Transit.cpp, TransitBase.hpp, official manual); `observed_json: null` pending Rack round-trip recon. Catalog now 50 modules.
- **`vcv_patch` op `set_module_data`**: write a module's saved `data` blob (full object) or a compact Transit `presets` spec (`[{label?, fade_time?, color?, values[]}]`, optional `source_maps` bindings). Version-chained like `edit`; refuses structurally invalid Transit data with reasons.
- **Validator Check 4 (module data)**: Transit blobs checked against `data_schema` (slot count, numeric values, binding width match); foreign blobs without a schema get a warning. `transit_data.build_transit_data` / `validate_transit_data` covered by 7 new tests (24 total passing).

### Notes
- P2 gate still needs Sandra with Rack: PackOne is NOT installed locally — sideload via Library subscribe + restart, then open the generated Transit patch and re-save for the round-trip JSON reference.
- TransitEx (+T, 12 more slots each) noted in catalog notes but not yet catalogued.

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
