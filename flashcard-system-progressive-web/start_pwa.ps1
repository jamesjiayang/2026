Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "Starting Polyglot Flashcard PWA on http://localhost:3000" -ForegroundColor Green
Write-Host "Open http://localhost:3000 in your browser." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Cyan

try {
    python -m http.server 3000
} catch {
    Write-Host "Falling back to py launcher..." -ForegroundColor Yellow
    py -m http.server 3000
}
