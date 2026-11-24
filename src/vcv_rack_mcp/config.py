"""Configuration for vcv-rack-mcp - paths and settings from env vars."""

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path


def _repo_root() -> Path:
    """Resolve repo root: <repo>/src/vcv_rack_mcp/config.py -> <repo>."""
    return Path(__file__).resolve().parent.parent.parent


def _detect_rack_exe() -> Path:
    """Resolve RACK_EXE from env or probe standard VCV Rack 2 install locations."""
    env = os.environ.get("RACK_EXE")
    if env:
        return Path(env)

    candidates = [
        Path(r"C:\Program Files\VCV\Rack2Free\Rack.exe"),
        Path(r"C:\Program Files\VCV\Rack2Pro\Rack.exe"),
        Path(r"C:\Program Files\VCV\Rack2\Rack.exe"),
        Path(r"C:\Program Files (x86)\VCV\Rack2Free\Rack.exe"),
        Path(r"D:\Program Files\VCV\Rack2Free\Rack.exe"),
        Path(r"D:\Program Files\VCV\Rack2Pro\Rack.exe"),
        Path("/Applications/VCV Rack 2 Free.app/Contents/MacOS/Rack"),
        Path("/Applications/VCV Rack 2 Pro.app/Contents/MacOS/Rack"),
        Path("/usr/local/bin/Rack"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    which_rack = shutil.which("Rack") or shutil.which("Rack.exe")
    if which_rack:
        return Path(which_rack)

    return candidates[0]


def _detect_rack_user_dir() -> Path:
    """Resolve RACK_USER_DIR from env or probe standard VCV Rack 2 user folders."""
    env = os.environ.get("RACK_USER_DIR")
    if env:
        return Path(env)

    local_app = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    candidates = [
        local_app / "Rack2",
        local_app / "Rack2Free",
        local_app / "Rack2Pro",
        Path.home() / "Documents" / "Rack2",
        Path.home() / ".Rack2",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate

    return local_app / "Rack2"


def _detect_plugins_dir(user_dir: Path) -> Path:
    """Resolve VCV Rack 2 plugins directory inside RACK_USER_DIR."""
    candidates = [
        user_dir / "plugins-win-x64",
        user_dir / "plugins-lin-x64",
        user_dir / "plugins-mac-arm64",
        user_dir / "plugins-mac-x64",
        user_dir / "plugins",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    if os.name == "nt":
        return user_dir / "plugins-win-x64"
    return user_dir / "plugins"


@dataclass
class Settings:
    # -- VCV Rack paths --
    RACK_EXE: Path = field(default_factory=_detect_rack_exe)
    RACK_USER_DIR: Path = field(default_factory=_detect_rack_user_dir)

    # -- Derived paths --
    PLUGINS_DIR: Path = field(init=False)
    DEPOT_DIR: Path = field(init=False)
    CATALOG_PATH: Path = field(init=False)
    DB_PATH: Path = field(init=False)
    SKILLS_DIR: Path = field(init=False)

    # -- Network --
    HOST: str = field(default_factory=lambda: os.environ.get("HOST", "127.0.0.1"))
    PORT: int = field(default_factory=lambda: int(os.environ.get("PORT", "10916")))

    # -- External services --
    OSC_MCP_BASE: str = field(
        default_factory=lambda: os.environ.get("OSC_MCP_BASE", "http://127.0.0.1:10767")
    )
    BRIDGE_URL: str = field(
        default_factory=lambda: os.environ.get("VCV_BRIDGE_URL", "http://127.0.0.1:11265")
    )
    VLLM_PORT: int = field(default_factory=lambda: int(os.environ.get("VLLM_PORT", "8000")))

    def __post_init__(self):
        root = _repo_root()
        self.PLUGINS_DIR = _detect_plugins_dir(self.RACK_USER_DIR)
        self.DEPOT_DIR = root / "depot"
        self.CATALOG_PATH = root / "catalog" / "modules.yaml"
        self.DB_PATH = self.DEPOT_DIR / "patches.sqlite"
        self.SKILLS_DIR = root / "skills"

    def update_rack_paths(
        self, rack_exe: str | None = None, rack_user_dir: str | None = None
    ) -> None:
        if rack_exe is not None and rack_exe.strip():
            self.RACK_EXE = Path(rack_exe.strip())
        if rack_user_dir is not None and rack_user_dir.strip():
            self.RACK_USER_DIR = Path(rack_user_dir.strip())
            self.PLUGINS_DIR = _detect_plugins_dir(self.RACK_USER_DIR)


# Module-level singleton for convenience
settings = Settings()
