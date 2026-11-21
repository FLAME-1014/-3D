@echo off
cd /d "%~dp0"
title Solar Atlas
echo.
echo Solar Atlas - local preview
echo Open http://127.0.0.1:4208/ in Chrome or Edge.
echo Press Ctrl+C to stop.
echo.
node server.mjs
pause
