param(
    [int]$Lote = 0
)

# Estacao de Mineracao Genetica em Massa ZaionVest (Fabrica de Robos)
# =========================================================================
# Este script automatiza o pipeline completo de ponta a ponta para minerar,
# validar, compilar e publicar centenas de estrategias na vitrine da ZaionVest
# de forma 100% autonoma na sua maquina.

Write-Host "Fabrica de EAs ZaionVest..." -ForegroundColor Cyan

# Lista de ativos principais dividida por lote para execucao paralela
if ($Lote -eq 1) {
    $Ativos = @("XAUUSD", "EURUSD", "GBPUSD", "USDJPY")
    Write-Host "Iniciando Lote 1 (Ativos Principais): $($Ativos -join ', ')" -ForegroundColor Cyan
} elseif ($Lote -eq 2) {
    $Ativos = @("AUDUSD", "EURAUD", "GBPJPY", "EURJPY")
    Write-Host "Iniciando Lote 2 (Ativos Cruzados): $($Ativos -join ', ')" -ForegroundColor Cyan
} elseif ($Lote -eq 3) {
    $Ativos = @("USDCAD", "NZDUSD", "AUDJPY")
    Write-Host "Iniciando Lote 3 (Ativos de Carry/Reserva): $($Ativos -join ', ')" -ForegroundColor Cyan
} else {
    $Ativos = @(
        "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", 
        "AUDUSD", "EURAUD", "GBPJPY", "EURJPY", 
        "USDCAD", "NZDUSD", "AUDJPY"
    )
    Write-Host "Iniciando Lote Completo (Todos os ativos): $($Ativos -join ', ')" -ForegroundColor Cyan
}

# Timeframes estaveis recomendados
$Timeframes = @("H1", "H4", "M30")

foreach ($Ativo in $Ativos) {
    foreach ($Tf in $Timeframes) {
        Write-Host "Iniciando mineracao para $Ativo no grafico $Tf..." -ForegroundColor Yellow
        
        $OutFile = "scripts/robustez/survivors_temp_$($Ativo)_$($Tf).json"
        
        # Determina o executável do Python (usa o venv-numba se existir)
        $PythonExe = "python"
        if (Test-Path "scripts/robustez/.venv-numba/Scripts/python.exe") {
            $PythonExe = "scripts/robustez/.venv-numba/Scripts/python.exe"
        }
        
        # 1. Roda a evolucao genetica com holdout OOS
        & $PythonExe scripts/robustez/genetic.py --symbols $Ativo --timeframes $Tf --pop 80 --gen 30 --keep 12 --out $OutFile
        
        if (Test-Path $OutFile) {
            Write-Host "Sobreviventes gerados. Iniciando compilacao e upload..." -ForegroundColor Green
            
            # 2. Compila os EAs, faz upload dos binarios (.ex5) para o Storage e gera o JSON do banco
            & $PythonExe scripts/robustez/publish.py --survivors $OutFile
            
            # 3. Insere de forma consistente no banco de dados Supabase via Prisma ORM
            & npx tsx scripts/robustez/publish_db.ts
            
            # Limpa o arquivo temporario de sobreviventes
            Remove-Item $OutFile -ErrorAction SilentlyContinue
            
            Write-Host "Ciclo concluido para $Ativo $Tf!" -ForegroundColor Green
        } else {
            Write-Host "Nenhum sobrevivente robusto passou pelo holdout OOS para $Ativo $Tf." -ForegroundColor Gray
        }
    }
}

Write-Host "Mineracao em massa finalizada com sucesso! Verifique a vitrine em producao." -ForegroundColor Cyan
