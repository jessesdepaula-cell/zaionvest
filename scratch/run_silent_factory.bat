@echo off
cd /d "C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest"
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest'; & .\scripts\robustez\auto_mine.ps1 -Lote 1 -Loop > scripts\robustez\lote1.log"
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest'; & .\scripts\robustez\auto_mine.ps1 -Lote 2 -Loop > scripts\robustez\lote2.log"
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest'; & .\scripts\robustez\auto_mine.ps1 -Lote 3 -Loop > scripts\robustez\lote3.log"
echo Continuous native loop started successfully.
