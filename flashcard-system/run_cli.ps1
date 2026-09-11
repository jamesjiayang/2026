# Run Python Flashcard Presentation Layer CLI
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = "$ScriptDir\python-client\venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "Virtual environment not found, falling back to system python..." -ForegroundColor Yellow
    $VenvPython = "python"
}

Set-Location "$ScriptDir\python-client"
& $VenvPython app\cli.py
