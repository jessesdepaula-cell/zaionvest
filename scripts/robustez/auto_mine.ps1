# Estacao de Mineracao Genetica em Massa ZaionVest (Fabrica de Robos)
# =========================================================================
# Este script automatiza o pipeline completo de ponta a ponta para minerar,
# validar, compilar e publicar centenas de estrategias na vitrine da ZaionVest
# de forma 100% autonoma na sua maquina.
#
# Uso: 
#   $env:SUPABASE_MGMT_TOKEN="sbp_sua_chave_aqui"
#   $env:SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role"
#   .\scripts\robustez\auto_mine.ps1

Write-Host "Fabrica de EAs ZaionVest..." -ForegroundColor Cyan

# Lista de ativos principais para mineracao profunda
$Ativos = @(
    "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", 
    "AUDUSD", "EURAUD", "GBPJPY", "EURJPY", 
    "USDCAD", "NZDUSD", "AUDJPY"
)

# Timeframes estaveis recomendados
$Timeframes = @("H1", "H4", "M30")

$TotalPublicado = 0

foreach ($Ativo in $Ativos) {
    foreach ($Tf in $Timeframes) {
        Write-Host "Iniciando mineracao para $Ativo no grafico $Tf..." -ForegroundColor Yellow
        
        $OutFile = "scripts/robustez/survivors_temp_$($Ativo)_$($Tf).json"
        
        # 1. Roda a evolucao genetica com holdout OOS
        & python scripts/robustez/genetic.py --symbols $Ativo --timeframes $Tf --pop 80 --gen 30 --keep 12 --out $OutFile
        
        if (Test-Path $OutFile) {
            Write-Host "Sobreviventes gerados. Iniciando compilacao e upload..." -ForegroundColor Green
            
            # 2. Compila os EAs, faz upload dos binarios (.ex5) para o Storage e gera o JSON do banco
            & python scripts/robustez/publish.py --survivors $OutFile
            
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
