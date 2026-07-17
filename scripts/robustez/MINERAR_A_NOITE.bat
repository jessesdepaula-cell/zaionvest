@echo off
REM ===================================================================
REM  MINERAR A NOITE TODA - ZaionVest
REM ===================================================================
REM  Da dois cliques neste arquivo e deixa a janela aberta minimizada.
REM  Ele minera USDJPY sem parar e SE RELEVANTA sozinho se o Python
REM  morrer (MT5 caiu, erro solto, etc).
REM
REM  PARA PARAR: cria um arquivo vazio chamado _STOP_MINING nesta pasta,
REM  ou simplesmente fecha esta janela.
REM
REM  NAO consome credito nenhum do Claude - e Python puro na sua maquina.
REM ===================================================================

cd /d "%~dp0"
title ZaionVest - Minerando USDJPY (nao feche para continuar)

if exist _STOP_MINING del _STOP_MINING

set TENTATIVA=0

:loop
if exist _STOP_MINING goto fim

set /a TENTATIVA+=1
echo.
echo ===================================================================
echo  [%date% %time%] Iniciando minerador (tentativa %TENTATIVA%)
echo ===================================================================

REM %RANDOM% da uma semente nova a cada religada, entao mesmo apos uma
REM queda ele nao repete a mesma busca. O proprio script tambem troca de
REM semente a cada rodada interna.
python mine_overnight.py ^
    --symbols USDJPY ^
    --timeframes H1,H4 ^
    --years 4 ^
    --pop 70 ^
    --gen 20 ^
    --keep 6 ^
    --seed0 %RANDOM%%RANDOM% ^
    --out survivors_usdjpy_overnight.json >> _noite.log 2>&1

if exist _STOP_MINING goto fim

echo [%date% %time%] O minerador parou (codigo %ERRORLEVEL%). Religando em 30s...
echo [%date% %time%] MINERADOR CAIU - religando (tentativa %TENTATIVA%) >> _noite.log
timeout /t 30 /nobreak >nul
goto loop

:fim
echo.
echo ===================================================================
echo  Mineracao encerrada. Resultados:
echo    survivors_usdjpy_overnight.json       (as estrategias)
echo    survivors_usdjpy_overnight_meta.json  (quantas rodadas)
echo    _noite.log                            (o log)
echo ===================================================================
if exist _STOP_MINING del _STOP_MINING
pause
