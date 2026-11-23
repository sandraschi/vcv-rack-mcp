"""Local LLM discovery and chat proxy (Ollama, LM Studio, vLLM)."""

from __future__ import annotations

import asyncio
import logging
import subprocess
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger(__name__)

PROBE_TIMEOUT = 3.0
CHAT_TIMEOUT = 120.0

PROVIDER_BASES = {
    "ollama": "http://127.0.0.1:11434",
    "lmstudio": "http://127.0.0.1:1234",
}


def _gpu_vram_sync() -> list[dict[str, Any]]:
    try:
        proc = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,name,memory.total,memory.used,memory.free",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode != 0:
            return []
        gpus: list[dict[str, Any]] = []
        for line in proc.stdout.splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 5:
                continue
            try:
                gpus.append(
                    {
                        "index": int(parts[0]),
                        "name": ",".join(parts[1:-3]).strip(),
                        "total_mb": int(parts[-3]),
                        "used_mb": int(parts[-2]),
                        "free_mb": int(parts[-1]),
                    }
                )
            except ValueError:
                continue
        return gpus
    except Exception:
        return []


async def get_gpus() -> list[dict[str, Any]]:
    return await asyncio.to_thread(_gpu_vram_sync)


async def _probe_ollama(client: httpx.AsyncClient) -> dict[str, Any]:
    base = PROVIDER_BASES["ollama"]
    try:
        res = await client.get(f"{base}/api/tags")
        if res.status_code == 200:
            models = [m["name"] for m in res.json().get("models", []) if m.get("name")]
            return {
                "id": "ollama",
                "name": "Ollama",
                "port": 11434,
                "url": base,
                "available": True,
                "models": models,
            }
    except Exception as exc:
        logger.debug("Ollama probe failed: %s", exc)
    return {"id": "ollama", "name": "Ollama", "port": 11434, "url": base, "available": False, "models": []}


async def _probe_openai_compat(
    client: httpx.AsyncClient, pid: str, name: str, port: int
) -> dict[str, Any]:
    base = f"http://127.0.0.1:{port}"
    try:
        res = await client.get(f"{base}/v1/models")
        if res.status_code == 200:
            models = [m["id"] for m in res.json().get("data", []) if m.get("id")]
            return {
                "id": pid,
                "name": name,
                "port": port,
                "url": base,
                "available": True,
                "models": models,
            }
    except Exception as exc:
        logger.debug("%s probe failed: %s", name, exc)
    return {"id": pid, "name": name, "port": port, "url": base, "available": False, "models": []}


async def probe_providers() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=PROBE_TIMEOUT) as client:
        results = await asyncio.gather(
            _probe_ollama(client),
            _probe_openai_compat(client, "lmstudio", "LM Studio", 1234),
            _probe_openai_compat(client, "vllm", "vLLM", settings.VLLM_PORT),
        )
    return list(results)


async def list_models(provider: str) -> list[str]:
    providers = await probe_providers()
    for p in providers:
        if p["id"] == provider and p["available"]:
            return p["models"]
    return []


async def chat_completion(
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    temperature: float = 0.7,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=CHAT_TIMEOUT) as client:
        if provider == "ollama":
            res = await client.post(
                f"{PROVIDER_BASES['ollama']}/api/chat",
                json={
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            res.raise_for_status()
            data = res.json()
            return {
                "success": True,
                "provider": provider,
                "model": model,
                "reply": data.get("message", {}).get("content", ""),
            }

        port = 1234 if provider == "lmstudio" else settings.VLLM_PORT
        res = await client.post(
            f"http://127.0.0.1:{port}/v1/chat/completions",
            json={"model": model, "messages": messages, "temperature": temperature},
        )
        res.raise_for_status()
        data = res.json()
        choices = data.get("choices") or []
        reply = choices[0]["message"]["content"] if choices else ""
        return {"success": True, "provider": provider, "model": model, "reply": reply}
