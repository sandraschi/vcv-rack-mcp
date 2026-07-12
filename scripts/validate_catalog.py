#!/usr/bin/env python3
"""Validate catalog/modules.yaml against the schema."""
import yaml, sys
from pathlib import Path

catalog_path = Path(__file__).parent.parent / "catalog" / "modules.yaml"
with open(catalog_path) as f:
    catalog = yaml.safe_load(f)

errors = []
if not isinstance(catalog, list):
    errors.append("Root must be a list")

count = len(catalog)
if count < 44 or count > 50:
    errors.append(f"Module count {count} outside [44, 50]")

persona_counts = {"generative": 0, "performance": 0, "both": 0}
required_keys = {"plugin_slug", "model_slug", "display_name", "function_tags", "persona_tags", "params", "inputs", "outputs"}

for i, mod in enumerate(catalog):
    missing = required_keys - set(mod.keys())
    if missing:
        errors.append(f"Entry {i} ({mod.get('display_name','?')}): missing keys {missing}")
    if not mod.get("plugin_slug"):
        errors.append(f"Entry {i}: missing plugin_slug")
    if not mod.get("model_slug"):
        errors.append(f"Entry {i}: missing model_slug")
    for pt in mod.get("persona_tags", []):
        if pt in persona_counts:
            persona_counts[pt] += 1

gen_frac = (persona_counts["generative"] + persona_counts["both"]) / max(count, 1)
perf_frac = (persona_counts["performance"] + persona_counts["both"]) / max(count, 1)
if gen_frac < 0.35 or gen_frac > 0.65:
    errors.append(f"Generative fraction {gen_frac:.0%} outside 35-65%")
if perf_frac < 0.35 or perf_frac > 0.65:
    errors.append(f"Performance fraction {perf_frac:.0%} outside 35-65%")

if errors:
    print(f"FAIL: {len(errors)} validation errors:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
else:
    print(f"PASS: {count} modules, gen={persona_counts['generative']+persona_counts['both']}, perf={persona_counts['performance']+persona_counts['both']}")
