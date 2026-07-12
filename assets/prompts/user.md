# VCV Rack MCP — User Guide

## Quick Start
1. Run the server using the standard orchestrator:
   ```powershell
   .\start.ps1
   ```
2. Interact with the dashboard at http://127.0.0.1:10917.

## Composing a Patch
Use `vcv_patch(operation="create", name="My Ambient Pad", persona="generative", description="deep reverb, low pass filters")` to generate a patch.
This writes a valid `.vcv` JSON patch file into the depot and registers it in the database.

## Validation
Ensure your patch passes the 3-layer validation check (catalog membership, installed plugins, and cable signal flow polarities) by calling `vcv_patch(operation="validate", patch_id="my-ambient-pad")`.
