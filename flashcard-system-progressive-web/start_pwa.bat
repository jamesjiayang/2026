@echo off
echo =======================================================
echo Starting Polyglot Flashcard PWA on http://localhost:3000
echo Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop.
echo =======================================================
python -m http.server 3000
if %ERRORLEVEL% NEQ 0 (
    echo Python not found in PATH, trying py launcher...
    py -m http.server 3000
)
pause
