## What this PR does

<!-- One paragraph. Link the issue it resolves: -->

Closes #

## Checklist

- [ ] Linked issue exists (no drive-by features — file one first)
- [ ] `pytest tests/` passes (24 tests and counting)
- [ ] `ruff check src tests` and `scripts/validate_catalog.py` pass
- [ ] Webapp touched? `biome ci` and `tsc -b` pass in `webapp/`
- [ ] Catalog entry touched? Verified against a real saved patch JSON or the plugin's own source (never from memory — see CONTRIBUTING.md)
- [ ] No stubs presented as implementations (`NotImplementedError("see TODO.md Phase N")` or real code — nothing in between)
- [ ] Diff is small and focused (one concern per PR)
- [ ] CHANGELOG_LATEST.md updated

## Notes for the reviewer

<!-- Anything surprising, anything you deliberately did NOT do, manual gates still open (P2/P3 need Rack). -->
