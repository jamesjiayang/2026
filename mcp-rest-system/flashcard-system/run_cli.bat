@echo off
rem Wrapper to run run_cli.ps1 bypassing PowerShell execution policy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_cli.ps1"
