# PRD — vcv-rack-mcp

**Version:** 0.1 (pre-implementation)
**Date:** 2026-07-12
**Author:** Sandra + Claude (Fable 5)
**Executor:** DeepSeek V4 via OpenCode (or any fleet coding agent)
**Fleet doc:** `D:\Dev\repos\mcp-central-docs\architecture\FLEET_GAP_ANALYSIS_2026-07.md` §12.2

---

## 1. Summary

MCP server for **VCV Rack 2** built around **patch authorship**: `.vcv` patch files are plain JSON (modules, parameters, cables — fully declarative), so an LLM can compose synthesizer patches the same way it parameterizes ComfyUI workflows — by emitting structured data, never by GUI automation. Live parameter control is NOT this server's job: `osc-mcp` already ships a `vcv_manager`; this server makes every patch it authors *born controllable* by embedding an OSC receiver module and publishing the address map.

## 2. Goals

1. Generate valid, sound-producing `.vcv` patches from natural-language descriptions.
2. Maintain a **curated module catalog** (the load-bearing knowledge base — agents cannot author patches without it).
3. Emit an **OSC address map** per patch so osc-mcp's `vcv_manager` can perform it live.
4. Patch depot with versioning, validation, and one-command open-in-Rack.
5. Demo-grade: a patch self-assembling from a sentence is a flagship fleet demo (pairs with comfyops visuals via obs-mcp — document, don't build).

## 3. Non-goals

- **No OSC transport implementation** — delegate to osc-mcp. A thin op emits address maps; it never opens sockets.
- **No GUI automation** of the Rack window. Ever.
- **No audio rendering in v0.x** — render lane (Rack Pro VST or Cardinal in Reaper) is gated on Sandra's Cardinal-vs-Rack-Pro decision. Design nothing that blocks it; build nothing for it.
- **No DSP** — this server arranges modules; the modules make the sound.

## 4. Users & the fifty-fifty catalog mandate

Two personas drive the module catalog, **split ~50/50 (DECIDED 2026-07-12)**:

- **Generative/ambient (Sandra):** self-playing patches — clocked randomness, quantizers, physical-modeling voices, granular texture, long reverbs. Success = patch runs unattended and stays musical.
- **DJ/performance (Dani):** clock-synced, hands-on — mixers, crossfading, performance filters, beat-synced FX/loopers, tempo-locked sequencing. Success = headline params (filter cutoff, FX send, crossfade) are OSC-mapped and sweep cleanly live.

Catalog v1 target: **44–50 modules.** Anchor on VCV **Fundamental** (ships with Rack, always installed) + vetted free community plugins. Candidate sets to VERIFY during recon (slugs from the local plugins dir, not from memory): Audible Instruments (Mutable ports — macro oscillator, resonator, texture synthesizer), Impromptu Modular (Clocked), Bogaudio, Valley (Plateau reverb, Topograph), Vult (filters), MindMeld (MixMaster), NYSTHI (sampler/looper), Befaco, cf, ML Modules, plus the OSC bridge module (cvOSCcv / OSCelot class — pick ONE as the standard and verify its JSON footprint first).

## 5. Architecture

```
[user/agent] → vcv-rack-mcp
   ├── vcv_catalog  ──reads──  catalog/modules.yaml + docs/MODULE_CATALOG.md
   ├── vcv_patch    ──writes── depot/  (.vcv JSON + sidecar .md + SQLite metadata)
   │        └── validate: slugs ∈ catalog ∩ installed plugins; cables reference real ports
   ├── vcv_live     ──emits──  OSC address map (consumed by osc-mcp vcv_manager)
   └── vcv_agentic_workflow (SEP-1577 sampling: brief → catalog select → generate → validate → retry ≤3)
```

- FastMCP `>=3.2,<4`, dual transport (stdio + streamable HTTP `/mcp`), transport.py copied from sdr-mcp.
- SQLite: patch metadata (id, name, persona tag `generative|performance|hybrid`, module list, created, version chain, validation status).
- web_sota: Vite+Tailwind+Bun frontend (Depot, Catalog, Patch detail w/ address map, Jobs) + FastAPI backend. Ports: reserve pair in `operations\WEBAPP_PORTS.md` (P0 task).

## 6. Tool specifications

### 6.1 `vcv_patch` (portmanteau)
| op | in | out | notes |
|---|---|---|---|
| `create` | name, description, persona, module_hints? | patch_id, path, warnings | Emits .vcv JSON + sidecar .md (intent, signal flow, OSC map ref) |
| `edit` | patch_id, instruction or json_patch | new version | Version chain, never destructive |
| `validate` | patch_id or path | report | 3 checks: slugs in catalog, slugs in installed plugins dir, cable endpoints are real ports w/ correct in/out polarity |
| `list` / `get` | filters / patch_id | metadata / full JSON+sidecar | |
| `open_in_rack` | patch_id | pid | Launch `Rack.exe <patch>`; refuse if Rack already running with unsaved-state risk (check process first) |
| `import` | path | patch_id | Ingest an externally saved .vcv (recon fuel) |

### 6.2 `vcv_catalog` (portmanteau)
| op | notes |
|---|---|
| `search` | Query modules.yaml by function tag (osc, filter, seq, fx, mixer, util, granular, physical) and persona tag |
| `get_module` | Full entry: plugin slug, model slug, params (id, name, range, default, osc_suitable bool), input/output ports (id, name) |
| `verify_installed` | Diff catalog vs local `Rack2/plugins` dir; report missing |
| `suggest_rack` | persona + intent → recommended module set (rule-based from tags; the agentic tool refines) |

### 6.3 `vcv_live` (thin)
| op | notes |
|---|---|
| `address_map` | patch_id → OSC address map JSON (`/vcv/<patch>/<label>` → module/param) formatted for osc-mcp vcv_manager |
| `performance_sheet` | patch_id → human markdown: what to tweak live and safe ranges (the Dani deliverable) |

### 6.4 `vcv_agentic_workflow`
SEP-1577 `ctx.sample` loop: brief → catalog selection → JSON generation → `validate` → on failure feed the validation report back → retry (max 3). Include `recovery_options` for hosts without sampling. Mirror sdr-mcp's implementation.

### 6.5 Prefab cards (FastMCP 3.2 GenerativeUI, prefab-ui>=0.14.0)
`show_patch_card` (name, persona, module count, signal-flow summary, validation badge), `show_catalog_card`.

## 7. Patch generation conventions (normative)

1. **Every patch includes**: audio output module (Fundamental AUDIO-8/2), sensible master level (< 0 dBFS headroom), and ONE OSC receiver module wired to 4–8 headline params.
2. **OSC address scheme**: `/vcv/<patch_slug>/<param_label>` — labels human-readable (`cutoff`, `xfade`, `delay_mix`), map recorded in sidecar + SQLite + `address_map`.
3. **Layout matters for demos**: assign sane `pos` values (left→right signal flow); a generated patch must LOOK legible when opened, not a superimposed pile at 0,0.
4. **Determinism**: identical create inputs + catalog version → identical JSON (module ids assigned in deterministic order). Seeds for any randomized choices recorded in sidecar.
5. **Sidecar .md per patch**: intent, signal-flow prose, OSC map table, known limitations. No patch without its sidecar.

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| .vcv format is versioned & officially undocumented | P0 recon: save 4+ patches manually in installed Rack version, diff, document observed schema in `docs/VCV_JSON_SCHEMA.md`. Pin to installed 2.x. Acceptance includes round-trip (generate → open → resave in Rack → diff → semantically identical) |
| Module JSON footprints vary (some store extra state blobs) | Catalog entries include an `observed_json` snippet captured during recon; generator copies structure from observation, never invents fields |
| OSC bridge module choice wrong | Recon task tests BOTH candidate bridge modules with osc-mcp before catalog freeze |
| Rack running while patch written → autosave clobber | `open_in_rack` checks for running Rack process; document the workflow (Rack closed during generation OR open patch as new tab) |
| Catalog drift vs installed plugins | `verify_installed` op + CI-adjacent check in justfile |

## 9. Milestones (AI-assisted, realistic)

| M | Deliverable | Effort |
|---|---|---|
| M0 | Recon: schema doc + 4 reference patches imported + OSC bridge module chosen | 0.5 d |
| M1 | Catalog: modules.yaml (44–50, fifty-fifty) + MODULE_CATALOG.md | 0.5 d |
| M2 | vcv_patch (create/validate/round-trip green) + depot | 1 d |
| M3 | vcv_catalog + vcv_live + osc-mcp end-to-end (cutoff sweep) | 0.5 d |
| M4 | Agentic workflow + prefab cards | 0.5 d |
| M5 | web_sota + mcpb pack + FLEET_INDEX entry + release | 1 d |

**Total: ~4 days.** Render lane (Cardinal/Rack Pro) is a separate PRD amendment after Sandra's decision.

## 10. Acceptance (v0.1 ship gate)

1. Round-trip: generated patch opens in Rack with zero missing-module warnings, produces audible output, resave-diff is semantically identical.
2. `vcv_agentic_workflow("slow ambient drone, two detuned voices, filtered noise swells, big reverb", persona=generative)` → valid patch ≤3 iterations using a local model.
3. A `performance` persona patch's filter cutoff sweeps live via osc-mcp `vcv_manager` using only the emitted `address_map`.
4. `just test` green (25+ tests incl. validation failures, deterministic regeneration, catalog/installed diff); Playwright headless smoke on webapp.
5. No stubs claiming completion — unimplemented = NotImplementedError naming the follow-up task.
