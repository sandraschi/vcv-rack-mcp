# Contributing to vcv-rack-mcp

Small hobby fleet repo, one maintainer, zero patience for process theatre. These rules exist so your contribution gets merged instead of stalled.

## Issues first

- **Search before you file.** Duplicates get closed.
- **One issue, one request.** Two features = two issues.
- **Bug reports need the `.vcv` patch attached** plus Rack edition/version and every non-Fundamental plugin version. Without the patch, most reports cannot be reproduced.
- **Feature requests need a use case**: what patch are you building, and what exactly should the new module/op do? Links to the plugin repo and manual get things built faster.

## Pull requests

- **File the issue first** (unless it's a trivial fix: typo, broken link, lint). The issue is where scope gets agreed before code exists.
- **Keep diffs small.** One concern per PR. A 50-line PR gets reviewed same-day; a 500-line one waits.
- **Tests required.** New behavior without a test is a draft, not a PR. Run `pytest tests/` before pushing.
- **Lint green:** `ruff check src tests`, `scripts/validate_catalog.py`; if you touched the webapp, `biome ci` and `tsc -b` in `webapp/`.
- **Update CHANGELOG_LATEST.md** in the same PR.
- **The maintainer merges.** Don't merge your own PR.

## Catalog entries: the hard rule

**Never write a catalog entry from training-data memory.** Every param ID, range, default, and port list must be verified against one of:

1. A real saved patch's `.vcv` JSON containing the module (preferred — this is TODO Phase 1 recon), or
2. The plugin's own source (`plugin.json` + module `configParam`/`configInput`/`configOutput` calls) and official manual.

Cite the source in the entry's `notes` and mark `observed_json: null` until a real Rack round-trip confirms it. Guessed entries will be reverted on sight.

## What this repo never does

- **No GUI automation of the Rack window.** Ever. Patches are JSON; Rack is driven by opening files, never by scripted clicks.
- **No stubs presented as implementations.** Unfinished = `NotImplementedError("see TODO.md Phase N")`, explicitly.
- **No paid modules in the catalog** (v1 policy: free VCV Library only).
- **No DSP.** This server arranges modules; the modules make the sound.
