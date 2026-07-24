@echo off
REM ===================================================================
REM  MINERAR MINI ÍNDICE BOVESPA (B3) - ZaionVest / XP Investimentos
REM ===================================================================

cd /d "%~dp0"
title ZaionVest - Minerando Mini Indice Bovespa (nao feche)

set MT5_TERMINAL_PATH=C:\Program Files\MetaTrader 5 Terminal\terminal64.exe

if exist _STOP_MINING del _STOP_MINING

set TENTATIVA=0

:loop
if exist _STOP_MINING goto fim

set /a TENTATIVA+=1
echo.
echo ===================================================================
echo  [%date% %time%] Iniciando minerador Mini Indice WIN$ (tentativa %TENTATIVA%)
echo ===================================================================

"%~dp0.venv-numba\Scripts\python.exe" mine_overnight.py ^
    --symbols WIN$ ^
    --timeframes H1,H2,H4 ^
    --years 3 ^
    --pop 80 ^
    --gen 20 ^
    --keep 6 ^
    --seed0 %RANDOM%%RANDOM% ^
    --autopublish ^
    --out survivors_bovespa.json >> _bovespa.log 2>&1

if exist _STOP_MINING goto fim

echo [%date% %time%] O minerador parou (codigo %ERRORLEVEL%). Religando em 5s...
echo [%date% %time%] MINERADOR CAIU - religando (tentativa %TENTATIVA%) >> _bovespa.log
timeout /t 5 /nobreak >nul
goto loop

:fim
echo.
echo ===================================================================
echo  Mineracao de Mini Indice encerrada.
echo ===================================================================
if exist _STOP_MINING del _STOP_MINING
pause
