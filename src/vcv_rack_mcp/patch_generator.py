"""Core patch generation engine — produces valid .vcv JSON."""

import re
from pathlib import Path

import yaml

from .config import settings

# ---------------------------------------------------------------------------
# Catalog loader
# ---------------------------------------------------------------------------

def load_catalog() -> dict[str, dict]:
    """Load the module catalog from ``modules.yaml``.

    Returns ``{plugin: {model: entry, ...}, ...}`` where each entry contains
    param/port metadata observed from real saved patches.
    """
    path: Path = settings.CATALOG_PATH
    if not path.exists():
        return _builtin_catalog()

    with open(path, encoding="utf-8") as f:
        raw: list[dict] = yaml.safe_load(f) or []

    catalog: dict[str, dict] = {}
    for entry in raw:
        plugin = entry.get("plugin_slug", "Fundamental")
        model = entry.get("model_slug", "UNKNOWN")
        catalog.setdefault(plugin, {})[model] = entry
    return catalog


def _builtin_catalog() -> dict[str, dict]:
    """Minimal built-in catalog covering Fundamental modules.

    Used as a fallback when ``catalog/modules.yaml`` does not exist yet.
    The full 44–50 entry catalog lives in ``catalog/modules.yaml`` (Phase 1).
    """
    def _mod(plugin: str, model: str, params, inputs, outputs,
             tags: list[str] | None = None, display_name: str | None = None):
        return {model: {
            "plugin_slug": plugin,
            "model_slug": model,
            "display_name": display_name or model,
            "function_tags": tags or [],
            "persona_tags": ["generative", "performance"],
            "params": params,
            "inputs": inputs,
            "outputs": outputs,
        }}

    fundamental = "Fundamental"
    return {
        fundamental: dict(
            **_mod(fundamental, "VCO",
                params=[
                    {"id": 0, "label": "FREQ", "min": -3, "max": 3, "default": 0, "osc_suitable": True},
                    {"id": 1, "label": "FINE", "min": -1, "max": 1, "default": 0, "osc_suitable": False},
                    {"id": 2, "label": "PWM", "min": 0, "max": 1, "default": 0.5, "osc_suitable": False},
                    {"id": 3, "label": "FM", "min": 0, "max": 1, "default": 0, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "PITCH", "type": "input"}, {"id": 1, "name": "FM", "type": "input"}, {"id": 2, "name": "PWM", "type": "input"}],
                outputs=[{"id": 0, "name": "SIN", "type": "output"}, {"id": 1, "name": "TRI", "type": "output"}, {"id": 2, "name": "SAW", "type": "output"}, {"id": 3, "name": "SQR", "type": "output"}],
                tags=["osc"]),
            **_mod(fundamental, "VCO-2",
                params=[
                    {"id": 0, "label": "FINE", "min": -1, "max": 1, "default": 0, "osc_suitable": False},
                    {"id": 1, "label": "SEMI", "min": -12, "max": 12, "default": 0, "osc_suitable": False},
                    {"id": 2, "label": "PWM", "min": 0, "max": 1, "default": 0.5, "osc_suitable": False},
                    {"id": 3, "label": "FM", "min": 0, "max": 1, "default": 0, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "PITCH", "type": "input"}, {"id": 1, "name": "FM", "type": "input"}, {"id": 2, "name": "PWM", "type": "input"}],
                outputs=[{"id": 0, "name": "SIN", "type": "output"}, {"id": 1, "name": "TRI", "type": "output"}, {"id": 2, "name": "SAW", "type": "output"}, {"id": 3, "name": "SQR", "type": "output"}],
                tags=["osc"]),
            **_mod(fundamental, "LFO",
                params=[
                    {"id": 0, "label": "FREQ", "min": 0, "max": 1, "default": 0.5, "osc_suitable": True},
                    {"id": 1, "label": "GAIN", "min": 0, "max": 1, "default": 1, "osc_suitable": False},
                    {"id": 2, "label": "OFFSET", "min": -1, "max": 1, "default": 0, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "RESET", "type": "input"}],
                outputs=[{"id": 0, "name": "SIN", "type": "output"}, {"id": 1, "name": "TRI", "type": "output"}, {"id": 2, "name": "SAW", "type": "output"}, {"id": 3, "name": "SQR", "type": "output"}, {"id": 4, "name": "STEP", "type": "output"}],
                tags=["modulation"]),
            **_mod(fundamental, "VCF",
                params=[
                    {"id": 0, "label": "FREQ", "min": 0, "max": 1, "default": 0.5, "osc_suitable": True},
                    {"id": 1, "label": "RES", "min": 0, "max": 1, "default": 0, "osc_suitable": True},
                    {"id": 2, "label": "FM", "min": 0, "max": 1, "default": 0, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "AUDIO_IN", "type": "input"}, {"id": 1, "name": "FREQ_CV", "type": "input"}, {"id": 2, "name": "RES_CV", "type": "input"}, {"id": 3, "name": "FM", "type": "input"}],
                outputs=[{"id": 0, "name": "LP", "type": "output"}, {"id": 1, "name": "HP", "type": "output"}, {"id": 2, "name": "BP", "type": "output"}],
                tags=["filter"]),
            **_mod(fundamental, "VCA",
                params=[{"id": 0, "label": "LEVEL", "min": 0, "max": 1, "default": 0.8, "osc_suitable": True}],
                inputs=[{"id": 0, "name": "AUDIO_IN", "type": "input"}, {"id": 1, "name": "CV", "type": "input"}],
                outputs=[{"id": 0, "name": "AUDIO_OUT", "type": "output"}],
                tags=["amp"]),
            **_mod(fundamental, "ADSR",
                params=[
                    {"id": 0, "label": "ATTACK", "min": 0, "max": 1, "default": 0.1, "osc_suitable": True},
                    {"id": 1, "label": "DECAY", "min": 0, "max": 1, "default": 0.3, "osc_suitable": False},
                    {"id": 2, "label": "SUSTAIN", "min": 0, "max": 1, "default": 0.7, "osc_suitable": False},
                    {"id": 3, "label": "RELEASE", "min": 0, "max": 1, "default": 0.5, "osc_suitable": True},
                ],
                inputs=[{"id": 0, "name": "GATE", "type": "input"}],
                outputs=[{"id": 0, "name": "ENVELOPE", "type": "output"}],
                tags=["envelope"]),
            **_mod(fundamental, "RANDOM",
                params=[{"id": 0, "label": "MODE", "min": 0, "max": 1, "default": 0, "osc_suitable": False}],
                inputs=[{"id": 0, "name": "TRIG", "type": "input"}],
                outputs=[{"id": 0, "name": "UNI", "type": "output"}, {"id": 1, "name": "BI", "type": "output"}, {"id": 2, "name": "TRIG", "type": "output"}],
                tags=["random"]),
            **_mod(fundamental, "SEQ",
                params=[{"id": 0, "label": "STEP", "min": 0, "max": 7, "default": 0, "osc_suitable": False}],
                inputs=[{"id": 0, "name": "CLOCK", "type": "input"}, {"id": 1, "name": "RESET", "type": "input"}],
                outputs=[{"id": 0, "name": "GATE", "type": "output"}, {"id": 1, "name": "CV", "type": "output"}],
                tags=["sequencer"]),
            **_mod(fundamental, "SEQ-3",
                params=[{"id": 0, "label": "STEP", "min": 0, "max": 7, "default": 0, "osc_suitable": False}],
                inputs=[{"id": 0, "name": "CLOCK", "type": "input"}, {"id": 1, "name": "RESET", "type": "input"}],
                outputs=[{"id": 0, "name": "GATE", "type": "output"}, {"id": 1, "name": "CV1", "type": "output"}, {"id": 2, "name": "CV2", "type": "output"}, {"id": 3, "name": "CV3", "type": "output"}],
                tags=["sequencer"]),
            **_mod(fundamental, "DELAY",
                params=[
                    {"id": 0, "label": "TIME", "min": 0, "max": 1, "default": 0.3, "osc_suitable": True},
                    {"id": 1, "label": "FEEDBACK", "min": 0, "max": 1, "default": 0.3, "osc_suitable": True},
                ],
                inputs=[{"id": 0, "name": "AUDIO_IN", "type": "input"}, {"id": 1, "name": "TIME_CV", "type": "input"}],
                outputs=[{"id": 0, "name": "AUDIO_OUT", "type": "output"}],
                tags=["fx"]),
            **_mod(fundamental, "SPRING REVERB",
                params=[
                    {"id": 0, "label": "SIZE", "min": 0, "max": 1, "default": 0.5, "osc_suitable": True},
                    {"id": 1, "label": "DAMP", "min": 0, "max": 1, "default": 0.5, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "AUDIO_IN", "type": "input"}],
                outputs=[{"id": 0, "name": "AUDIO_OUT", "type": "output"}],
                tags=["fx"]),
            **_mod(fundamental, "MIXER",
                params=[
                    {"id": 0, "label": "CH1", "min": 0, "max": 1, "default": 0.8, "osc_suitable": True},
                    {"id": 1, "label": "CH2", "min": 0, "max": 1, "default": 0.8, "osc_suitable": True},
                    {"id": 2, "label": "CH3", "min": 0, "max": 1, "default": 0.8, "osc_suitable": True},
                    {"id": 3, "label": "CH4", "min": 0, "max": 1, "default": 0.8, "osc_suitable": True},
                ],
                inputs=[{"id": i, "name": f"CH{i+1}", "type": "input"} for i in range(4)],
                outputs=[{"id": 0, "name": "OUT_L", "type": "output"}, {"id": 1, "name": "OUT_R", "type": "output"}],
                tags=["mixer"]),
            **_mod(fundamental, "AUDIO-8",
                params=[{"id": i, "label": f"LEVEL {i//2+1}", "min": 0, "max": 1, "default": 1, "osc_suitable": False} for i in range(0, 8, 2)],
                inputs=[{"id": i, "name": f"IN {i+1}", "type": "input"} for i in range(8)],
                outputs=[{"id": 0, "name": "OUT L", "type": "output"}, {"id": 1, "name": "OUT R", "type": "output"}],
                tags=["output"]),
            **_mod(fundamental, "LFO-2",
                params=[
                    {"id": 0, "label": "FREQ", "min": 0, "max": 1, "default": 0.5, "osc_suitable": True},
                    {"id": 1, "label": "GAIN", "min": 0, "max": 1, "default": 1, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "RESET", "type": "input"}],
                outputs=[{"id": 0, "name": "SIN", "type": "output"}, {"id": 1, "name": "TRI", "type": "output"}, {"id": 2, "name": "SAW", "type": "output"}, {"id": 3, "name": "SQR", "type": "output"}],
                tags=["modulation"]),
            **_mod(fundamental, "PULSE PROCESSOR",
                params=[
                    {"id": 0, "label": "MODE", "min": 0, "max": 1, "default": 0, "osc_suitable": False},
                    {"id": 1, "label": "DELAY", "min": 0, "max": 1, "default": 0, "osc_suitable": False},
                ],
                inputs=[{"id": 0, "name": "TRIG_IN", "type": "input"}],
                outputs=[{"id": 0, "name": "TRIG_OUT", "type": "output"}, {"id": 1, "name": "GATE", "type": "output"}],
                tags=["utility"]),
        ),
        "cvOSCcv": {
            "OSC-RECV": {
                "plugin_slug": "cvOSCcv",
                "model_slug": "OSC-RECV",
                "display_name": "OSC-RECV",
                "function_tags": ["osc"],
                "persona_tags": ["generative", "performance"],
                "params": [{"id": i, "label": f"Param {i+1}", "min": 0, "max": 1, "default": 0, "osc_suitable": True} for i in range(8)],
                "inputs": [],
                "outputs": [{"id": i, "name": f"OUT {i+1}", "type": "output"} for i in range(8)],
            }
        },
    }


