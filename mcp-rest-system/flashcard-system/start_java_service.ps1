# Start Java Spring Boot Data Service
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir\java-data-service"

Write-Host "Starting Flashcard Java Data Service on port 8080..." -ForegroundColor Cyan
mvn spring-boot:run
