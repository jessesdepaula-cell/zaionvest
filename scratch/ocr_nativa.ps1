[void][System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime")

[void][Windows.Security.Cryptography.CryptographicBuffer, Windows.Security.Cryptography, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]

function Get-OcrText {
    param([string]$ImagePath)
    
    # 1. Carrega o StorageFile
    $asyncOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)
    $task = [System.Runtime.WindowsRuntimeSystemExtensions]::AsTask($asyncOp)
    $file = $task.GetAwaiter().GetResult()
    
    # 2. Abre a stream
    $asyncOp2 = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $task2 = [System.Runtime.WindowsRuntimeSystemExtensions]::AsTask($asyncOp2)
    $stream = $task2.GetAwaiter().GetResult()
    
    # 3. Cria o decodificador
    $asyncOp3 = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $task3 = [System.Runtime.WindowsRuntimeSystemExtensions]::AsTask($asyncOp3)
    $decoder = $task3.GetAwaiter().GetResult()
    
    # 4. Obtem o SoftwareBitmap
    $asyncOp4 = $decoder.GetSoftwareBitmapAsync()
    $task4 = [System.Runtime.WindowsRuntimeSystemExtensions]::AsTask($asyncOp4)
    $bitmap = $task4.GetAwaiter().GetResult()
    
    # 5. Inicializa o OCR Engine
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        $lang = [Windows.Globalization.Language]::new("pt-BR")
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }
    
    # 6. Faz o OCR
    $asyncOp5 = $engine.RecognizeAsync($bitmap)
    $task5 = [System.Runtime.WindowsRuntimeSystemExtensions]::AsTask($asyncOp5)
    $result = $task5.GetAwaiter().GetResult()
    
    return $result.Text
}

$dir = "C:\Users\Jesse\Desktop\QUANT TRADER\Prints quantminer"
$images = Get-ChildItem -Path $dir -Filter "*.png" | Sort-Object Name
$outFile = "C:\Users\Jesse\Desktop\PROJETOS LOVA\zaionvest\scratch\ocr_results.txt"

# Cria/limpa arquivo
New-Item -Path $outFile -ItemType File -Force | Out-Null

foreach ($img in $images) {
    Write-Host "Processando: $($img.Name)..."
    try {
        $text = Get-OcrText -ImagePath $img.FullName
        Add-Content -Path $outFile -Value "========================================="
        Add-Content -Path $outFile -Value "ARQUIVO: $($img.Name)"
        Add-Content -Path $outFile -Value "========================================="
        Add-Content -Path $outFile -Value $text
        Add-Content -Path $outFile -Value "`n"
    } catch {
        Write-Host "Erro em $($img.Name): $_" -ForegroundColor Red
        Add-Content -Path $outFile -Value "Erro em $($img.Name): $_"
    }
}
Write-Host "Concluido! Resultados salvos em: $outFile"
