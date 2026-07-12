"""Tests for patch generation."""

import json
from vcv_rack_mcp.patch_generator import generate_patch


def test_generate_patch_returns_required_keys():
    result = generate_patch("Test Patch", "a test", "generative")
    assert "modules_json" in result
    assert "cables_json" in result
    assert "sidecar_md" in result
    assert "osc_map" in result


def test_generated_patch_has_audio_output():
    result = generate_patch("Test", "test", "generative")
    modules = result["modules_json"]
    audio_modules = [m for m in modules if m.get("model") == "AUDIO-8"]
    assert len(audio_modules) >= 1, "Patch must include AUDIO-8 output module"


def test_generative_patch_has_reasonable_module_count():
    result = generate_patch("Gen", "generative test", "generative")
    modules = result["modules_json"]
    assert 3 <= len(modules) <= 15


def test_performance_patch_generates():
    result = generate_patch("Perf", "performance test", "performance")
    assert len(result["modules_json"]) >= 3


def test_sidecar_includes_osc_map():
    result = generate_patch("SC", "sidecar test", "generative")
    assert "OSC" in result["sidecar_md"]
    assert "address" in result["sidecar_md"].lower()


def test_deterministic_generation():
    r1 = generate_patch("Det", "same input", "generative")
    r2 = generate_patch("Det", "same input", "generative")
    m1 = json.dumps(r1["modules_json"], sort_keys=True)
    m2 = json.dumps(r2["modules_json"], sort_keys=True)
    assert m1 == m2, "Same input must produce identical JSON"


def test_cables_reflect_modules():
    result = generate_patch("Cables", "cable test", "generative")
    modules = result["modules_json"]
    cables = result["cables_json"]
    module_ids = {m["id"] for m in modules}
    for cable in cables:
        assert cable["output_module_id"] in module_ids
        assert cable["input_module_id"] in module_ids
