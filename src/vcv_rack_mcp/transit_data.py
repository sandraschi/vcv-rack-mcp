"""Stoermelder Transit module-data builder + validator.

Authoritative schema: PackOne v2 ``TransitBase::dataToJson`` /
``dataFromJson`` (``src/modules/transit/TransitBase.hpp``) plus
``TransitModule::dataToJson`` (``src/modules/transit/Transit.cpp``),
plugin.json 2.7.0. Verified 2026-10-22 against the v2 branch source.

Transit data blob shape (``.vcv`` module ``data`` object)::

    {
      "panelTheme": 0,
      "ctrlUniqueId": -1,
      "mappingIndicatorHidden": false,
      "mappingIndicatorColor": "#ffffff",
      "presetProcessDivision": 64,
      "slotCvMode": 0, "outMode": 0,
      "preset": -1, "presetFirst": 0, "presetCount": 12,
      "presetCountLongPress": false, "clampFadeCv": false,
      "parameterChangesDirect": false,
      "sourceMaps": [{"moduleId": int, "paramId": int}, ...],
      "presets": [
        {"slotUsed": bool, "textLabel": str, "fadeTime": float,
         "slot": [float, ...], "color": "#rrggbb"?},
        ... (12 entries for TRANSIT, 12 per TransitEx expander)
      ]
    }

``preset[i]`` holds one float per bound parameter in ``sourceMaps`` order.
Rack tolerates missing keys and clamps extra presets, so validation is
structural: error = unloadable or binding-inconsistent, warning = lossy.
"""

from __future__ import annotations

import math
from typing import Any

TRANSIT_SLOTS = 12
TRANSIT_MAX_SLOTS = 96  # 12 base + 7 chained +T expanders x 12


