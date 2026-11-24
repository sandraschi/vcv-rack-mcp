"""Async HTTP client for the in-process VCVBridge Rack 2 plugin."""

from __future__ import annotations

from typing import Any

import httpx

from .config import settings

BRIDGE_TIMEOUT = 5.0


async def _get(path: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT) as client:
            res = await client.get(f"{settings.BRIDGE_URL}{path}")
            res.raise_for_status()
            return res.json()
    except Exception as exc:
        return {
            "success": False,
            "error": f"VCVBridge unreachable at {settings.BRIDGE_URL}: {exc}. Ensure Rack is running with the VCVBridge module in the patch.",
        }


async def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=BRIDGE_TIMEOUT) as client:
            res = await client.post(f"{settings.BRIDGE_URL}{path}", json=payload)
            res.raise_for_status()
            return res.json()
    except Exception as exc:
        return {
            "success": False,
            "error": f"VCVBridge unreachable at {settings.BRIDGE_URL}: {exc}. Ensure Rack is running with the VCVBridge module in the patch.",
        }


async def bridge_health() -> dict[str, Any]:
    return await _get("/health")


async def bridge_state() -> dict[str, Any]:
    return await _get("/state")


async def bridge_add_module(
    plugin: str, model: str, x: float = 0.0, y: float = 0.0
) -> dict[str, Any]:
    return await _post("/module/add", {"plugin": plugin, "model": model, "x": x, "y": y})


async def bridge_remove_module(module_id: int) -> dict[str, Any]:
    return await _post("/module/remove", {"module_id": module_id})


async def bridge_add_cable(
    output_module_id: int, output_id: int, input_module_id: int, input_id: int
) -> dict[str, Any]:
    return await _post(
        "/cable/add",
        {
            "output_module_id": output_module_id,
            "output_id": output_id,
            "input_module_id": input_module_id,
            "input_id": input_id,
        },
    )


async def bridge_remove_cable(cable_id: int) -> dict[str, Any]:
    return await _post("/cable/remove", {"cable_id": cable_id})


async def bridge_set_param(module_id: int, param_id: int, value: float) -> dict[str, Any]:
    return await _post(
        "/param/set", {"module_id": module_id, "param_id": param_id, "value": value}
    )
