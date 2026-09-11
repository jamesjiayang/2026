# Run all tests (Java Maven unit tests + Python End-to-End integration tests)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[1/2] Running Java Unit & Service Tests..." -ForegroundColor Cyan
mvn -f "$ScriptDir\java-data-service\pom.xml" test
if ($LASTEXITCODE -ne 0) {
    Write-Host "Java tests failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/2] Running Python End-to-End Integration Tests..." -ForegroundColor Cyan
$VenvPython = "$ScriptDir\python-client\venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    $VenvPython = "python"
}

# Check if Java service is running; if not, we can test it with the service started
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/deck" -TimeoutSec 2 -ErrorAction Stop
    $isRunning = $true
} catch {
    $isRunning = $false
}

if ($isRunning) {
    Set-Location "$ScriptDir\python-client"
    & $VenvPython app\test_e2e.py
} else {
    Write-Host "Java service is not currently running on port 8080." -ForegroundColor Yellow
    Write-Host "Start it with .\start_java_service.ps1 and then run .\python-client\venv\Scripts\python.exe app\test_e2e.py" -ForegroundColor Yellow
}
