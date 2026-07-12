# TODO — vcv-rack-mcp

Ordered task list for the executing agent. Work TOP TO BOTTOM. Do not skip ahead:
every phase's output is the next phase's input. Check boxes as you complete tasks;
each phase ends with a GATE — do not pass a gate with failing criteria.
PRD.md is the contract; mcp-central-docs section 0 rules apply (no stubs, real tests).

## Phase 0 — Recon & setup (0.5 d)

- [ ] Read `PRD.md`, `AGENTS.md`, `mcp-central-docs\standards\AGENT_PROTOCOLS.md`, `WEBAPP_SOTA_STANDARDS.md`
- [x] Verify VCV Rack 2 installed on Goliath — CONFIRMED 2026-07-12: `C:\Program Files\VCV\Rack2Free\Rack.exe` (Free edition — standalone only, no plugin hosting; see docs/ONBOARDING.md). Record exact version number in `docs/VCV_JSON_SCHEMA.md` header at recon time. On any OTHER machine or fresh setup: follow `docs/ONBOARDING.md` first
- [ ] Locate Rack user dir + `plugins/` dir; list installed plugins to `recon/installed_plugins.txt`
- [ ] Manually save 4 reference patches in Rack (ASK Sandra to click, or do it if computer use available): (a) empty, (b) 3-module minimal voice VCO→VCF→AUDIO, (c) 8-module patch with cables + a sequencer, (d) same as (c) resaved after moving one knob
- [ ] Copy them to `recon/reference_patches/`; diff (c) vs (d); document observed JSON schema (top-level keys, module entry shape, cable entry shape, param storage, id assignment, pos units) in `docs/VCV_JSON_SCHEMA.md`
- [ ] Install BOTH OSC bridge candidates (cvOSCcv, OSCelot class — whatever the current VCV Library offers); save a patch containing each; test receiving one OSC message into each via osc-mcp `vcv_manager`; CHOOSE ONE, record decision + observed JSON footprint in schema doc
- [ ] Scaffold repo from `D:\Dev\repos\mcp-server-template` (uv, FastMCP >=3.2,<4, justfile, start.ps1, CHANGELOG_LATEST.md)
- [ ] Reserve backend+frontend port pair in `mcp-central-docs\operations\WEBAPP_PORTS.md` — same commit as first use
- [ ] GATE P0: schema doc exists with real observations; bridge module chosen and proven receiving OSC; repo skeleton passes `just lint`

## Phase 1 — Module catalog (0.5 d) — LOAD-BEARING

- [ ] Design `catalog/modules.yaml` schema: plugin_slug, model_slug, display_name, function_tags[], persona_tags[] (generative|performance|both), params[] {id, label, min, max, default, osc_suitable}, inputs[], outputs[], observed_json (snippet), notes
- [ ] Populate ~10 Fundamental modules first (VCO, LFO, VCF, VCA, ADSR, SEQ, RANDOM, DELAY, MIXER, AUDIO) — verify every param id and port id by saving a patch containing the module and reading its JSON. NEVER write a catalog entry from memory/training data
- [ ] Populate community set to 44–50 total, **fifty-fifty generative/performance** per PRD §4 candidate list — only modules present in `installed_plugins.txt`; flag desirable-but-missing ones in `docs/CATALOG_WISHLIST.md` for Sandra to install
- [ ] Write `docs/MODULE_CATALOG.md` — human-readable rendering of the YAML, grouped by function, persona-tagged
- [ ] GATE P1: yaml validates against its own schema (write the validator, `scripts/validate_catalog.py`); zero entries reference uninstalled plugins; count in [44,50]; persona split within 45–55%

## Phase 2 — vcv_patch + depot (1 d)

- [ ] SQLite layer: patches table (id, name, slug, persona, version, parent_version, modules_json, status, created_at), migrations in `src/.../db.py`
- [ ] `vcv_patch.import` — ingest reference patches (they become test fixtures)
- [ ] `vcv_patch.validate` — the 3 checks (catalog membership, installed membership, cable endpoint correctness incl. in/out polarity). Structured report: list of {severity, module_or_cable, message}
- [ ] Patch generator core: module instantiation from catalog observed_json, deterministic id assignment, cable builder, left-to-right pos layout (PRD §7.3), mandatory AUDIO module + OSC bridge wiring (§7.1), headroom default
- [ ] `vcv_patch.create` (uses generator), `edit` (version chain), `list`, `get`, `open_in_rack` (with running-Rack process check), sidecar .md emission (§7.5)
- [ ] Tests: deterministic regeneration (same input → identical JSON), validation catches (bad slug, cable to nonexistent port, output-to-output cable), version chain integrity — 15+ cases this phase
- [ ] MANUAL GATE P2 (needs Rack, coordinate with Sandra): generate the PRD §10.1 round-trip patch, open in Rack, confirm no missing modules + audible output + legible layout, resave, run semantic diff script (`scripts/semantic_diff.py` — ignore volatile fields identified in P0 recon)

## Phase 3 — vcv_catalog + vcv_live + OSC e2e (0.5 d)

- [ ] `vcv_catalog`: search (tag/persona/text), get_module, verify_installed, suggest_rack (rule-based)
- [ ] `vcv_live.address_map` — emit map in the format osc-mcp `vcv_manager` consumes (read osc-mcp source for the exact contract; do NOT guess)
- [ ] `vcv_live.performance_sheet` — markdown from sidecar + map
- [ ] MANUAL GATE P3: performance-persona patch playing in Rack; sweep filter cutoff via osc-mcp using only the emitted address_map (PRD §10.3)

## Phase 4 — Agentic + Prefab (0.5 d)

- [ ] `vcv_agentic_workflow` — ctx.sample loop per PRD §6.4, mirror sdr-mcp implementation incl. recovery_options; max 3 iterations; every iteration logged to job record
- [ ] Job queue (SQLite) if not already from template; agentic runs are jobs
- [ ] Prefab: `show_patch_card`, `show_catalog_card` (prefab-ui>=0.14.0; mirror arxiv-mcp card style)
- [ ] Test: PRD §10.2 ambient-drone brief against local model (LM Studio endpoint) — mark slow/manual, record transcript to `recon/agentic_runs/`
- [ ] GATE P4: agentic run produces a validate-green patch in ≤3 iterations at least 2 of 3 attempts

## Phase 5 — Webapp, packaging, release (1 d)

- [ ] web_sota: Vite+Tailwind+Bun; pages: Depot (list+filter by persona), Patch detail (JSON viewer, sidecar, address map, validate button, open-in-Rack button), Catalog (searchable), Jobs. FastAPI backend on reserved port
- [ ] Playwright headless smoke (per fleet standard)
- [ ] mcpb: manifest, `bunx @anthropic-ai/mcpb validate` + `pack` (NOT init/publish)
- [ ] `just release-dry` per release-template; CHANGELOG_LATEST.md for v0.1.0
- [ ] Add repo to FLEET_INDEX.md (honest status + port numbers); GitHub repo `sandraschi/vcv-rack-mcp`, push
- [ ] GATE P5 (ship): all PRD §10 acceptance criteria checked off with evidence (paths to test output / screenshots in `docs/ACCEPTANCE_EVIDENCE.md`)

## Explicitly deferred (do not build)

- Render lane (Rack Pro VST / Cardinal in Reaper) — pending Sandra's decision
- Patch depot RAG/semantic search — after fleet embedops consolidation (gap analysis §8.2)
- obs-mcp demo choreography — separate task once v0.1 ships
