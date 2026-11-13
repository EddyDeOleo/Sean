# Start the Sean backend with the optional Gemini key (Spec 4 section 8).
#
# The key is read from SEAN_GEMINI_API_KEY in the current environment, or from the line of that name in .kiro\.env.
# It is passed only to this backend process and is never printed. Run from anywhere:
#     powershell -ExecutionPolicy Bypass -File scripts\start_backend.ps1

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".kiro\.env"

if (-not $env:SEAN_GEMINI_API_KEY -and (Test-Path -LiteralPath $envFile)) {
    foreach ($line in Get-Content -LiteralPath $envFile) {
        if ($line -match '^\s*SEAN_GEMINI_API_KEY\s*=\s*(.+?)\s*$') {
            $env:SEAN_GEMINI_API_KEY = $Matches[1].Trim('"').Trim("'")
            break
        }
    }
}

if ($env:SEAN_GEMINI_API_KEY) {
    Write-Host "Gemini interpreter: key present (value not shown)."
} else {
    Write-Host "Gemini interpreter: no key found. Deterministic reading only."
}

# Registry used by the running Sean setup (see .kiro\reports\phase-status.md).
$env:LOCALAPPDATA = "C:\Users\User\AppData\Local\Temp\sean-i6-runtime\localappdata"

Set-Location -LiteralPath (Join-Path $root "backend")
& .\.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000
