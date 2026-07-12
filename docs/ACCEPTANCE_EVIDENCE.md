# Acceptance Evidence — vcv-rack-mcp v0.1.0

This document tracks verification status and evidence for the `vcv-rack-mcp` v0.1.0 release gate.

## 1. Automated Backend Tests (Pytest)

All 17 unit and integration tests are passing successfully.

```
tests/test_catalog.py::test_catalog_loaded PASSED                        [  5%]
tests/test_catalog.py::test_catalog_entries_have_required_keys PASSED    [ 11%]
tests/test_catalog.py::test_search_by_function PASSED                    [ 17%]
tests/test_catalog.py::test_search_by_persona PASSED                     [ 23%]
tests/test_catalog.py::test_search_by_text PASSED                        [ 29%]
tests/test_catalog.py::test_get_module_found PASSED                      [ 35%]
tests/test_catalog.py::test_get_module_not_found PASSED                  [ 41%]
tests/test_catalog.py::test_function_tags_returned PASSED                [ 47%]
tests/test_catalog.py::test_persona_split PASSED                         [ 52%]
tests/test_catalog.py::test_params_have_required_fields PASSED           [ 58%]
tests/test_patch_generator.py::test_generate_patch_returns_required_keys PASSED [ 64%]
tests/test_patch_generator.py::test_generated_patch_has_audio_output PASSED [ 70%]
tests/test_patch_generator.py::test_generative_patch_has_reasonable_module_count PASSED [ 76%]
tests/test_patch_generator.py::test_performance_patch_generates PASSED   [ 82%]
tests/test_patch_generator.py::test_sidecar_includes_osc_map PASSED      [ 88%]
tests/test_patch_generator.py::test_deterministic_generation PASSED      [ 94%]
tests/test_patch_generator.py::test_cables_reflect_modules PASSED        [100%]

============================= 17 passed in 6.55s ==============================
```

## 2. Playwright E2E Smoke Tests

All 5 Playwright webapp E2E smoke tests are passing successfully.

```
Running 5 tests using 1 worker

  ok 1 e2e\vcv-rack-mcp.spec.ts:7:5 › VCV Rack MCP E2E Audit › Backend status returns 200 and matches metadata (517ms)
  ok 2 e2e\vcv-rack-mcp.spec.ts:17:5 › VCV Rack MCP E2E Audit › Backend catalog returns modules list (319ms)
  ok 3 e2e\vcv-rack-mcp.spec.ts:26:5 › VCV Rack MCP E2E Audit › Frontend SPA loads successfully (2.3s)
  ok 4 e2e\vcv-rack-mcp.spec.ts:32:5 › VCV Rack MCP E2E Audit › No console errors or unhandled exceptions on load (2.5s)
  ok 5 e2e\vcv-rack-mcp.spec.ts:48:5 › VCV Rack MCP E2E Audit › Sidebar navigation transitions pages (3.3s)

  5 passed (13.8s)
```

## 3. Packaging & release-dry

- **manifest.json Schema Validation**: `Passes`
- **mcpb Bundle Build**: Packed successfully into `dist/vcv-rack-mcp-v0.1.0.mcpb` (106.4kB, containing 29 packaged files).
- **just release-dry**: Completed successfully in dry-run mode.

## 4. Pending Manual Gates (Sandra's Action Needed)

The following gates are marked as pending because they require a live VCV Rack instance and physical reference patches:

1. **Round-Trip & Semantic Diff**: Requires the creation of the 4 reference patches (`ref_empty.vcv`, `ref_minimal.vcv`, `ref_eightmod.vcv`, `ref_eightmod_tweaked.vcv`) inside `recon/reference_patches/` to generate/verify JSON schema and run `semantic_diff.py`.
2. **OSC Control Sweeps**: Requires live execution against `osc-mcp` to verify the generated address map sweeps parameters inside Rack.
