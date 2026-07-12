"""Configuration for vcv-rack-mcp — paths and settings from env vars."""

import os
from dataclasses import dataclass, field
from pathlib import Path


def _repo_root() -> Path:
    """Resolve repo root: <repo>/src/vcv_rack_mcp/config.py -> <repo>."""
    return Path(__file__).resolve().parent.parent.parent


def _default_rack_user_dir() -> Path:
    """RACK_USER_DIR or %LOCALAPPDATA%/Rack2Free."""
    env = os.environ.get("RACK_USER_DIR")
    if env:
        return Path(env)
    return Path(os.environ.get("LOCALAPPDATA", "C:\\Users\\Default\\AppData\\Local")) / "Rack2Free"


@dataclass
class Settings:
    # -- VCV Rack paths --
    RACK_EXE: Path = field(
        default_factory=lambda: Path(
            os.environ.get("RACK_EXE", "C:\\Program Files\\VCV\\Rack2Free\\Rack.exe")
        )
    )
    RACK_USER_DIR: Path = field(default_factory=_default_rack_user_dir)

    # -- Derived paths --
    PLUGINS_DIR: Path = field(init=False)
    DEPOT_DIR: Path = field(init=False)
    CATALOG_PATH: Path = field(init=False)
    DB_PATH: Path = field(init=False)

    # -- Network --
    HOST: str = field(default_factory=lambda: os.environ.get("HOST", "127.0.0.1"))
    PORT: int = field(
        default_factory=lambda: int(os.environ.get("PORT", "10916"))
    )

    # -- External services --
    OSC_MCP_BASE: str = field(
        default_factory=lambda: os.environ.get(
            "OSC_MCP_BASE", "http://127.0.0.1:10767"
        )
    )

    def __post_init__(self):
        root = _repo_root()
        # Avoid shadowing the module-level Path import
        self.PLUGINS_DIR = self.RACK_USER_DIR / "plugins"
        self.DEPOT_DIR = root / "depot"
        self.CATALOG_PATH = root / "catalog" / "modules.yaml"
        self.DB_PATH = self.DEPOT_DIR / "patches.sqlite"


# Module-level singleton for convenience
settings = Settings()
