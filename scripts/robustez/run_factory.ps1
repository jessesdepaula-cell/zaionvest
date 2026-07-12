# Dispara a Fabrica de Robos ZaionVest em 3 janelas paralelas de PowerShell
# ==============================================================================
# Este script abre 3 processos separados no Windows para minerar diferentes
# lotes de ativos ao mesmo tempo, triplicando a velocidade de geracao de EAs.
#
# Uso:
#   $env:SUPABASE_MGMT_TOKEN="sbp_sua_chave_aqui"
#   $env:SUPABASE_SERVICE_ROLE_KEY="sua_chave_service_role"
#   .\scripts\robustez\run_factory.ps1

$token = $env:SUPABASE_MGMT_TOKEN
$key = $env:SUPABASE_SERVICE_ROLE_KEY

if (-not $token -or -not $key) {
    Write-Host "ERRO: Defina as variaveis de ambiente SUPABASE_MGMT_TOKEN e SUPABASE_SERVICE_ROLE_KEY antes de rodar." -ForegroundColor Red
    Exit 1
}

Write-Host "Disparando a Fabrica de EAs ZaionVest em 3 janelas paralelas..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:SUPABASE_MGMT_TOKEN='$token'; `$env:SUPABASE_SERVICE_ROLE_KEY='$key'; & .\scripts\robustez\auto_mine.ps1 -Lote 1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:SUPABASE_MGMT_TOKEN='$token'; `$env:SUPABASE_SERVICE_ROLE_KEY='$key'; & .\scripts\robustez\auto_mine.ps1 -Lote 2"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:SUPABASE_MGMT_TOKEN='$token'; `$env:SUPABASE_SERVICE_ROLE_KEY='$key'; & .\scripts\robustez\auto_mine.ps1 -Lote 3"

Write-Host "3 janelas paralelas iniciadas com sucesso no seu Desktop!" -ForegroundColor Green
Write-Host "Você verá três telas pretas rodando a evolução genética concorrente. Deixe-as trabalhar juntas!" -ForegroundColor Green
