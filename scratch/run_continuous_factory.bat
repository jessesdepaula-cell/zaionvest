@echo off
cd /d "C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest"
:loop
echo =======================================================
echo INICIANDO NOVO CICLO COMPLETO DE MINERACAO - LOTE %1
echo =======================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest'; & .\scripts\robustez\auto_mine.ps1 -Lote %1"
echo Ciclo finalizado para Lote %1. Reiniciando em 30 segundos...
timeout /t 30
goto loop
