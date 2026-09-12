@echo off
rem Wrapper to run test_system.ps1 bypassing PowerShell execution policy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test_system.ps1"
