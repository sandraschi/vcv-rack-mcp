"""Patch validation — 3 checks against catalog, installed plugins, and cable polarity."""

from pathlib import Path

from .config import settings
from .patch_generator import load_catalog

# ---------------------------------------------------------------------------
# Validation issue type
# ---------------------------------------------------------------------------

class ValidationIssue:
    __slots__ = ("severity", "module_or_cable", "message")

    def __init__(self, severity: str, module_or_cable: str, message: str):
        self.severity = severity  # "error" | "warning"
        self.module_or_cable = module_or_cable
        self.message = message

    def to_dict(self) -> dict[str, str]:
        return {
            "severity": self.severity,
            "module_or_cable": self.module_or_cable,
            "message": self.message,
        }


# ---------------------------------------------------------------------------
# Check 1: Catalog membership
# ---------------------------------------------------------------------------

def _check_catalog_membership(
    modules: list[dict], catalog: dict[str, dict]
) -> list[ValidationIssue]:
    """Every module's plugin+model must exist in the catalog."""
    issues: list[ValidationIssue] = []
    for mod in modules:
        plugin = mod.get("plugin", "")
        model = mod.get("model", "")
        mod_label = f"mod_{mod['id']} ({plugin}/{model})"
        if plugin not in catalog:
            issues.append(ValidationIssue(
                "error", mod_label,
                f"Plugin '{plugin}' not found in catalog.",
            ))
            continue
        if model not in catalog[plugin]:
            issues.append(ValidationIssue(
                "error", mod_label,
                f"Model '{model}' not found in plugin '{plugin}' catalog.",
            ))
    return issues


# ---------------------------------------------------------------------------
# Check 2: Installed plugins membership
# ---------------------------------------------------------------------------

def _check_installed_membership(
    modules: list[dict],
) -> list[ValidationIssue]:
    """Every module's plugin slug must exist in the installed plugins dir.

    Checks that a directory matching the plugin slug exists under
    ``config.PLUGINS_DIR``.
    """
    issues: list[ValidationIssue] = []
    plugins_dir: Path = settings.PLUGINS_DIR

    if not plugins_dir.is_dir():
        issues.append(ValidationIssue(
            "warning", "global",
            f"Plugins directory not found at {plugins_dir}.",
        ))
        return issues

    installed_slugs = {
        p.name.lower()
        for p in plugins_dir.iterdir()
        if p.is_dir()
    }

    for mod in modules:
        plugin = mod.get("plugin", "")
        mod_label = f"mod_{mod['id']} ({plugin}/{mod.get('model', '?')})"
        if plugin.lower() not in installed_slugs:
            issues.append(ValidationIssue(
                "error", mod_label,
                f"Plugin '{plugin}' not found in installed plugins at {plugins_dir}.",
            ))
    return issues


# ---------------------------------------------------------------------------
# Check 3: Cable endpoint correctness and polarity
# ---------------------------------------------------------------------------

