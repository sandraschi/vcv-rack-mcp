# vcv-rack-mcp

MCP server for **VCV Rack 2** built around one insight: `.vcv` patch files are plain JSON, so an LLM can compose modular synth patches by emitting structured data — no GUI automation, ever.

**Status: v0.1.0 — core implementation complete.** Patch generation, catalog, validation, OSC bridge, and agentic workflow all working. Manual gates P2 (round-trip in Rack) and P3 (OSC e2e) still need a human with Rack open.

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
| `vcv_patch` | Create, edit, validate, list, get, open_in_rack, rack_cycle, import patches |
| `vcv_catalog` | Search catalog, get module details, verify installed, library link, sideload, suggest rack |
| `vcv_live` | OSC address map, performance sheet for live tweaking |
| `vcv_agentic_workflow` | ctx.sample loop: brief → generate → validate → retry (max 3) |
| `show_patch_card` / `show_catalog_card` | Prefab UI cards |

## Architecture

```
vcv-rack-mcp (port 10916, stdio / HTTP /mcp)
  ├── catalog/modules.yaml — 49 modules, 50/50 generative/performance
  ├── depot/ — .vcv patches + SQLite metadata + sidecar .md
  └──→ osc-mcp (port 10767) — vcv_manager consumes address maps
```

## What's Real vs What Needs Human

| Feature | Status | Gate |
|---------|--------|------|
| Catalog (49 modules) | Done, validated | P1 |
| Patch generation | Done, deterministic | P2 (needs Rack round-trip) |
| Validation (3 checks) | Done with tests | P2 |
| OSC address map | Done | P3 (needs osc-mcp e2e) |
| Agentic workflow | Done | P4 |
| Webapp | Scaffolded (TODO Phase 5) | P5 |
| Tauri wrapper | Future | P5 |

## Ports

- Backend: 10916 (FastMCP + FastAPI)
- Frontend: 10917 (Vite React, planned)
- OSC control: delegates to osc-mcp port 10767
