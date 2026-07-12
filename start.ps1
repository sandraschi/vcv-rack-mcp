param([switch]$Headless, [switch]$BackendOnly, [switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $PSCommandPath
$BackendPort = 10916
$FrontendPort = 10917

# Port zombie clearing
Get-NetTCPConnection -LocalPort $BackendPort -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort $FrontendPort -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

# Start backend via Start-Job
Write-Host "Starting vcv-rack-mcp backend on port $BackendPort..." -ForegroundColor Cyan
$BackendJob = Start-Job -Name "vcv_backend" -ScriptBlock {
    param($Root, $Port)
    Set-Location $Root
    uv run python -m vcv_rack_mcp --http --port $Port
} -ArgumentList $ScriptRoot, $BackendPort

# Readiness poll
Write-Host "Polling backend health endpoint..." -ForegroundColor Gray
$Healthy = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$BackendPort/api/status" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) {
            $Healthy = $true
            break
        }
    } catch {}
    Start-Sleep 1
}

if (-not $Healthy) {
    Write-Error "Backend failed to start or respond on port $BackendPort"
    Receive-Job $BackendJob
    exit 1
}
Write-Host "Backend is healthy!" -ForegroundColor Green

if ($BackendOnly) {
    Write-Host "Running in backend-only mode. Press Ctrl+C to terminate." -ForegroundColor Yellow
    while ($true) { Start-Sleep 2 }
}

# Start frontend
Write-Host "Starting webapp frontend on port $FrontendPort..." -ForegroundColor Cyan
$WebRoot = Join-Path $ScriptRoot "webapp"
$BunPath = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"
if (-not (Test-Path $BunPath)) {
    $BunPath = "bun"
}
$FrontendProcess = Start-Process -NoNewWindow -PassThru -FilePath $BunPath -ArgumentList "x vite --port $FrontendPort --host" -WorkingDirectory $WebRoot

# Auto-open browser
if (-not $NoBrowser) {
    Start-Sleep 1
    Write-Host "Opening dashboard in browser..." -ForegroundColor Gray
    Start-Process "http://127.0.0.1:$FrontendPort"
}

# Keep-alive
Write-Host "VCV Rack MCP Orchestrator running. Press Ctrl+C to stop all services." -ForegroundColor Green
try {
    while ($true) {
        if ($BackendJob.State -eq "Completed" -or $BackendJob.State -eq "Failed") {
            Receive-Job $BackendJob
            break
        }
        Start-Sleep 2
    }
} finally {
    Write-Host "Stopping background jobs and processes..." -ForegroundColor Yellow
    Stop-Job $BackendJob -ErrorAction SilentlyContinue
    Remove-Job $BackendJob -ErrorAction SilentlyContinue
    if ($FrontendProcess) {
        Stop-Process -Id $FrontendProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

