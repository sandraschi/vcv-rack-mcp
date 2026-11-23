"""In-memory ring-buffer logging for /api/logs."""

from __future__ import annotations

import logging
from collections import deque
from datetime import UTC, datetime
from threading import Lock
from typing import Any


class RingLogHandler(logging.Handler):
    """Thread-safe in-memory ring buffer capturing log records."""

    def __init__(self, maxlen: int = 500) -> None:
        super().__init__()
        self._entries: deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._lock = Lock()
        self._seq = 0

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
        except Exception:
            msg = record.getMessage()

        kind = getattr(record, "kind", "system")
        entry = {
            "id": 0,
            "timestamp": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "logger": record.name,
            "kind": kind,
            "message": msg,
        }
        with self._lock:
            self._seq += 1
            entry["id"] = self._seq
            self._entries.append(entry)

    def query(
        self,
        level: str | None = None,
        kind: str | None = None,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        with self._lock:
            items = list(self._entries)
        if level:
            lvl = level.upper()
            items = [i for i in items if i["level"] == lvl]
        if kind:
            k = kind.lower()
            items = [i for i in items if i["kind"].lower() == k]
        return items[-limit:]


ring_handler = RingLogHandler(maxlen=500)
ring_handler.setFormatter(logging.Formatter("%(message)s"))


def setup_logging() -> None:
    """Attach the ring buffer handler to root and vcv_rack_mcp loggers."""
    root = logging.getLogger()
    if ring_handler not in root.handlers:
        root.addHandler(ring_handler)
    if root.level == logging.NOTSET or root.level > logging.INFO:
        root.setLevel(logging.INFO)
