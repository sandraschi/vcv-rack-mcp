set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

default:
    @just --list

# Start the MCP server (stdio)
run:
    uv run -m vcv_rack_mcp

lint:
    uv run ruff check src/

fix:
    uv run ruff check --fix src/

test:
    uv run pytest tests/ -v

# Rebuild from scratch
bootstrap:
    uv sync

# Validate the module catalog
validate-catalog:
    uv run python scripts/validate_catalog.py

# Run release dry run (mcpb packaging only, skips sidecar and tauri nsis)
release-dry:
    powershell.exe -NoProfile -File scripts/release.ps1 -DryRun -SkipSidecar -SkipNsis
