"""PyInstaller entry point — dual transport for Tauri/HTTP deployment."""
import os, sys
port = os.environ.get("MCP_PORT") or os.environ.get("PORT")
if port:
    host = os.environ.get("MCP_HOST", "127.0.0.1")
    sys.argv = ["run_server.py", "--mode", "http", "--host", host, "--port", str(port)]
from vcv_rack_mcp.server import main
main()
