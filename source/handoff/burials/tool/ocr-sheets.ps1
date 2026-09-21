<#
    Runs Windows OCR over the rendered reading sheets and writes sheet-ocr.json, which
    make-lines.mjs turns into the validator's reference corpus.

    powershell -File source/handoff/burials/tool/ocr-sheets.ps1

    The sheets are copied to a temporary directory first because the shared OCR driver
    writes sidecars next to its input; the bundle should not accumulate them.
#>
param(
    [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'
$bundle = Split-Path $PSScriptRoot -Parent
$repo = Resolve-Path (Join-Path $bundle '..\..\..')
if (-not $OutFile) { $OutFile = Join-Path $bundle 'sheet-ocr.json' }

$src = Join-Path $bundle 'sheets'
if (-not (Test-Path (Join-Path $src 'sheets.json'))) {
    throw 'No sheets to read. Run tool/sheets.ps1 first.'
}

$d = Join-Path $env:TEMP 'burials-sheet-ocr'
if (Test-Path $d) { Remove-Item -Recurse -Force $d }
New-Item -ItemType Directory -Force $d | Out-Null
Copy-Item (Join-Path $src '*.png') $d

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'source\burials-index\tool\ocr.ps1') -Dir $d -OutFile $OutFile
Remove-Item -Recurse -Force $d
Write-Host "sheet-ocr.json written to $OutFile"
