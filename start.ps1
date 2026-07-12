param([switch]$Headless)

$ErrorActionPreference = "Stop"
$Port = 10916

Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Write-Host "Starting vcv-rack-mcp..." -ForegroundColor Cyan
Set-Location $PSScriptRoot
uv run -m vcv_rack_mcp
