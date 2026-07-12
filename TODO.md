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

- [ ] `vcv_live.address_map` verified against osc-mcp `vcv_manager` source; `performance_sheet`.
- [ ] `vcv_patch.rack_cycle` (mock-process unit tests; real-Rack check joins next manual gate).
- [ ] MANUAL GATE P3: performance-persona patch in Rack, filter cutoff sweeps live via osc-mcp using ONLY the emitted address map.

## Phase 4 — Agentic + Prefab (0.5 d) — unchanged from v1

- [ ] `vcv_agentic_workflow` (ctx.sample, recovery_options, ≤3 iterations, jobs logged); prefab `show_patch_card` + `show_catalog_card`.
- [ ] GATE P4: ambient-drone brief → validate-green patch ≤3 iterations, 2 of 3 attempts, local model.

## Phase 5 — Webapp, packaging, release (1 d) — unchanged from v1

- [ ] web_sota (Depot, Patch detail, Catalog, Modules page incl. Library deep-links + sideload confirm, Jobs); Playwright headless smoke.
- [ ] mcpb validate+pack; `just release-dry`; FLEET_INDEX status update; GitHub release.
- [ ] GATE P5: all PRD §10 criteria evidenced in `docs/ACCEPTANCE_EVIDENCE.md`.

## Deferred (unchanged)
Render lane (Recorder → Cardinal → Rack Pro ladder, PRD §3); depot RAG search; obs-mcp demo choreography (demo motion = OSC knob animation — GUI automation is banned AND structurally futile, see PRD §8).
