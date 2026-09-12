@echo off
rem Wrapper to run start_java_service.ps1 bypassing PowerShell execution policy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_java_service.ps1"
