# Start Sean as the local agent for the web site (Sean Local + Web, docs/development/d05-local-web-deployment-decision-record.md).
#
#     powershell -ExecutionPolicy Bypass -File scripts\start_agent.ps1 -AllowedOrigin https://<your-site>.netlify.app
#
# Unlike scripts\start_backend.ps1 (development, with a temporary test registry), the agent uses your real registry in
# %LOCALAPPDATA%\Sean. It listens on 127.0.0.1:8000 only. Browser requests are accepted only from the exact site origin
# (SEAN_ALLOWED_ORIGINS), which must pair first: the pairing code appears in this window. Loopback browser origins are refused
# (SEAN_LOOPBACK_ORIGINS=none). The optional Groq key and GitHub token are read from .kiro\.env by the application and are
# never printed. The origin may also be set as SEAN_ALLOWED_ORIGINS in .kiro\.env instead of -AllowedOrigin.
#
# An origin is scheme and host only, for example https://example.netlify.app: no path, no trailing slash. Several origins are
# separated by commas. A malformed origin stops the script before the agent starts.
#
# The two variables are set only while the agent runs, and restored afterwards, so a development backend started later from
# the same shell is not affected. To revoke every pairing, stop the agent (Ctrl+C or close this window) and start it again.
param(
    [string]$AllowedOrigin = ""
)

$root = Split-Path -Parent $PSScriptRoot

# The same rule as backend/app/api/local_guard.py (_WEB_ORIGIN), limited to HTTPS: a deployed site is always HTTPS.
$originPattern = '^https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$'

function Test-Origins([string]$value, [string]$source) {
    $entries = @($value.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
    if ($entries.Count -eq 0) {
        return $null
    }
    $normalized = @()
    foreach ($entry in $entries) {
        $lower = $entry.ToLowerInvariant()
        if ($lower -notmatch $originPattern) {
            $hint = "Use the exact site origin, for example https://example.netlify.app"
            if ($lower -match '^https?://[^/]+/') {
                $hint = "Remove the path or the trailing slash: an origin is only https:// and the host name"
            } elseif ($lower -match '^http://') {
                $hint = "The site origin must use https://"
            }
            Write-Host "Invalid origin in ${source}: '$entry'. $hint." -ForegroundColor Red
            exit 1
        }
        $normalized += $lower
    }
    return ($normalized -join ",")
}

# Where the origin comes from: the parameter, else this shell's environment, else .kiro\.env (only that one name is read).
$origins = $null
if ($AllowedOrigin) {
    $origins = Test-Origins $AllowedOrigin "-AllowedOrigin"
} elseif ($env:SEAN_ALLOWED_ORIGINS) {
    $origins = Test-Origins $env:SEAN_ALLOWED_ORIGINS "the SEAN_ALLOWED_ORIGINS environment variable"
} else {
    $envFile = Join-Path $root ".kiro\.env"
    if (Test-Path -LiteralPath $envFile) {
        $line = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^\s*SEAN_ALLOWED_ORIGINS\s*=' } | Select-Object -First 1
        if ($line) {
            $value = ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
            $origins = Test-Origins $value "SEAN_ALLOWED_ORIGINS in .kiro\.env"
        }
    }
}
if (-not $origins) {
    Write-Host "No site origin given. Pass -AllowedOrigin https://<your-site>.netlify.app, or set SEAN_ALLOWED_ORIGINS in .kiro\.env." -ForegroundColor Red
    Write-Host "Without it, no web page can use this agent."
    exit 1
}

$previousAllowed = $env:SEAN_ALLOWED_ORIGINS
$previousLoopback = $env:SEAN_LOOPBACK_ORIGINS
$env:SEAN_ALLOWED_ORIGINS = $origins
$env:SEAN_LOOPBACK_ORIGINS = "none"
Write-Host "Sean agent on http://127.0.0.1:8000 for $origins"
Write-Host "Pairing codes appear in this window. Press Ctrl+C to stop (this revokes every pairing)."
Push-Location -LiteralPath (Join-Path $root "backend")
try {
    & .\.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
    $env:SEAN_ALLOWED_ORIGINS = $previousAllowed
    $env:SEAN_LOOPBACK_ORIGINS = $previousLoopback
}
