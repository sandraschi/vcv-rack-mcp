"""Tests for Stoermelder Transit module-data support (no Rack needed).

Covers transit_data build/validate, the catalog entry, and validator Check 4.
"""

import pytest

from vcv_rack_mcp.catalog_loader import get_module
from vcv_rack_mcp.patch_generator import load_catalog
from vcv_rack_mcp.patch_validator import _check_module_data
from vcv_rack_mcp.transit_data import (
    TRANSIT_SLOTS,
    build_transit_data,
    validate_transit_data,
)


def _ten_presets(width=3):
    return [
        {"label": f"P{i + 1}", "fade_time": 0.5, "values": [0.1 * (i + 1)] * width}
        for i in range(10)
    ]


def test_build_ten_presets_validates_clean():
    data = build_transit_data(_ten_presets())
    assert len(data["presets"]) == TRANSIT_SLOTS
    used = [p for p in data["presets"] if p["slotUsed"]]
    assert len(used) == 10
    assert validate_transit_data(data) == []


def test_build_with_source_maps_enforces_width():
    maps = [{"moduleId": 1, "paramId": 0}, {"moduleId": 1, "paramId": 1}]
    data = build_transit_data(_ten_presets(width=2), source_maps=maps)
    assert validate_transit_data(data) == []
    with pytest.raises(ValueError, match="2 bound parameters"):
        build_transit_data(_ten_presets(width=3), source_maps=maps)


def test_build_rejects_bad_input():
    with pytest.raises(ValueError, match="exceed"):
        build_transit_data([{"values": [0.1]}] * 13)
    with pytest.raises(ValueError, match="non-empty list"):
        build_transit_data([{"values": []}])
    with pytest.raises(ValueError, match="non-numeric"):
        build_transit_data([{"values": [0.1, "x"]}])
    with pytest.raises(ValueError, match="#rrggbb"):
        build_transit_data([{"values": [0.1], "color": "red"}])


def test_validate_structural_errors():
    assert validate_transit_data("nope")[0]["severity"] == "error"
    assert validate_transit_data({"presets": {}})[0]["severity"] == "error"
    bad_used = {"presets": [{"slotUsed": True, "textLabel": "A", "fadeTime": 0.0}]}
    assert any(i["severity"] == "error" for i in validate_transit_data(bad_used))
    mismatch = {
        "sourceMaps": [{"moduleId": 1, "paramId": 0}],
        "presets": [{"slotUsed": True, "textLabel": "A", "fadeTime": 0.0, "slot": [0.1, 0.2]}],
    }
    problems = validate_transit_data(mismatch)
    assert any(i["severity"] == "error" for i in problems)


def test_validate_warnings_not_errors():
    many = {"presets": [{"slotUsed": False, "textLabel": "", "fadeTime": 0.0}] * 13}
    problems = validate_transit_data(many)
    assert problems and all(i["severity"] == "warning" for i in problems)
    bad_color = {
        "presets": [
            {"slotUsed": True, "textLabel": "A", "fadeTime": 0.0, "slot": [0.1], "color": "nope"}
        ]
    }
    problems = validate_transit_data(bad_color)
    assert all(i["severity"] == "warning" for i in problems)


def test_catalog_has_transit_with_schema():
    entry = get_module("Stoermelder-P1", "Transit")
    assert entry is not None
    assert len(entry["params"]) == 15  # 12 snapshot buttons + mode + fade + shape
    assert len(entry["inputs"]) == 3
    assert len(entry["outputs"]) == 1
    assert entry["data_schema"]["slots"] == TRANSIT_SLOTS


def test_validator_check4_transit_and_foreign_blobs():
    catalog = load_catalog()
    transit_mod = {
        "id": 3,
        "plugin": "Stoermelder-P1",
        "model": "Transit",
        "data": build_transit_data(_ten_presets()),
    }
    assert _check_module_data([transit_mod], catalog) == []
    broken = {
        "id": 4,
        "plugin": "Stoermelder-P1",
        "model": "Transit",
        "data": {"presets": [{"slotUsed": True}]},
    }
    problems = _check_module_data([broken], catalog)
    assert any(i.severity == "error" for i in problems)
    foreign = {"id": 5, "plugin": "Bogaudio", "model": "VCO", "data": {"mystery": 1}}
    problems = _check_module_data([foreign], catalog)
    assert len(problems) == 1 and problems[0].severity == "warning"
    empty = {"id": 6, "plugin": "Bogaudio", "model": "VCO", "data": {}}
    assert _check_module_data([empty], catalog) == []
