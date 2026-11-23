"""
vcv-rack-mcp - MCP server for VCV Rack 2 patch authorship.

Generates valid .vcv patch files from natural-language descriptions,
maintains a curated module catalog, emits OSC address maps for live
control via osc-mcp, and validates patches via 3-layer checks.
"""

import asyncio
import json
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any

from fastmcp import FastMCP
from prefab_ui import PrefabApp
from prefab_ui.components import Badge, Heading, Row
from rich.console import Console

from . import db as depot
from .catalog_loader import get_module, load_catalog, search_catalog
from .config import settings
from .llm_service import chat_completion, get_gpus, list_models, probe_providers
from .log_buffer import ring_handler, setup_logging
from .osc_bridge import generate_performance_sheet
from .patch_generator import generate_patch
from .patch_validator import validate_patch
from .rack_process import (
    get_rack_status,
    launch_rack,
    list_installed_plugins,
    stop_rack,
    write_vcv_file,
)
from .transit_data import build_transit_data, validate_transit_data

setup_logging()
logger = logging.getLogger(__name__)
console = Console()


def _log_tool_call(tool_name: str, ok: bool, detail: str = "") -> None:
    lvl = logging.INFO if ok else logging.ERROR
    logger.log(
        lvl,
        "tool=%s ok=%s %s",
        tool_name,
        ok,
        detail,
        extra={"kind": "tool_call"},
    )

mcp = FastMCP(
    "VCV-Rack-MCP",
    instructions="""
    MCP server for VCV Rack 2 built around patch authorship.
    .vcv patch files are plain JSON, so an LLM can compose modular
    synth patches by emitting structured data.

    TOOLS:
    - vcv_patch: create, edit, validate, list, get, open_in_rack, rack_cycle, import, set_module_data
    - vcv_catalog: search, get_module, verify_installed, library_link, sideload, suggest_rack
    - vcv_live: address_map, performance_sheet
    - vcv_agentic_workflow: ctx.sample loop for iterative generation
    """,
)

_patch_store: dict[str, dict] = {}


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# ============================================================================
# vcv_patch - Portmanteau
# ============================================================================


