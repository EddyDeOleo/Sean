# Start the Sean backend. The optional Groq key is loaded by the application itself (app/core/env.py), from .kiro\.env,
# so this script and a direct uvicorn start read the same configuration. The key is never printed.
#     powershell -ExecutionPolicy Bypass -File scripts\start_backend.ps1

$root = Split-Path -Parent $PSScriptRoot
# Registry used by the running Sean setup (see .kiro\reports\phase-status.md): a local-data folder under the user's temp
# directory, so Sean's real %LOCALAPPDATA%\Sean is left untouched.
$env:LOCALAPPDATA = Join-Path $env:TEMP "sean-i6-runtime\localappdata"

Set-Location -LiteralPath (Join-Path $root "backend")
& .\.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000