# ---------------------------------------------------------------------------
# Slugify
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


# ---------------------------------------------------------------------------
# Default module chains
# ---------------------------------------------------------------------------

_GENERATIVE_CHAIN = [
    ("Fundamental", "SEQ-3"),
    ("Fundamental", "LFO"),
    ("Fundamental", "RANDOM"),
    ("Fundamental", "VCO"),
    ("Fundamental", "VCO"),
    ("Fundamental", "VCF"),
    ("Fundamental", "VCA"),
    ("Fundamental", "ADSR"),
    ("Fundamental", "DELAY"),
    ("Fundamental", "SPRING REVERB"),
    ("Fundamental", "MIXER"),
]

_PERFORMANCE_CHAIN = [
    ("Fundamental", "LFO-2"),
    ("Fundamental", "VCO-2"),
    ("Fundamental", "VCO-2"),
    ("Fundamental", "VCF"),
    ("Fundamental", "VCA"),
    ("Fundamental", "ADSR"),
    ("Fundamental", "DELAY"),
    ("Fundamental", "MIXER"),
    ("Fundamental", "PULSE PROCESSOR"),
]

_AUDIO_OUT = ("Fundamental", "AUDIO-8")
_OSC_RECV = ("cvOSCcv", "OSC-RECV")


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

