@echo off
cd /d "%~dp0"
if not exist node_modules\.bin\next.cmd goto install
if not exist node_modules\pdfjs-dist\package.json goto install
if not exist node_modules\pdf-lib\package.json goto install
goto prepare
:install
call npm.cmd install
if errorlevel 1 exit /b 1
:prepare
if not exist public\pdfjs\pdf.worker.min.mjs (
  node scripts\prepare-pdf.mjs
  if errorlevel 1 exit /b 1
)
call npm.cmd run dev
