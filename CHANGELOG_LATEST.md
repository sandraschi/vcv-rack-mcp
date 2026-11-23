# CHANGELOG_LATEST — vcv-rack-mcp

## Unreleased — 2026-11-23 (Webapp SOTA rebuild & VCV Rack 2 launch)

### Fixed
- **VCV Rack 2 auto-detection**: `config.py` now probes `Rack2Free`/`Rack2Pro`/`Rack2` executables, `%LOCALAPPDATA%\Rack2` (instead of hardcoded `Rack2Free`), and `plugins-win-x64` (instead of `plugins`).
- **`.vcv` file materialization & double-JSON bug**: `vcv_patch` (`create`, `edit`, `import`, `set_module_data`) and `POST /api/patches` now write `<depot>/<slug>.vcv` to disk and pass parsed `list`/`dict` objects to `db.py` (fixing `open_in_rack` 404s).
- **Rack lifecycle control**: added `rack_process.py` (`get_rack_status`, `launch_rack`, `stop_rack`), `vcv_patch` operations `rack_status`/`rack_start`/`rack_stop`, and REST routes `GET /api/rack/status`, `POST /api/rack/start`, `POST /api/rack/stop`, `POST /api/rack/config`.

### Added
- **Full SOTA Webapp (`webapp/src/`)**: replaced monolithic `App.tsx` with `Layout.tsx` (retractable sidebar with top toggle, topbar with Start/Stop Rack, `Ctrl+L` logs modal, theme toggle, footer), Zustand store (`store/app.ts`), and 12 routed pages: Dashboard, Patch Depot (+ Detail), Modules Catalog, VCV Library, Agentic Jobs, Tools Hub, Skills, AI Chat, Apps Hub, Logs, Settings, and Help (5-tab contract).
- **Backend SOTA endpoints**: `GET /api/health`, `/api/dashboard`, `/api/tools`, `/api/tools/{name}`, `POST /api/tools/{name}/run`, `GET /api/skills`, `/api/skills/{name}`, `/skill/{name}`, `GET /api/logs` (ring-buffer + `tool_call` logging), `GET /api/llm/providers`, `/api/llm/models`, `/api/llm/gpus`, `POST /api/llm/chat`, `GET /api/apps`.
- **MCP Skill resource**: added `skills/vcv-rack-mcp/SKILL.md` and `@mcp.resource("skill://vcv-rack-mcp/SKILL.md")`.

## Unreleased — assfix 2026-10-31 (fleet compliance)

### Fixed
- **CORS wildcard removed** (CRITICAL): `allow_origins=["*"]` replaced with explicit 10917 origins (127.0.0.1/localhost/goliath + tauri://localhost, tauri.localhost) plus unconditional `allow_origin_regex` for LAN/Tailscale.
- **Shutdown surface** (HIGH): new `vcv_shutdown` MCP tool (destructive annotation) + `POST /api/shutdown` route (200 now, exit ~500 ms later); shared `_error_response()` helper with `logger.exception` auto-logging.
- **Capabilities endpoint** (HIGH): new `GET /api/capabilities` (tools + routes, standard shape) for webapp/IDE discovery.
- **Tool docs** (HIGH): `hub_status` gained `## Return Format` + `## Examples`; both Prefab cards gained `## Examples`; create/edit responses now carry a `message` key (dialogic contract).
- **Tool annotations** (MEDIUM): every tool carries `annotations=` (`readOnlyHint`, destructive on shutdown).
- **Ruff T20 enforced** (MEDIUM): `T20` added to `select` with per-file-ignores for tests/scripts; `ruff format` clean.
- **justfile fleet recipes** (MEDIUM): added `fmt`, `serve`, `check` (lint + format-check + tests).
- **Missing roots** (MEDIUM/LOW): new `.env.example` (RACK_EXE/RACK_USER_DIR/HOST/PORT/OSC_MCP_BASE), `start.bat` shim, `llms.txt` + `llms-full.txt` (tools/endpoints/config/ports); `.gitignore` now covers `*.mcpb`, `reports/`, `*.bak.*`, `native/target|gen`.
- **Gates verified**: `ruff check` clean, `ruff format --check` clean, `pytest` 24/24 pass, webapp `bun run build` (tsc -b + vite) clean, CSS 19.9 kB (Tailwind active).

### Deferred (issues to mint)
- Webapp catch-them-all rebuild (Dashboard/Inbox/Tools/Skills/Chat/Settings/Help/Logs) + Chat backend proxy + LLM glom-on + onboarding cue.
- MCPB 3-4-100 prompts (system 193 words, user 87 words) + `examples.json` + `scripts/mcpb-pack.ps1` shim + `glama.json`.
- Session injection channels (`.cursorrules`, `.claude-plugin`, copilot instructions) - needs fleet template decision.
- `.pre-commit-config.yaml` + hook materialisation, CI `ci.yml` (ruff/biome/pyright/pytest), coverage `--cov` gate.
- `CHANGELOG.md` (has CHANGELOG_LATEST.md only), `CLAUDE.md`, `.gitattributes`, `.windsurfrules`.
- `.bak` dross cleanup (tracked `*.bak` from prior runs).
- ghaudit never run on this repo.

## v0.2.0 — 2026-10-22 (Transit module data)

### Added
- **Stoermelder TRANSIT catalog entry** (`Stoermelder-P1`/`Transit`, GPL-3.0, free): 15 params, 3 inputs, 1 output, `data_schema` for the 12-slot preset blob. Source-verified against PackOne v2 (plugin.json 2.7.0, Transit.cpp, TransitBase.hpp, official manual); `observed_json: null` pending Rack round-trip recon. Catalog now 50 modules.
- **`vcv_patch` op `set_module_data`**: write a module's saved `data` blob (full object) or a compact Transit `presets` spec (`[{label?, fade_time?, color?, values[]}]`, optional `source_maps` bindings). Version-chained like `edit`; refuses structurally invalid Transit data with reasons.
- **Validator Check 4 (module data)**: Transit blobs checked against `data_schema` (slot count, numeric values, binding width match); foreign blobs without a schema get a warning. `transit_data.build_transit_data` / `validate_transit_data` covered by 7 new tests (24 total passing).
- **GitHub hygiene**: issue forms (`bug_report.yml`, `feature_request.yml`), PR template, `CONTRIBUTING.md` (catalog verification rule, no-stubs, no-GUI-automation).

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
