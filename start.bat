@echo off
rem Start the OpenSpec Local Viewer dev server and open it in the browser.
rem Run from the project folder (or double-click). Requires Node.js on PATH
rem (npx ships with it) or Python.

cd /d "%~dp0"

echo Starting server at http://127.0.0.1:8743/
echo Close the "OpenSpec Viewer" window, or press Ctrl+C there, to stop it.
echo.

rem Keep the server in its own window so you can stop it later.
start "OpenSpec Viewer" cmd /k "npx http-server . -p 8743 --cors"

rem Give the server a moment to bind, then open the page.
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8743/"
