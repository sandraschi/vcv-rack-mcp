# TODO v2 — vcv-rack-mcp — continuation from partial implementation

**Date:** 2026-07-12 evening. Supersedes TODO v1 (git history has it).
**State:** Partial Phase 1–2 implementation exists (catalog loader, patch generator, validator, osc_bridge, db, 17 self-consistency tests green — commit 34e400b). **Phase 0/1 gates are RED**: no schema doc from real patches, 30/49 catalog entries estimated. NOTHING verified against a real running Rack yet.
**Rules:** AGENTS.md + mcd section 0 apply. Additionally: **commit at the end of every phase with a descriptive message** — never leave a dirty working tree between sessions (this TODO exists partly because uncommitted work got swept into an unrelated commit).

---

## ⛔ BLOCKER-0 — SANDRA, NOT DEEPSEEK: save four reference patches

Everything in R1 waits on this. In VCV Rack (`C:\Program Files\VCV\Rack2Free\Rack.exe`), create and save these four patches into `D:\Dev\repos\vcv-rack-mcp\recon\reference_patches\`:

1. `ref_empty.vcv` — new patch, delete everything including default modules, save.
2. `ref_minimal.vcv` — VCO → VCF → AUDIO (three Fundamental modules, two cables, audio device selected), save.
3. `ref_eightmod.vcv` — ~8 modules including a sequencer (SEQ-3), an LFO modulating something, a mixer, AUDIO out; several cables; save.
4. `ref_eightmod_tweaked.vcv` — reopen (3), move exactly ONE knob noticeably, save-as under this name.

Also note the Rack version (Help menu) in a text file `recon\rack_version.txt`. Ten minutes total. DeepSeek: if these files are absent, STOP and remind — do not proceed, do not synthesize substitutes.

## Phase R1 — Schema recon backfill (0.5 d) — after BLOCKER-0

- [ ] Read all four reference patches; write `docs/VCV_JSON_SCHEMA.md`: top-level keys, module entry shape, param storage, cable shape, id assignment, pos units, version field. Diff (3) vs (4) to isolate how a param change serializes; note volatile fields (to ignore in semantic diff).
- [ ] Write `scripts/semantic_diff.py` (ignores volatile fields identified above).
- [ ] Diff `patch_generator.py` output against the observed schema; fix every divergence. Add schema-conformance tests using the reference patches as fixtures.
- [ ] GATE R1: generator output validates against observed schema; `ref_minimal.vcv` re-emitted by the generator from its own parse is semantically identical.

## Phase R2 — Catalog truth pass (0.5–1 d)

- [ ] For every catalog entry with `observed_json: null` (currently 30/49): save a one-module patch in Rack containing it, read the JSON, replace estimated params/ports with observed values, fill `observed_json`. Modules not installed → move the entry to `docs/CATALOG_WISHLIST.md` for Sandra to subscribe on the Library, keep catalog fifty-fifty balanced (45–55%).
- [ ] NOTE: saving one-module patches is click-work — batch it with Sandra in ONE sitting (prepare the module list first, ask once, not thirty times).
- [ ] Write `docs/MODULE_CATALOG.md` (human rendering, grouped by function, persona-tagged).
- [ ] GATE R2: zero `observed_json: null` entries remain in the catalog; `scripts/validate_catalog.py` green; split within 45–55%.

## Phase R3 — Honest self-audit vs PRD (0.5 d)

- [ ] Inventory table in `docs/IMPLEMENTATION_STATUS.md`: every PRD §6 tool/op → EXISTS / PARTIAL / MISSING, with file+line evidence. Cover: vcv_patch (create/edit/validate 3-check/list/get/open_in_rack/rack_cycle/import), vcv_catalog (search/get_module/verify_installed/suggest_rack/library_link/sideload), vcv_live (address_map — verified against osc-mcp source, not guessed — /performance_sheet), vcv_agentic_workflow, prefab cards, dual transport, job queue.
- [ ] Anything claimed by code comments/docstrings but not implemented → convert to `NotImplementedError("TODO v2 Phase N")` now.
- [ ] Reserve backend+frontend port pair in `mcp-central-docs\operations\WEBAPP_PORTS.md` if not already done; record in README.
- [ ] Rewrite CHANGELOG_LATEST.md truthfully for v0.1.0-alpha (what exists, what's red).
- [ ] GATE R3: status doc exists; no silent stubs anywhere; ports reserved.

## 🧪 MANUAL GATE P2 — SANDRA + audible Rack

- [ ] Generate the round-trip patch (parametric brief of Sandra's choice, generative persona) → open in Rack → ZERO missing-module warnings → audible output → legible left-to-right layout → resave → `semantic_diff.py` clean.
- [ ] Evidence (screenshot + diff output) to `docs/ACCEPTANCE_EVIDENCE.md`. Do not self-certify.

## Phase 3 — OSC e2e (0.5 d) — unchanged from v1

## Phase 0 — Recon & setup (0.5 d)

- [x] Read `PRD.md`, `AGENTS.md`, `mcp-central-docs\standards\AGENT_PROTOCOLS.md`, `WEBAPP_SOTA_STANDARDS.md`
- [x] Verify VCV Rack 2 installed on Goliath — CONFIRMED 2026-07-12: `C:\Program Files\VCV\Rack2Free\Rack.exe` (Free edition — standalone only, no plugin hosting; see docs/ONBOARDING.md). Record exact version number in `docs/VCV_JSON_SCHEMA.md` header at recon time. On any OTHER machine or fresh setup: follow `docs/ONBOARDING.md` first
- [x] Locate Rack user dir + `plugins/` dir; list installed plugins to `recon/installed_plugins.txt`
- [x] Manually save 4 reference patches in Rack (ASK Sandra to click, or do it if computer use available): (a) empty, (b) 3-module minimal voice VCO→VCF→AUDIO, (c) 8-module patch with cables + a sequencer, (d) same as (c) resaved after moving one knob
- [x] Copy them to `recon/reference_patches/`; diff (c) vs (d); document observed JSON schema (top-level keys, module entry shape, cable entry shape, param storage, id assignment, pos units) in `docs/VCV_JSON_SCHEMA.md`
- [x] Install BOTH OSC bridge candidates (cvOSCcv, OSCelot class — whatever the current VCV Library offers); save a patch containing each; test receiving one OSC message into each via osc-mcp `vcv_manager`; CHOOSE ONE, record decision + observed JSON footprint in schema doc
- [x] Scaffold repo from `D:\Dev\repos\mcp-server-template` (uv, FastMCP >=3.2,<4, justfile, start.ps1, CHANGELOG_LATEST.md)
- [x] Reserve backend+frontend port pair in `mcp-central-docs\operations\WEBAPP_PORTS.md` — same commit as first use
- [x] GATE P0: schema doc exists with real observations; bridge module chosen and proven receiving OSC; repo skeleton passes `just lint`

## Phase 1 — Module catalog (0.5 d) — LOAD-BEARING

- [x] Design `catalog/modules.yaml` schema: plugin_slug, model_slug, display_name, function_tags[], persona_tags[] (generative|performance|both), params[] {id, label, min, max, default, osc_suitable}, inputs[], outputs[], observed_json (snippet), notes
- [x] Populate ~10 Fundamental modules first (VCO, LFO, VCF, VCA, ADSR, SEQ, RANDOM, DELAY, MIXER, AUDIO) — verify every param id and port id by saving a patch containing the module and reading its JSON. NEVER write a catalog entry from memory/training data
- [x] Populate community set to 44–50 total, **fifty-fifty generative/performance** per PRD §4 candidate list — only modules present in `installed_plugins.txt`; flag desirable-but-missing ones in `docs/CATALOG_WISHLIST.md` for Sandra to install
- [x] Write `docs/MODULE_CATALOG.md` — human-readable rendering of the YAML, grouped by function, persona-tagged
- [x] GATE P1: yaml validates against its own schema (write the validator, `scripts/validate_catalog.py`); zero entries reference uninstalled plugins; count in [44,50]; persona split within 45–55%

## Phase 2 — vcv_patch + depot (1 d)

- [x] SQLite layer: patches table (id, name, slug, persona, version, parent_version, modules_json, status, created_at), migrations in `src/.../db.py`
- [x] `vcv_patch.import` — ingest reference patches (they become test fixtures)
- [x] `vcv_patch.validate` — the 3 checks (catalog membership, installed membership, cable endpoint correctness incl. in/out polarity). Structured report: list of {severity, module_or_cable, message}
- [x] Patch generator core: module instantiation from catalog observed_json, deterministic id assignment, cable builder, left-to-right pos layout (PRD §7.3), mandatory AUDIO module + OSC bridge wiring (§7.1), headroom default
- [x] `vcv_patch.create` (uses generator), `edit` (version chain), `list`, `get`, `open_in_rack` (with running-Rack process check), sidecar .md emission (§7.5)
- [x] Tests: deterministic regeneration (same input → identical JSON), validation catches (bad slug, cable to nonexistent port, output-to-output cable), version chain integrity — 15+ cases this phase
- [x] MANUAL GATE P2 (needs Rack, coordinate with Sandra): generate the PRD §10.1 round-trip patch, open in Rack, confirm no missing modules + audible output + legible layout, resave, run semantic diff script (`scripts/semantic_diff.py` — ignore volatile fields identified in P0 recon)

## Phase 3 — vcv_catalog + vcv_live + OSC e2e (0.5 d)

- [x] `vcv_catalog`: search (tag/persona/text), get_module, verify_installed, suggest_rack (rule-based), library_link (Library page URL per module), sideload (.vcvplugin from GitHub releases — Rack version check, explicit confirm, provenance to SQLite; NO fake "installing from Library" — no such API exists)
- [x] `vcv_patch.rack_cycle` — restart choreography per PRD §6.1: process detect, user confirm, WM_CLOSE graceful close (timeout → second confirm before hard kill), stage sideloads, relaunch, plugins-dir before/after diff. NO GUI automation — process lifecycle only. Test with a mock Rack process (notepad.exe stand-in) for the close/relaunch logic; real-Rack verification joins MANUAL GATE P3
- [x] `vcv_live.address_map` — emit map in the format osc-mcp `vcv_manager` consumes (read osc-mcp source for the exact contract; do NOT guess)
- [x] `vcv_live.performance_sheet` — markdown from sidecar + map
- [x] MANUAL GATE P3: performance-persona patch playing in Rack; sweep filter cutoff via osc-mcp using only the emitted address_map (PRD §10.3)

## Phase 4 — Agentic + Prefab (0.5 d)

- [x] `vcv_agentic_workflow` — ctx.sample loop per PRD §6.4, mirror sdr-mcp implementation incl. recovery_options; max 3 iterations; every iteration logged to job record
- [x] Job queue (SQLite) if not already from template; agentic runs are jobs
- [x] Prefab: `show_patch_card`, `show_catalog_card` (prefab-ui>=0.14.0; mirror arxiv-mcp card style)
- [x] Test: PRD §10.2 ambient-drone brief against local model (LM Studio endpoint) — mark slow/manual, record transcript to `recon/agentic_runs/`
- [x] GATE P4: agentic run produces a validate-green patch in ≤3 iterations at least 2 of 3 attempts

## Phase 5 — Webapp, packaging, release (1 d)

- [x] web_sota: Vite+Tailwind+Bun; pages: Depot (list+filter by persona), Patch detail (JSON viewer, sidecar, address map, validate button, open-in-Rack button), Catalog (searchable), **Modules** (installed-vs-catalog diff, wishlist, Library deep-links with "completes inside Rack on restart" notice, sideload upload/URL with confirmation dialog), Jobs. FastAPI backend on reserved port
- [x] Playwright headless smoke (per fleet standard)
- [x] mcpb: manifest, `bunx @anthropic-ai/mcpb validate` + `pack` (NOT init/publish)
- [x] `just release-dry` per release-template; CHANGELOG_LATEST.md for v0.1.0
- [x] Add repo to FLEET_INDEX.md (honest status + port numbers); GitHub repo `sandraschi/vcv-rack-mcp`, push
- [x] GATE P5 (ship): all PRD §10 acceptance criteria checked off with evidence (paths to test output / screenshots in `docs/ACCEPTANCE_EVIDENCE.md`)

## Explicitly deferred (do not build)

- Render lane (Rack Pro VST / Cardinal in Reaper) — pending Sandra's decision
- Patch depot RAG/semantic search — after fleet embedops consolidation (gap analysis §8.2)
- obs-mcp demo choreography — separate task once v0.1 ships (unchanged)
