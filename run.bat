@echo off
cd /d "%~dp0"
where bun >nul 2>nul && (bun install && bun run dev) || (npm install && npm run dev)
pause
