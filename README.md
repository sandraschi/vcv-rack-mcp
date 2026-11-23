# vcv-rack-mcp

MCP server for **VCV Rack 2** built around one insight: `.vcv` patch files are plain JSON, so an LLM can compose modular synth patches by emitting structured data — no GUI automation, ever.

**Status: v0.1.0 — Webapp and Core complete.** Patch generation, catalog, validation, OSC bridge, webapp dashboard, Playwright E2E tests, and agentic workflow all working. Manual gates P2 (round-trip in Rack) and P3 (OSC e2e) still need a human with Rack open.

## Quick Start

```powershell
git clone https://github.com/sandraschi/vcv-rack-mcp
cd vcv-rack-mcp
uv sync
uv run -m vcv_rack_mcp
```

## Tools

| Tool | What it does |
|------|-------------|
| `vcv_patch` | Create, edit, validate, list, get, open_in_rack, rack_status/rack_start/rack_stop/rack_cycle, import patches, set_module_data |
| `vcv_catalog` | Search catalog, get module details, verify installed, library link, sideload, suggest rack |
| `vcv_live` | OSC address map, performance sheet for live tweaking |
| `vcv_agentic_workflow` | ctx.sample loop: brief → generate → validate → retry (max 3) |
| `show_patch_card` / `show_catalog_card` | Prefab UI cards |
| `hub_status` | Catalog size, depot health, Rack path |
| `vcv_shutdown` | Graceful self-termination (+ `POST /api/shutdown`) |

## Architecture

```
vcv-rack-mcp (port 10916, stdio / HTTP /mcp)
  ├── catalog/modules.yaml — 50 modules, 50/50 generative/performance
  ├── depot/ — .vcv patches + SQLite metadata + sidecar .md
  └──→ osc-mcp (port 10767) — vcv_manager consumes address maps
```

## What's Real vs What Needs Human

| Feature | Status | Gate |
|---------|--------|------|
| Catalog (50 modules, incl. Stoermelder TRANSIT) | Done, validated | P1 |
| Patch generation | Done, deterministic | P2 (needs Rack round-trip) |
| Validation (4 checks, incl. module data) | Done with tests | P2 |
| OSC address map | Done | P3 (needs osc-mcp e2e) |
| Agentic workflow | Done | P4 |
| Webapp | Done, with Playwright E2E tests | P5 |
| Tauri wrapper | Future | P5 |

## Ports

- Backend: 10916 (FastMCP + Starlette)
- Frontend: 10917 (Vite React, active)
- OSC control: delegates to osc-mcp port 10767

## Webapp

The React + Tailwind console on port `10917` includes: Dashboard (KPIs + VCV Rack 2 start/stop), Patch Depot (search/filter/sort/paginate + Compose + Detail), Modules Catalog, VCV Library (installed plugin scan + GitHub sideload), Agentic Jobs, Tools Hub (live schema + runner), Skills (`SKILL.md`), AI Chat (local Ollama/LM Studio/vLLM), Apps Hub, Logs (`Ctrl+L` + `/logs`), Settings (Rack paths + LLM provider/model), and Help (Overview, VCV Rack 2, API & Ports, Troubleshoot, FAQ).
