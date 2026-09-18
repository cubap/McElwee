param([string]$Dir, [string]$OutFile, [string]$Filter = '*.png')

[void][Windows.Foundation.IAsyncOperation`1, Windows.Foundation, ContentType=WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]
[void][Windows.Storage.FileAccessMode, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]
[void][Windows.Globalization.Language, Windows.Foundation.UniversalApiContract, ContentType=WindowsRuntime]

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } |
    Select-Object -First 1
function Await($op, [type]$t) { $asTask.MakeGenericMethod($t).Invoke($null, @($op)).GetAwaiter().GetResult() }

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]"en-US")
if (-not $engine) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() }

$all = @()
foreach ($f in (Get-ChildItem -LiteralPath $Dir -Filter $Filter | Sort-Object Name)) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($f.FullName)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $sb = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $res = Await ($engine.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])

  $lines = @()
  foreach ($l in $res.Lines) {
    $ws = @()
    foreach ($w in $l.Words) {
      $r = $w.BoundingRect
      $ws += [pscustomobject]@{ t = $w.Text; x = [math]::Round($r.X,1); y = [math]::Round($r.Y,1); w = [math]::Round($r.Width,1); h = [math]::Round($r.Height,1) }
    }
    $lines += [pscustomobject]@{ text = $l.Text; words = $ws }
  }
  $all += [pscustomobject]@{ page = $f.BaseName; width = $sb.PixelWidth; height = $sb.PixelHeight; lines = $lines }
  Write-Output ("{0}  lines={1}" -f $f.BaseName, $lines.Count)
}

ConvertTo-Json -InputObject $all -Depth 6 -Compress | Out-File -Encoding UTF8 $OutFile
Write-Output "wrote $OutFile"
