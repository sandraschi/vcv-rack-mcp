"""
vcv-rack-mcp — MCP server for VCV Rack 2 patch authorship.

Generates valid .vcv patch files from natural-language descriptions,
maintains a curated module catalog, emits OSC address maps for live
control via osc-mcp, and validates patches via 3-layer checks.
"""

import asyncio
import json
import logging
import os
import re
import subprocess
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
from .osc_bridge import generate_performance_sheet
from .patch_generator import generate_patch
from .patch_validator import validate_patch

logger = logging.getLogger(__name__)
console = Console()

mcp = FastMCP(
    "VCV-Rack-MCP",
    instructions="""
    MCP server for VCV Rack 2 built around patch authorship.
    .vcv patch files are plain JSON, so an LLM can compose modular
    synth patches by emitting structured data.

    TOOLS:
    - vcv_patch: create, edit, validate, list, get, open_in_rack, rack_cycle, import
    - vcv_catalog: search, get_module, verify_installed, library_link, sideload, suggest_rack
    - vcv_live: address_map, performance_sheet
    - vcv_agentic_workflow: ctx.sample loop for iterative generation
    """
)

_patch_store: dict[str, dict] = {}


def _slugify(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

# ============================================================================
# vcv_patch — Portmanteau
# ============================================================================

@mcp.tool()
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
) -> dict:
    """
    Patch authorship portmanteau — create, edit, validate, list, get, open_in_rack, rack_cycle, import.

    ## Return Format
    {"success": bool, "operation": str, ...operation-specific keys}

    ## Examples
    vcv_patch(operation="create", name="Ambient Drone", persona="generative", description="slow detuned drone")
    vcv_patch(operation="validate", patch_id="ambient-drone")
    vcv_patch(operation="list", persona="generative")
    """
    op = operation

    if op == "create":
        if not name:
            return {"success": False, "error": "name is required"}
        slug = _slugify(name)
        pid = slug or str(uuid.uuid4())[:8]
        result = generate_patch(name=name, description=description, persona=persona, module_hints=module_hints)
        patch_data = {
            "id": pid,
            "name": name,
            "slug": slug,
            "persona": persona,
            "description": description,
            "version": 1,
            "modules_json": json.dumps(result["modules_json"]),
            "cables_json": json.dumps(result["cables_json"]),
            "sidecar_md": result["sidecar_md"],
            "osc_address_map": json.dumps(result.get("osc_map", {})),
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        return {"success": True, "operation": "create", "patch_id": pid, "path": str(settings.DEPOT_DIR / f"{slug}.vcv"), "warnings": result.get("warnings", [])}

    if op == "edit":
        if not patch_id or not instruction:
            return {"success": False, "error": "patch_id and instruction required"}
        existing = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not existing:
            return {"success": False, "error": f"patch {patch_id} not found"}
        new_version = existing.get("version", 1) + 1
        result = generate_patch(name=existing["name"], description=instruction, persona=existing.get("persona", "generative"))
        existing["version"] = new_version
        existing["parent_version"] = str(new_version - 1)
        existing["modules_json"] = json.dumps(result["modules_json"])
        existing["cables_json"] = json.dumps(result["cables_json"])
        existing["sidecar_md"] = result["sidecar_md"]
        _patch_store[patch_id] = existing
        await depot.save_patch(existing)
        return {"success": True, "operation": "edit", "patch_id": patch_id, "new_version": new_version}

    if op == "validate":
        patch_data = None
        if patch_id:
            patch_data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        elif path:
            p = Path(path)
            if p.exists():
                with open(p) as f:
                    raw = json.load(f)
                patch_data = {"modules_json": json.dumps(raw.get("modules", [])), "cables_json": json.dumps(raw.get("cables", []))}
        if not patch_data:
            return {"success": False, "error": "patch_id or path required"}
        modules = json.loads(patch_data["modules_json"]) if isinstance(patch_data["modules_json"], str) else patch_data["modules_json"]
        cables = json.loads(patch_data["cables_json"]) if isinstance(patch_data["cables_json"], str) else patch_data["cables_json"]
        report = await validate_patch(modules, cables)
        return {"success": report["valid"], "operation": "validate", "valid": report["valid"], "report": report["report"]}

    if op == "list":
        patches = await depot.list_patches(persona=persona if persona != "all" else None, limit=limit)
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
        if not settings.RACK_EXE.exists():
            return {"success": False, "error": f"Rack not found at {settings.RACK_EXE}"}
        try:
            subprocess.run(["tasklist", "/FI", "IMAGENAME eq Rack.exe"], capture_output=True, text=True, timeout=5)
        except Exception:
            pass
        patch_path = settings.DEPOT_DIR / f"{patch_id}.vcv"
        if not patch_path.exists():
            return {"success": False, "error": f"patch file not found at {patch_path}"}
        subprocess.Popen([str(settings.RACK_EXE), str(patch_path)])
        return {"success": True, "operation": "open_in_rack", "pid": "launched"}

    if op == "rack_cycle":
        return {"success": True, "operation": "rack_cycle", "message": "Restart choreography: close Rack, stage files, relaunch. Use confirm=true to proceed. (GUI automation is banned — process lifecycle only.)"}

    if op == "import":
        if not path:
            return {"success": False, "error": "path required"}
        p = Path(path)
        if not p.exists():
            return {"success": False, "error": f"file not found: {path}"}
        with open(p) as f:
            raw = json.load(f)
        slug = _slugify(p.stem)
        pid = slug or str(uuid.uuid4())[:8]
        patch_data = {
            "id": pid, "name": p.stem, "slug": slug, "persona": "hybrid",
            "description": f"Imported from {path}", "version": 1,
            "modules_json": json.dumps(raw.get("modules", [])),
            "cables_json": json.dumps(raw.get("cables", [])),
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        return {"success": True, "operation": "import", "patch_id": pid}

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# vcv_catalog — Portmanteau
# ============================================================================

@mcp.tool()
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
    Module catalog portmanteau — search, get_module, verify_installed, library_link, sideload, suggest_rack.

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
        return {"success": True, "operation": "search", "count": len(results), "modules": results[:limit]}

    if op == "get_module":
        if not plugin_slug or not model_slug:
            return {"success": False, "error": "plugin_slug and model_slug required"}
        mod = get_module(plugin_slug, model_slug)
        if not mod:
            return {"success": False, "error": f"module {plugin_slug}/{model_slug} not found in catalog"}
        return {"success": True, "operation": "get_module", "module": mod}

    if op == "verify_installed":
        catalog = load_catalog()
        installed = set()
        if settings.PLUGINS_DIR.exists():
            for d in settings.PLUGINS_DIR.iterdir():
                if d.is_dir():
                    installed.add(d.name)
        missing = []
        for mod in catalog:
            ps = mod.get("plugin_slug", "")
            if ps and ps not in installed and ps not in ("cvOSCcv", "OSCelot"):
                missing.append(ps)
        return {"success": True, "operation": "verify_installed", "total": len(catalog), "missing": list(set(missing))}

    if op == "library_link":
        if not plugin_slug or not model_slug:
            return {"success": False, "error": "plugin_slug and model_slug required"}
        url = f"https://library.vcvrack.com/{plugin_slug}/{model_slug}"
        return {"success": True, "operation": "library_link", "url": url, "note": "Subscribe on this page. Install completes inside Rack on restart — no headless install API exists."}

    if op == "sideload":
        if not url:
            return {"success": False, "error": "url required (GitHub release .vcvplugin)"}
        if "github.com" not in url.lower() or not url.endswith(".vcvplugin"):
            return {"success": False, "error": "Only GitHub-released .vcvplugin files are accepted. Refusing unknown origin."}
        await depot.save_sideload({"plugin_slug": url.split("/")[-1].replace(".vcvplugin", ""), "source_url": url, "provenance": "github"})
        return {"success": True, "operation": "sideload", "message": "Sideload staged. Use rack_cycle to restart Rack for the plugin to load.", "url": url}

    if op == "suggest_rack":
        results = search_catalog(persona_tag=persona_tag or "both")
        if intent:
            text_results = search_catalog(text=intent)
            results = results + text_results if text_results else results
        tags = set()
        for m in results:
            tags.update(m.get("function_tags", []))
        return {"success": True, "operation": "suggest_rack", "suggestion": f"Recommended modules for {persona_tag or 'both'}: {', '.join(sorted(tags))}", "module_count": len(results)}

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# vcv_live — Portmanteau
# ============================================================================

@mcp.tool()
async def vcv_live(
    operation: str,
    patch_id: str | None = None,
) -> dict:
    """
    Live performance portmanteau — address_map, performance_sheet.

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
        return {"success": True, "operation": "address_map", "patch_id": patch_id, "address_map": json.loads(data.get("osc_address_map", "{}"))}

    if operation == "performance_sheet":
        if not patch_id:
            return {"success": False, "error": "patch_id required"}
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return {"success": False, "error": f"patch {patch_id} not found"}
        json.loads(data["modules_json"]) if isinstance(data["modules_json"], str) else data["modules_json"]
        address_map = json.loads(data.get("osc_address_map", "{}"))
        sheet = generate_performance_sheet(
            name=data["name"],
            persona=data.get("persona", "hybrid"),
            address_map=address_map,
            signal_flow=f"Generated patch '{data['name']}' ({data.get('persona', 'hybrid')})",
        )
        return {"success": True, "operation": "performance_sheet", "patch_id": patch_id, "sheet": sheet}

    return {"success": False, "error": f"unknown operation: {operation}"}


# ============================================================================
# Agentic workflow
# ============================================================================

@mcp.tool()
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
                "id": pid, "name": name, "slug": pid, "persona": persona,
                "description": brief, "version": 1,
                "modules_json": json.dumps(modules), "cables_json": json.dumps(cables),
                "sidecar_md": result.get("sidecar_md", ""),
                "osc_address_map": json.dumps(result.get("osc_map", {})),
                "validation_status": "passed",
            }
            _patch_store[pid] = patch_data
            await depot.save_patch(patch_data)
            await depot.update_job(job_id, status="complete", result_patch_id=pid, iterations=iteration + 1)
            return {"success": True, "patch_id": pid, "iterations": iteration + 1, "report": last_report}

    await depot.update_job(job_id, status="failed", iterations=max_iterations)
    return {
        "success": False,
        "error": f"Failed to produce valid patch after {max_iterations} iterations",
        "iterations": max_iterations,
        "report": last_report,
        "recovery_options": ["Refine the brief and retry", "Use vcv_catalog suggest_rack for module recommendations"],
    }


# ============================================================================
# Prefab cards
# ============================================================================

@mcp.tool(app=True)
async def show_patch_card(patch_id: str) -> dict:
    """
    Show a rich in-chat card for a patch.

    ## Return Format
    ToolResult with PrefabApp content.
    """
    data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
    if not data:
        return {"success": False, "error": f"patch {patch_id} not found", "content": f"Patch {patch_id} not found"}

    modules = json.loads(data["modules_json"]) if isinstance(data["modules_json"], str) else data["modules_json"]
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


@mcp.tool(app=True)
async def show_catalog_card(function_tag: str | None = None, persona_tag: str | None = None) -> dict:
    """
    Show a rich in-chat card for the module catalog.

    ## Return Format
    ToolResult with PrefabApp content.
    """
    modules = search_catalog(function_tag=function_tag, persona_tag=persona_tag)
    with PrefabApp(title=f"Catalog ({len(modules)} modules)") as app:
        Heading(f"Catalog: {len(modules)} modules")
        for m in modules[:15]:
            tags = ", ".join(m.get("function_tags", []))
            Row(label=m["display_name"], value=tags)
        if len(modules) > 15:
            Row(label="...", value=f"{len(modules) - 15} more")

    return {"success": True, "content": f"Catalog: {len(modules)} modules", "structured_content": app}


# ============================================================================
# Hub status
# ============================================================================

@mcp.tool()
async def hub_status() -> dict:
    """
    Show hub status: catalog size, depot health, Rack path.
    """
    catalog = load_catalog()
    rack_ok = settings.RACK_EXE.exists()
    depot_ok = settings.DEPOT_DIR.exists()
    patches = await depot.list_patches(limit=5)
    return {
        "success": True,
        "server": "vcv-rack-mcp",
        "version": "0.1.0",
        "catalog_size": len(catalog),
        "rack_installed": rack_ok,
        "rack_path": str(settings.RACK_EXE) if rack_ok else "not found",
        "depot_ok": depot_ok,
        "recent_patches": len(patches),
    }


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
        rack_ok = settings.RACK_EXE.exists()
        depot_ok = settings.DEPOT_DIR.exists()
        patches = await depot.list_patches(limit=5)
        return JSONResponse({
            "success": True,
            "server": "vcv-rack-mcp",
            "version": "0.1.0",
            "catalog_size": len(catalog),
            "rack_installed": rack_ok,
            "rack_path": str(settings.RACK_EXE) if rack_ok else "not found",
            "depot_ok": depot_ok,
            "recent_patches": len(patches),
        })

    async def api_catalog(request: Request) -> JSONResponse:
        function_tag = request.query_params.get("function_tag")
        persona_tag = request.query_params.get("persona_tag")
        query = request.query_params.get("query")
        modules = search_catalog(function_tag=function_tag, persona_tag=persona_tag, text=query)
        return JSONResponse({"success": True, "modules": modules})

    async def api_patches_list(request: Request) -> JSONResponse:
        persona = request.query_params.get("persona")
        limit = int(request.query_params.get("limit", "50"))
        patches = await depot.list_patches(persona=persona if persona != "all" else None, limit=limit)
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
        result = generate_patch(name=name, description=description, persona=persona, module_hints=module_hints)
        patch_data = {
            "id": pid,
            "name": name,
            "slug": slug,
            "persona": persona,
            "description": description,
            "version": 1,
            "modules_json": json.dumps(result["modules_json"]),
            "cables_json": json.dumps(result["cables_json"]),
            "sidecar_md": result["sidecar_md"],
            "osc_address_map": json.dumps(result.get("osc_map", {})),
            "validation_status": "unknown",
        }
        _patch_store[pid] = patch_data
        await depot.save_patch(patch_data)
        return JSONResponse({"success": True, "patch_id": pid, "path": str(settings.DEPOT_DIR / f"{slug}.vcv")})

    async def api_patches_get(request: Request) -> JSONResponse:
        patch_id = request.path_params["id"]
        data = _patch_store.get(patch_id) or await depot.get_patch(patch_id)
        if not data:
            return JSONResponse({"success": False, "error": f"patch {patch_id} not found"}, status_code=404)
        return JSONResponse({"success": True, "patch": data})

    async def api_patches_open(request: Request) -> JSONResponse:
        patch_id = request.path_params["id"]
        patch_path = settings.DEPOT_DIR / f"{patch_id}.vcv"
        if not patch_path.exists():
            return JSONResponse({"success": False, "error": f"patch file not found at {patch_path}"}, status_code=404)
        if not settings.RACK_EXE.exists():
            return JSONResponse({"success": False, "error": f"Rack not found at {settings.RACK_EXE}"}, status_code=500)
        subprocess.Popen([str(settings.RACK_EXE), str(patch_path)])
        return JSONResponse({"success": True, "pid": "launched"})

    async def api_jobs_list(request: Request) -> JSONResponse:
        db_conn = await depot._get_db()
        try:
            cursor = await db_conn.execute("SELECT * FROM agentic_jobs ORDER BY created_at DESC LIMIT 50")
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

    mcp_asgi = mcp.http_app(path="/", transport="http", stateless_http=True)
    cors = Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    return Starlette(
        routes=[
            Mount("/mcp", app=mcp_asgi),
            Route("/api/status", endpoint=api_status),
            Route("/api/catalog", endpoint=api_catalog),
            Route("/api/patches", endpoint=api_patches_list),
            Route("/api/patches", endpoint=api_patches_create, methods=["POST"]),
            Route("/api/patches/{id}", endpoint=api_patches_get),
            Route("/api/patches/{id}/open", endpoint=api_patches_open, methods=["POST"]),
            Route("/api/jobs", endpoint=api_jobs_list),
            Route("/api/jobs", endpoint=api_jobs_create, methods=["POST"]),
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
    console.print("[bold cyan]VCV Rack MCP — patch authorship server[/bold cyan]")
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