_COL_WIDTH = 190
_ROW_HEIGHT = 30
_START_X = 10
_START_Y = 50


def _assign_positions(modules: list[dict]) -> list[dict]:
    """Assign left-to-right positions with vertical staggering."""
    positioned = []
    col_counts: dict[int, int] = {}
    for i, mod in enumerate(modules):
        col = i  # one column per module for simplicity
        col_counts[col] = col_counts.get(col, 0) + 1
        row_idx = col_counts[col] - 1
        pos_x = _START_X + col * _COL_WIDTH
        pos_y = _START_Y + row_idx * _ROW_HEIGHT
        mod["pos_x"] = pos_x
        mod["pos_y"] = pos_y
        positioned.append(mod)
    return positioned


# ---------------------------------------------------------------------------
# Module instantiation
# ---------------------------------------------------------------------------

def _make_module(mod_id: int, plugin: str, model: str,
                 catalog: dict[str, dict]) -> dict:
    """Instantiate a module from catalog data, or with bare defaults."""
    entry = catalog.get(plugin, {}).get(model)
    params = {}
    if entry:
        for p in entry.get("params", []):
            params[str(p["id"])] = p["default"]
    return {
        "id": mod_id,
        "plugin": plugin,
        "model": model,
        "pos_x": 0,
        "pos_y": 0,
        "params": params,
        "data": {},
    }