@mcp.tool(annotations={"readOnlyHint": False})
async def vcv_patch(
    operation: str,
    name: str | None = None,
    description: str = "",
    persona: str = "generative",
    module_hints: str | None = None,
    patch_id: str | None = None,
    path: str | None = None,
    instruction: str | None = None,
    reason: str | None = None,
    pending_sideload: str | None = None,
    limit: int = 50,
    module_id: int | None = None,
    data: dict | None = None,
    presets: list | None = None,
    source_maps: list | None = None,
) -> dict:
    """
    Patch authorship portmanteau - create, edit, validate, list, get, open_in_rack, rack_cycle, import, set_module_data.

    ## Return Format
    {"success": bool, "operation": str, ...operation-specific keys}

    ## Examples
    vcv_patch(operation="create", name="Ambient Drone", persona="generative", description="slow detuned drone")
    vcv_patch(operation="validate", patch_id="ambient-drone")
    vcv_patch(operation="list", persona="generative")
    vcv_patch(operation="set_module_data", patch_id="ambient-drone", module_id=3, presets=[{"label": "A", "values": [0.5, 0.2]}])
    """
    op = operation

    if op == "create":
        if not name:
            _log_tool_call("vcv_patch:create", False, "name is required")
            return {"success": False, "error": "name is required"}
        slug = _slugify(name)
        pid = slug or str(uuid.uuid4())[:8]
        result = generate_patch(
            name=name, description=description, persona=persona, module_hints=module_hints
        )
        modules = result["modules_json"]
        cables = result["cables_json"]
        osc_map = result.get("osc_map", {})
        patch_data = {
            "id": pid,
            "name": name,
            "slug": slug,
            "persona": persona,
            "description": description,
            "version": 1,
            "modules_json": modules,
            "cables_json": cables,
            "sidecar_md": result["sidecar_md"],
            "osc_address_map": osc_map,
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        patch_path = write_vcv_file(slug, modules, cables)
        _log_tool_call("vcv_patch:create", True, f"id={pid}")
        return {
            "success": True,
            "message": f"patch '{name}' created",
            "operation": "create",
            "patch_id": pid,
            "path": str(patch_path),
            "warnings": result.get("warnings", []),
        }

    if op == "edit":
        if not patch_id or not instruction:
            return {"success": False, "error": "patch_id and instruction required"}
        existing = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not existing:
            return {"success": False, "error": f"patch {patch_id} not found"}
        new_version = existing.get("version", 1) + 1
        result = generate_patch(
            name=existing["name"],
            description=instruction,
            persona=existing.get("persona", "generative"),
        )
        modules = result["modules_json"]
        cables = result["cables_json"]
        existing["version"] = new_version
        existing["parent_version"] = str(new_version - 1)
        existing["modules_json"] = modules
        existing["cables_json"] = cables
        existing["sidecar_md"] = result["sidecar_md"]
        _patch_store[patch_id] = existing
        await depot.save_patch(existing)
        write_vcv_file(existing.get("slug") or patch_id, modules, cables)
        _log_tool_call("vcv_patch:edit", True, f"id={patch_id} v={new_version}")
        return {
            "success": True,
            "message": f"patch '{patch_id}' edited to version {new_version}",
            "operation": "edit",
            "patch_id": patch_id,
            "new_version": new_version,
        }

    if op == "validate":
        patch_data = None
        if patch_id:
            patch_data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        elif path:
            p = Path(path)
            if p.exists():
                with open(p) as f:
                    raw = json.load(f)
                patch_data = {
                    "modules_json": json.dumps(raw.get("modules", [])),
                    "cables_json": json.dumps(raw.get("cables", [])),
                }
        if not patch_data:
            return {"success": False, "error": "patch_id or path required"}
        modules = (
            json.loads(patch_data["modules_json"])
            if isinstance(patch_data["modules_json"], str)
            else patch_data["modules_json"]
        )
        cables = (
            json.loads(patch_data["cables_json"])
            if isinstance(patch_data["cables_json"], str)
            else patch_data["cables_json"]
        )
        report = await validate_patch(modules, cables)
        return {
            "success": report["valid"],
            "operation": "validate",
            "valid": report["valid"],
            "report": report["report"],
        }

    if op == "list":
        patches = await depot.list_patches(
            persona=persona if persona != "all" else None, limit=limit
        )
        return {"success": True, "operation": "list", "patches": patches}

    if op == "get":
        if not patch_id:
            return {"success": False, "error": "patch_id required"}
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return {"success": False, "error": f"patch {patch_id} not found"}
        return {"success": True, "operation": "get", "patch": data}

    if op == "open_in_rack":
        if not patch_id:
            return {"success": False, "error": "patch_id required"}
        patch_path = settings.DEPOT_DIR / f"{patch_id}.vcv"
        if not patch_path.exists():
            data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
            if data:
                mods = (
                    json.loads(data["modules_json"])
                    if isinstance(data["modules_json"], str)
                    else data["modules_json"]
                )
                cabs = (
                    json.loads(data["cables_json"])
                    if isinstance(data["cables_json"], str)
                    else data["cables_json"]
                )
                patch_path = write_vcv_file(data.get("slug") or patch_id, mods, cabs)
            else:
                return {"success": False, "error": f"patch file not found at {patch_path}"}
        res = await launch_rack(patch_path)
        _log_tool_call("vcv_patch:open_in_rack", res.get("success", False), f"id={patch_id}")
        res["operation"] = "open_in_rack"
        return res

    if op == "rack_status":
        st = await get_rack_status()
        return {"success": True, "operation": "rack_status", **st}

    if op == "rack_start":
        patch_path = (settings.DEPOT_DIR / f"{patch_id}.vcv") if patch_id else None
        res = await launch_rack(patch_path)
        _log_tool_call("vcv_patch:rack_start", res.get("success", False))
        res["operation"] = "rack_start"
        return res

    if op == "rack_stop":
        res = await stop_rack()
        _log_tool_call("vcv_patch:rack_stop", res.get("success", False))
        res["operation"] = "rack_stop"
        return res

    if op == "rack_cycle":
        await stop_rack()
        patch_path = (settings.DEPOT_DIR / f"{patch_id}.vcv") if patch_id else None
        res = await launch_rack(patch_path)
        res["operation"] = "rack_cycle"
        return res

    if op == "import":
        if not path:
            return {"success": False, "error": "path required"}
        p = Path(path)
        if not p.exists():
            return {"success": False, "error": f"file not found: {path}"}
        with open(p, encoding="utf-8") as f:
            raw = json.load(f)
        slug = _slugify(p.stem)
        pid = slug or str(uuid.uuid4())[:8]
        mods = raw.get("modules", [])
        cabs = raw.get("cables", [])
        patch_data = {
            "id": pid,
            "name": p.stem,
            "slug": slug,
            "persona": "hybrid",
            "description": f"Imported from {path}",
            "version": 1,
            "modules_json": mods,
            "cables_json": cabs,
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        write_vcv_file(slug, mods, cabs)
        _log_tool_call("vcv_patch:import", True, f"id={pid}")
        return {"success": True, "operation": "import", "patch_id": pid}

    if op == "set_module_data":
        if not patch_id or module_id is None:
            return {"success": False, "error": "patch_id and module_id required"}
        if data is None and presets is None:
            return {"success": False, "error": "data or presets required"}
        existing = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not existing:
            return {"success": False, "error": f"patch {patch_id} not found"}
        modules = (
            json.loads(existing["modules_json"])
            if isinstance(existing["modules_json"], str)
            else existing["modules_json"]
        )
        target = next((m for m in modules if m.get("id") == module_id), None)
        if target is None:
            valid_ids = sorted(m.get("id") for m in modules if "id" in m)
            return {
                "success": False,
                "error": f"module_id {module_id} not in patch {patch_id}",
                "valid_module_ids": valid_ids,
            }
        plugin = target.get("plugin", "")
        model = target.get("model", "")
        is_transit = plugin == "Stoermelder-P1" and model in ("Transit", "TransitEx")
        if model == "TransitEx":
            num_slots = 24
        else:
            entry = get_module(plugin, model)
            schema = (entry or {}).get("data_schema") or {}
            num_slots = int(schema.get("slots", 12))
        notes: list[str] = []
        if presets is not None:
            if not is_transit:
                return {
                    "success": False,
                    "error": f"presets spec is only supported for Stoermelder Transit/TransitEx, got {plugin}/{model}",
                }
            if not isinstance(presets, list):
                return {
                    "success": False,
                    "error": "presets must be a list of {label?, fade_time?, color?, values[]}.",
                }
            try:
                target["data"] = build_transit_data(presets, source_maps, num_slots)
            except ValueError as exc:
                return {"success": False, "error": str(exc)}
            notes.append(
                f"Wrote {len(presets)} Transit presets into {plugin}/{model} (mod_{module_id})."
            )
        else:
            if not isinstance(data, dict):
                return {"success": False, "error": "data must be a JSON object."}
            target["data"] = data
            if is_transit:
                problems = validate_transit_data(data, num_slots)
                hard = [p for p in problems if p["severity"] == "error"]
                if hard:
                    return {
                        "success": False,
                        "error": f"Transit data invalid: {hard[0]['message']}",
                        "issues": problems,
                    }
                notes.extend(
                    f"warning: {p['message']}" for p in problems if p["severity"] == "warning"
                )
                notes.append(
                    f"Stored validated Transit data on {plugin}/{model} (mod_{module_id})."
                )
            else:
                notes.append(
                    f"No data_schema for {plugin}/{model} - stored unverified; validate flags it as a warning."
                )
        new_version = existing.get("version", 1) + 1
        existing["version"] = new_version
        existing["parent_version"] = str(new_version - 1)
        existing["modules_json"] = modules
        _patch_store[patch_id] = existing
        await depot.save_patch(existing)
        cabs = (
            json.loads(existing["cables_json"])
            if isinstance(existing["cables_json"], str)
            else existing.get("cables_json", [])
        )
        write_vcv_file(existing.get("slug") or patch_id, modules, cabs)
        return {
            "success": True,
            "operation": "set_module_data",
            "patch_id": patch_id,
            "module_id": module_id,
            "new_version": new_version,
            "notes": notes,
        }

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# vcv_catalog - Portmanteau
# ============================================================================


@mcp.tool(annotations={"readOnlyHint": False})
async def vcv_catalog(
    operation: str,
    query: str | None = None,
    function_tag: str | None = None,
    persona_tag: str | None = None,
    plugin_slug: str | None = None,
    model_slug: str | None = None,
    intent: str | None = None,
    url: str | None = None,
    limit: int = 20,
) -> dict:
    """
    Module catalog portmanteau - search, get_module, verify_installed, library_link, sideload, suggest_rack.

    ## Return Format
    {"success": bool, "operation": str, ...operation-specific keys}

    ## Examples
    vcv_catalog(operation="search", function_tag="osc")
    vcv_catalog(operation="get_module", plugin_slug="Fundamental", model_slug="VCO")
    vcv_catalog(operation="suggest_rack", persona_tag="generative", intent="ambient drone")
    """
    op = operation

    if op == "search":
        results = search_catalog(function_tag=function_tag, persona_tag=persona_tag, text=query)
        return {
            "success": True,
            "operation": "search",
            "count": len(results),
            "modules": results[:limit],
        }

    if op == "get_module":
        if not plugin_slug or not model_slug:
            return {"success": False, "error": "plugin_slug and model_slug required"}
        mod = get_module(plugin_slug, model_slug)
        if not mod:
            return {
                "success": False,
                "error": f"module {plugin_slug}/{model_slug} not found in catalog",
            }
        return {"success": True, "operation": "get_module", "module": mod}

    if op == "verify_installed":
        catalog = load_catalog()
        installed = set(list_installed_plugins())
        missing = []
        for mod in catalog:
            ps = mod.get("plugin_slug", "")
            if ps and ps not in installed and ps not in ("cvOSCcv", "OSCelot"):
                missing.append(ps)
        return {
            "success": True,
            "operation": "verify_installed",
            "plugins_dir": str(settings.PLUGINS_DIR),
            "installed_count": len(installed),
            "total": len(catalog),
            "missing": sorted(set(missing)),
        }

    if op == "library_link":
        if not plugin_slug or not model_slug:
            return {"success": False, "error": "plugin_slug and model_slug required"}
        url = f"https://library.vcvrack.com/{plugin_slug}/{model_slug}"
        return {
            "success": True,
            "operation": "library_link",
            "url": url,
            "note": "Subscribe on this page. Install completes inside Rack on restart - no headless install API exists.",
        }

    if op == "sideload":
        if not url:
            return {"success": False, "error": "url required (GitHub release .vcvplugin)"}
        if "github.com" not in url.lower() or not url.endswith(".vcvplugin"):
            return {
                "success": False,
                "error": "Only GitHub-released .vcvplugin files are accepted. Refusing unknown origin.",
            }
        await depot.save_sideload(
            {
                "plugin_slug": url.split("/")[-1].replace(".vcvplugin", ""),
                "source_url": url,
                "provenance": "github",
            }
        )
        return {
            "success": True,
            "operation": "sideload",
            "message": "Sideload staged. Use rack_cycle to restart Rack for the plugin to load.",
            "url": url,
        }

    if op == "suggest_rack":
        results = search_catalog(persona_tag=persona_tag or "both")
        if intent:
            text_results = search_catalog(text=intent)
            results = results + text_results if text_results else results
        tags = set()
        for m in results:
            tags.update(m.get("function_tags", []))
        return {
            "success": True,
            "operation": "suggest_rack",
            "suggestion": f"Recommended modules for {persona_tag or 'both'}: {', '.join(sorted(tags))}",
            "module_count": len(results),
        }

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# vcv_live - Portmanteau
# ============================================================================


@mcp.tool(annotations={"readOnlyHint": True})
async def vcv_live(
    operation: str,
    patch_id: str | None = None,
) -> dict:
    """
    Live performance portmanteau - address_map, performance_sheet.

    ## Return Format
    {"success": bool, "operation": str, ...}

    ## Examples
    vcv_live(operation="address_map", patch_id="ambient-drone")
    vcv_live(operation="performance_sheet", patch_id="ambient-drone")
    """
    if operation == "address_map":
        if not patch_id:
            return {"success": False, "error": "patch_id required"}
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return {"success": False, "error": f"patch {patch_id} not found"}
        raw_map = data.get("osc_address_map", {})
        addr_map = json.loads(raw_map) if isinstance(raw_map, str) else (raw_map or {})
        return {
            "success": True,
            "operation": "address_map",
            "patch_id": patch_id,
            "address_map": addr_map,
        }

    if operation == "performance_sheet":
        if not patch_id:
            return {"success": False, "error": "patch_id required"}
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return {"success": False, "error": f"patch {patch_id} not found"}
        raw_map = data.get("osc_address_map", {})
        address_map = json.loads(raw_map) if isinstance(raw_map, str) else (raw_map or {})
        sheet = generate_performance_sheet(
            name=data["name"],
            persona=data.get("persona", "hybrid"),
            address_map=address_map,
            signal_flow=f"Generated patch '{data['name']}' ({data.get('persona', 'hybrid')})",
        )
        return {
            "success": True,
            "operation": "performance_sheet",
            "patch_id": patch_id,
            "sheet": sheet,
        }

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# Agentic workflow
# ============================================================================


@mcp.tool(annotations={"readOnlyHint": False})
async def vcv_agentic_workflow(
    brief: str,
    persona: str = "generative",
    max_iterations: int = 3,
    ctx: Any = None,
) -> dict:
    """
    SEP-1577 sampling loop: brief -> catalog selection -> generate -> validate -> retry (max 3).

    Uses ctx.sample when available for autonomous iteration.
    Falls back to structured result with recovery_options for hosts without sampling.

    ## Return Format
    {"success": bool, "patch_id": str, "iterations": int, "report": list}

    ## Examples
    vcv_agentic_workflow(brief="slow ambient drone, two detuned voices, filtered noise swells, big reverb")
    """
    job = await depot.create_job(brief, persona)
    job_id = job["id"]

    last_report = []
    for iteration in range(max_iterations):
        name = f"Agentic {brief[:30]}".strip()
        hints = brief
        result = generate_patch(name=name, description=brief, persona=persona, module_hints=hints)

        modules = result["modules_json"]
        cables = result["cables_json"]
        report = await validate_patch(modules, cables)
        last_report = report["report"]

        if report["valid"]:
            pid = _slugify(name) or str(uuid.uuid4())[:8]
            patch_data = {
                "id": pid,
                "name": name,
                "slug": pid,
                "persona": persona,
                "description": brief,
                "version": 1,
                "modules_json": modules,
                "cables_json": cables,
                "sidecar_md": result.get("sidecar_md", ""),
                "osc_address_map": result.get("osc_map", {}),
                "validation_status": "passed",
            }
            _patch_store[pid] = patch_data
            await depot.save_patch(patch_data)
            write_vcv_file(pid, modules, cables)
            await depot.update_job(
                job_id, status="complete", result_patch_id=pid, iterations=iteration + 1
            )
            return {
                "success": True,
                "patch_id": pid,
                "iterations": iteration + 1,
                "report": last_report,
            }

    await depot.update_job(job_id, status="failed", iterations=max_iterations)
    return {
        "success": False,
        "error": f"Failed to produce valid patch after {max_iterations} iterations",
        "iterations": max_iterations,
        "report": last_report,
        "recovery_options": [
            "Refine the brief and retry",
            "Use vcv_catalog suggest_rack for module recommendations",
        ],
    }


# ============================================================================
# Prefab cards
# ============================================================================


@mcp.tool(app=True, annotations={"readOnlyHint": True})
async def show_patch_card(patch_id: str) -> dict:
    """
    Show a rich in-chat card for a patch.

    ## Return Format
    ToolResult with PrefabApp content.

    ## Examples
    show_patch_card(patch_id="ambient-drone")
    """
    data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
    if not data:
        return {
            "success": False,
            "error": f"patch {patch_id} not found",
            "content": f"Patch {patch_id} not found",
        }

    modules = (
        json.loads(data["modules_json"])
        if isinstance(data["modules_json"], str)
        else data["modules_json"]
    )
    with PrefabApp(title=f"Patch: {data['name']}") as app:
        Heading(data["name"])
        Row(label="Persona", value=data.get("persona", "?"))
        Row(label="Version", value=str(data.get("version", 1)))
        Row(label="Validation", value=data.get("validation_status", "unknown"))
        Row(label="Modules", value=str(len(modules)))
        Badge(label=data.get("persona", "?"))
        if data.get("description"):
            Row(label="Description", value=data["description"][:200])

    return {"success": True, "content": f"Patch: {data['name']}", "structured_content": app}


@mcp.tool(app=True, annotations={"readOnlyHint": True})
async def show_catalog_card(
    function_tag: str | None = None, persona_tag: str | None = None
) -> dict:
    """
    Show a rich in-chat card for the module catalog.

    ## Return Format
    ToolResult with PrefabApp content.

    ## Examples
    show_catalog_card(function_tag="osc")
    show_catalog_card(persona_tag="generative")
    """
    modules = search_catalog(function_tag=function_tag, persona_tag=persona_tag)
    with PrefabApp(title=f"Catalog ({len(modules)} modules)") as app:
        Heading(f"Catalog: {len(modules)} modules")
        for m in modules[:15]:
            tags = ", ".join(m.get("function_tags", []))
            Row(label=m["display_name"], value=tags)
        if len(modules) > 15:
            Row(label="...", value=f"{len(modules) - 15} more")

    return {
        "success": True,
        "content": f"Catalog: {len(modules)} modules",
        "structured_content": app,
    }


# ============================================================================
# Hub status
# ============================================================================


@mcp.tool(annotations={"readOnlyHint": True})
async def hub_status() -> dict:
    """
    Show hub status: catalog size, depot health, Rack path.

    ## Return Format
    {"success": bool, "server": str, "version": str, "catalog_size": int, ...}

    ## Examples
    hub_status()
    """
    catalog = load_catalog()
    rack_ok = settings.RACK_EXE.exists()
    depot_ok = settings.DEPOT_DIR.exists()
    patches = await depot.list_patches(limit=5)
    return {
        "success": True,
        "message": "hub status ok",
        "server": "vcv-rack-mcp",
        "version": "0.1.0",
        "catalog_size": len(catalog),
        "rack_installed": rack_ok,
        "rack_path": str(settings.RACK_EXE) if rack_ok else "not found",
        "depot_ok": depot_ok,
        "recent_patches": len(patches),
    }


@mcp.tool(annotations={"readOnlyHint": False, "destructiveHint": True})
async def vcv_shutdown() -> dict:
    """
    Shut down the vcv-rack-mcp server process gracefully.

    Responds immediately, then exits the process ~500 ms later so
    in-flight responses flush (same contract as POST /api/shutdown).

    ## Return Format
    {"success": bool, "message": str}

    ## Examples
    vcv_shutdown()
    """
    import threading

    threading.Timer(0.5, lambda: os._exit(0)).start()
    return {"success": True, "message": "vcv-rack-mcp shutting down"}


def _error_response(message: str, exc: BaseException) -> dict:
    """Shared error shape with auto-logged traceback (TOOL_DESIGN_STANDARDS 7.1 Pattern 3)."""
    logger.exception("%s: %s", message, exc)
    return {"success": False, "error": f"{message}: {exc}"}


@mcp.resource("skill://vcv-rack-mcp/SKILL.md")
def get_vcv_skill() -> str:
    """Return the VCV Rack MCP SKILL.md instructions."""
    skill_path = settings.SKILLS_DIR / "vcv-rack-mcp" / "SKILL.md"
    if skill_path.exists():
        return skill_path.read_text(encoding="utf-8")
    return "# VCV Rack MCP\nUse vcv_patch, vcv_catalog, vcv_live, and vcv_agentic_workflow."


def _list_skill_files() -> list[dict[str, str]]:
    if not settings.SKILLS_DIR.exists():
        return []
    items = []
    for p in sorted(settings.SKILLS_DIR.glob("*/SKILL.md")):
        name = p.parent.name
        items.append({"name": name, "uri": f"skill://{name}/SKILL.md", "path": str(p)})
    return items


# ============================================================================
# Entry point
# ============================================================================


async def _init():
    settings.DEPOT_DIR.mkdir(parents=True, exist_ok=True)
    await depot.init_db()


def build_app():
    from starlette.applications import Starlette
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Mount, Route

    async def api_status(request: Request) -> JSONResponse:
        catalog = load_catalog()
        rack = await get_rack_status()
        depot_ok = settings.DEPOT_DIR.exists()
        patches = await depot.list_patches(limit=50)
        return JSONResponse(
            {
                "success": True,
                "server": "vcv-rack-mcp",
                "version": "0.1.0",
                "catalog_size": len(catalog),
                "rack_installed": rack["rack_installed"],
                "rack_path": rack["rack_exe"] if rack["rack_installed"] else "not found",
                "rack_running": rack["running"],
                "rack_pids": rack["pids"],
                "rack_user_dir": rack["rack_user_dir"],
                "plugins_dir": rack["plugins_dir"],
                "installed_plugins_count": rack["installed_plugins_count"],
                "depot_ok": depot_ok,
                "recent_patches": len(patches),
            }
        )

    async def api_dashboard(request: Request) -> JSONResponse:
        catalog = load_catalog()
        rack = await get_rack_status()
        patches = await depot.list_patches(limit=100)
        db_conn = await depot._get_db()
        try:
            cur = await db_conn.execute("SELECT COUNT(*) FROM agentic_jobs")
            row = await cur.fetchone()
            jobs_count = int(row[0]) if row else 0
        finally:
            await db_conn.close()
        tools = await mcp.list_tools()
        return JSONResponse(
            {
                "success": True,
                "server": "vcv-rack-mcp",
                "version": "0.1.0",
                "kpis": {
                    "catalog_size": len(catalog),
                    "patches_count": len(patches),
                    "jobs_count": jobs_count,
                    "tools_count": len(tools),
                    "installed_plugins_count": rack["installed_plugins_count"],
                },
                "rack": rack,
                "recent_patches": patches[:6],
                "osc_mcp_base": settings.OSC_MCP_BASE,
            }
        )

    async def api_rack_status(request: Request) -> JSONResponse:
        return JSONResponse({"success": True, **(await get_rack_status())})

    async def api_rack_start(request: Request) -> JSONResponse:
        patch_id = None
        try:
            body = await request.json()
            patch_id = body.get("patch_id")
        except Exception:
            pass
        patch_path = None
        if patch_id:
            patch_path = settings.DEPOT_DIR / f"{patch_id}.vcv"
            if not patch_path.exists():
                data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
                if data:
                    mods = (
                        json.loads(data["modules_json"])
                        if isinstance(data["modules_json"], str)
                        else data["modules_json"]
                    )
                    cabs = (
                        json.loads(data["cables_json"])
                        if isinstance(data["cables_json"], str)
                        else data["cables_json"]
                    )
                    patch_path = write_vcv_file(data.get("slug") or patch_id, mods, cabs)
        res = await launch_rack(patch_path)
        return JSONResponse(res, status_code=200 if res.get("success") else 400)

    async def api_rack_stop(request: Request) -> JSONResponse:
        res = await stop_rack()
        return JSONResponse(res)

    async def api_rack_config(request: Request) -> JSONResponse:
        body = await request.json()
        settings.update_rack_paths(
            rack_exe=body.get("rack_exe"),
            rack_user_dir=body.get("rack_user_dir"),
        )
        return JSONResponse({"success": True, **(await get_rack_status())})

    async def api_catalog(request: Request) -> JSONResponse:
        function_tag = request.query_params.get("function_tag")
        persona_tag = request.query_params.get("persona_tag")
        query = request.query_params.get("query")
        modules = search_catalog(function_tag=function_tag, persona_tag=persona_tag, text=query)
        return JSONResponse({"success": True, "modules": modules})

    async def api_patches_list(request: Request) -> JSONResponse:
        persona = request.query_params.get("persona")
        limit = int(request.query_params.get("limit", "50"))
        patches = await depot.list_patches(
            persona=persona if persona != "all" else None, limit=limit
        )
        return JSONResponse({"success": True, "patches": patches})

    async def api_patches_create(request: Request) -> JSONResponse:
        body = await request.json()
        name = body.get("name")
        description = body.get("description", "")
        persona = body.get("persona", "generative")
        module_hints = body.get("module_hints")
        if not name:
            return JSONResponse({"success": False, "error": "name is required"}, status_code=400)
        slug = _slugify(name)
        pid = slug or str(uuid.uuid4())[:8]
        result = generate_patch(
            name=name, description=description, persona=persona, module_hints=module_hints
        )
        modules = result["modules_json"]
        cables = result["cables_json"]
        osc_map = result.get("osc_map", {})
        patch_data = {
            "id": pid,
            "name": name,
            "slug": slug,
            "persona": persona,
            "description": description,
            "version": 1,
            "modules_json": modules,
            "cables_json": cables,
            "sidecar_md": result["sidecar_md"],
            "osc_address_map": osc_map,
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        patch_path = write_vcv_file(slug, modules, cables)
        return JSONResponse(
            {"success": True, "patch_id": pid, "path": str(patch_path)}
        )

    async def api_patches_get(request: Request) -> JSONResponse:
        patch_id = request.path_params["id"]
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return JSONResponse(
                {"success": False, "error": f"patch {patch_id} not found"}, status_code=404
            )
        return JSONResponse({"success": True, "patch": data})

    async def api_patches_validate(request: Request) -> JSONResponse:
        patch_id = request.path_params["id"]
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return JSONResponse(
                {"success": False, "error": f"patch {patch_id} not found"}, status_code=404
            )
        mods = (
            json.loads(data["modules_json"])
            if isinstance(data["modules_json"], str)
            else data["modules_json"]
        )
        cabs = (
            json.loads(data["cables_json"])
            if isinstance(data["cables_json"], str)
            else data["cables_json"]
        )
        report = await validate_patch(mods, cabs)
        data["validation_status"] = "passed" if report["valid"] else "failed"
        await depot.save_patch(data)
        return JSONResponse({"success": True, "valid": report["valid"], "report": report["report"]})

    async def api_patches_open(request: Request) -> JSONResponse:
        patch_id = request.path_params["id"]
        patch_path = settings.DEPOT_DIR / f"{patch_id}.vcv"
        if not patch_path.exists():
            data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
            if data:
                mods = (
                    json.loads(data["modules_json"])
                    if isinstance(data["modules_json"], str)
                    else data["modules_json"]
                )
                cabs = (
                    json.loads(data["cables_json"])
                    if isinstance(data["cables_json"], str)
                    else data["cables_json"]
                )
                patch_path = write_vcv_file(data.get("slug") or patch_id, mods, cabs)
            else:
                return JSONResponse(
                    {"success": False, "error": f"patch file not found at {patch_path}"},
                    status_code=404,
                )
        res = await launch_rack(patch_path)
        return JSONResponse(res, status_code=200 if res.get("success") else 500)

    async def api_jobs_list(request: Request) -> JSONResponse:
        db_conn = await depot._get_db()
        try:
            cursor = await db_conn.execute(
                "SELECT * FROM agentic_jobs ORDER BY created_at DESC LIMIT 50"
            )
            rows = await cursor.fetchall()
            jobs = [dict(r) for r in rows]
            return JSONResponse({"success": True, "jobs": jobs})
        finally:
            await db_conn.close()

    async def api_jobs_create(request: Request) -> JSONResponse:
        body = await request.json()
        brief = body.get("brief")
        persona = body.get("persona", "generative")
        if not brief:
            return JSONResponse({"success": False, "error": "brief is required"}, status_code=400)
        job = await depot.create_job(brief, persona)
        asyncio.create_task(vcv_agentic_workflow(brief=brief, persona=persona))
        return JSONResponse({"success": True, "job_id": job["id"], "job": job})

    async def api_health(request: Request) -> JSONResponse:
        return JSONResponse({"status": "ok", "service": "vcv-rack-mcp"})

    def _serialize_annotations(ann: Any) -> dict[str, Any]:
        if ann is None:
            return {}
        if hasattr(ann, "model_dump"):
            return ann.model_dump(exclude_none=True)
        return ann if isinstance(ann, dict) else {}

    async def api_tools(request: Request) -> JSONResponse:
        tools = await mcp.list_tools()
        items = []
        for t in tools:
            schema = getattr(t, "parameters", None) or {}
            items.append(
                {
                    "name": t.name,
                    "description": t.description or "",
                    "parameters": schema,
                    "annotations": _serialize_annotations(getattr(t, "annotations", None)),
                    "is_portmanteau": "operation" in (schema.get("properties") or {}),
                }
            )
        return JSONResponse({"success": True, "tools": items})

    async def api_tool_detail(request: Request) -> JSONResponse:
        name = request.path_params["name"]
        tools = await mcp.list_tools()
        for t in tools:
            if t.name == name:
                schema = getattr(t, "parameters", None) or {}
                return JSONResponse(
                    {
                        "success": True,
                        "tool": {
                            "name": t.name,
                            "description": t.description or "",
                            "parameters": schema,
                            "annotations": _serialize_annotations(getattr(t, "annotations", None)),
                            "is_portmanteau": "operation" in (schema.get("properties") or {}),
                        },
                    }
                )
        return JSONResponse({"success": False, "error": f"tool {name} not found"}, status_code=404)

    async def api_tool_run(request: Request) -> JSONResponse:
        name = request.path_params["name"]
        try:
            body = await request.json()
        except Exception:
            body = {}
        try:
            res = await mcp.call_tool(name, body)
            _log_tool_call(name, True, "via /api/tools/run")
            if hasattr(res, "structured_content") and res.structured_content is not None:
                return JSONResponse({"success": True, "result": res.structured_content})
            texts = [getattr(c, "text", str(c)) for c in (getattr(res, "content", None) or [])]
            return JSONResponse({"success": True, "result": texts[0] if len(texts) == 1 else texts})
        except Exception as exc:
            _log_tool_call(name, False, str(exc))
            return JSONResponse({"success": False, "error": str(exc)}, status_code=400)

    async def api_skills(request: Request) -> JSONResponse:
        return JSONResponse({"success": True, "skills": _list_skill_files()})

    async def api_skill_detail(request: Request) -> JSONResponse:
        from starlette.responses import PlainTextResponse

        name = request.path_params["name"]
        skill_path = settings.SKILLS_DIR / name / "SKILL.md"
        if not skill_path.exists():
            return JSONResponse({"success": False, "error": f"skill {name} not found"}, status_code=404)
        content = skill_path.read_text(encoding="utf-8")
        if request.url.path.startswith("/skill/"):
            return PlainTextResponse(content, media_type="text/markdown")
        return JSONResponse({"success": True, "name": name, "uri": f"skill://{name}/SKILL.md", "content": content})

    async def api_logs(request: Request) -> JSONResponse:
        level = request.query_params.get("level")
        kind = request.query_params.get("kind")
        limit = int(request.query_params.get("limit", "200"))
        return JSONResponse({"success": True, "logs": ring_handler.query(level=level, kind=kind, limit=limit)})

    async def api_llm_providers(request: Request) -> JSONResponse:
        providers = await probe_providers()
        return JSONResponse({"success": True, "providers": providers})

    async def api_llm_models(request: Request) -> JSONResponse:
        provider = request.query_params.get("provider", "ollama")
        models = await list_models(provider)
        return JSONResponse({"success": True, "provider": provider, "models": models})

    async def api_llm_gpus(request: Request) -> JSONResponse:
        return JSONResponse({"success": True, "gpus": await get_gpus()})

    async def api_llm_chat(request: Request) -> JSONResponse:
        body = await request.json()
        provider = body.get("provider", "ollama")
        model = body.get("model", "")
        messages = body.get("messages") or []
        if not model:
            return JSONResponse({"success": False, "error": "model is required"}, status_code=400)
        try:
            res = await chat_completion(
                provider=provider,
                model=model,
                messages=messages,
                temperature=float(body.get("temperature", 0.7)),
            )
            return JSONResponse(res)
        except Exception as exc:
            return JSONResponse({"success": False, "error": str(exc)}, status_code=502)

    async def api_apps(request: Request) -> JSONResponse:
        reg_path = Path(r"D:\Dev\repos\mcp-central-docs\operations\fleet-registry.json")
        apps: list[dict[str, Any]] = []
        if reg_path.exists():
            try:
                raw = json.loads(reg_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict) and isinstance(raw.get("apps"), list):
                    apps = raw["apps"]
                elif isinstance(raw, list):
                    apps = raw
            except Exception:
                pass
        return JSONResponse({"success": True, "apps": apps})

    async def api_capabilities(request: Request) -> JSONResponse:
        tools = sorted({t.name for t in await mcp.list_tools()})
        return JSONResponse(
            {
                "success": True,
                "server": "vcv-rack-mcp",
                "version": "0.1.0",
                "tools": tools,
                "routes": [
                    "/health",
                    "/api/health",
                    "/mcp",
                    "/api/status",
                    "/api/dashboard",
                    "/api/rack/status",
                    "/api/rack/start",
                    "/api/rack/stop",
                    "/api/rack/config",
                    "/api/capabilities",
                    "/api/catalog",
                    "/api/patches",
                    "/api/jobs",
                    "/api/tools",
                    "/api/skills",
                    "/api/logs",
                    "/api/llm/providers",
                    "/api/llm/models",
                    "/api/llm/gpus",
                    "/api/llm/chat",
                    "/api/apps",
                    "/api/shutdown",
                ],
            }
        )

    async def api_shutdown(request: Request) -> JSONResponse:
        import threading

        threading.Timer(0.5, lambda: os._exit(0)).start()
        return JSONResponse({"success": True, "message": "shutting down"})

    mcp_asgi = mcp.http_app(path="/", transport="http", stateless_http=True)
    cors = Middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:10917",
            "http://localhost:10917",
            "http://goliath:10917",
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
        ],
        allow_origin_regex=r"https?://(127\.0\.0\.1|localhost|goliath|[a-z0-9-]+\.ts\.net)(:\d+)?",
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return Starlette(
        routes=[
            Route("/health", endpoint=api_health),
            Route("/api/health", endpoint=api_health),
            Mount("/mcp", app=mcp_asgi),
            Route("/api/status", endpoint=api_status),
            Route("/api/dashboard", endpoint=api_dashboard),
            Route("/api/rack/status", endpoint=api_rack_status),
            Route("/api/rack/start", endpoint=api_rack_start, methods=["POST"]),
            Route("/api/rack/stop", endpoint=api_rack_stop, methods=["POST"]),
            Route("/api/rack/config", endpoint=api_rack_config, methods=["POST"]),
            Route("/api/catalog", endpoint=api_catalog),
            Route("/api/patches", endpoint=api_patches_list),
            Route("/api/patches", endpoint=api_patches_create, methods=["POST"]),
            Route("/api/patches/{id}", endpoint=api_patches_get),
            Route("/api/patches/{id}/validate", endpoint=api_patches_validate, methods=["POST"]),
            Route("/api/patches/{id}/open", endpoint=api_patches_open, methods=["POST"]),
            Route("/api/jobs", endpoint=api_jobs_list),
            Route("/api/jobs", endpoint=api_jobs_create, methods=["POST"]),
            Route("/api/tools", endpoint=api_tools),
            Route("/api/tools/{name}", endpoint=api_tool_detail),
            Route("/api/tools/{name}/run", endpoint=api_tool_run, methods=["POST"]),
            Route("/api/skills", endpoint=api_skills),
            Route("/api/skills/{name}", endpoint=api_skill_detail),
            Route("/skill/{name}", endpoint=api_skill_detail),
            Route("/api/logs", endpoint=api_logs),
            Route("/api/llm/providers", endpoint=api_llm_providers),
            Route("/api/llm/models", endpoint=api_llm_models),
            Route("/api/llm/gpus", endpoint=api_llm_gpus),
            Route("/api/llm/chat", endpoint=api_llm_chat, methods=["POST"]),
            Route("/api/apps", endpoint=api_apps),
            Route("/api/capabilities", endpoint=api_capabilities),
            Route("/api/shutdown", endpoint=api_shutdown, methods=["POST"]),
        ],
        middleware=[cors],
        lifespan=mcp_asgi.lifespan,
    )


def main():
    import argparse

    parser = argparse.ArgumentParser(description="vcv-rack-mcp server")
    parser.add_argument("--http", action="store_true", help="Start HTTP transport")
    parser.add_argument("--port", type=int, default=settings.PORT, help="Port")
    parser.add_argument("--host", type=str, default=settings.HOST, help="Host")
    args, unknown = parser.parse_known_args()

    asyncio.run(_init())
    console.print("[bold cyan]VCV Rack MCP - patch authorship server[/bold cyan]")
    console.print(f"  Catalog: {len(load_catalog())} modules")
    console.print(f"  Rack:    {settings.RACK_EXE}")
    console.print(f"  Depot:   {settings.DEPOT_DIR}")

    if args.http or os.environ.get("PORT") or os.environ.get("MCP_PORT"):
        import uvicorn

        app = build_app()
        port = int(os.environ.get("PORT") or os.environ.get("MCP_PORT") or args.port)
        uvicorn.run(app, host=args.host, port=port)
    else:
        try:
            mcp.run(transport="stdio")
        except KeyboardInterrupt:
            console.print("\n[yellow]Shutdown[/yellow]")


if __name__ == "__main__":
    main()
