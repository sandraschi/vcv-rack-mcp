"""SQLite layer for the patch depot — async via aiosqlite."""

import json
from datetime import UTC, datetime
from typing import Any

import aiosqlite

from .config import settings

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS patches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    persona TEXT NOT NULL CHECK(persona IN ('generative','performance','hybrid')),
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    parent_version TEXT,
    modules_json TEXT NOT NULL,
    cables_json TEXT NOT NULL,
    sidecar_md TEXT,
    osc_address_map TEXT,
    validation_status TEXT DEFAULT 'unknown',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sideloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin_slug TEXT NOT NULL,
    source_url TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT 'github',
    installed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agentic_jobs (
    id TEXT PRIMARY KEY,
    brief TEXT NOT NULL,
    persona TEXT,
    iterations INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 3,
    status TEXT DEFAULT 'queued',
    result_patch_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------

async def _get_db() -> aiosqlite.Connection:
    settings.DEPOT_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(settings.DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create tables if they do not exist."""
    db = await _get_db()
    try:
        await db.executescript(_SCHEMA_SQL)
        await db.commit()
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Patches
# ---------------------------------------------------------------------------

async def save_patch(patch_data: dict) -> str:
    """Insert or update a patch record.  Returns the patch id."""
    pid = patch_data["id"]
    db = await _get_db()
    try:
        existing = await db.execute(
            "SELECT id, version FROM patches WHERE id = ?", (pid,)
        )
        row = await existing.fetchone()
        if row:
            new_version = row["version"] + 1
            await db.execute(
                """UPDATE patches SET
                   name=?, slug=?, persona=?, description=?,
                   version=?, parent_version=?, modules_json=?,
                   cables_json=?, sidecar_md=?, osc_address_map=?,
                   validation_status=?, updated_at=?
                   WHERE id=?""",
                (
                    patch_data.get("name"),
                    patch_data.get("slug"),
                    patch_data.get("persona"),
                    patch_data.get("description"),
                    new_version,
                    row["version"],
                    json.dumps(patch_data.get("modules_json", [])),
                    json.dumps(patch_data.get("cables_json", [])),
                    patch_data.get("sidecar_md"),
                    json.dumps(patch_data.get("osc_address_map", {})),
                    patch_data.get("validation_status", "unknown"),
                    _now(),
                    pid,
                ),
            )
        else:
            await db.execute(
                """INSERT INTO patches
                   (id, name, slug, persona, description, version,
                    modules_json, cables_json, sidecar_md,
                    osc_address_map, validation_status)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    pid,
                    patch_data.get("name"),
                    patch_data.get("slug"),
                    patch_data.get("persona"),
                    patch_data.get("description"),
                    patch_data.get("version", 1),
                    json.dumps(patch_data.get("modules_json", [])),
                    json.dumps(patch_data.get("cables_json", [])),
                    patch_data.get("sidecar_md"),
                    json.dumps(patch_data.get("osc_address_map", {})),
                    patch_data.get("validation_status", "unknown"),
                ),
            )
        await db.commit()
        return pid
    finally:
        await db.close()


async def get_patch(patch_id: str) -> dict | None:
    """Fetch a single patch by id.  Returns None when not found."""
    db = await _get_db()
    try:
        cursor = await db.execute("SELECT * FROM patches WHERE id = ?", (patch_id,))
        row = await cursor.fetchone()
        if row is None:
            return None
        return _row_to_patch(row)
    finally:
        await db.close()


async def list_patches(
    persona: str | None = None, limit: int = 50
) -> list[dict]:
    """List patches, optionally filtered by persona tag."""
    db = await _get_db()
    try:
        if persona:
            cursor = await db.execute(
                "SELECT * FROM patches WHERE persona = ? ORDER BY updated_at DESC LIMIT ?",
                (persona, limit),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM patches ORDER BY updated_at DESC LIMIT ?", (limit,)
            )
        rows = await cursor.fetchall()
        return [_row_to_patch(r) for r in rows]
    finally:
        await db.close()


async def delete_patch(patch_id: str) -> bool:
    """Delete a patch by id.  Returns True if a row was removed."""
    db = await _get_db()
    try:
        cursor = await db.execute("DELETE FROM patches WHERE id = ?", (patch_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


def _row_to_patch(row: aiosqlite.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "persona": row["persona"],
        "description": row["description"],
        "version": row["version"],
        "parent_version": row["parent_version"],
        "modules_json": json.loads(row["modules_json"]),
        "cables_json": json.loads(row["cables_json"]),
        "sidecar_md": row["sidecar_md"],
        "osc_address_map": json.loads(row["osc_address_map"]) if row["osc_address_map"] else {},
        "validation_status": row["validation_status"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# ---------------------------------------------------------------------------
# Sideloads
# ---------------------------------------------------------------------------

async def save_sideload(entry: dict) -> int:
    """Log a plugin sideload.  Returns the auto-increment id."""
    db = await _get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO sideloads (plugin_slug, source_url, provenance) VALUES (?,?,?)",
            (entry["plugin_slug"], entry["source_url"], entry.get("provenance", "github")),
        )
        await db.commit()
        return cursor.lastrowid
    finally:
        await db.close()


async def list_sideloads(limit: int = 50) -> list[dict]:
    """List recent sideloads."""
    db = await _get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM sideloads ORDER BY installed_at DESC LIMIT ?", (limit,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Agentic jobs
# ---------------------------------------------------------------------------

async def create_job(brief: str, persona: str | None = None) -> dict:
    """Create a new agentic job.  Returns the full job record."""
    import uuid

    job_id = uuid.uuid4().hex[:12]
    db = await _get_db()
    try:
        await db.execute(
            """INSERT INTO agentic_jobs (id, brief, persona, status)
               VALUES (?,?,?,?)""",
            (job_id, brief, persona, "queued"),
        )
        await db.commit()
        return await get_job(job_id)
    finally:
        await db.close()


async def update_job(job_id: str, **kwargs: Any) -> dict | None:
    """Update job fields (status, iterations, result_patch_id, error)."""
    allowed = {"status", "iterations", "result_patch_id", "error"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return await get_job(job_id)

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [job_id]
    db = await _get_db()
    try:
        await db.execute(
            f"UPDATE agentic_jobs SET {set_clause} WHERE id = ?", values
        )
        await db.commit()
        return await get_job(job_id)
    finally:
        await db.close()


async def get_job(job_id: str) -> dict | None:
    """Fetch a single job by id."""
    db = await _get_db()
    try:
        cursor = await db.execute("SELECT * FROM agentic_jobs WHERE id = ?", (job_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()