def _check_cables(
    modules: list[dict],
    cables: list[dict],
    catalog: dict[str, dict],
) -> list[ValidationIssue]:
    """Validate cable endpoints:

    - Output module ids exist
    - Output ports connect to real output ports
    - Input ports connect to real input ports
    - No output-to-output or input-to-input cables
    """
    issues: list[ValidationIssue] = []
    mod_map = {m["id"]: m for m in modules}

    for i, cable in enumerate(cables):
        cable_label = f"cable_{cable.get('id', i)}"
        out_mod_id = cable.get("output_module_id")
        out_port_id = cable.get("output_id")
        in_mod_id = cable.get("input_module_id")
        in_port_id = cable.get("input_id")

        # -- Module existence --
        if out_mod_id not in mod_map:
            issues.append(ValidationIssue(
                "error", cable_label,
                f"Output module id {out_mod_id} does not exist.",
            ))
            continue
        if in_mod_id not in mod_map:
            issues.append(ValidationIssue(
                "error", cable_label,
                f"Input module id {in_mod_id} does not exist.",
            ))
            continue

        out_mod = mod_map[out_mod_id]
        in_mod = mod_map[in_mod_id]

        # -- Port existence and polarity --
        out_entry = catalog.get(out_mod["plugin"], {}).get(out_mod["model"])
        in_entry = catalog.get(in_mod["plugin"], {}).get(in_mod["model"])

        if out_entry:
            out_ports = out_entry.get("outputs", [])
            match_out = next((p for p in out_ports if p["id"] == out_port_id), None)
            if match_out is None:
                issues.append(ValidationIssue(
                    "error", cable_label,
                    f"Output port id {out_port_id} not found on "
                    f"{out_mod['plugin']}/{out_mod['model']} outputs: "
                    f"{[p['id'] for p in out_ports]}",
                ))
            elif match_out.get("type") != "output":
                issues.append(ValidationIssue(
                    "error", cable_label,
                    f"Port {out_port_id} on {out_mod['plugin']}/{out_mod['model']} "
                    f"is type '{match_out.get('type')}', expected 'output'.",
                ))
        else:
            issues.append(ValidationIssue(
                "warning", cable_label,
                f"Cannot verify output port {out_port_id} — "
                f"{out_mod['plugin']}/{out_mod['model']} not in catalog.",
            ))

        if in_entry:
            in_ports = in_entry.get("inputs", [])
            match_in = next((p for p in in_ports if p["id"] == in_port_id), None)
            if match_in is None:
                issues.append(ValidationIssue(
                    "error", cable_label,
                    f"Input port id {in_port_id} not found on "
                    f"{in_mod['plugin']}/{in_mod['model']} inputs: "
                    f"{[p['id'] for p in in_ports]}",
                ))
            elif match_in.get("type") != "input":
                issues.append(ValidationIssue(
                    "error", cable_label,
                    f"Port {in_port_id} on {in_mod['plugin']}/{in_mod['model']} "
                    f"is type '{match_in.get('type')}', expected 'input'.",
                ))
        else:
            issues.append(ValidationIssue(
                "warning", cable_label,
                f"Cannot verify input port {in_port_id} — "
                f"{in_mod['plugin']}/{in_mod['model']} not in catalog.",
            ))

        # -- Polarity guard: output-to-output or input-to-input --
        if out_entry and in_entry:
            out_is_output = any(p["id"] == out_port_id and p.get("type") == "output"
                               for p in out_entry.get("outputs", []))
            in_is_input = any(p["id"] == in_port_id and p.get("type") == "input"
                              for p in in_entry.get("inputs", []))
            if not out_is_output:
                issues.append(ValidationIssue(
                    "error", cable_label,
                    "Cable originates from a non-output port "
                    f"(output_module_id={out_mod_id}, output_id={out_port_id}).",
                ))
            if not in_is_input:
                issues.append(ValidationIssue(
                    "error", cable_label,
                    "Cable terminates at a non-input port "
                    f"(input_module_id={in_mod_id}, input_id={in_port_id}).",
                ))

    return issues


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def validate_patch(
    modules_json: list[dict],
    cables_json: list[dict],
) -> dict:
    """Run all 3 validation checks against a patch.

    Args:
        modules_json: List of module dicts from the .vcv JSON.
        cables_json: List of cable dicts from the .vcv JSON.

    Returns:
        ``{valid: bool, report: [{severity, module_or_cable, message}]}``.

    ## Return Format
    ```json
    {
      "valid": false,
      "report": [
        {"severity": "error", "module_or_cable": "mod_0 (Fundamental/VCO)",
         "message": "Port id 9 not found on ..."}
      ]
    }
    ```
    """
    catalog = load_catalog()

    all_issues: list[ValidationIssue] = []

    # Check 1 — catalog membership
    all_issues.extend(_check_catalog_membership(modules_json, catalog))

    # Check 2 — installed plugins
    all_issues.extend(_check_installed_membership(modules_json))

    # Check 3 — cable polarity
    all_issues.extend(_check_cables(modules_json, cables_json, catalog))

    report = [issue.to_dict() for issue in all_issues]
    valid = not any(issue.severity == "error" for issue in all_issues)

    return {
        "valid": valid,
        "report": report,
    }