def _make_cable(cable_id: int, out_mod: int, out_port: int,
                in_mod: int, in_port: int) -> dict:
    return {
        "id": cable_id,
        "output_module_id": out_mod,
        "output_id": out_port,
        "input_module_id": in_mod,
        "input_id": in_port,
    }


# ---------------------------------------------------------------------------
# OSC wiring
# ---------------------------------------------------------------------------

def _pick_osc_params(modules: list[dict], catalog: dict[str, dict]) -> list[dict]:
    """Select 4-8 headline params for OSC mapping.

    Returns list of {module_id, param_id, label, min, max}.
    """
    osc_map = []
    for mod in modules:
        entry = catalog.get(mod["plugin"], {}).get(mod["model"])
        if not entry:
            continue
        suitable = [p for p in entry.get("params", []) if p.get("osc_suitable")]
        for p in suitable[:2]:  # at most 2 per module
            label = f"{mod['model']}_{p['label']}".lower().replace(" ", "_")
            osc_map.append({
                "module_id": mod["id"],
                "param_id": p["id"],
                "label": label,
                "min": p.get("min", 0),
                "max": p.get("max", 1),
            })
    return osc_map[:8]  # cap at 8


# ---------------------------------------------------------------------------
# Cable builder
# ---------------------------------------------------------------------------

