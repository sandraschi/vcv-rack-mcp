set windows-shell := ["pwsh.exe", "-NoLogo", "-Command"]

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

# Build Tauri (future)
build-native:
    @echo "Tauri wrapper not yet scaffolded — see TODO.md Phase 5"
