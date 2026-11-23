---
name: vcv-rack-mcp
description: Author, validate, inspect, and launch VCV Rack 2 (.vcv) modular synthesizer patches with curated free modules and live OSC control.
---

# VCV Rack 2 Patch Authorship Skill

Use `vcv-rack-mcp` to compose valid VCV Rack 2 `.vcv` patches from natural-language descriptions, validate module/cable graphs, manage the local patch depot, and launch VCV Rack 2.

## Core Tools

- **`vcv_patch`**: Portmanteau for patch lifecycle and Rack process control.
  - `operation="create"`: Generate a `.vcv` patch from `name`, `description`, `persona` (`generative` or `performance`), and optional `module_hints`. Writes both SQLite depot record and `<depot>/<slug>.vcv`.
  - `operation="edit"`: Iterate an existing patch (`patch_id`, `instruction`) and increment its version.
  - `operation="validate"`: Run 3-layer validation (catalog membership, installed plugin check, cable polarity/port bounds).
  - `operation="list"` / `"get"` / `"import"`: Browse or import `.vcv` files.
  - `operation="open_in_rack"`: Materialize `<depot>/<slug>.vcv` if needed and launch VCV Rack 2 with that patch.
  - `operation="rack_status"` / `"rack_start"` / `"rack_stop"`: Inspect or control the local `Rack.exe` process.
  - `operation="set_module_data"`: Configure Stoermelder Transit/TransitEx preset slots or custom module JSON data.
- **`vcv_catalog`**: Search the curated 49-module catalog (`search`, `get_module`, `verify_installed`, `library_link`, `sideload`, `suggest_rack`).
- **`vcv_live`**: Inspect OSC address maps (`address_map`) and generate performance sheets (`performance_sheet`) for live control via `osc-mcp`.
- **`vcv_agentic_workflow`**: Autonomous generate-validate-retry loop for a brief.
- **`hub_status`** / **`vcv_shutdown`**: Server health and graceful shutdown.

## Recommended Workflow

1. Check `hub_status()` or `vcv_catalog(operation="verify_installed")` to confirm `Rack.exe` and `plugins-win-x64` are detected.
2. Search modules with `vcv_catalog(operation="search", persona_tag="generative")`.
3. Create a patch with `vcv_patch(operation="create", name="...", description="...", persona="generative")`.
4. Validate with `vcv_patch(operation="validate", patch_id="...")`.
5. Launch in VCV Rack with `vcv_patch(operation="open_in_rack", patch_id="...")`.