def _build_cables(modules: list[dict], catalog: dict[str, dict]) -> list[dict]:
    """Auto-wire modules left-to-right in signal-chain order.

    This is a best-effort heuristic.  Complex patches may need manual edits.
    """
    cables = []
    cable_id = 0

    def _port(plugin: str, model: str, direction: str, idx: int = 0) -> int | None:
        entry = catalog.get(plugin, {}).get(model)
        if not entry:
            return idx
        ports = entry.get(f"{direction}s", [])  # "inputs" or "outputs"
        if idx < len(ports):
            return ports[idx]["id"]
        return ports[0]["id"] if ports else idx

    audio_out_idx = None
    osc_recv_idx = None

    for i, mod in enumerate(modules):
        if mod["plugin"] == "Fundamental" and mod["model"] == "AUDIO-8":
            audio_out_idx = i
        if mod["plugin"] == "cvOSCcv" and mod["model"] == "OSC-RECV":
            osc_recv_idx = i

    # Wire each module's main output to the next module's main input
    for i in range(len(modules) - 1):
        curr = modules[i]
        nxt = modules[i + 1]
        # Skip wiring to AUDIO-8 or OSC-RECV — handled separately
        if (nxt["plugin"] == "Fundamental" and nxt["model"] == "AUDIO-8"):
            continue
        if (nxt["plugin"] == "cvOSCcv" and nxt["model"] == "OSC-RECV"):
            continue

        out_port = _port(curr["plugin"], curr["model"], "output", 0)
        in_port = _port(nxt["plugin"], nxt["model"], "input", 0)
        if out_port is not None and in_port is not None:
            cables.append(_make_cable(cable_id, curr["id"], out_port, nxt["id"], in_port))
            cable_id += 1

    # Wire last audio module -> AUDIO-8 input 0
    if audio_out_idx is not None:
        source_idx = audio_out_idx - 1
        if source_idx >= 0:
            src = modules[source_idx]
            out_port = _port(src["plugin"], src["model"], "output", 0)
            if out_port is not None:
                cables.append(_make_cable(cable_id, src["id"], out_port,
                                          modules[audio_out_idx]["id"], 0))
                cable_id += 1

    # Wire OSC receiver outputs to first N params
    if osc_recv_idx is not None:
        for target_i, mod in enumerate(modules):
            if target_i == osc_recv_idx:
                continue
            entry = catalog.get(mod["plugin"], {}).get(mod["model"])
            if not entry:
                continue
            suitable = [p for p in entry.get("params", []) if p.get("osc_suitable")]
            for pi, p in enumerate(suitable[:2]):
                osc_out = pi  # use OSC-RECV output 0, 1, etc.
                cables.append(_make_cable(
                    cable_id,
                    modules[osc_recv_idx]["id"], osc_out,
                    mod["id"], p["id"],
                ))
                cable_id += 1

    return cables


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_patch(
    name: str,
    description: str,
    persona: str,
    module_hints: list[str] | None = None,
) -> dict:
    """Generate a complete .vcv patch from a description and persona.

    Args:
        name: Human-readable patch name.
        description: Natural-language description of the patch.
        persona: ``"generative"`` | ``"performance"`` | ``"hybrid"``.
        module_hints: Optional list of model names to prefer.

    Returns:
        ``{patch_json, modules_json, cables_json, osc_map, sidecar_md, warnings}``.

    ## Return Format
    ```json
    {
      "success": true,
      "patch_json": {...},
      "modules_json": [...],
      "cables_json": [...],
      "osc_map": {"label": {"module_id": int, "param_id": int, ...}},
      "sidecar_md": str,
      "warnings": [str]
    }
    ```
    """
    warnings: list[str] = []
    catalog = load_catalog()
    slug = _slugify(name)

    # --- Select module chain ---
    if persona == "performance":
        chain = list(_PERFORMANCE_CHAIN)
    elif persona == "hybrid":
        chain = list(_GENERATIVE_CHAIN[:5]) + list(_PERFORMANCE_CHAIN)
    else:
        chain = list(_GENERATIVE_CHAIN)

    # Inject module_hints — replace matching slots
    if module_hints:
        for hint in module_hints:
            for plugin, models in catalog.items():
                if hint in models:
                    # Append hinted module (don't replace — keeps defaults)
                    chain.append((plugin, hint))
                    break

    # Always include AUDIO-8 and OSC-RECV
    if _AUDIO_OUT not in chain:
        chain.append(_AUDIO_OUT)
    if _OSC_RECV not in chain:
        chain.append(_OSC_RECV)

    # --- Instantiate modules ---
    modules = []
    for mod_id, (plugin, model) in enumerate(chain):
        if plugin not in catalog or model not in catalog.get(plugin, {}):
            warnings.append(f"Module {plugin}/{model} not in catalog — using bare defaults.")
        modules.append(_make_module(mod_id, plugin, model, catalog))

    # Filter out modules whose plugin is completely missing from catalog
    modules = [m for m in modules if m["plugin"] in catalog or m["plugin"] == "Fundamental"]

    # --- Layout ---
    modules = _assign_positions(modules)

    # --- Build cables ---
    cables = _build_cables(modules, catalog)

    # --- OSC map ---
    osc_params = _pick_osc_params(modules, catalog)
    osc_map = {}
    for p in osc_params:
        label = p["label"]
        osc_map[f"/vcv/{slug}/{label}"] = {
            "module_id": p["module_id"],
            "param_id": p["param_id"],
            "min": p["min"],
            "max": p["max"],
        }

    # --- Assemble patch JSON ---
    modules_json = modules
    cables_json = cables

    patch_json = {
        "version": "0.6",
        "modules": modules_json,
        "cables": cables_json,
    }

    # --- Sidecar ---
    sidecar_md = generate_sidecar({
        "name": name,
        "slug": slug,
        "persona": persona,
        "description": description,
        "modules": modules,
        "cables": cables,
        "osc_map": osc_map,
    })

    return {
        "patch_json": patch_json,
        "modules_json": modules_json,
        "cables_json": cables_json,
        "osc_map": osc_map,
        "sidecar_md": sidecar_md,
        "warnings": warnings,
    }


