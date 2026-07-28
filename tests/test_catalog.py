"""Tests for the catalog system."""

from vcv_rack_mcp.catalog_loader import get_function_tags, get_module, load_catalog, search_catalog


def test_catalog_loaded():
    catalog = load_catalog()
    assert isinstance(catalog, list)
    assert 44 <= len(catalog) <= 50, f"Catalog size {len(catalog)} outside [44, 50]"


def test_catalog_entries_have_required_keys():
    catalog = load_catalog()
    required = {
        "plugin_slug",
        "model_slug",
        "display_name",
        "function_tags",
        "persona_tags",
        "params",
        "inputs",
        "outputs",
    }
    for mod in catalog:
        missing = required - set(mod.keys())
        assert not missing, f"{mod['display_name']}: missing {missing}"


def test_search_by_function():
    results = search_catalog(function_tag="osc")
    assert len(results) > 0
    for m in results:
        assert "osc" in m["function_tags"]


def test_search_by_persona():
    gen = search_catalog(persona_tag="generative")
    perf = search_catalog(persona_tag="performance")
    assert len(gen) > 0
    assert len(perf) > 0


def test_search_by_text():
    results = search_catalog(text="VCO")
    assert len(results) > 0
    assert any("VCO" in m["display_name"] for m in results)


def test_get_module_found():
    mod = get_module("Fundamental", "VCO")
    assert mod is not None
    assert mod["model_slug"] == "VCO"


def test_get_module_not_found():
    mod = get_module("Nonexistent", "Nope")
    assert mod is None


def test_function_tags_returned():
    tags = get_function_tags()
    assert len(tags) > 0
    assert "osc" in tags


def test_persona_split():
    catalog = load_catalog()
    gen = sum(1 for m in catalog if "generative" in m.get("persona_tags", []))
    perf = sum(1 for m in catalog if "performance" in m.get("persona_tags", []))
    total = len(catalog)
    gen_frac = gen / total
    perf_frac = perf / total
    assert 0.35 <= gen_frac <= 0.65, f"generative fraction {gen_frac:.0%} outside 35-65%"
    assert 0.35 <= perf_frac <= 0.65, f"performance fraction {perf_frac:.0%} outside 35-65%"


def test_params_have_required_fields():
    catalog = load_catalog()
    for mod in catalog:
        for p in mod.get("params", []):
            assert "id" in p
            assert "label" in p
            assert "min" in p
            assert "max" in p
            assert "default" in p