def _is_num(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_hex_color(value: Any) -> bool:
    if not isinstance(value, str) or len(value) != 7 or not value.startswith("#"):
        return False
    try:
        int(value[1:], 16)
        return True
    except ValueError:
        return False


def validate_transit_data(data: Any, num_slots: int = TRANSIT_SLOTS) -> list[dict[str, str]]:
    """Validate a Transit-family data blob.

    Returns a list of ``{"severity": "error"|"warning", "message": str}``.
    Empty list = clean.
    """
    issues: list[dict[str, str]] = []

    def err(message: str) -> None:
        issues.append({"severity": "error", "message": message})

    def warn(message: str) -> None:
        issues.append({"severity": "warning", "message": message})

    if not isinstance(data, dict):
        err(f"Transit data must be a JSON object, got {type(data).__name__}.")
        return issues

    presets = data.get("presets", [])
    if not isinstance(presets, list):
        err("'presets' must be a list.")
        return issues
    if len(presets) > num_slots:
        warn(f"{len(presets)} presets exceed {num_slots} slots - Rack ignores the extras.")

    source_maps = data.get("sourceMaps", [])
    if source_maps is not None and not isinstance(source_maps, list):
        err("'sourceMaps' must be a list of {moduleId, paramId}.")
        source_maps = []
    bound_count: int | None = None
    if isinstance(source_maps, list) and source_maps:
        for entry in source_maps:
            if not isinstance(entry, dict):
                err(f"sourceMaps entry must be an object, got {entry!r}.")
                break
            if not isinstance(entry.get("moduleId"), int) or isinstance(entry.get("moduleId"), bool):
                err(f"sourceMaps entry needs integer moduleId, got {entry!r}.")
                break
            if not isinstance(entry.get("paramId"), int) or isinstance(entry.get("paramId"), bool):
                err(f"sourceMaps entry needs integer paramId, got {entry!r}.")
                break
        else:
            bound_count = len(source_maps)

    widths: set[int] = set()
    for index, preset in enumerate(presets[:num_slots]):
        where = f"presets[{index}]"
        if not isinstance(preset, dict):
            err(f"{where} must be an object.")
            continue
        slot_used = preset.get("slotUsed", False)
        if not isinstance(slot_used, bool):
            err(f"{where}.slotUsed must be boolean.")
            continue
        label = preset.get("textLabel", "")
        if label is not None and not isinstance(label, str):
            err(f"{where}.textLabel must be a string.")
        fade = preset.get("fadeTime", 0.0)
        if fade is not None and not _is_num(fade):
            err(f"{where}.fadeTime must be numeric.")
        color = preset.get("color")
        if color is not None and not _is_hex_color(color):
            warn(f"{where}.color {color!r} is not #rrggbb - Rack falls back to default.")
        values = preset.get("slot", [])
        if slot_used:
            if not isinstance(values, list) or not values:
                err(f"{where} is marked used but has no numeric 'slot' values.")
                continue
            bad = [v for v in values if not _is_num(v)]
            if bad:
                err(f"{where}.slot contains {len(bad)} non-numeric values.")
                continue
            widths.add(len(values))
            if bound_count is not None and len(values) != bound_count:
                err(
                    f"{where}.slot has {len(values)} values but {bound_count} "
                    "parameters are bound (sourceMaps) - morphing reads garbage."
                )
        elif isinstance(values, list) and values:
            warn(f"{where} is unused but carries {len(values)} values (dead weight).")

    if bound_count is None and len(widths) > 1:
        warn(f"Used slots have inconsistent widths {sorted(widths)} - morphing may misbehave.")

    return issues


def build_transit_data(
    presets: list[dict[str, Any]],
    source_maps: list[dict[str, int]] | None = None,
    num_slots: int = TRANSIT_SLOTS,
    panel_theme: int = 0,
) -> dict[str, Any]:
    """Build a valid Transit data blob from a compact preset spec.

    Args:
        presets: one dict per snapshot: ``{"values": [float, ...],
            "label": str (optional), "fade_time": float (optional),
            "color": "#rrggbb" (optional)}``. Max ``num_slots`` entries.
        source_maps: optional ``[{"moduleId": int, "paramId": int}]`` bindings.
            When given, every preset's ``values`` must match its length.
        num_slots: slot count (12 for TRANSIT, 12 per +T expander).
        panel_theme: Rack panel theme (0 = dark).

    Raises:
        ValueError: on structural problems (message explains the fix).
    """
    if len(presets) > num_slots:
        raise ValueError(f"{len(presets)} presets exceed {num_slots} Transit slots.")
    bound_count = len(source_maps) if source_maps else None
    blob_presets: list[dict[str, Any]] = []
    for index, spec in enumerate(presets):
        values = spec.get("values", [])
        if not isinstance(values, list) or not values:
            raise ValueError(f"Preset {index}: 'values' must be a non-empty list of numbers.")
        bad = [v for v in values if not _is_num(v)]
        if bad:
            raise ValueError(f"Preset {index}: {len(bad)} non-numeric values in 'values'.")
        if bound_count is not None and len(values) != bound_count:
            raise ValueError(
                f"Preset {index}: {len(values)} values but {bound_count} bound parameters."
            )
        entry: dict[str, Any] = {
            "slotUsed": True,
            "textLabel": str(spec.get("label", f"Preset {index + 1}")),
            "fadeTime": float(spec.get("fade_time", 0.0)),
            "slot": [float(v) for v in values],
        }
        color = spec.get("color")
        if color is not None:
            if not _is_hex_color(color):
                raise ValueError(f"Preset {index}: color {color!r} is not #rrggbb.")
            entry["color"] = color
        blob_presets.append(entry)
    for _ in range(num_slots - len(blob_presets)):
        blob_presets.append({"slotUsed": False, "textLabel": "", "fadeTime": 0.0})
    return {
        "panelTheme": panel_theme,
        "ctrlUniqueId": -1,
        "sourceMaps": list(source_maps) if source_maps else [],
        "presets": blob_presets,
    }
