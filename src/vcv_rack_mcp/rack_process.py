"""VCV Rack 2 process detection, launch, stop, and .vcv file writing."""

from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any

from .config import settings

logger = logging.getLogger(__name__)


def _list_rack_pids_sync() -> list[int]:
    """Return PIDs of running Rack.exe / Rack processes."""
    pids: list[int] = []
    try:
        if os.name == "nt":
            proc = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq Rack.exe", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if proc.returncode == 0 and proc.stdout:
                reader = csv.reader(io.StringIO(proc.stdout.strip()))
                for row in reader:
                    if len(row) >= 2 and row[0].lower() == "rack.exe":
                        try:
                            pids.append(int(row[1]))
                        except ValueError:
                            pass
        else:
            proc = subprocess.run(
                ["pgrep", "-x", "Rack"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if proc.returncode == 0:
                for line in proc.stdout.splitlines():
                    try:
                        pids.append(int(line.strip()))
                    except ValueError:
                        pass
    except Exception as exc:
        logger.debug("Rack process probe failed: %s", exc)
    return pids


def list_installed_plugins() -> list[str]:
    """Return sorted list of installed plugin directory slugs."""
    if not settings.PLUGINS_DIR.exists():
        return []
    return sorted(
        d.name for d in settings.PLUGINS_DIR.iterdir() if d.is_dir() and not d.name.startswith(".")
    )


async def get_rack_status() -> dict[str, Any]:
    """Return comprehensive VCV Rack 2 installation and runtime status."""
    pids = await asyncio.to_thread(_list_rack_pids_sync)
    plugins = await asyncio.to_thread(list_installed_plugins)
    return {
        "rack_installed": settings.RACK_EXE.exists(),
        "rack_exe": str(settings.RACK_EXE),
        "rack_user_dir": str(settings.RACK_USER_DIR),
        "rack_user_dir_exists": settings.RACK_USER_DIR.exists(),
        "plugins_dir": str(settings.PLUGINS_DIR),
        "plugins_dir_exists": settings.PLUGINS_DIR.exists(),
        "installed_plugins_count": len(plugins),
        "installed_plugins": plugins,
        "running": len(pids) > 0,
        "pids": pids,
    }


def write_vcv_file(slug: str, modules: list[dict], cables: list[dict]) -> Path:
    """Write a valid VCV Rack 2 .vcv JSON file into DEPOT_DIR."""
    settings.DEPOT_DIR.mkdir(parents=True, exist_ok=True)
    patch_path = settings.DEPOT_DIR / f"{slug}.vcv"
    payload = {
        "version": "2.0.0",
        "modules": modules,
        "cables": cables,
    }
    patch_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return patch_path


async def launch_rack(patch_path: Path | None = None) -> dict[str, Any]:
    """Launch VCV Rack 2, optionally opening a specific .vcv patch file."""
    if not settings.RACK_EXE.exists():
        return {
            "success": False,
            "error": f"VCV Rack executable not found at {settings.RACK_EXE}. Configure RACK_EXE in Settings.",
        }
    cmd = [str(settings.RACK_EXE)]
    if patch_path is not None:
        if not patch_path.exists():
            return {"success": False, "error": f"Patch file not found: {patch_path}"}
        cmd.append(str(patch_path))

    kwargs: dict[str, Any] = {}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    proc = await asyncio.to_thread(subprocess.Popen, cmd, **kwargs)
    logger.info("Launched VCV Rack (PID %s): %s", proc.pid, " ".join(cmd))
    return {
        "success": True,
        "pid": proc.pid,
        "rack_exe": str(settings.RACK_EXE),
        "patch_path": str(patch_path) if patch_path else None,
        "message": f"VCV Rack launched (PID {proc.pid})",
    }


async def stop_rack(force: bool = False) -> dict[str, Any]:
    """Stop running VCV Rack 2 processes."""
    pids = await asyncio.to_thread(_list_rack_pids_sync)
    if not pids:
        return {"success": True, "stopped": 0, "message": "VCV Rack is not running"}

    if os.name == "nt":
        cmd = ["taskkill", "/IM", "Rack.exe", "/T"]
        if force:
            cmd.append("/F")
        proc = await asyncio.to_thread(
            subprocess.run, cmd, capture_output=True, text=True, timeout=10
        )
        if proc.returncode != 0 and not force:
            proc = await asyncio.to_thread(
                subprocess.run,
                ["taskkill", "/IM", "Rack.exe", "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=10,
            )
    else:
        sig = "-9" if force else "-15"
        proc = await asyncio.to_thread(
            subprocess.run, ["pkill", sig, "-x", "Rack"], capture_output=True, text=True, timeout=10
        )

    return {
        "success": True,
        "stopped": len(pids),
        "pids": pids,
        "message": f"Stopped {len(pids)} VCV Rack process(es)",
    }
