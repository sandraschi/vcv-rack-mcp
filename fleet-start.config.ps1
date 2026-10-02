# Per-repo fleet start config for vcv-rack-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'vcv-rack-mcp'
    BackendPort  = 10916
    FrontendPort = 10917
    HealthPath   = '/health'
    WebRoot      = 'webapp'
    Backend = @{
        Kind       = 'module-serve'
        Module     = 'vcv_rack_mcp'
        ServeArgs  = @('--http', '--port', '10916')
        SyncExtras = @('dev')
    }
    Frontend = @{
        Kind           = 'vite-npm'
        PackageManager = 'npm'
        PortEnvVar     = 'VITE_PORT'
        ApiTargetEnv   = 'VITE_API_TARGET'
    }
}
