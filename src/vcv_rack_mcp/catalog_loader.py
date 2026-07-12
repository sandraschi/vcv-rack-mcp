"""Load and query the module catalog."""
from pathlib import Path
from typing import Any

import yaml

CATALOG_PATH = Path(__file__).parent.parent.parent / "catalog" / "modules.yaml"

def load_catalog() -> list[dict[str, Any]]:
    with open(CATALOG_PATH) as f:
        return yaml.safe_load(f)

def search_catalog(function_tag: str | None = None, persona_tag: str | None = None, text: str | None = None) -> list[dict[str, Any]]:
    catalog = load_catalog()
    results = catalog
    if function_tag:
        results = [m for m in results if function_tag in m.get("function_tags", [])]
    if persona_tag:
        results = [m for m in results if persona_tag in m.get("persona_tags", [])]
    if text:
        text_lower = text.lower()
        results = [m for m in results if text_lower in m["display_name"].lower() or text_lower in (m.get("brand", "") or "").lower()]
    return results

def get_module(plugin_slug: str, model_slug: str) -> dict[str, Any] | None:
    catalog = load_catalog()
    for m in catalog:
        if m["plugin_slug"] == plugin_slug and m["model_slug"] == model_slug:
            return m
    return None

def get_function_tags() -> list[str]:
    catalog = load_catalog()
    tags = set()
    for m in catalog:
        tags.update(m.get("function_tags", []))
    return sorted(tags)