def generate_sidecar(patch_data: dict) -> str:
    """Emit markdown sidecar with intent, signal flow, and OSC map."""
    name = patch_data.get("name", "Untitled")
    slug = patch_data.get("slug", "untitled")
    persona = patch_data.get("persona", "generative")
    description = patch_data.get("description", "")
    modules = patch_data.get("modules", [])
    cables = patch_data.get("cables", [])
    osc_map = patch_data.get("osc_map", {})

    lines = [
        f"# {name}",
        "",
        f"**Slug:** `{slug}`",
        f"**Persona:** {persona}",
        f"**Description:** {description}",
        "",
        "## Signal Flow",
        "",
    ]

    for i, mod in enumerate(modules):
        arrow = " → " if i < len(modules) - 1 else ""
        lines.append(f"- {mod['plugin']}/{mod['model']}{arrow}")

    lines += [
        "",
        f"**Cables:** {len(cables)}",
        "",
        "## OSC Address Map",
        "",
        "| OSC Path | Module | Param | Range |",
        "|----------|--------|-------|-------|",
    ]

    for path, info in sorted(osc_map.items()):
        mid = info.get("module_id")
        pid = info.get("param_id")
        m_min = info.get("min")
        m_max = info.get("max")
        # Find module name for readability
        mod_name = next(
            (f"{m['plugin']}/{m['model']}" for m in modules if m["id"] == mid),
            f"mod_{mid}",
        )
        lines.append(f"| `{path}` | {mod_name} param {pid} | [{m_min}, {m_max}] |")

    lines += [
        "",
        "## Known Limitations",
        "",
        "- This patch was auto-generated.  Fine-tune params in Rack.",
        "- OSC map assumes cvOSCcv/OSC-RECV is installed.",
        "- Cable routing is heuristic — may need manual adjustment.",
    ]

    return "\n".join(lines)
