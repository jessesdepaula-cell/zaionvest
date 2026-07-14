Get-Process terminal64 | Where-Object { $_.Path -like "*4xCube*" } | Stop-Process -Force
Remove-Item -Recurse -Force "C:\Program Files\4xCube MT5 Terminal"
Remove-Item -Recurse -Force "C:\Program Files\4xCube MT5 Terminalsfgw"
Write-Host "4xCube terminal successfully closed and deleted."
Start-Sleep -Seconds 3
